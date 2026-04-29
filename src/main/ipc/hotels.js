import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { logActivity } from '../lib/activity-log'

export function registerHotelHandlers() {
  const buildDateFilter = (column, startDate, endDate, params) => {
    if (startDate) {
      params.push(startDate)
      if (endDate) {
        params.push(endDate)
        return ` AND date(${column}) BETWEEN date(?) AND date(?)`
      }
      return ` AND date(${column}) >= date(?)`
    }
    if (endDate) {
      params.push(endDate)
      return ` AND date(${column}) <= date(?)`
    }
    return ''
  }

  ipcMain.handle('hotel:get-all', () => {
    return dbOps.all(`
      SELECT h.*, 
        (
          SELECT COALESCE(SUM(r.vendor_fee), 0)
          FROM rentals r
          WHERE r.hotel_id = h.id
            AND r.status != 'refunded'
            AND r.vendor_fee > 0
            AND COALESCE(r.relation_type, 'rental') IN ('rental', 'extend', 'swap_source')
        ) as total_commission,
        (
          SELECT COALESCE(SUM(r.vendor_fee), 0)
          FROM rentals r
          WHERE r.hotel_id = h.id
            AND r.status != 'refunded'
            AND r.vendor_fee > 0
            AND COALESCE(r.relation_type, 'rental') IN ('rental', 'extend', 'swap_source')
            AND NOT EXISTS (
              SELECT 1
              FROM cash_transactions ct
              WHERE ct.reference_type = 'rental_vendor_fee'
                AND ct.reference_id = r.id
            )
        ) as unpaid_commission
      FROM hotels h ORDER BY name ASC
    `)
  })

  ipcMain.handle('hotel:get-by-id', (_, id) => {
    const hotel = dbOps.get('SELECT * FROM hotels WHERE id = ?', [id])
    return { ...hotel }
  })

  ipcMain.handle('hotel:create', (_, data) => {
    const name = String(data?.name || '').trim()
    if (!name) throw new Error('Nama hotel/vendor wajib diisi')

    // FIX #4: Cek duplikat nama hotel
    const existing = dbOps.get('SELECT id FROM hotels WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [name])
    if (existing) throw new Error(`Vendor dengan nama "${name}" sudah terdaftar`)

    dbOps.runRaw(
      'INSERT INTO hotels (name) VALUES (?)',
      [
        name
      ]
    )
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()
    logActivity({
      source: 'user',
      action: 'hotel.create',
      detail: `Tambah vendor/hotel ${name}`
    })
    return { id: row.id }
  })

  ipcMain.handle('hotel:update', (_, { id, ...data }) => {
    // FIX #4: Cek duplikat nama hotel saat update (kecuali diri sendiri)
    const existing = dbOps.get(
      'SELECT id FROM hotels WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?',
      [data.name, id]
    )
    if (existing) throw new Error(`Vendor dengan nama "${data.name}" sudah terdaftar`)

    dbOps.run(
      'UPDATE hotels SET name=?, is_active=? WHERE id=?',
      [data.name, data.is_active ?? 1, id]
    )
    logActivity({
      source: 'user',
      action: 'hotel.update',
      detail: `Update vendor/hotel #${id} menjadi ${data.name}`
    })
    return { success: true }
  })

  ipcMain.handle('hotel:delete', (_, id) => {
    dbOps.run('UPDATE hotels SET is_active = 0 WHERE id = ?', [id])
    logActivity({
      source: 'user',
      action: 'hotel.soft-delete',
      detail: `Nonaktifkan vendor/hotel #${id}`
    })
    return { success: true }
  })

  ipcMain.handle('hotel:get-payout-history', (_, { hotelId, startDate, endDate }) => {
    const historyParams = [hotelId]
    const historyDateFilter = buildDateFilter('p.date', startDate, endDate, historyParams)
    const payouts = dbOps.all(`
      SELECT p.*, ca.name as cash_account_name,
        ct.description as tx_description
      FROM hotel_payouts p
      JOIN cash_accounts ca ON p.cash_account_id = ca.id
      LEFT JOIN cash_transactions ct ON ct.reference_type = 'hotel_payout' AND ct.reference_id = p.id
      WHERE p.hotel_id = ?
      ${historyDateFilter}
      ORDER BY p.date DESC, p.id DESC
    `, historyParams)

    return {
      payouts: payouts.map(p => {
        const rentals = dbOps.all(`
          SELECT r.date_time, r.vendor_fee as amount, r.period_days, m.model, m.plate_number, r.customer_name
          FROM rentals r JOIN motors m ON r.motor_id = m.id
          WHERE r.hotel_payout_id = ?
          ORDER BY r.date_time DESC
        `, [p.id])

        return { ...p, rentals }
      })
    }
  })

  ipcMain.handle('hotel:payout-preview', (_, { hotelId, startDate, endDate }) => {
    const previewParams = [hotelId]
    const rentalDateFilter = buildDateFilter('r.date_time', startDate, endDate, previewParams)
    const rentals = dbOps.all(`
      SELECT r.id, r.date_time, r.vendor_fee, r.total_price, r.period_days, r.customer_name,
             m.model, m.plate_number, m.id as motor_id
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE r.hotel_id = ? AND r.status != 'refunded' AND r.vendor_fee > 0
        AND COALESCE(r.relation_type, 'rental') IN ('rental', 'extend', 'swap_source')
      ${rentalDateFilter}
      ORDER BY r.date_time DESC
    `, previewParams)

    const grossCommission = rentals.reduce((s, r) => s + (r.vendor_fee || 0), 0)
    // Sesuai proses bisnis terbaru: fee vendor/hotel dibayar tunai saat transaksi.
    // Untuk tampilan detail vendor, semua fee pada periode dianggap sudah dibayar otomatis.
    const paidAmount = grossCommission
    const unpaidAmount = 0
    const netAmount = 0

    return { rentals, grossCommission, paidAmount, unpaidAmount, totalDeductions: 0, netAmount }
  })

  ipcMain.handle('hotel:payout', (_, data) => {
    throw new Error('Pembayaran terpisah fee vendor dinonaktifkan. Fee vendor dibayar tunai saat transaksi rental.')
  })
}
