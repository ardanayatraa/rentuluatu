import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import initSqlJs from 'sql.js'

let db
let dbPath

export async function initDb() {
  // sql.js needs the WASM file path
  const wasmPath = join(
    app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
      : join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
  )
  const SQL = await initSqlJs({ locateFile: () => wasmPath })
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  dbPath = join(userDataPath, 'wavy.db')

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  initSchema()
  saveDb()
  return db
}

export function getDb() {
  if (!db) throw new Error('Database belum diinisialisasi')
  return db
}

export function saveDb() {
  if (db && dbPath) {
    const data = db.export()
    writeFileSync(dbPath, Buffer.from(data))
  }
}

function run(sql, params = []) {
  db.run(sql, params)
  saveDb()
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

export const dbOps = { run, get, all }

function initSchema() {
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
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS cash_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_time TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      hotel TEXT,
      motor_id INTEGER NOT NULL REFERENCES motors(id),
      period_days INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      total_price REAL NOT NULL,
      vendor_fee REAL DEFAULT 0,
      sisa REAL,
      wavy_gets REAL,
      owner_gets REAL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  // Migrate: rename price_per_day to total_price if old schema exists
  try { db.run("ALTER TABLE rentals ADD COLUMN total_price REAL DEFAULT 0") } catch (_) {}
  try { db.run("UPDATE rentals SET total_price = price_per_day * period_days WHERE total_price = 0 OR total_price IS NULL") } catch (_) {}
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
      cash_account_id INTEGER NOT NULL REFERENCES cash_accounts(id),
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  
  // Migrate: add payout_id mapping to rentals
  try { db.run("ALTER TABLE rentals ADD COLUMN payout_id INTEGER REFERENCES payouts(id)") } catch (_) {}
  // Legacy migration (tandai semua rental lama sebagai "lunas / tidak ngutang" menggunakan payout_id dummy '0')
  try { db.run("UPDATE rentals SET payout_id = 0 WHERE payout_id IS NULL AND owner_gets > 0") } catch (_) {}
  
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      motor_id INTEGER REFERENCES motors(id),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
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

  // Seed default admin
  const admin = get('SELECT id FROM users WHERE username = ?', ['admin'])
  if (!admin) {
    db.run("INSERT INTO users (username, password_hash) VALUES ('admin', '$2b$10$placeholder')")
  }

  // Seed default cash accounts
  const cash = get("SELECT id FROM cash_accounts WHERE type = 'tunai'")
  if (!cash) {
    db.run("INSERT INTO cash_accounts (name, type, balance) VALUES ('Kas Tunai', 'tunai', 0)")
    db.run("INSERT INTO cash_accounts (name, type, balance) VALUES ('Rekening Transfer', 'transfer', 0)")
    db.run("INSERT INTO cash_accounts (name, type, balance) VALUES ('QRIS', 'qris', 0)")
  }
  // Migrate: add QRIS account if not exists
  const qris = get("SELECT id FROM cash_accounts WHERE type = 'qris'")
  if (!qris) {
    db.run("INSERT INTO cash_accounts (name, type, balance) VALUES ('QRIS', 'qris', 0)")
  }

  saveDb()
}
