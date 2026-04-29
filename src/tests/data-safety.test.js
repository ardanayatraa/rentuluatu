/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import initSqlJs from 'sql.js'

const tempDirs = []

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'wavy-data-safety-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 350))
  vi.resetModules()
  vi.clearAllMocks()
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    rmSync(dir, { recursive: true, force: true })
  }
})

async function loadRuntime(userDataPath) {
  vi.resetModules()
  const handlers = new Map()
  vi.doMock('electron', () => ({
    ipcMain: {
      handle: vi.fn((channel, fn) => handlers.set(channel, fn))
    },
    app: {
      isPackaged: false,
      getPath: vi.fn(() => userDataPath)
    },
    shell: {
      openExternal: vi.fn(),
      showItemInFolder: vi.fn()
    },
    dialog: {
      showOpenDialog: vi.fn()
    }
  }))

  const dbModule = await import('../main/db.js')
  await dbModule.initDb()
  const backupModule = await import('../main/ipc/backup.js')
  backupModule.registerBackupHandlers()
  return { handlers, dbModule }
}

function insertBusinessRows(
  dbModule,
  { customer = 'Budi', total = 300000, date = '2026-04-25T10:00:00' } = {}
) {
  const { dbOps, forceSaveDb } = dbModule
  dbOps.runRaw("INSERT OR IGNORE INTO owners (id, name) VALUES (1, 'Owner A')")
  dbOps.runRaw(
    "INSERT OR IGNORE INTO motors (id, model, plate_number, type, owner_id) VALUES (1, 'Vario', 'DK 1001 AA', 'titipan', 1)"
  )
  const account = dbOps.get(
    "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'pendapatan' ORDER BY id ASC LIMIT 1"
  )
  dbOps.runRaw(
    `
    INSERT INTO rentals (
      date_time, customer_name, motor_id, period_days, payment_method, total_price,
      price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number
    ) VALUES (?, ?, 1, 1, 'tunai', ?, ?, 0, ?, ?, ?, 'completed', ?)
  `,
    [
      date,
      customer,
      total,
      total,
      total,
      Math.round(total * 0.3),
      Math.round(total * 0.7),
      `TEST-${customer}`
    ]
  )
  const rentalId = dbOps.get('SELECT last_insert_rowid() as id').id
  dbOps.runRaw(
    "INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (?, 'in', ?, 'rental', ?, ?, ?)",
    [account.id, total, rentalId, `Sewa ${customer}`, date.slice(0, 10)]
  )
  forceSaveDb()
}

async function writeLegacyModalDb(dbPath) {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('CREATE TABLE schema_version (version INTEGER NOT NULL, applied_at TEXT)')
  db.run('INSERT INTO schema_version (version) VALUES (17)')
  db.run(`
    CREATE TABLE cash_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      bucket TEXT,
      balance REAL DEFAULT 0,
      created_at TEXT
    )
  `)
  db.run(`
    CREATE TABLE cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cash_account_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      description TEXT,
      date TEXT NOT NULL,
      created_at TEXT
    )
  `)
  db.run(
    "INSERT INTO cash_accounts (id, name, type, bucket, balance) VALUES (1, 'Modal Lama', 'modal_ditanam', 'modal', 100000)"
  )
  db.run(
    "INSERT INTO cash_accounts (id, name, type, bucket, balance) VALUES (2, 'Modal QRIS Lama', 'qris', 'modal', 50000)"
  )
  db.run(
    "INSERT INTO cash_transactions (id, cash_account_id, type, amount, reference_type, date) VALUES (1, 1, 'in', 100000, 'opening_balance', '2020-01-01')"
  )
  db.run(
    "INSERT INTO cash_transactions (id, cash_account_id, type, amount, reference_type, date) VALUES (2, 2, 'in', 50000, 'capital_injection', '2020-01-02')"
  )
  writeFileSync(dbPath, Buffer.from(db.export()))
  db.close()
}

