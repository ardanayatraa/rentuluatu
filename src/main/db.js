import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import initSqlJs from 'sql.js'

let db
let dbPath
let sqlModule
let saveTimer = null
let isDirty = false
const SAVE_DEBOUNCE_MS = 250

// ─────────────────────────────────────────────────────────────────────────────
// Versi schema — naikkan angka ini setiap kali ada perubahan struktur database.
// Sistem akan otomatis jalankan migrasi yang belum pernah dijalankan.
// ─────────────────────────────────────────────────────────────────────────────
const SCHEMA_VERSION = 17

export async function initDb() {
  const wasmPath = join(
    app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
      : join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
  )
  sqlModule = await initSqlJs({ locateFile: () => wasmPath })
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  dbPath = join(userDataPath, 'wavy.db')

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new sqlModule.Database(fileBuffer)
  } else {
    db = new sqlModule.Database()
  }

  createBaseSchema()
  ensureRequiredColumns()
  runMigrations()
  ensureRequiredColumns()
  createBaseIndexes()
  seedDefaults()
  forceSaveDb()
  return db
}

export function getDb() {
  if (!db) throw new Error('Database belum diinisialisasi')
  return db
}

function persistDbNow() {
  if (db && dbPath) {
    const data = db.export()
    writeFileSync(dbPath, Buffer.from(data))
    isDirty = false
  }
}

export function saveDb() {
  if (!db || !dbPath) return
  isDirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (isDirty) persistDbNow()
  }, SAVE_DEBOUNCE_MS)
}

export function forceSaveDb() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (isDirty || (db && dbPath)) {
    persistDbNow()
  }
}

function run(sql, params = []) {
  db.run(sql, params)
  saveDb()
}

// runRaw: jalankan query tanpa langsung saveDb — dipakai saat butuh last_insert_rowid()
function runRaw(sql, params = []) {
  db.run(sql, params)
}

