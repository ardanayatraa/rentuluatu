import { ipcMain, app } from 'electron'
import { dbOps, getDb, saveDb, forceSaveDb } from '../db'
import { calcCommission } from '../lib/finance'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { logActivity } from '../lib/activity-log'

const RESET_SETTINGS_FILENAME = 'reset-settings.json'
const TRANSACTION_RESET_WINDOW_DAYS = 3

function assertDevOnly() {
  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    throw new Error('Tindakan ini tidak diizinkan di environment Production!')
  }
}

function isProductionRuntime() {
  return app.isPackaged || process.env.NODE_ENV === 'production'
}

function getResetSettingsPath() {
  return join(app.getPath('userData'), RESET_SETTINGS_FILENAME)
}

function loadResetSettings() {
  try {
    const path = getResetSettingsPath()
    if (!existsSync(path)) return {}
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveResetSettings(nextSettings) {
  writeFileSync(getResetSettingsPath(), JSON.stringify(nextSettings, null, 2))
}

function getProductionResetStatus() {
  if (!isProductionRuntime()) {
    return { visible: false, used: false }
  }
  const settings = loadResetSettings()
  const used = Boolean(settings.productionResetUsed)
  return { visible: !used, used }
}

function ensureTransactionResetWindow() {
  const settings = loadResetSettings()
  const now = Date.now()
  const parsedStart = Date.parse(String(settings.transactionResetStartedAt || ''))
  const startedAtMs = Number.isFinite(parsedStart) ? parsedStart : now
  const expiresAtMs = startedAtMs + (TRANSACTION_RESET_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  if (!Number.isFinite(parsedStart) || !settings.transactionResetStartedAt) {
    saveResetSettings({
      ...settings,
      transactionResetStartedAt: new Date(startedAtMs).toISOString(),
      transactionResetExpiresAt: new Date(expiresAtMs).toISOString()
    })
  }

  return {
    startedAtMs,
    expiresAtMs,
    visible: now <= expiresAtMs
  }
}

function getTransactionResetStatus() {
  const windowState = ensureTransactionResetWindow()
  return {
    visible: windowState.visible,
    startedAt: new Date(windowState.startedAtMs).toISOString(),
    expiresAt: new Date(windowState.expiresAtMs).toISOString()
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function randomDateTimeWithinDays(daysBack) {
  const date = new Date()
  date.setDate(date.getDate() - randomInt(0, daysBack))
  date.setHours(randomInt(8, 20), randomInt(0, 59), 0, 0)
  return date.toISOString().slice(0, 19)
}

function randomDateWithinDays(daysBack) {
  return randomDateTimeWithinDays(daysBack).slice(0, 10)
}

function ensureSandboxMasterData({ rentalCount = 500 } = {}) {
  const ownerCount = Number(dbOps.get('SELECT COUNT(*) as count FROM owners')?.count || 0)
  const hotelCount = Number(dbOps.get('SELECT COUNT(*) as count FROM hotels')?.count || 0)
  const motorCount = Number(dbOps.get('SELECT COUNT(*) as count FROM motors')?.count || 0)
  const targetOwners = Math.max(6, Math.ceil(rentalCount / 750))
  const targetHotels = Math.max(6, Math.ceil(rentalCount / 1200))
  const targetMotors = Math.max(18, Math.ceil(rentalCount / 120))

  const ownerNames = ['Wayan Arta', 'Made Jaya', 'Kadek Surya', 'Komang Putra', 'Gede Ariana', 'Luh Sari']
  const hotelNames = ['IBIS', 'Aston', 'Mercure', 'Grand Zuri', 'Harper', 'Swiss-Belhotel']
  const motorModels = ['Honda Beat', 'Honda Vario 125', 'Honda Scoopy', 'Yamaha NMAX', 'Yamaha Mio M3', 'Honda PCX']
  const created = { owners: 0, hotels: 0, motors: 0 }

  for (let index = ownerCount; index < targetOwners; index += 1) {
    const baseName = ownerNames[index % ownerNames.length]
    const ownerName = index < ownerNames.length ? baseName : `${baseName} ${index + 1}`
    dbOps.run('INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)', [
        ownerName,
        `08123${randomInt(100000, 999999)}`,
        null,
        null
      ])
    created.owners += 1
  }

  for (let index = hotelCount; index < targetHotels; index += 1) {
    const baseName = hotelNames[index % hotelNames.length]
    const hotelName = index < hotelNames.length ? baseName : `${baseName} Cabang ${index + 1}`
    dbOps.run('INSERT INTO hotels (name, phone) VALUES (?, ?)', [
        hotelName,
        `0361${randomInt(100000, 999999)}`
      ])
    created.hotels += 1
  }

  const owners = dbOps.all('SELECT id, name FROM owners ORDER BY id ASC')

  // Rapikan data sandbox lama: jangan ada motor tanpa owner.
  const orphanMotors = dbOps.all('SELECT id FROM motors WHERE owner_id IS NULL ORDER BY id ASC')
  orphanMotors.forEach((motor, index) => {
    const owner = owners[index % owners.length]
    dbOps.run('UPDATE motors SET owner_id = ? WHERE id = ?', [owner.id, motor.id])
  })

  if (targetMotors > motorCount) {
    for (let index = motorCount; index < targetMotors; index += 1) {
      const owner = owners[index % owners.length]
      const type = index % 4 === 0 ? 'aset_pt' : 'milik_pemilik'
      dbOps.run('INSERT INTO motors (model, plate_number, type, owner_id) VALUES (?, ?, ?, ?)', [
        motorModels[index % motorModels.length],
        `DK ${randomInt(1000, 9999)} ${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index + 7) % 26))}`,
        type,
        owner.id
      ])
      created.motors += 1
    }
  }

  return created
}

function getSandboxStats() {
  const tables = [
    ['owners', 'Mitra'],
    ['motors', 'Motor'],
    ['hotels', 'Hotel'],
    ['rentals', 'Rental'],
    ['rental_swaps', 'Ganti Unit'],
    ['expenses', 'Pengeluaran'],
    ['refunds', 'Refund'],
    ['payouts', 'Pencairan Mitra'],
    ['hotel_payouts', 'Pencairan Hotel'],
    ['cash_transactions', 'Mutasi Kas'],
    ['downloads', 'Unduhan']
  ]

  const counts = tables.map(([table, label]) => ({
    table,
    label,
    count: Number(dbOps.get(`SELECT COUNT(*) as count FROM ${table}`)?.count || 0)
  }))

  const db = getDb()
  return {
    counts,
    dbSizeBytes: db.export().length
  }
}

function normalizePlate(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '')
}

function assertDatabaseEmptyForSeed() {
  const nonEmptyTable = [
    ['owners', 'mitra'],
    ['motors', 'motor'],
    ['hotels', 'hotel'],
    ['rentals', 'rental'],
    ['expenses', 'pengeluaran'],
    ['refunds', 'refund'],
    ['cash_transactions', 'mutasi kas']
  ].find(([table]) => Number(dbOps.get(`SELECT COUNT(*) as count FROM ${table}`)?.count || 0) > 0)

  if (nonEmptyTable) {
    throw new Error(`Database belum kosong (${nonEmptyTable[1]} masih ada). Hapus semua data dulu, baru jalankan seed.`)
  }
}

function seedProductionSimulationData() {
  assertDatabaseEmptyForSeed()
  const owners = ['Mitra A', 'Mitra B', 'Mitra C', 'Mitra D']
  const ownerIdByName = {}
  owners.forEach((name, index) => {
    dbOps.run('INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)', [
      name,
      `08123${String(index + 111111).slice(-6)}`,
      null,
      null
    ])
    ownerIdByName[name] = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
  })

  const motorRows = [
    { plate: 'DK 1001 WA', model: 'NMAX BLACK', owner: 'Mitra A', type: 'milik_pemilik' },
    { plate: 'DK 1002 WA', model: 'VARIO WHITE', owner: 'Mitra A', type: 'aset_pt' },
    { plate: 'DK 1003 WA', model: 'SCOOPY GREY', owner: 'Mitra B', type: 'milik_pemilik' },
    { plate: 'DK 1004 WA', model: 'LEXI RED', owner: 'Mitra B', type: 'milik_pemilik' },
    { plate: 'DK 1005 WA', model: 'FAZZIO BLUE', owner: 'Mitra C', type: 'aset_pt' },
    { plate: 'DK 1006 WA', model: 'GEAR BLACK', owner: 'Mitra C', type: 'milik_pemilik' },
    { plate: 'DK 1007 WA', model: 'PCX BLACK', owner: 'Mitra D', type: 'aset_pt' },
    { plate: 'DK 1008 WA', model: 'ADV GREEN', owner: 'Mitra D', type: 'milik_pemilik' }
  ]

  const motorByPlate = {}
  motorRows.forEach((motor) => {
    dbOps.run('INSERT INTO motors (model, plate_number, type, owner_id) VALUES (?, ?, ?, ?)', [
      motor.model,
      motor.plate,
      motor.type,
      ownerIdByName[motor.owner]
    ])
    const id = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
    motorByPlate[normalizePlate(motor.plate)] = { id, ...motor }
  })

  const cashAccounts = dbOps.all('SELECT id, type FROM cash_accounts ORDER BY id ASC')
  const cashByType = Object.fromEntries(cashAccounts.map((account) => [account.type, account]))
  const fallbackAccount = cashAccounts[0]

  const getCashAccountId = (paymentMethod) => (cashByType[paymentMethod] || fallbackAccount)?.id
  const runRentalIncome = (rentalId, paymentMethod, amount, description, date) => {
    const accountId = getCashAccountId(paymentMethod)
    dbOps.run(
      `INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
       VALUES (?, 'in', ?, 'rental', ?, ?, ?)`,
      [accountId, amount, rentalId, description, date]
    )
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [amount, accountId])
  }
  const runVendorFee = (rentalId, amount, description, date) => {
    if (amount <= 0) return
    const tunaiId = getCashAccountId('tunai')
    dbOps.run(
      `INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
       VALUES (?, 'out', ?, 'rental_vendor_fee', ?, ?, ?)`,
      [tunaiId, amount, rentalId, description, date]
    )
    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [amount, tunaiId])
  }

  let invoiceCounter = 1
  const insertRental = ({
    dateTime,
    customerName,
    plate,
    periodDays,
    paymentMethod,
    totalPrice,
    vendorFee = 0,
    relationType = 'rental',
    isExtension = 0,
    parentRentalId = null
  }) => {
    const motor = motorByPlate[normalizePlate(plate)]
    if (!motor) throw new Error(`Motor ${plate} tidak ditemukan pada seeder simulasi`)
    const fee = Number(vendorFee || 0)
    const total = Number(totalPrice || 0)
    const pricePerDay = periodDays > 0 ? total / periodDays : total
    const { sisa, wavy_gets, owner_gets } = calcCommission(motor.type, total, fee)
    const invoice = `SIM-${String(dateTime).slice(0, 10).replace(/-/g, '')}-${String(invoiceCounter).padStart(4, '0')}`
    invoiceCounter += 1

    dbOps.run(`
      INSERT INTO rentals (
        date_time, customer_name, hotel, hotel_id, motor_id, period_days, payment_method, total_price,
        price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number, is_extension, relation_type, parent_rental_id
      ) VALUES (?, ?, '', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
    `, [
      dateTime,
      customerName,
      motor.id,
      periodDays,
      paymentMethod,
      total,
      pricePerDay,
      fee,
      sisa,
      wavy_gets,
      owner_gets,
      invoice,
      isExtension,
      relationType,
      parentRentalId
    ])

    const rentalId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
    const txDate = String(dateTime).slice(0, 10)
    runRentalIncome(rentalId, paymentMethod, total, `Sewa ${plate} - ${customerName}`, txDate)
    runVendorFee(rentalId, fee, `Fee Vendor - ${customerName}`, txDate)
    return { rentalId, invoice, motor }
  }

  const baseRentals = []
  baseRentals.push(insertRental({
    dateTime: '2026-04-01T09:00:00',
    customerName: 'Andi',
    plate: 'DK 1001 WA',
    periodDays: 3,
    paymentMethod: 'debit_card',
    totalPrice: 450000,
    vendorFee: 0
  }))
  baseRentals.push(insertRental({
    dateTime: '2026-04-01T10:00:00',
    customerName: 'Budi',
    plate: 'DK 1002 WA',
    periodDays: 2,
    paymentMethod: 'tunai',
    totalPrice: 260000,
    vendorFee: 15000
  }))
  baseRentals.push(insertRental({
    dateTime: '2026-04-02T08:30:00',
    customerName: 'Citra',
    plate: 'DK 1003 WA',
    periodDays: 4,
    paymentMethod: 'transfer',
    totalPrice: 520000,
    vendorFee: 0
  }))
  baseRentals.push(insertRental({
    dateTime: '2026-04-02T11:15:00',
    customerName: 'Dewa',
    plate: 'DK 1004 WA',
    periodDays: 5,
    paymentMethod: 'qris',
    totalPrice: 700000,
    vendorFee: 0
  }))

  const extendParent = baseRentals[0]
  insertRental({
    dateTime: '2026-04-03T09:30:00',
    customerName: 'Andi',
    plate: 'DK 1001 WA',
    periodDays: 2,
    paymentMethod: 'tunai',
    totalPrice: 260000,
    vendorFee: 0,
    relationType: 'extend',
    isExtension: 1,
    parentRentalId: extendParent.rentalId
  })

  const swapSource = insertRental({
    dateTime: '2026-04-04T10:00:00',
    customerName: 'Eka',
    plate: 'DK 1006 WA',
    periodDays: 6,
    paymentMethod: 'debit_card',
    totalPrice: 900000,
    vendorFee: 0
  })

  const usedDays = 2
  const remainingDays = 4
  const originalTotal = 900000
  const originalVendorFee = 0
  const originalPricePerDay = originalTotal / 6
  const oldRemainingCredit = Math.round(originalTotal * (remainingDays / 6))
  const sourceUsedTotal = Math.round(originalTotal - oldRemainingCredit)
  const sourceUsedVendorFee = Math.round((originalTotal > 0 ? originalVendorFee / originalTotal : 0) * sourceUsedTotal)
  const sourceUsedCommission = calcCommission(swapSource.motor.type, sourceUsedTotal, sourceUsedVendorFee)

  dbOps.run(`
    UPDATE rentals
    SET period_days = ?, total_price = ?, price_per_day = ?, vendor_fee = ?, sisa = ?, wavy_gets = ?, owner_gets = ?, relation_type = 'swap_source'
    WHERE id = ?
  `, [
    usedDays,
    sourceUsedTotal,
    usedDays > 0 ? sourceUsedTotal / usedDays : sourceUsedTotal,
    sourceUsedVendorFee,
    sourceUsedCommission.sisa,
    sourceUsedCommission.wavy_gets,
    sourceUsedCommission.owner_gets,
    swapSource.rentalId
  ])

  const replacementTotal = 800000
  const replacement = insertRental({
    dateTime: '2026-04-06T10:30:00',
    customerName: 'Eka',
    plate: 'DK 1008 WA',
    periodDays: remainingDays,
    paymentMethod: 'debit_card',
    totalPrice: replacementTotal,
    vendorFee: 0,
    relationType: 'swap',
    isExtension: 0,
    parentRentalId: swapSource.rentalId
  })

  const settlementDelta = Math.round(replacementTotal - oldRemainingCredit)
  const settlementType = settlementDelta > 0 ? 'topup' : settlementDelta < 0 ? 'refund' : 'none'
  const settlementAmount = Math.abs(settlementDelta)
  const settlementMethod = settlementType === 'none' ? null : 'tunai'
  if (settlementType !== 'none') {
    const settlementAccountId = getCashAccountId(settlementMethod)
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
      VALUES (?, ?, ?, 'rental_swap_settlement', ?, ?, ?)
    `, [
      settlementAccountId,
      settlementType === 'topup' ? 'in' : 'out',
      settlementAmount,
      replacement.rentalId,
      settlementType === 'topup' ? 'Top up ganti unit (Seeder)' : 'Refund ganti unit (Seeder)',
      '2026-04-06'
    ])
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [
      settlementType === 'topup' ? settlementAmount : -settlementAmount,
      settlementAccountId
    ])
  }

  dbOps.run(`
    INSERT INTO rental_swaps (
      source_rental_id, replacement_rental_id, switch_date_time, used_days, remaining_days,
      original_price_per_day, original_remaining_credit, replacement_price_per_day, replacement_total_price,
      settlement_type, settlement_amount, settlement_payment_method, settlement_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    swapSource.rentalId,
    replacement.rentalId,
    '2026-04-06T10:30:00',
    usedDays,
    remainingDays,
    originalPricePerDay,
    oldRemainingCredit,
    replacementTotal / remainingDays,
    replacementTotal,
    settlementType,
    settlementAmount,
    settlementMethod,
    'Seeder simulasi ganti unit'
  ])

  const seededRentalCount = Number(dbOps.get('SELECT COUNT(*) as count FROM rentals')?.count || 0)
  forceSaveDb()
  return {
    ...getSandboxStats(),
    addedMasters: {
      owners: owners.length,
      hotels: 0,
      motors: motorRows.length
    },
    rentalSeeded: seededRentalCount
  }
}

function seedSandboxData({ rentalCount = 500, daysBack = 365 }) {
  const addedMasters = ensureSandboxMasterData({ rentalCount })

  const motors = dbOps.all('SELECT id, model, plate_number, type, owner_id FROM motors ORDER BY id ASC')
  const hotels = dbOps.all('SELECT id, name FROM hotels ORDER BY id ASC')
  const cashAccounts = dbOps.all('SELECT id, type, balance FROM cash_accounts ORDER BY id ASC')
  const cashAccountByType = Object.fromEntries(cashAccounts.map((account) => [account.type, account]))
  const categoriesMotor = ['service', 'samsat', 'ganti oli', 'ban', 'lainnya']
  const categoriesGeneral = ['air', 'listrik', 'internet', 'bensin', 'lainnya']
  const customerNames = ['Budi', 'Sarah', 'Kevin', 'Anita', 'Dian', 'Michael', 'Putu', 'Raka']

  let maxRentalId = Number(dbOps.get('SELECT COALESCE(MAX(id), 0) as id FROM rentals')?.id || 0)
  const completedBaseRentals = []

  for (let index = 0; index < rentalCount; index += 1) {
    const motor = pick(motors)
    const hotel = Math.random() > 0.2 ? pick(hotels) : null
    const periodDays = randomInt(1, 7)
    const pricePerDay = pick([75000, 85000, 100000, 125000, 150000])
    const totalPrice = periodDays * pricePerDay
    const vendorFee = hotel ? pick([0, 10000, 15000, 20000]) : 0
    const { sisa, wavy_gets, owner_gets } = calcCommission(motor.type, totalPrice, vendorFee)
    const paymentMethod = pick(['tunai', 'transfer', 'qris', 'debit_card'])
    const cashAccount = cashAccountByType[paymentMethod] || cashAccounts[0]
    const dateTime = randomDateTimeWithinDays(daysBack)
    const status = Math.random() > 0.08 ? 'completed' : 'refunded'
    maxRentalId += 1
    const invoiceNumber = `INV-${dateTime.slice(0, 10).replace(/-/g, '')}-${String(maxRentalId).padStart(5, '0')}`

    dbOps.run(`
      INSERT INTO rentals (
        date_time, customer_name, hotel, hotel_id, motor_id, period_days, payment_method,
        total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number, relation_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dateTime,
      pick(customerNames),
      hotel?.name || '',
      hotel?.id || null,
      motor.id,
      periodDays,
      paymentMethod,
      totalPrice,
      pricePerDay,
      vendorFee,
      sisa,
      wavy_gets,
      owner_gets,
      status,
      invoiceNumber,
      'rental'
    ])

    const rentalId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
    dbOps.run(`
      INSERT INTO cash_transactions (
        cash_account_id, type, amount, reference_type, reference_id, description, date
      ) VALUES (?, 'in', ?, 'rental', ?, ?, ?)
    `, [cashAccount.id, totalPrice, rentalId, `Sewa ${invoiceNumber}`, dateTime.slice(0, 10)])
    dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [totalPrice, cashAccount.id])
    if (vendorFee > 0) {
      const cashTunai = cashAccountByType.tunai || cashAccounts[0]
      dbOps.run(`
        INSERT INTO cash_transactions (
          cash_account_id, type, amount, reference_type, reference_id, description, date
        ) VALUES (?, 'out', ?, 'rental_vendor_fee', ?, ?, ?)
      `, [cashTunai.id, vendorFee, rentalId, `Fee Vendor ${invoiceNumber}`, dateTime.slice(0, 10)])
      dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?', [vendorFee, cashTunai.id])
    }

    if (status === 'completed') {
      completedBaseRentals.push({
        id: rentalId,
        dateTime,
        customerName: pick(customerNames),
        hotelName: hotel?.name || '',
        hotelId: hotel?.id || null,
        motorId: motor.id,
        motorType: motor.type,
        periodDays,
        totalPrice,
        pricePerDay,
        vendorFee,
        paymentMethod
      })
    }

    if (status === 'refunded') {
      const refundDays = randomInt(1, periodDays)
      const refundAmount = refundDays * pricePerDay * pick([0.5, 1])
      dbOps.run('INSERT INTO refunds (rental_id, refund_percentage, refund_amount, remaining_days, reason) VALUES (?, ?, ?, ?, ?)', [
        rentalId,
        refundAmount === refundDays * pricePerDay ? 100 : 50,
        refundAmount,
        refundDays,
        'Sandbox refund'
      ])
      dbOps.run(`
        INSERT INTO cash_transactions (
          cash_account_id, type, amount, reference_type, reference_id, description, date
        ) VALUES (?, 'out', ?, 'refund', ?, ?, ?)
      `, [cashAccount.id, refundAmount, rentalId, `Refund ${invoiceNumber}`, dateTime.slice(0, 10)])
      dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?', [refundAmount, cashAccount.id])
    }

    if (Math.random() > 0.55) {
      const expenseType = Math.random() > 0.4 ? 'motor' : 'umum'
      const amount = pick([20000, 30000, 50000, 75000, 100000])
      const expenseDate = randomDateWithinDays(daysBack)
      dbOps.run(`
        INSERT INTO expenses (type, motor_id, category, amount, payment_method, description, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        expenseType,
        expenseType === 'motor' ? motor.id : null,
        pick(expenseType === 'motor' ? categoriesMotor : categoriesGeneral),
        amount,
        paymentMethod,
        'Sandbox expense',
        expenseDate
      ])
      const expenseId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
      dbOps.run(`
        INSERT INTO cash_transactions (
          cash_account_id, type, amount, reference_type, reference_id, description, date
        ) VALUES (?, 'out', ?, 'expense', ?, ?, ?)
      `, [cashAccount.id, amount, expenseId, 'Sandbox expense', expenseDate])
      dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?', [amount, cashAccount.id])
    }
  }

  // Seed sample EXTEND agar tab extend terisi realistis
  const extendTarget = Math.min(Math.max(1, Math.round(rentalCount * 0.08)), completedBaseRentals.length)
  for (let index = 0; index < extendTarget; index += 1) {
    const parent = pick(completedBaseRentals)
    const extendDays = randomInt(1, 4)
    const extendPricePerDay = pick([75000, 85000, 100000, 125000, 150000])
    const extendTotal = extendDays * extendPricePerDay
    // Aturan bisnis: extend tidak membawa fee vendor.
    const extendVendorFee = 0
    const extendCommission = calcCommission(parent.motorType, extendTotal, extendVendorFee)
    const extendDateTime = randomDateTimeWithinDays(daysBack)
    const extendInvoice = `EXT-${extendDateTime.slice(0, 10).replace(/-/g, '')}-${String(parent.id).padStart(5, '0')}-${index + 1}`
    const extendPaymentMethod = pick(['tunai', 'transfer', 'qris', 'debit_card'])
    const extendCashAccount = cashAccountByType[extendPaymentMethod] || cashAccounts[0]

    dbOps.run(`
      INSERT INTO rentals (
        date_time, customer_name, hotel, hotel_id, motor_id, period_days, payment_method,
        total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status,
        invoice_number, is_extension, relation_type, parent_rental_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 1, 'extend', ?)
    `, [
      extendDateTime,
      parent.customerName,
      parent.hotelName,
      parent.hotelId,
      parent.motorId,
      extendDays,
      extendPaymentMethod,
      extendTotal,
      extendPricePerDay,
      extendVendorFee,
      extendCommission.sisa,
      extendCommission.wavy_gets,
      extendCommission.owner_gets,
      extendInvoice,
      parent.id
    ])

    const extendRentalId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
    dbOps.run(`
      INSERT INTO cash_transactions (
        cash_account_id, type, amount, reference_type, reference_id, description, date
      ) VALUES (?, 'in', ?, 'rental', ?, ?, ?)
    `, [extendCashAccount.id, extendTotal, extendRentalId, `Extend ${extendInvoice}`, extendDateTime.slice(0, 10)])
    dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [extendTotal, extendCashAccount.id])
  }

  // Seed sample GANTI UNIT agar tab swap terisi realistis
  const swapCandidates = completedBaseRentals.filter((item) => Number(item.periodDays || 0) >= 2)
  const swapTarget = Math.min(Math.max(1, Math.round(rentalCount * 0.04)), swapCandidates.length)
  const usedSwapSources = new Set()
  for (let index = 0; index < swapTarget; index += 1) {
    const source = pick(swapCandidates.filter((item) => !usedSwapSources.has(item.id)))
    if (!source) break
    usedSwapSources.add(source.id)

    const remainingDays = randomInt(1, Math.max(1, source.periodDays - 1))
    const usedDays = source.periodDays - remainingDays
    const oldRemainingCredit = Math.round(source.totalPrice * (remainingDays / source.periodDays))
    const sourceUsedTotal = Math.max(0, Math.round(source.totalPrice - oldRemainingCredit))
    const sourceVendorRatio = source.totalPrice > 0 ? Number(source.vendorFee || 0) / Number(source.totalPrice || 1) : 0
    const sourceUsedVendorFee = Math.round(sourceVendorRatio * sourceUsedTotal)
    const sourceUsedCommission = calcCommission(source.motorType, sourceUsedTotal, sourceUsedVendorFee)

    dbOps.run(`
      UPDATE rentals
      SET period_days = ?, total_price = ?, price_per_day = ?, vendor_fee = ?, sisa = ?, wavy_gets = ?, owner_gets = ?, relation_type = 'swap_source'
      WHERE id = ?
    `, [
      usedDays,
      sourceUsedTotal,
      usedDays > 0 ? sourceUsedTotal / usedDays : sourceUsedTotal,
      sourceUsedVendorFee,
      sourceUsedCommission.sisa,
      sourceUsedCommission.wavy_gets,
      sourceUsedCommission.owner_gets,
      source.id
    ])

    const replacementMotor = pick(motors.filter((item) => Number(item.id) !== Number(source.motorId)))
    if (!replacementMotor) continue
    const replacementPricePerDay = pick([75000, 85000, 100000, 125000, 150000, 175000])
    const replacementTotal = Math.round(replacementPricePerDay * remainingDays)
    // Aturan bisnis: motor pengganti tidak membawa fee vendor.
    const replacementVendorFee = 0
    const replacementCommission = calcCommission(replacementMotor.type, replacementTotal, replacementVendorFee)
    const switchDateTime = randomDateTimeWithinDays(daysBack)
    const replacementInvoice = `SWP-${switchDateTime.slice(0, 10).replace(/-/g, '')}-${String(source.id).padStart(5, '0')}-${index + 1}`

    dbOps.run(`
      INSERT INTO rentals (
        date_time, customer_name, hotel, hotel_id, motor_id, period_days, payment_method,
        total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status,
        invoice_number, relation_type, parent_rental_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 'swap', ?)
    `, [
      switchDateTime,
      source.customerName,
      source.hotelName,
      source.hotelId,
      replacementMotor.id,
      remainingDays,
      source.paymentMethod,
      replacementTotal,
      replacementPricePerDay,
      replacementVendorFee,
      replacementCommission.sisa,
      replacementCommission.wavy_gets,
      replacementCommission.owner_gets,
      replacementInvoice,
      source.id
    ])

    const replacementRentalId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
    const settlementDelta = Math.round(replacementTotal - oldRemainingCredit)
    const settlementType = settlementDelta > 0 ? 'topup' : settlementDelta < 0 ? 'refund' : 'none'
    const settlementAmount = Math.abs(settlementDelta)
    const settlementPaymentMethod = settlementType === 'none' ? null : pick(['tunai', 'transfer', 'qris', 'debit_card'])
    const settlementAccount = settlementPaymentMethod ? (cashAccountByType[settlementPaymentMethod] || cashAccounts[0]) : null

    if (settlementType !== 'none' && settlementAccount) {
      const txType = settlementType === 'topup' ? 'in' : 'out'
      dbOps.run(`
        INSERT INTO cash_transactions (
          cash_account_id, type, amount, reference_type, reference_id, description, date
        ) VALUES (?, ?, ?, 'rental_swap_settlement', ?, ?, ?)
      `, [
        settlementAccount.id,
        txType,
        settlementAmount,
        replacementRentalId,
        settlementType === 'topup' ? 'Sandbox swap topup' : 'Sandbox swap refund',
        switchDateTime.slice(0, 10)
      ])
      dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [
        settlementType === 'topup' ? settlementAmount : -settlementAmount,
        settlementAccount.id
      ])
    }

    dbOps.run(`
      INSERT INTO rental_swaps (
        source_rental_id, replacement_rental_id, switch_date_time, used_days, remaining_days,
        original_price_per_day, original_remaining_credit, replacement_price_per_day, replacement_total_price,
        settlement_type, settlement_amount, settlement_payment_method, settlement_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      source.id,
      replacementRentalId,
      switchDateTime,
      usedDays,
      remainingDays,
      source.pricePerDay,
      oldRemainingCredit,
      replacementPricePerDay,
      replacementTotal,
      settlementType,
      settlementAmount,
      settlementPaymentMethod,
      'Sandbox swap'
    ])
  }

  const owners = dbOps.all('SELECT id FROM owners ORDER BY id ASC')
  const orphanMotors = dbOps.all('SELECT id FROM motors WHERE owner_id IS NULL ORDER BY id ASC')
  orphanMotors.forEach((motor, index) => {
    const owner = owners[index % owners.length]
    dbOps.run('UPDATE motors SET owner_id = ? WHERE id = ?', [owner.id, motor.id])
  })

  forceSaveDb()
  return {
    ...getSandboxStats(),
    addedMasters
  }
}

export function registerResetHandlers() {
  const performResetTransactionsOnly = () => {
    const db = getDb()

    db.run('PRAGMA foreign_keys = OFF')

    try {
      db.run('DELETE FROM rental_swaps')
      db.run('DELETE FROM payout_deductions')
      db.run('DELETE FROM refunds')
      db.run('DELETE FROM cash_transactions')
      db.run('DELETE FROM hotel_payouts')
      db.run('DELETE FROM payouts')
      db.run('DELETE FROM rentals')
      db.run('DELETE FROM expenses')
      db.run('UPDATE cash_accounts SET balance = 0')
      db.run(`DELETE FROM sqlite_sequence WHERE name IN (
        'payout_deductions', 'refunds', 'cash_transactions',
        'hotel_payouts', 'rentals', 'rental_swaps', 'expenses', 'payouts'
      )`)
    } finally {
      db.run('PRAGMA foreign_keys = ON')
      db.run('VACUUM')
      saveDb()
    }

    return { success: true }
  }

  const performResetAllData = () => {
    const db = getDb()

    // Matikan Foreign Key check sementara agar bisa hapus semua tanpa error urutan
    db.run('PRAGMA foreign_keys = OFF')

    try {
      // Hapus data transaksi
      db.run('DELETE FROM rental_swaps')
      db.run('DELETE FROM payout_deductions')
      db.run('DELETE FROM refunds')
      db.run('DELETE FROM cash_transactions')
      db.run('DELETE FROM hotel_payouts')
      db.run('DELETE FROM payouts')
      db.run('DELETE FROM rentals')
      db.run('DELETE FROM expenses')

      // Hapus master data
      db.run('DELETE FROM hotels')
      db.run('DELETE FROM motors')
      db.run('DELETE FROM owners')

      // Reset saldo kas kembali ke 0
      db.run('UPDATE cash_accounts SET balance = 0')

      // Reset autoincrement ID kembali ke 1
      db.run(`DELETE FROM sqlite_sequence WHERE name IN (
        'payout_deductions', 'refunds', 'cash_transactions',
        'hotel_payouts', 'rentals', 'rental_swaps', 'expenses', 'payouts',
        'hotels', 'motors', 'owners'
      )`)

    } finally {
      // Hidupkan kembali FK check
      db.run('PRAGMA foreign_keys = ON')
      db.run('VACUUM')
      saveDb()
    }

    return { success: true }
  }

  ipcMain.handle('db:reset-all', () => {
    assertDevOnly()
    const result = performResetAllData()
    logActivity({
      action: 'system.reset-all',
      detail: 'Reset semua data dilakukan dari pengaturan (development mode)'
    })
    return result
  })

  ipcMain.handle('db:production-reset-status', () => {
    return getProductionResetStatus()
  })

  ipcMain.handle('db:production-reset-once', () => {
    if (!isProductionRuntime()) {
      throw new Error('Reset production hanya tersedia pada build production')
    }
    const current = loadResetSettings()
    if (current.productionResetUsed) {
      throw new Error('Reset production sudah pernah digunakan di instalasi ini')
    }

    const result = performResetAllData()
    logActivity({
      action: 'system.reset-production-once',
      detail: 'Reset data production sekali pakai dijalankan'
    })
    saveResetSettings({
      ...current,
      productionResetUsed: true,
      productionResetUsedAt: new Date().toISOString()
    })
    return {
      ...result,
      used: true
    }
  })

  ipcMain.handle('db:reset-transactions-status', () => {
    return getTransactionResetStatus()
  })

  ipcMain.handle('db:reset-transactions-only', () => {
    const status = getTransactionResetStatus()
    if (!status.visible) {
      throw new Error('Masa reset transaksi (3 hari) sudah berakhir.')
    }

    const result = performResetTransactionsOnly()
    logActivity({
      action: 'system.reset-transactions-only',
      detail: 'Reset transaksi saja dijalankan dari pengaturan'
    })
    return {
      ...result,
      expiresAt: status.expiresAt
    }
  })

  ipcMain.handle('db:dev-stats', () => {
    assertDevOnly()
    return getSandboxStats()
  })

  ipcMain.handle('db:dev-seed', (_, payload = {}) => {
    assertDevOnly()
    const rentalCount = Math.max(1, Math.min(50000, Number(payload.rentalCount) || 500))
    const daysBack = Math.max(30, Math.min(3650, Number(payload.daysBack) || 365))
    const stats = seedSandboxData({ rentalCount, daysBack })
    return {
      success: true,
      rentalCount,
      daysBack,
      stats
    }
  })

  ipcMain.handle('db:seed-prod-simulation', () => {
    assertDevOnly()
    const stats = seedProductionSimulationData()
    return {
      success: true,
      stats
    }
  })
}