describe('data safety hardening', () => {
  it('migrasi v18 memindahkan akun modal legacy tanpa menghapus histori transaksi', async () => {
    const userDataPath = makeTempDir()
    await writeLegacyModalDb(join(userDataPath, 'wavy.db'))

    const { dbModule } = await loadRuntime(userDataPath)
    const { dbOps, reloadDbFromBuffer } = dbModule

    expect(dbOps.get('SELECT MAX(version) as v FROM schema_version').v).toBe(18)
    expect(dbOps.get('SELECT COUNT(*) as c FROM cash_transactions').c).toBe(2)

    const modalTunai = dbOps.get(
      "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'modal'"
    )
    expect(modalTunai?.id).toBeTruthy()
    expect(
      dbOps.get("SELECT COUNT(*) as c FROM cash_accounts WHERE LOWER(TRIM(type)) = 'modal_ditanam'")
        .c
    ).toBe(0)
    expect(
      dbOps.get(
        "SELECT COUNT(*) as c FROM cash_accounts WHERE type = 'qris' AND COALESCE(bucket, 'pendapatan') = 'modal'"
      ).c
    ).toBe(0)
    expect(
      dbOps.get('SELECT COUNT(*) as c FROM cash_transactions WHERE cash_account_id = ?', [
        modalTunai.id
      ]).c
    ).toBe(2)

    reloadDbFromBuffer(readFileSync(join(userDataPath, 'wavy.db')))
    expect(dbOps.get('SELECT COUNT(*) as c FROM cash_transactions').c).toBe(2)
  })

  it('normalisasi DB melepas parent rental dari extend lama', async () => {
    const userDataPath = makeTempDir()
    const { dbModule } = await loadRuntime(userDataPath)
    const { dbOps, forceSaveDb, reloadDbFromBuffer } = dbModule

    dbOps.runRaw("INSERT OR IGNORE INTO owners (id, name) VALUES (1, 'Owner A')")
    dbOps.runRaw(
      "INSERT OR IGNORE INTO motors (id, model, plate_number, type, owner_id) VALUES (1, 'Vario', 'DK 9001 XX', 'titipan', 1)"
    )
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, motor_id, period_days, payment_method, total_price,
        price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number, relation_type
      ) VALUES (200, '2026-04-01T10:00:00', 'Ayu', 1, 2, 'tunai', 300000, 150000, 0, 300000, 90000, 210000, 'completed', 'LEG-200', 'rental')
    `)
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, motor_id, period_days, payment_method, total_price,
        price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number,
        is_extension, relation_type, parent_rental_id
      ) VALUES (201, '2026-04-03T10:00:00', 'Ayu', 1, 1, 'tunai', 150000, 150000, 0, 150000, 45000, 105000, 'completed', 'LEG-201', 1, 'extend', 200)
    `)
    forceSaveDb()

    reloadDbFromBuffer(readFileSync(join(userDataPath, 'wavy.db')))

    expect(dbOps.get('SELECT parent_rental_id FROM rentals WHERE id = 201').parent_rental_id).toBeNull()
  })

  it('restore lokal valid membuat safety backup terenkripsi dan mengganti DB setelah validasi', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)

    insertBusinessRows(dbModule, { customer: 'Ayu', total: 250000, date: '2024-01-15T09:00:00' })
    const backup = await handlers.get('backup:create-local')()
    insertBusinessRows(dbModule, { customer: 'Doni', total: 400000, date: '2026-04-25T09:00:00' })

    const result = await handlers.get('backup:restore-local')(null, { path: backup.path })

    expect(result.success).toBe(true)
    expect(result.summary.rentals).toBe(1)
    expect(result.safetyBackupName).toMatch(
      /^wavy_before_restore_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.wavy$/
    )
    expect(existsSync(result.safetyBackupPath)).toBe(true)
    expect(existsSync(`${result.safetyBackupPath}.key.wavy`)).toBe(true)
    expect(
      dbModule.dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE customer_name = 'Doni'").c
    ).toBe(0)
    expect(
      dbModule.dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE customer_name = 'Ayu'").c
    ).toBe(1)

    const safetyRestore = await handlers.get('backup:restore-local')(null, {
      path: result.safetyBackupPath
    })
    expect(safetyRestore.success).toBe(true)
    expect(safetyRestore.summary.rentals).toBe(2)
    expect(
      dbModule.dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE customer_name = 'Doni'").c
    ).toBe(1)
    expect(
      dbModule.dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE customer_name = 'Ayu'").c
    ).toBe(1)
  })

  it('restore lokal menolak path di luar folder backup dan DB aktif tidak berubah', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)
    insertBusinessRows(dbModule, { customer: 'Ayu' })

    const backup = await handlers.get('backup:create-local')()
    insertBusinessRows(dbModule, { customer: 'Doni' })

    const outsidePath = join(userDataPath, 'outside.wavy')
    writeFileSync(outsidePath, readFileSync(backup.path))
    const dbPath = join(userDataPath, 'wavy.db')
    const before = readFileSync(dbPath)

    await expect(
      handlers.get('backup:restore-local')(null, { path: outsidePath })
    ).rejects.toThrow('Lokasi file backup tidak valid')
    expect(readFileSync(dbPath).equals(before)).toBe(true)
    expect(
      dbModule.dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE customer_name = 'Doni'").c
    ).toBe(1)
  })

  it('restore lokal menolak file rusak dan DB aktif tidak berubah', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)
    insertBusinessRows(dbModule, { customer: 'Ayu' })

    const dbPath = join(userDataPath, 'wavy.db')
    const before = readFileSync(dbPath)
    mkdirSync(join(userDataPath, 'backups'), { recursive: true })
    const badPath = join(userDataPath, 'backups', 'bad.wavy')
    writeFileSync(badPath, Buffer.from('not-a-valid-backup'))

    await expect(handlers.get('backup:restore-local')(null, { path: badPath })).rejects.toThrow()
    expect(readFileSync(dbPath).equals(before)).toBe(true)
  })

  it('restore lokal menolak DB tanpa tabel wajib dan DB aktif tidak berubah', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)
    insertBusinessRows(dbModule, { customer: 'Ayu' })

    const dbPath = join(userDataPath, 'wavy.db')
    const before = readFileSync(dbPath)
    mkdirSync(join(userDataPath, 'backups'), { recursive: true })
    const SQL = await initSqlJs()
    const invalidDb = new SQL.Database()
    invalidDb.run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT)')
    const invalidPath = join(userDataPath, 'backups', 'missing-tables.db')
    writeFileSync(invalidPath, Buffer.from(invalidDb.export()))
    invalidDb.close()

    await expect(handlers.get('backup:restore-local')(null, { path: invalidPath })).rejects.toThrow(
      'Tabel wajib hilang'
    )
    expect(readFileSync(dbPath).equals(before)).toBe(true)
  })

  it('restore lokal dari backup lama tetap melepas parent rental extend', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)
    const { dbOps, forceSaveDb } = dbModule

    dbOps.runRaw("INSERT OR IGNORE INTO owners (id, name) VALUES (1, 'Owner A')")
    dbOps.runRaw(
      "INSERT OR IGNORE INTO motors (id, model, plate_number, type, owner_id) VALUES (1, 'Vario', 'DK 9002 XX', 'titipan', 1)"
    )
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, motor_id, period_days, payment_method, total_price,
        price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number, relation_type
      ) VALUES (300, '2026-04-01T10:00:00', 'Legacy', 1, 2, 'tunai', 300000, 150000, 0, 300000, 90000, 210000, 'completed', 'LEG-300', 'rental')
    `)
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, motor_id, period_days, payment_method, total_price,
        price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number,
        is_extension, relation_type, parent_rental_id
      ) VALUES (301, '2026-04-03T10:00:00', 'Legacy', 1, 1, 'tunai', 150000, 150000, 0, 150000, 45000, 105000, 'completed', 'LEG-301', 1, 'extend', 300)
    `)
    forceSaveDb()

    const backupDir = join(userDataPath, 'backups')
    mkdirSync(backupDir, { recursive: true })
    const legacyBackupPath = join(backupDir, 'legacy-extend.db')
    writeFileSync(legacyBackupPath, readFileSync(join(userDataPath, 'wavy.db')))

    dbOps.runRaw('DELETE FROM rentals')
    forceSaveDb()

    const result = await handlers.get('backup:restore-local')(null, { path: legacyBackupPath })

    expect(result.success).toBe(true)
    expect(dbOps.get('SELECT COUNT(*) as c FROM rentals').c).toBe(2)
    expect(dbOps.get('SELECT parent_rental_id FROM rentals WHERE id = 301').parent_rental_id).toBeNull()
  })

  it('backup dan restore dataset multi-tahun mempertahankan jumlah row dan total nominal', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)
    const { dbOps, forceSaveDb } = dbModule

    dbOps.runRaw("INSERT OR IGNORE INTO owners (id, name) VALUES (1, 'Owner A')")
    dbOps.runRaw(
      "INSERT OR IGNORE INTO motors (id, model, plate_number, type, owner_id) VALUES (1, 'Vario', 'DK 1001 AA', 'titipan', 1)"
    )
    const account = dbOps.get(
      "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'pendapatan' ORDER BY id ASC LIMIT 1"
    )

    dbOps.runRaw('BEGIN TRANSACTION')
    for (let year = 2019; year <= 2026; year += 1) {
      for (let i = 0; i < 250; i += 1) {
        const amount = 150000 + ((year + i) % 350000)
        const date = `${year}-${String((i % 12) + 1).padStart(2, '0')}-15T10:00:00`
        dbOps.runRaw(
          `
          INSERT INTO rentals (
            date_time, customer_name, motor_id, period_days, payment_method, total_price,
            price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number
          ) VALUES (?, ?, 1, 1, 'tunai', ?, ?, 0, ?, ?, ?, 'completed', ?)
        `,
          [
            date,
            `Customer ${year}-${i}`,
            amount,
            amount,
            amount,
            Math.round(amount * 0.3),
            Math.round(amount * 0.7),
            `STRESS-${year}-${i}`
          ]
        )
        const rentalId = dbOps.get('SELECT last_insert_rowid() as id').id
        dbOps.runRaw(
          "INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (?, 'in', ?, 'rental', ?, ?, ?)",
          [account.id, amount, rentalId, `Stress ${year}-${i}`, date.slice(0, 10)]
        )
      }
      for (let i = 0; i < 80; i += 1) {
        const amount = 50000 + ((year + i) % 75000)
        dbOps.runRaw(
          "INSERT INTO expenses (type, category, amount, payment_method, cash_bucket, description, date) VALUES ('umum', 'stress', ?, 'tunai', 'pendapatan', 'Stress expense', ?)",
          [amount, `${year}-${String((i % 12) + 1).padStart(2, '0')}-20`]
        )
      }
    }
    dbOps.runRaw('COMMIT')
    forceSaveDb()

    const expected = dbOps.get(`
      SELECT
        (SELECT COUNT(*) FROM rentals) as rental_count,
        (SELECT COUNT(*) FROM expenses) as expense_count,
        (SELECT COUNT(*) FROM cash_transactions) as cash_count,
        (SELECT CAST(SUM(total_price) AS INTEGER) FROM rentals) as rental_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM expenses) as expense_total
    `)
    const backup = await handlers.get('backup:create-local')()
    insertBusinessRows(dbModule, { customer: 'Mutation After Backup', total: 999999 })
    await handlers.get('backup:restore-local')(null, { path: backup.path })

    const actual = dbOps.get(`
      SELECT
        (SELECT COUNT(*) FROM rentals) as rental_count,
        (SELECT COUNT(*) FROM expenses) as expense_count,
        (SELECT COUNT(*) FROM cash_transactions) as cash_count,
        (SELECT CAST(SUM(total_price) AS INTEGER) FROM rentals) as rental_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM expenses) as expense_total
    `)
    expect(actual).toEqual(expected)
  })
})