function get(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  const rows = []
  stmt.bind(params)
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

export function reloadDbFromBuffer(buffer) {
  if (!sqlModule) throw new Error('Database engine belum siap')
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  isDirty = false

  try {
    db?.close?.()
  } catch {
    // ignore
  }

  db = buffer ? new sqlModule.Database(buffer) : new sqlModule.Database()
  createBaseSchema()
  ensureRequiredColumns()
  runMigrations()
  ensureRequiredColumns()
  createBaseIndexes()
  seedDefaults()
  forceSaveDb()
}

function hasTableColumn(tableName, columnName) {
  try {
    const rows = all(`PRAGMA table_info(${tableName})`) || []
    return rows.some((row) => String(row.name || '').toLowerCase() === String(columnName || '').toLowerCase())
  } catch (_) {
    return false
  }
}

function ensureRequiredColumns() {
  try {
    if (!hasTableColumn('cash_accounts', 'bucket')) {
      db.run("ALTER TABLE cash_accounts ADD COLUMN bucket TEXT DEFAULT 'pendapatan'")
      db.run("UPDATE cash_accounts SET bucket = 'pendapatan' WHERE bucket IS NULL OR TRIM(bucket) = ''")
    }
  } catch (_) {}

  try {
    if (!hasTableColumn('expenses', 'cash_bucket')) {
      db.run("ALTER TABLE expenses ADD COLUMN cash_bucket TEXT DEFAULT 'pendapatan'")
      db.run("UPDATE expenses SET cash_bucket = 'pendapatan' WHERE cash_bucket IS NULL OR TRIM(cash_bucket) = ''")
    }
  } catch (_) {}
}

export const dbOps = { run, runRaw, get, all }

// ─────────────────────────────────────────────────────────────────────────────
// BASE SCHEMA — hanya CREATE TABLE IF NOT EXISTS, tidak ada ALTER di sini.
// Ini adalah definisi tabel lengkap (versi terbaru).
// Untuk install baru, semua tabel langsung terbentuk sempurna.
// ─────────────────────────────────────────────────────────────────────────────
function createBaseSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      bank_account TEXT,
      bank_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS motors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      plate_number TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      owner_id INTEGER REFERENCES owners(id),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS cash_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      bucket TEXT NOT NULL DEFAULT 'pendapatan',
      balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS hotel_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id),
      amount REAL NOT NULL,
      cash_account_id INTEGER NOT NULL REFERENCES cash_accounts(id),
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_time TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      hotel TEXT,
      hotel_id INTEGER REFERENCES hotels(id),
      hotel_payout_id INTEGER REFERENCES hotel_payouts(id),
      motor_id INTEGER NOT NULL REFERENCES motors(id),
      period_days INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      total_price REAL NOT NULL,
      price_per_day REAL,
      vendor_fee REAL DEFAULT 0,
      sisa REAL,
      wavy_gets REAL,
      owner_gets REAL,
      status TEXT DEFAULT 'completed',
      payout_id INTEGER,
      invoice_number TEXT,
      is_extension INTEGER DEFAULT 0,
      relation_type TEXT DEFAULT 'rental',
      parent_rental_id INTEGER REFERENCES rentals(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS rental_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_rental_id INTEGER NOT NULL REFERENCES rentals(id),
      replacement_rental_id INTEGER NOT NULL REFERENCES rentals(id),
      switch_date_time TEXT NOT NULL,
      used_days INTEGER NOT NULL,
      remaining_days INTEGER NOT NULL,
      original_price_per_day REAL NOT NULL,
      original_remaining_credit REAL NOT NULL,
      replacement_price_per_day REAL NOT NULL,
      replacement_total_price REAL NOT NULL,
      settlement_type TEXT NOT NULL,
      settlement_amount REAL NOT NULL,
      settlement_payment_method TEXT,
      settlement_note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id INTEGER NOT NULL REFERENCES rentals(id),
      refund_percentage REAL,
      refund_amount REAL NOT NULL,
      remaining_days INTEGER,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES owners(id),
      amount REAL NOT NULL,
      gross_amount REAL DEFAULT 0,
      deduction_amount REAL DEFAULT 0,
      cash_account_id INTEGER NOT NULL REFERENCES cash_accounts(id),
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS payout_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payout_id INTEGER NOT NULL REFERENCES payouts(id),
      expense_id INTEGER NOT NULL REFERENCES expenses(id),
      amount REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      motor_id INTEGER REFERENCES motors(id),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      cash_bucket TEXT NOT NULL DEFAULT 'pendapatan',
      description TEXT,
      date TEXT NOT NULL,
      payout_id INTEGER REFERENCES payouts(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cash_account_id INTEGER NOT NULL REFERENCES cash_accounts(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      description TEXT,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY DEFAULT 1,
      trial_started_at TEXT,
      trial_days INTEGER DEFAULT 7,
      serial_number TEXT,
      licensed_until TEXT,
      machine_id TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      report_name TEXT,
      file_size INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id),
      actor_username TEXT NOT NULL,
      source TEXT DEFAULT 'system',
      action TEXT NOT NULL,
      detail TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
}

function createBaseIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_rentals_date_status ON rentals(date_time, status)',
    'CREATE INDEX IF NOT EXISTS idx_rentals_motor_date ON rentals(motor_id, date_time)',
    'CREATE INDEX IF NOT EXISTS idx_rentals_owner_payout ON rentals(payout_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_rentals_hotel_payout ON rentals(hotel_id, hotel_payout_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_rentals_invoice_number ON rentals(invoice_number)',
    'CREATE INDEX IF NOT EXISTS idx_rentals_extension_parent ON rentals(parent_rental_id, is_extension)',
    'CREATE INDEX IF NOT EXISTS idx_rentals_relation_type ON rentals(relation_type)',
    'CREATE INDEX IF NOT EXISTS idx_rental_swaps_source ON rental_swaps(source_rental_id)',
    'CREATE INDEX IF NOT EXISTS idx_rental_swaps_replacement ON rental_swaps(replacement_rental_id)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_date_type_motor ON expenses(date, type, motor_id)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_payout ON expenses(payout_id)',
    'CREATE INDEX IF NOT EXISTS idx_cash_transactions_date_ref ON cash_transactions(date, reference_type)',
    'CREATE INDEX IF NOT EXISTS idx_cash_transactions_account_date ON cash_transactions(cash_account_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_cash_accounts_type_bucket ON cash_accounts(type, bucket)',
    'CREATE INDEX IF NOT EXISTS idx_payouts_owner_date ON payouts(owner_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_hotel_payouts_hotel_date ON hotel_payouts(hotel_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created ON activity_logs(actor_username, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_source_created ON activity_logs(source, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_motors_owner_active ON motors(owner_id, is_active)',
    'CREATE INDEX IF NOT EXISTS idx_hotels_active_name ON hotels(is_active, name)',
    'CREATE INDEX IF NOT EXISTS idx_owners_active_name ON owners(is_active, name)'
  ]

  for (const sql of indexes) {
    try { db.run(sql) } catch (_) {}
  }

  try { db.run('ANALYZE') } catch (_) {}
  try { db.run('PRAGMA optimize') } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS — dijalankan berurutan, hanya yang belum pernah dijalankan.
