import { ipcMain, app } from 'electron'
import { dbOps, getDb, saveDb, forceSaveDb } from '../db'

function assertDevOnly() {
  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    throw new Error('Tindakan ini tidak diizinkan di environment Production!')
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
        `1000${randomInt(100000, 999999)}`,
        ['BCA', 'BRI', 'BNI'][index % 3]
      ])
    created.owners += 1
  }

  for (let index = hotelCount; index < targetHotels; index += 1) {
    const baseName = hotelNames[index % hotelNames.length]
    const hotelName = index < hotelNames.length ? baseName : `${baseName} Cabang ${index + 1}`
    dbOps.run('INSERT INTO hotels (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)', [
        hotelName,
        `0361${randomInt(100000, 999999)}`,
        `2000${randomInt(100000, 999999)}`,
        'BCA'
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
      const type = index % 4 === 0 ? 'pribadi' : 'titipan'
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

  for (let index = 0; index < rentalCount; index += 1) {
    const motor = pick(motors)
    const hotel = Math.random() > 0.2 ? pick(hotels) : null
    const periodDays = randomInt(1, 7)
    const pricePerDay = pick([75000, 85000, 100000, 125000, 150000])
    const totalPrice = periodDays * pricePerDay
    const vendorFee = hotel ? pick([0, 10000, 15000, 20000]) : 0
    const net = totalPrice - vendorFee
    const wavyPercentage = motor.type === 'pribadi' ? 0.2 : 0.3
    const paymentMethod = pick(['tunai', 'transfer', 'qris', 'debit_card'])
    const cashAccount = cashAccountByType[paymentMethod] || cashAccounts[0]
    const dateTime = randomDateTimeWithinDays(daysBack)
    const status = Math.random() > 0.08 ? 'completed' : 'refunded'
    maxRentalId += 1
    const invoiceNumber = `INV-${dateTime.slice(0, 10).replace(/-/g, '')}-${String(maxRentalId).padStart(5, '0')}`

    dbOps.run(`
      INSERT INTO rentals (
        date_time, customer_name, hotel, hotel_id, motor_id, period_days, payment_method,
        total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      net,
      net * wavyPercentage,
      net * (1 - wavyPercentage),
      status,
      invoiceNumber
    ])

    const rentalId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
    dbOps.run(`
      INSERT INTO cash_transactions (
        cash_account_id, type, amount, reference_type, reference_id, description, date
      ) VALUES (?, 'in', ?, 'rental', ?, ?, ?)
    `, [cashAccount.id, totalPrice, rentalId, `Sewa ${invoiceNumber}`, dateTime.slice(0, 10)])
    dbOps.run('UPDATE cash_accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?', [totalPrice, cashAccount.id])

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
  ipcMain.handle('db:reset-all', () => {
    assertDevOnly()

    const db = getDb()
    
    // Matikan Foreign Key check sementara agar bisa hapus semua tanpa error urutan
    db.run('PRAGMA foreign_keys = OFF')

    try {
      // Hapus data transaksi
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
        'hotel_payouts', 'rentals', 'expenses', 'payouts',
        'hotels', 'motors', 'owners'
      )`)

    } finally {
      // Hidupkan kembali FK check
      db.run('PRAGMA foreign_keys = ON')
      db.run('VACUUM')
      saveDb()
    }

    return { success: true }
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
}
