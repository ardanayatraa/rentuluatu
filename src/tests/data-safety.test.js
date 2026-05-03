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

async function loadRuntime(userDataPath, { registerBusinessHandlers = false } = {}) {
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
  if (registerBusinessHandlers) {
    const ownerModule = await import('../main/ipc/owners.js')
    const hotelModule = await import('../main/ipc/hotels.js')
    const motorModule = await import('../main/ipc/motors.js')
    const rentalModule = await import('../main/ipc/rentals.js')
    const expenseModule = await import('../main/ipc/expenses.js')
    ownerModule.registerOwnerHandlers()
    hotelModule.registerHotelHandlers()
    motorModule.registerMotorHandlers()
    rentalModule.registerRentalHandlers()
    expenseModule.registerExpenseHandlers()
  }
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
  it('auto backup saat close tetap nonaktif meski dicoba dinyalakan', async () => {
    const userDataPath = makeTempDir()
    const { handlers } = await loadRuntime(userDataPath)

    expect(handlers.get('backup:auto-close-status')()).toEqual({ enabled: false, available: false })

    const result = handlers.get('backup:auto-close-set')(null, { enabled: true })
    expect(result).toEqual({ success: true, enabled: false, available: false })
    expect(handlers.get('backup:auto-close-status')()).toEqual({ enabled: false, available: false })

    const settings = JSON.parse(readFileSync(join(userDataPath, 'backup-settings.json'), 'utf-8'))
    expect(settings.autoBackupOnClose).toBe(false)
  })

  it('saveDb langsung menulis file agar data tidak hilang saat app ditutup cepat', async () => {
    const userDataPath = makeTempDir()
    const { dbModule } = await loadRuntime(userDataPath)
    const { dbOps, reloadDbFromBuffer, saveDb } = dbModule

    dbOps.runRaw("INSERT INTO owners (name, phone) VALUES ('Owner Persist', '081')")
    saveDb()
    reloadDbFromBuffer(readFileSync(join(userDataPath, 'wavy.db')))

    expect(dbOps.get("SELECT COUNT(*) as c FROM owners WHERE name = 'Owner Persist'").c).toBe(1)

    dbOps.runRaw('BEGIN TRANSACTION')
    dbOps.run("INSERT INTO hotels (name, phone) VALUES ('Vendor Persist', '082')")
    dbOps.runRaw('COMMIT')
    reloadDbFromBuffer(readFileSync(join(userDataPath, 'wavy.db')))

    expect(dbOps.get("SELECT COUNT(*) as c FROM hotels WHERE name = 'Vendor Persist'").c).toBe(1)
  })

  it('input user-facing tetap tersimpan setelah DB dibuka ulang dari file', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath, { registerBusinessHandlers: true })
    const { dbOps, reloadDbFromBuffer } = dbModule

    const owner = await handlers.get('owner:create')(null, {
      name: 'Owner UI Persist',
      phone: '0811111111'
    })
    const hotel = await handlers.get('hotel:create')(null, {
      name: 'Vendor UI Persist'
    })
    const motor = await handlers.get('motor:create')(null, {
      model: 'Vario Persist',
      plate_number: 'DK 1010 UI',
      type: 'milik_pemilik',
      owner_id: owner.id
    })
    await handlers.get('rental:create')(null, {
      date_time: '2026-04-21T10:00:00',
      customer_name: 'Daily Persist',
      hotel: 'Vendor UI Persist',
      hotel_id: hotel.id,
      motor_id: motor.id,
      period_days: 2,
      payment_method: 'tunai',
      total_price: 300000,
      vendor_fee: 0,
      status: 'completed'
    })
    await handlers.get('expense:create')(null, {
      type: 'motor',
      motor_id: motor.id,
      category: 'servis',
      amount: 50000,
      payment_method: 'tunai',
      cash_bucket: 'pendapatan',
      description: 'Servis persist',
      date: '2026-04-22'
    })

    reloadDbFromBuffer(readFileSync(join(userDataPath, 'wavy.db')))

    expect(dbOps.get("SELECT COUNT(*) as c FROM owners WHERE name = 'Owner UI Persist'").c).toBe(1)
    expect(dbOps.get("SELECT COUNT(*) as c FROM hotels WHERE name = 'Vendor UI Persist'").c).toBe(1)
    expect(dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE customer_name = 'Daily Persist'").c).toBe(1)
    expect(dbOps.get("SELECT COUNT(*) as c FROM expenses WHERE description = 'Servis persist'").c).toBe(1)
    expect(dbOps.get("SELECT COUNT(*) as c FROM cash_transactions WHERE description LIKE '%Persist%' OR description = 'Servis persist'").c).toBeGreaterThanOrEqual(2)
  })

  it('filter pengeluaran memakai tanggal saja agar data dengan jam tetap muncul', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath, { registerBusinessHandlers: true })
    const { dbOps } = dbModule

    dbOps.runRaw(
      "INSERT INTO expenses (type, category, amount, payment_method, cash_bucket, description, date) VALUES ('umum', 'operasional', 125000, 'tunai', 'pendapatan', 'Tanggal dengan jam', '2026-04-30T18:30:00')"
    )

    const rows = await handlers.get('expense:get-all')(null, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      type: 'umum'
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].description).toBe('Tanggal dengan jam')
  })

  it('tab pengeluaran operasional tetap menampilkan type lama yang bukan motor', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath, { registerBusinessHandlers: true })
    const { dbOps } = dbModule

    dbOps.runRaw(
      "INSERT INTO expenses (type, category, amount, payment_method, cash_bucket, description, date) VALUES ('kantor', 'legacy', 50000, 'tunai', 'pendapatan', 'Legacy type kantor', '2026-04-15')"
    )

    const operationalRows = await handlers.get('expense:get-all')(null, {
      type: 'umum'
    })
    const motorRows = await handlers.get('expense:get-all')(null, {
      type: 'motor'
    })

    expect(operationalRows).toHaveLength(1)
    expect(operationalRows[0].description).toBe('Legacy type kantor')
    expect(motorRows).toHaveLength(0)
  })

  it('filter periode vendor hotel memasukkan data tanggal 30 dan relasi hotel legacy', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath, { registerBusinessHandlers: true })
    const { dbOps } = dbModule

    dbOps.runRaw("INSERT OR IGNORE INTO hotels (id, name, phone) VALUES (300, 'Vendor April', '080')")
    dbOps.runRaw(
      "INSERT OR IGNORE INTO motors (id, model, plate_number, type) VALUES (301, 'Scoopy', 'DK 300 AP', 'pribadi')"
    )
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, hotel, hotel_id, motor_id, period_days,
        payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets,
        status, invoice_number, relation_type
      ) VALUES
        (901, '2026-04-01T09:00:00', 'April 1', 'Vendor April', 300, 301, 1, 'tunai', 100000, 100000, 10000, 90000, 90000, 0, 'completed', 'APR-901', 'rental'),
        (902, '2026-04-15T09:00:00', 'April 15', 'Vendor April', 300, 301, 1, 'tunai', 200000, 200000, 20000, 180000, 180000, 0, 'completed', 'APR-902', 'extend'),
        (903, '2026-04-30T08:00:00', 'April 30 Legacy', 'Vendor April', NULL, 301, 1, 'tunai', 300000, 300000, 30000, 270000, 270000, 0, 'completed', 'APR-903', ''),
        (904, '2026-04-30T21:30:00', 'April 30 Null Status', 'Vendor April', NULL, 301, 1, 'tunai', 400000, 400000, 40000, 360000, 360000, 0, NULL, 'APR-904', NULL),
        (905, '2026-05-01T09:00:00', 'May Excluded', 'Vendor April', 300, 301, 1, 'tunai', 500000, 500000, 50000, 450000, 450000, 0, 'completed', 'MAY-905', 'rental')
    `)

    const period = { startDate: '2026-04-01', endDate: '2026-04-30' }
    const preview = await handlers.get('hotel:payout-preview')(null, {
      hotelId: 300,
      ...period
    })
    const summaries = await handlers.get('hotel:get-all')(null, period)
    const vendorSummary = summaries.find((item) => Number(item.id) === 300)

    expect(preview.rentals).toHaveLength(4)
    expect(preview.grossCommission).toBe(100000)
    expect(vendorSummary?.total_commission).toBe(100000)
  })

  it('migrasi v18 memindahkan akun modal legacy tanpa menghapus histori transaksi', async () => {
    const userDataPath = makeTempDir()
    await writeLegacyModalDb(join(userDataPath, 'wavy.db'))

    const { dbModule } = await loadRuntime(userDataPath)
    const { dbOps, reloadDbFromBuffer } = dbModule

    expect(dbOps.get('SELECT MAX(version) as v FROM schema_version').v).toBe(19)
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
    expect(
      dbOps.get(
        "SELECT COUNT(*) as c FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'ganti_rugi' AND name = 'Kas Ganti Rugi'"
      ).c
    ).toBe(1)

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

  it('restore lokal memulihkan semua tabel bisnis: vendor, payout, refund, pengeluaran, dan mutasi kas', async () => {
    const userDataPath = makeTempDir()
    const { handlers, dbModule } = await loadRuntime(userDataPath)
    const { dbOps, forceSaveDb } = dbModule

    const account = dbOps.get(
      "SELECT id FROM cash_accounts WHERE type = 'tunai' AND COALESCE(bucket, 'pendapatan') = 'pendapatan' ORDER BY id ASC LIMIT 1"
    )

    dbOps.runRaw("INSERT OR IGNORE INTO owners (id, name, phone) VALUES (10, 'Owner Full', '081')")
    dbOps.runRaw("INSERT OR IGNORE INTO hotels (id, name, phone) VALUES (20, 'Vendor Hotel', '082')")
    dbOps.runRaw(
      "INSERT OR IGNORE INTO motors (id, model, plate_number, type, owner_id) VALUES (30, 'NMAX', 'DK 3030 YY', 'titipan', 10)"
    )
    dbOps.runRaw(
      'INSERT INTO hotel_payouts (id, hotel_id, amount, cash_account_id, date) VALUES (80, 20, 50000, ?, ?)',
      [account.id, '2026-04-20']
    )
    dbOps.runRaw(
      'INSERT INTO payouts (id, owner_id, amount, gross_amount, deduction_amount, cash_account_id, date) VALUES (70, 10, 275000, 350000, 75000, ?, ?)',
      [account.id, '2026-04-20']
    )
    dbOps.runRaw(
      "INSERT INTO expenses (id, type, motor_id, category, amount, payment_method, cash_bucket, description, date, payout_id) VALUES (600, 'motor', 30, 'servis', 75000, 'tunai', 'pendapatan', 'Servis CVT', '2026-04-12', 70)"
    )
    dbOps.runRaw(
      'INSERT INTO payout_deductions (id, payout_id, expense_id, amount) VALUES (71, 70, 600, 75000)'
    )
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, hotel_id, hotel_payout_id, motor_id, period_days,
        payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets,
        status, payout_id, invoice_number, relation_type
      ) VALUES (400, '2026-04-10T10:00:00', 'Customer Vendor', 20, 80, 30, 2,
        'tunai', 500000, 250000, 50000, 500000, 150000, 350000,
        'completed', 70, 'FULL-400', 'rental')
    `)
    dbOps.runRaw(`
      INSERT INTO rentals (
        id, date_time, customer_name, hotel_id, motor_id, period_days,
        payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets,
        status, invoice_number, relation_type
      ) VALUES (401, '2026-04-12T10:00:00', 'Customer Vendor', 20, 30, 1,
        'tunai', 200000, 200000, 0, 200000, 60000, 140000,
        'completed', 'FULL-401', 'rental')
    `)
    dbOps.runRaw(`
      INSERT INTO rental_swaps (
        id, source_rental_id, replacement_rental_id, switch_date_time, used_days, remaining_days,
        original_price_per_day, original_remaining_credit, replacement_price_per_day,
        replacement_total_price, settlement_type, settlement_amount, settlement_payment_method, settlement_note
      ) VALUES (90, 400, 401, '2026-04-11T08:00:00', 1, 1, 250000, 250000, 200000, 200000, 'refund', 50000, 'tunai', 'Test swap')
    `)
    dbOps.runRaw(
      "INSERT INTO refunds (id, rental_id, refund_percentage, refund_amount, remaining_days, reason) VALUES (91, 400, 10, 50000, 1, 'Test refund')"
    )
    dbOps.runRaw(
      "INSERT INTO cash_transactions (id, cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (700, ?, 'in', 500000, 'rental', 400, 'Rental vendor', '2026-04-10')",
      [account.id]
    )
    dbOps.runRaw(
      "INSERT INTO cash_transactions (id, cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (701, ?, 'out', 75000, 'expense', 600, 'Pengeluaran motor', '2026-04-12')",
      [account.id]
    )
    forceSaveDb()

    const expected = dbOps.get(`
      SELECT
        (SELECT COUNT(*) FROM owners) as owners,
        (SELECT COUNT(*) FROM motors) as motors,
        (SELECT COUNT(*) FROM hotels) as hotels,
        (SELECT COUNT(*) FROM hotel_payouts) as hotel_payouts,
        (SELECT COUNT(*) FROM rentals) as rentals,
        (SELECT COUNT(*) FROM rental_swaps) as rental_swaps,
        (SELECT COUNT(*) FROM refunds) as refunds,
        (SELECT COUNT(*) FROM payouts) as payouts,
        (SELECT COUNT(*) FROM payout_deductions) as payout_deductions,
        (SELECT COUNT(*) FROM expenses) as expenses,
        (SELECT COUNT(*) FROM cash_transactions) as cash_transactions,
        (SELECT CAST(SUM(total_price) AS INTEGER) FROM rentals) as rental_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM expenses) as expense_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM hotel_payouts) as hotel_payout_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM payouts) as payout_total,
        (SELECT CAST(SUM(refund_amount) AS INTEGER) FROM refunds) as refund_total
    `)

    const backup = await handlers.get('backup:create-local')()

    dbOps.runRaw('DELETE FROM payout_deductions')
    dbOps.runRaw('DELETE FROM rental_swaps')
    dbOps.runRaw('DELETE FROM refunds')
    dbOps.runRaw('DELETE FROM cash_transactions')
    dbOps.runRaw('UPDATE rentals SET payout_id = NULL, hotel_payout_id = NULL')
    dbOps.runRaw('DELETE FROM expenses')
    dbOps.runRaw('DELETE FROM rentals')
    dbOps.runRaw('DELETE FROM payouts')
    dbOps.runRaw('DELETE FROM hotel_payouts')
    dbOps.runRaw('DELETE FROM motors')
    dbOps.runRaw('DELETE FROM hotels')
    dbOps.runRaw('DELETE FROM owners')
    forceSaveDb()

    const result = await handlers.get('backup:restore-local')(null, { path: backup.path })

    expect(result.success).toBe(true)
    expect(result.summary.hotels).toBe(expected.hotels)
    expect(result.summary.hotelPayouts).toBe(expected.hotel_payouts)
    expect(result.summary.expenses).toBe(expected.expenses)

    const actual = dbOps.get(`
      SELECT
        (SELECT COUNT(*) FROM owners) as owners,
        (SELECT COUNT(*) FROM motors) as motors,
        (SELECT COUNT(*) FROM hotels) as hotels,
        (SELECT COUNT(*) FROM hotel_payouts) as hotel_payouts,
        (SELECT COUNT(*) FROM rentals) as rentals,
        (SELECT COUNT(*) FROM rental_swaps) as rental_swaps,
        (SELECT COUNT(*) FROM refunds) as refunds,
        (SELECT COUNT(*) FROM payouts) as payouts,
        (SELECT COUNT(*) FROM payout_deductions) as payout_deductions,
        (SELECT COUNT(*) FROM expenses) as expenses,
        (SELECT COUNT(*) FROM cash_transactions) as cash_transactions,
        (SELECT CAST(SUM(total_price) AS INTEGER) FROM rentals) as rental_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM expenses) as expense_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM hotel_payouts) as hotel_payout_total,
        (SELECT CAST(SUM(amount) AS INTEGER) FROM payouts) as payout_total,
        (SELECT CAST(SUM(refund_amount) AS INTEGER) FROM refunds) as refund_total
    `)
    expect(actual).toEqual(expected)
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