// Setiap entry = satu versi. Tambahkan entry baru di bawah untuk update fitur.
// JANGAN ubah atau hapus entry yang sudah ada.
// ─────────────────────────────────────────────────────────────────────────────
const migrations = [
  // v1 — hotel_id & hotel_payout_id di rentals
  {
    version: 1,
    up() {
      try { db.run("ALTER TABLE rentals ADD COLUMN hotel_id INTEGER REFERENCES hotels(id)") } catch (_) {}
      try { db.run("ALTER TABLE rentals ADD COLUMN hotel_payout_id INTEGER REFERENCES hotel_payouts(id)") } catch (_) {}
    }
  },

  // v2 — total_price (rename dari price_per_day * period_days)
  {
    version: 2,
    up() {
      try { db.run("ALTER TABLE rentals ADD COLUMN total_price REAL DEFAULT 0") } catch (_) {}
      try {
        db.run("UPDATE rentals SET total_price = price_per_day * period_days WHERE (total_price = 0 OR total_price IS NULL) AND price_per_day IS NOT NULL")
      } catch (_) {}
    }
  },

  // v3 — invoice_number di rentals + generate untuk data lama
  {
    version: 3,
    up() {
      try { db.run("ALTER TABLE rentals ADD COLUMN invoice_number TEXT") } catch (_) {}
      try {
        const noInvoice = get("SELECT COUNT(*) as c FROM rentals WHERE invoice_number IS NULL")
        if (noInvoice && noInvoice.c > 0) {
          const rentals = all("SELECT id, date_time FROM rentals WHERE invoice_number IS NULL ORDER BY id ASC")
          const counters = {}
          for (const r of rentals) {
            const dt = new Date(r.date_time)
            const yr = dt.getFullYear()
            const mo = String(dt.getMonth() + 1).padStart(2, '0')
            const key = `${yr}-${mo}`
            counters[key] = (counters[key] || 0) + 1
            const seq = String(counters[key]).padStart(4, '0')
            db.run("UPDATE rentals SET invoice_number = ? WHERE id = ?", [`WVY-${yr}-${mo}-${seq}`, r.id])
          }
        }
      } catch (_) {}
    }
  },

  // v4 — gross_amount & deduction_amount di payouts + payout_id di expenses
  {
    version: 4,
    up() {
      try { db.run("ALTER TABLE payouts ADD COLUMN gross_amount REAL DEFAULT 0") } catch (_) {}
      try { db.run("ALTER TABLE payouts ADD COLUMN deduction_amount REAL DEFAULT 0") } catch (_) {}
      try { db.run("ALTER TABLE expenses ADD COLUMN payout_id INTEGER REFERENCES payouts(id)") } catch (_) {}
      // Tandai rental lama sebagai lunas (payout_id = 0 = legacy paid)
      try { db.run("UPDATE rentals SET payout_id = 0 WHERE payout_id IS NULL AND owner_gets > 0") } catch (_) {}
    }
  },

  // v5 — is_active di motors + migrasi hotel string lama ke tabel hotels
  {
    version: 5,
    up() {
      try { db.run("ALTER TABLE motors ADD COLUMN is_active INTEGER DEFAULT 1") } catch (_) {}
      try { db.run("UPDATE motors SET is_active = 1 WHERE is_active IS NULL") } catch (_) {}
      // Migrasi hotel string lama ke relasi hotel_id
      try {
        const legacyVendors = all("SELECT id, hotel FROM rentals WHERE hotel_id IS NULL AND vendor_fee > 0 AND hotel IS NOT NULL AND TRIM(hotel) != ''")
        for (const rent of legacyVendors) {
          const hName = rent.hotel.trim()
          let ex = get("SELECT id FROM hotels WHERE name = ?", [hName])
          if (!ex) {
            db.run("INSERT INTO hotels (name) VALUES (?)", [hName])
            ex = get("SELECT last_insert_rowid() as id")
          }
          if (ex && ex.id) {
            db.run("UPDATE rentals SET hotel_id = ? WHERE id = ?", [ex.id, rent.id])
          }
        }
      } catch (_) {}
    }
  },

  // v6 — QRIS cash account
  {
    version: 6,
    up() {
      const qris = get("SELECT id FROM cash_accounts WHERE type = 'qris'")
      if (!qris) {
        db.run("INSERT INTO cash_accounts (name, type, balance) VALUES ('QRIS', 'qris', 0)")
      }
    }
  },

  // ── Tambahkan migrasi baru di sini ──────────────────────────────────────────
  // v7 — tabel license untuk trial & serial number
  {
    version: 7,
    up() {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS license (
            id INTEGER PRIMARY KEY DEFAULT 1,
            trial_started_at TEXT,
            trial_days INTEGER DEFAULT 7,
            serial_number TEXT,
            licensed_until TEXT,
            machine_id TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
          )
        `)
      } catch (_) {}
    }
  },
  // v8 — riwayat unduhan laporan
  {
    version: 8,
    up() {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            report_name TEXT,
            file_size INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime'))
          )
        `)
      } catch (_) {}
    }
  },
  // v9 — index performa untuk data jangka panjang
  {
    version: 9,
    up() {
      createBaseIndexes()
    }
  },
  // v10 — cash account Debit Card
  {
    version: 10,
    up() {
      const debitCard = get("SELECT id FROM cash_accounts WHERE type = 'debit_card'")
      if (!debitCard) {
        db.run("INSERT INTO cash_accounts (name, type, balance) VALUES ('Debit Card', 'debit_card', 0)")
      }
    }
  },
  // v11 — penanda transaksi extend
  {
    version: 11,
    up() {
      try { db.run("ALTER TABLE rentals ADD COLUMN is_extension INTEGER DEFAULT 0") } catch (_) {}
      try { db.run("ALTER TABLE rentals ADD COLUMN parent_rental_id INTEGER REFERENCES rentals(id)") } catch (_) {}
      try { db.run("UPDATE rentals SET is_extension = 0 WHERE is_extension IS NULL") } catch (_) {}
    }
  },
  // v12 — penanda relasi rental + log ganti unit
  {
    version: 12,
    up() {
      try { db.run("ALTER TABLE rentals ADD COLUMN relation_type TEXT DEFAULT 'rental'") } catch (_) {}
      try { db.run("UPDATE rentals SET relation_type = 'extend' WHERE is_extension = 1") } catch (_) {}
      try { db.run("UPDATE rentals SET relation_type = 'rental' WHERE relation_type IS NULL OR TRIM(relation_type) = ''") } catch (_) {}
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS rental_swaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_rental_id INTEGER NOT NULL REFERENCES rentals(id),
            replacement_rental_id INTEGER NOT NULL REFERENCES rentals(id),
            switch_date_time TEXT NOT NULL,
            used_days INTEGER NOT NULL,
            remaining_days INTEGER NOT NULL,
            original_price_per_day REAL NOT NULL,
            original_remaining_credit REAL NOT NULL,
            replacement_price_per_day REAL NOT NULL,
            replacement_total_price REAL NOT NULL,
            settlement_type TEXT NOT NULL,
            settlement_amount REAL NOT NULL,
            settlement_payment_method TEXT,
            settlement_note TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
          )
        `)
      } catch (_) {}
      createBaseIndexes()
    }
  },
  // v13 - tabel log aktivitas admin
  {
    version: 13,
    up() {
      try {
        db.run(`
          CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id INTEGER REFERENCES users(id),
            actor_username TEXT NOT NULL,
            source TEXT DEFAULT 'system',
            action TEXT NOT NULL,
            detail TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
          )
        `)
      } catch (_) {}
      createBaseIndexes()
    }
  },
  // v14 - sumber log (user vs system)
  {
    version: 14,
    up() {
      try { db.run("ALTER TABLE activity_logs ADD COLUMN source TEXT DEFAULT 'system'") } catch (_) {}
      try { db.run("UPDATE activity_logs SET source = 'system' WHERE source IS NULL OR TRIM(source) = ''") } catch (_) {}
      createBaseIndexes()
    }
  },
  // v15 - pisah akun kas pendapatan vs modal (per metode bayar)
  {
    version: 15,
    up() {
      const methods = [
        { type: 'tunai', pendapatanName: 'Kas Pendapatan Tunai', modalName: 'Kas Modal Tunai' },
        { type: 'transfer', pendapatanName: 'Kas Pendapatan Transfer', modalName: 'Kas Modal Transfer' },
        { type: 'qris', pendapatanName: 'Kas Pendapatan QRIS', modalName: 'Kas Modal QRIS' },
        { type: 'debit_card', pendapatanName: 'Kas Pendapatan Debit Card', modalName: 'Kas Modal Debit Card' }
      ]

      try { db.run("ALTER TABLE cash_accounts ADD COLUMN bucket TEXT DEFAULT 'pendapatan'") } catch (_) {}
      try { db.run("UPDATE cash_accounts SET bucket = 'pendapatan' WHERE bucket IS NULL OR TRIM(bucket) = ''") } catch (_) {}

      for (const method of methods) {
        const pendapatanAccount = get(
          "SELECT id FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = 'pendapatan'",
          [method.type]
        )
        if (!pendapatanAccount) {
          db.run(
            "INSERT INTO cash_accounts (name, type, bucket, balance) VALUES (?, ?, 'pendapatan', 0)",
            [method.pendapatanName, method.type]
          )
        } else {
          db.run("UPDATE cash_accounts SET name = ? WHERE id = ?", [method.pendapatanName, pendapatanAccount.id])
        }

        const modalAccount = get(
          "SELECT id FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = 'modal'",
          [method.type]
        )
        if (!modalAccount) {
          db.run(
            "INSERT INTO cash_accounts (name, type, bucket, balance) VALUES (?, ?, 'modal', 0)",
            [method.modalName, method.type]
          )
        }
      }

      try { db.run("ALTER TABLE expenses ADD COLUMN cash_bucket TEXT DEFAULT 'pendapatan'") } catch (_) {}
      try { db.run("UPDATE expenses SET cash_bucket = 'pendapatan' WHERE cash_bucket IS NULL OR TRIM(cash_bucket) = ''") } catch (_) {}

      try {
        const capitalRows = all(`
          SELECT ct.id, ca.type
          FROM cash_transactions ct
          JOIN cash_accounts ca ON ca.id = ct.cash_account_id
          WHERE ct.reference_type IN ('capital_injection', 'opening_balance')
        `)
        for (const row of capitalRows) {
          const modalAccount = get(
            "SELECT id FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = 'modal' ORDER BY id ASC LIMIT 1",
            [row.type]
          )
          if (modalAccount?.id) {
            db.run('UPDATE cash_transactions SET cash_account_id = ? WHERE id = ?', [modalAccount.id, row.id])
          }
        }
      } catch (_) {}

      try {
        const accounts = all('SELECT id FROM cash_accounts ORDER BY id ASC')
        for (const account of accounts) {
          const ledger = get(`
            SELECT COALESCE(SUM(CASE WHEN type = 'out' THEN -amount ELSE amount END), 0) as total
            FROM cash_transactions
            WHERE cash_account_id = ?
          `, [account.id])
          db.run('UPDATE cash_accounts SET balance = ? WHERE id = ?', [Number(ledger?.total || 0), account.id])
        }
      } catch (_) {}

      createBaseIndexes()
    }
  },
  // v16 - bersihkan akun kas legacy modal_ditanam
  {
    version: 16,
    up() {
      try {
        const legacyAccounts = all("SELECT id, type FROM cash_accounts WHERE LOWER(TRIM(type)) = 'modal_ditanam'") || []
        if (!legacyAccounts.length) return

        const fallbackModalTunai = get(
          "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'modal' ORDER BY id ASC LIMIT 1"
        )

        for (const legacy of legacyAccounts) {
          if (fallbackModalTunai?.id) {
            db.run('UPDATE cash_transactions SET cash_account_id = ? WHERE cash_account_id = ?', [fallbackModalTunai.id, legacy.id])
          } else {
            db.run('DELETE FROM cash_transactions WHERE cash_account_id = ?', [legacy.id])
          }
          db.run('DELETE FROM cash_accounts WHERE id = ?', [legacy.id])
        }

        const accounts = all('SELECT id FROM cash_accounts ORDER BY id ASC')
        for (const account of accounts) {
          const ledger = get(`
            SELECT COALESCE(SUM(CASE WHEN type = 'out' THEN -amount ELSE amount END), 0) as total
            FROM cash_transactions
            WHERE cash_account_id = ?
          `, [account.id])
          db.run('UPDATE cash_accounts SET balance = ? WHERE id = ?', [Number(ledger?.total || 0), account.id])
        }
      } catch (_) {}
    }
  },
  // v17 - modal tanam wajib masuk kas modal tunai
  {
    version: 17,
    up() {
      try {
        let modalTunaiAccount = get(
          "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'modal' ORDER BY id ASC LIMIT 1"
        )
        if (!modalTunaiAccount?.id) {
          db.run(
            "INSERT INTO cash_accounts (name, type, bucket, balance) VALUES ('Kas Modal Tunai', 'tunai', 'modal', 0)"
          )
          modalTunaiAccount = get(
            "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'modal' ORDER BY id ASC LIMIT 1"
          )
        }
        if (!modalTunaiAccount?.id) return

        db.run(`
          UPDATE cash_transactions
          SET cash_account_id = ?
          WHERE reference_type IN ('capital_injection', 'opening_balance')
        `, [modalTunaiAccount.id])

        const deprecatedModalAccounts = all(`
          SELECT id
          FROM cash_accounts
          WHERE COALESCE(bucket, 'pendapatan') = 'modal'
            AND type IN ('transfer', 'qris', 'debit_card')
        `) || []

        for (const account of deprecatedModalAccounts) {
          db.run('UPDATE cash_transactions SET cash_account_id = ? WHERE cash_account_id = ?', [modalTunaiAccount.id, account.id])
          db.run('DELETE FROM cash_accounts WHERE id = ?', [account.id])
        }

        const accounts = all('SELECT id FROM cash_accounts ORDER BY id ASC')
        for (const account of accounts) {
          const ledger = get(`
            SELECT COALESCE(SUM(CASE WHEN type = 'out' THEN -amount ELSE amount END), 0) as total
            FROM cash_transactions
            WHERE cash_account_id = ?
          `, [account.id])
          db.run('UPDATE cash_accounts SET balance = ? WHERE id = ?', [Number(ledger?.total || 0), account.id])
        }
      } catch (_) {}
    }
  },
  // Contoh untuk update fitur berikutnya:
  // {
  //   version: 7,
  //   up() {
  //     try { db.run("ALTER TABLE rentals ADD COLUMN notes TEXT") } catch (_) {}
  //   }
  // },
]

function getCurrentVersion() {
  try {
    const row = get("SELECT MAX(version) as v FROM schema_version")
    return row?.v || 0
  } catch (_) {
    return 0
  }
}

function runMigrations() {
  const currentVersion = getCurrentVersion()

  // Bedakan install baru vs database lama yang belum punya schema_version
  if (currentVersion === 0) {
    const hasExistingData = get("SELECT COUNT(*) as c FROM motors") 
    const isNewInstall = !hasExistingData || hasExistingData.c === 0

    if (isNewInstall) {
      // Install baru: langsung set ke versi terbaru, schema sudah lengkap dari createBaseSchema
      db.run("INSERT INTO schema_version (version) VALUES (?)", [SCHEMA_VERSION])
      return
    } else {
      // Database lama: jalankan SEMUA migrasi dari awal
      for (const migration of migrations) {
        try {
          migration.up()
          db.run("INSERT INTO schema_version (version) VALUES (?)", [migration.version])
          console.log(`[DB] Migration v${migration.version} applied (legacy)`)
        } catch (err) {
          console.error(`[DB] Migration v${migration.version} failed:`, err.message)
        }
      }
      return
    }
  }

  // Update app: jalankan hanya migrasi yang belum dijalankan
  const pending = migrations.filter(m => m.version > currentVersion)
  for (const migration of pending) {
    try {
      migration.up()
      db.run("INSERT INTO schema_version (version) VALUES (?)", [migration.version])
      console.log(`[DB] Migration v${migration.version} applied`)
    } catch (err) {
      console.error(`[DB] Migration v${migration.version} failed:`, err.message)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED — data default yang harus ada. Aman dijalankan berulang (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
function seedDefaults() {
  // Admin default
  const admin = get("SELECT id FROM users WHERE username = 'admin'")
  if (!admin) {
    db.run("INSERT INTO users (username, password_hash) VALUES ('admin', '$2b$10$placeholder')")
  }

  try {
    const legacyAccounts = all("SELECT id FROM cash_accounts WHERE LOWER(TRIM(type)) = 'modal_ditanam'") || []
    const fallbackModalTunai = get(
      "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'modal' ORDER BY id ASC LIMIT 1"
    )
    for (const legacy of legacyAccounts) {
      if (fallbackModalTunai?.id) {
        db.run('UPDATE cash_transactions SET cash_account_id = ? WHERE cash_account_id = ?', [fallbackModalTunai.id, legacy.id])
      } else {
        db.run('DELETE FROM cash_transactions WHERE cash_account_id = ?', [legacy.id])
      }
      db.run('DELETE FROM cash_accounts WHERE id = ?', [legacy.id])
    }
  } catch (_) {}
  try {
    const modalTunai = get(
      "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'modal' ORDER BY id ASC LIMIT 1"
    )
    if (modalTunai?.id) {
      const deprecatedModalAccounts = all(`
        SELECT id
        FROM cash_accounts
        WHERE COALESCE(bucket, 'pendapatan') = 'modal'
          AND type IN ('transfer', 'qris', 'debit_card')
      `) || []
      for (const account of deprecatedModalAccounts) {
        db.run('UPDATE cash_transactions SET cash_account_id = ? WHERE cash_account_id = ?', [modalTunai.id, account.id])
        db.run('DELETE FROM cash_accounts WHERE id = ?', [account.id])
      }
    }
  } catch (_) {}

  // Kas default
  const defaultAccounts = [
    { name: 'Kas Pendapatan Tunai', type: 'tunai', bucket: 'pendapatan' },
    { name: 'Kas Pendapatan Transfer', type: 'transfer', bucket: 'pendapatan' },
    { name: 'Kas Pendapatan QRIS', type: 'qris', bucket: 'pendapatan' },
    { name: 'Kas Pendapatan Debit Card', type: 'debit_card', bucket: 'pendapatan' },
    { name: 'Kas Modal Tunai', type: 'tunai', bucket: 'modal' }
  ]
  for (const account of defaultAccounts) {
    const existsAccount = get(
      "SELECT id FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = ?",
      [account.type, account.bucket]
    )
    if (!existsAccount) {
      db.run(
        'INSERT INTO cash_accounts (name, type, bucket, balance) VALUES (?, ?, ?, 0)',
        [account.name, account.type, account.bucket]
      )
    } else {
      db.run('UPDATE cash_accounts SET name = ? WHERE id = ?', [account.name, existsAccount.id])
    }
  }

  try {
    const accounts = all('SELECT id FROM cash_accounts ORDER BY id ASC')
    for (const account of accounts) {
      const ledger = get(`
        SELECT COALESCE(SUM(CASE WHEN type = 'out' THEN -amount ELSE amount END), 0) as total
        FROM cash_transactions
        WHERE cash_account_id = ?
      `, [account.id])
      db.run('UPDATE cash_accounts SET balance = ? WHERE id = ?', [Number(ledger?.total || 0), account.id])
    }
  } catch (_) {}
}
