import { ipcMain } from 'electron'
import { dbOps } from '../db'

function calcCommission(motorType, totalPrice, vendorFee) {
  const sisa = totalPrice - vendorFee
  const wavyPct = motorType === 'pribadi' ? 0.20 : 0.30
  return {
    sisa,
    wavy_gets: sisa * wavyPct,
    owner_gets: sisa * (1 - wavyPct)
  }
}

export function registerRentalHandlers() {
  ipcMain.handle('rental:get-all', (_, filters = {}) => {
    let query = `
      SELECT r.*, m.model, m.plate_number, m.type as motor_type
      FROM rentals r JOIN motors m ON r.motor_id = m.id WHERE 1=1
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

    const { sisa, wavy_gets, owner_gets } = calcCommission(
      motor.type, data.total_price, data.vendor_fee || 0
    )

    const pricePerDay = data.period_days > 0 ? data.total_price / data.period_days : data.total_price

    dbOps.run(`
      INSERT INTO rentals (date_time, customer_name, hotel, motor_id, period_days,
        payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [data.date_time, data.customer_name, data.hotel || null, data.motor_id,
        data.period_days, data.payment_method, data.total_price, pricePerDay,
        data.vendor_fee || 0, sisa, wavy_gets, owner_gets, data.status || 'completed'])

    const { id: rentalId } = dbOps.get('SELECT last_insert_rowid() as id')

    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [data.payment_method])
    if (cashAccount) {
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'in', ?, 'rental', ?, ?, ?)
      `, [cashAccount.id, data.total_price, rentalId, `Sewa ${motor.model} - ${data.customer_name}`, data.date_time.split('T')[0]])
      dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [data.total_price, cashAccount.id])
    }

    return { id: rentalId }
  })

  ipcMain.handle('rental:update', (_, { id, ...data }) => {
    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    const { sisa, wavy_gets, owner_gets } = calcCommission(
      motor.type, data.total_price, data.vendor_fee || 0
    )
    const pricePerDay = data.period_days > 0 ? data.total_price / data.period_days : data.total_price
    dbOps.run(`
      UPDATE rentals SET date_time=?, customer_name=?, hotel=?, motor_id=?, period_days=?,
        payment_method=?, total_price=?, price_per_day=?, vendor_fee=?, sisa=?, wavy_gets=?, owner_gets=?
      WHERE id=?
    `, [data.date_time, data.customer_name, data.hotel, data.motor_id, data.period_days,
        data.payment_method, data.total_price, pricePerDay, data.vendor_fee || 0, sisa, wavy_gets, owner_gets, id])
    return { success: true }
  })

  ipcMain.handle('rental:complete', (_, id) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [id])
    if (!rental) throw new Error('Rental tidak ditemukan')
    dbOps.run("UPDATE rentals SET status = 'completed' WHERE id = ?", [id])
    return { success: true }
  })
}
