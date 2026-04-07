import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { calcCommission } from '../lib/finance'

export function registerRentalHandlers() {
  const generateInvoiceNumber = (dateTime) => {
    const dt = new Date(dateTime)
    const yr = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const existing = dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE invoice_number LIKE ?", [`WVY-${yr}-${mo}-%`])
    const seq = String((existing?.c || 0) + 1).padStart(4, '0')
    return `WVY-${yr}-${mo}-${seq}`
  }

  ipcMain.handle('rental:get-all', (_, filters = {}) => {
    let query = `
      SELECT r.*, m.model, m.plate_number, m.type as motor_type, h.name as vendor_name
      FROM rentals r 
      JOIN motors m ON r.motor_id = m.id 
      LEFT JOIN hotels h ON r.hotel_id = h.id 
      WHERE 1=1
    `
    const params = []
    if (filters.startDate) { query += ' AND r.date_time >= ?'; params.push(filters.startDate) }
    if (filters.endDate) { query += ' AND r.date_time <= ?'; params.push(filters.endDate) }
    if (filters.status) { query += ' AND r.status = ?'; params.push(filters.status) }
    query += ' ORDER BY r.date_time DESC'
    return dbOps.all(query, params)
  })

  ipcMain.handle('rental:get-by-id', (_, id) => {
    return dbOps.get(`
      SELECT r.*, m.model, m.plate_number, m.type as motor_type, o.name as owner_name
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE r.id = ?
    `, [id])
  })

  ipcMain.handle('rental:create', (_, data) => {
    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    if (!motor) throw new Error('Motor tidak ditemukan')

    // FIX #3: Validasi vendor_fee tidak boleh melebihi total_price
    const vendorFee = data.vendor_fee || 0
    if (vendorFee < 0) throw new Error('Vendor fee tidak boleh negatif')
    if (vendorFee > data.total_price) throw new Error('Vendor fee tidak boleh melebihi total harga sewa')

    const { sisa, wavy_gets, owner_gets } = calcCommission(
      motor.type, data.total_price, vendorFee
    )
    const pricePerDay = data.period_days > 0 ? data.total_price / data.period_days : data.total_price

    const invoiceNumber = generateInvoiceNumber(data.date_time)

    dbOps.runRaw(`
      INSERT INTO rentals (date_time, customer_name, hotel, hotel_id, motor_id, period_days,
        payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.date_time, data.customer_name, data.hotel || null, data.hotel_id || null, data.motor_id,
        data.period_days, data.payment_method, data.total_price, pricePerDay,
        vendorFee, sisa, wavy_gets, owner_gets, data.status || 'completed', invoiceNumber])

    const { id: rentalId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [data.payment_method])
    if (cashAccount) {
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'in', ?, 'rental', ?, ?, ?)
      `, [cashAccount.id, data.total_price, rentalId, `Sewa ${motor.model} - ${data.customer_name}`, data.date_time.split('T')[0]])
      dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [data.total_price, cashAccount.id])
    }

    return { id: rentalId, invoice_number: invoiceNumber }
  })

  ipcMain.handle('rental:extend', (_, data) => {
    const parentRental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [data.parent_rental_id])
    if (!parentRental) throw new Error('Transaksi awal tidak ditemukan')
    if (parentRental.status === 'refunded') throw new Error('Transaksi refunded tidak bisa di-extend')

    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    if (!motor) throw new Error('Motor tidak ditemukan')

    const periodDays = Number(data.period_days || 0)
    const totalPrice = Number(data.total_price || 0)
    if (!periodDays || periodDays < 1) throw new Error('Periode extend minimal 1 hari')
    if (!totalPrice || totalPrice <= 0) throw new Error('Total harga extend harus lebih dari 0')

    const paymentMethod = String(data.payment_method || '')
    if (!['tunai', 'transfer', 'qris', 'debit_card'].includes(paymentMethod)) {
      throw new Error('Metode pembayaran tidak valid')
    }

    const parentVendorFeeRatio = parentRental.total_price > 0
      ? Number(parentRental.vendor_fee || 0) / Number(parentRental.total_price || 1)
      : 0
    const vendorFee = Math.min(totalPrice, Math.max(0, Math.round(totalPrice * parentVendorFeeRatio)))

    const { sisa, wavy_gets, owner_gets } = calcCommission(motor.type, totalPrice, vendorFee)
    const pricePerDay = periodDays > 0 ? totalPrice / periodDays : totalPrice
    const invoiceNumber = generateInvoiceNumber(data.date_time)

    dbOps.runRaw(`
      INSERT INTO rentals (
        date_time, customer_name, hotel, hotel_id, motor_id, period_days,
        payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets,
        status, invoice_number, is_extension, parent_rental_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 1, ?)
    `, [
      data.date_time,
      parentRental.customer_name,
      parentRental.hotel || null,
      parentRental.hotel_id || null,
      data.motor_id,
      periodDays,
      paymentMethod,
      totalPrice,
      pricePerDay,
      vendorFee,
      sisa,
      wavy_gets,
      owner_gets,
      invoiceNumber,
      parentRental.id
    ])

    const { id: rentalId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [paymentMethod])
    if (cashAccount) {
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'in', ?, 'rental', ?, ?, ?)
      `, [
        cashAccount.id,
        totalPrice,
        rentalId,
        `Extend Sewa ${motor.model} - ${parentRental.customer_name}`,
        data.date_time.split('T')[0]
      ])
      dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [totalPrice, cashAccount.id])
    }

    return { id: rentalId, invoice_number: invoiceNumber }
  })

  ipcMain.handle('rental:update', (_, { id, ...data }) => {
    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    // FIX #3: Validasi vendor_fee saat update juga
    const vendorFee = data.vendor_fee || 0
    if (vendorFee < 0) throw new Error('Vendor fee tidak boleh negatif')
    if (vendorFee > data.total_price) throw new Error('Vendor fee tidak boleh melebihi total harga sewa')

    const { sisa, wavy_gets, owner_gets } = calcCommission(
      motor.type, data.total_price, vendorFee
    )
    const pricePerDay = data.period_days > 0 ? data.total_price / data.period_days : data.total_price
    dbOps.run(`
      UPDATE rentals SET date_time=?, customer_name=?, hotel=?, hotel_id=?, motor_id=?, period_days=?,
        payment_method=?, total_price=?, price_per_day=?, vendor_fee=?, sisa=?, wavy_gets=?, owner_gets=?
      WHERE id=?
    `, [data.date_time, data.customer_name, data.hotel || null, data.hotel_id || null, data.motor_id, data.period_days,
        data.payment_method, data.total_price, pricePerDay, vendorFee, sisa, wavy_gets, owner_gets, id])
    return { success: true }
  })

  ipcMain.handle('rental:delete', (_, id) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [id])
    if (!rental) throw new Error('Rental tidak ditemukan')

    // Tidak boleh hapus kalau sudah masuk payout owner atau hotel
    if (rental.payout_id && rental.payout_id !== 0) {
      throw new Error('Rental tidak bisa dihapus karena sudah masuk ke pencairan komisi owner')
    }
    if (rental.hotel_payout_id) {
      throw new Error('Rental tidak bisa dihapus karena sudah masuk ke pencairan komisi vendor')
    }

    // Kembalikan saldo kas
    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [rental.payment_method])
    if (cashAccount && rental.status !== 'refunded') {
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [rental.total_price, cashAccount.id])
      dbOps.run("DELETE FROM cash_transactions WHERE reference_type = 'rental' AND reference_id = ?", [id])
    }

    // Hapus refund terkait jika ada
    dbOps.run('DELETE FROM refunds WHERE rental_id = ?', [id])
    dbOps.run('DELETE FROM rentals WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('rental:complete', (_, id) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [id])
    if (!rental) throw new Error('Rental tidak ditemukan')
    dbOps.run("UPDATE rentals SET status = 'completed' WHERE id = ?", [id])
    return { success: true }
  })
}
