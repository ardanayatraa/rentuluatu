import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'

export function registerHotelHandlers() {
  ipcMain.handle('hotel:get-all', () => {
    return dbOps.all(`
      SELECT h.*, 
        (SELECT COALESCE(SUM(r.vendor_fee), 0) FROM rentals r 
         WHERE r.hotel_id = h.id AND r.hotel_payout_id IS NULL AND r.status != 'refunded') as unpaid_commission
      FROM hotels h ORDER BY name ASC
    `)
  })

  ipcMain.handle('hotel:get-by-id', (_, id) => {
    const hotel = dbOps.get('SELECT * FROM hotels WHERE id = ?', [id])
    return { ...hotel }
  })

  ipcMain.handle('hotel:create', (_, data) => {
    // FIX #4: Cek duplikat nama hotel
    const existing = dbOps.get('SELECT id FROM hotels WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [data.name])
    if (existing) throw new Error(`Vendor dengan nama "${data.name}" sudah terdaftar`)

    dbOps.runRaw(
      'INSERT INTO hotels (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)',
      [data.name, data.phone, data.bank_account, data.bank_name]
    )
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()
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
      'UPDATE hotels SET name=?, phone=?, bank_account=?, bank_name=?, is_active=? WHERE id=?',
      [data.name, data.phone, data.bank_account, data.bank_name, data.is_active ?? 1, id]
    )
    return { success: true }
  })

  ipcMain.handle('hotel:delete', (_, id) => {
    dbOps.run('UPDATE hotels SET is_active = 0 WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('hotel:get-payout-history', (_, { hotelId }) => {
    const payouts = dbOps.all(`
      SELECT p.*, ca.name as cash_account_name,
        ct.description as tx_description
      FROM hotel_payouts p
      JOIN cash_accounts ca ON p.cash_account_id = ca.id
      LEFT JOIN cash_transactions ct ON ct.reference_type = 'hotel_payout' AND ct.reference_id = p.id
      WHERE p.hotel_id = ?
      ORDER BY p.date DESC, p.id DESC
    `, [hotelId])

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

  ipcMain.handle('hotel:payout-preview', (_, { hotelId }) => {
    const rentals = dbOps.all(`
      SELECT r.id, r.date_time, r.vendor_fee, r.total_price, r.period_days, r.customer_name,
             m.model, m.plate_number, m.id as motor_id
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE r.hotel_id = ? AND r.hotel_payout_id IS NULL AND r.status != 'refunded' AND r.vendor_fee > 0
      ORDER BY r.date_time DESC
    `, [hotelId])

    const grossCommission = rentals.reduce((s, r) => s + (r.vendor_fee || 0), 0)
    const netAmount = Math.max(0, grossCommission)

    return { rentals, grossCommission, totalDeductions: 0, netAmount }
  })

  ipcMain.handle('hotel:payout', (_, data) => {
    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE id = ?', [data.cash_account_id])
    if (!cashAccount) throw new Error('Akun kas tidak ditemukan')

    // FIX #1: Recalculate server-side, jangan percaya net_amount dari client
    // FIX #2: Ambil rental IDs yang valid saat ini (bukan saat preview)
    const validRentals = dbOps.all(`
      SELECT id, vendor_fee FROM rentals
      WHERE hotel_id = ? AND hotel_payout_id IS NULL AND status != 'refunded' AND vendor_fee > 0
    `, [data.hotel_id])

    if (validRentals.length === 0) throw new Error('Tidak ada komisi yang perlu dibayarkan')

    const serverNetAmount = validRentals.reduce((s, r) => s + (r.vendor_fee || 0), 0)

    // FIX #1: Validasi amount dari client tidak boleh melebihi kalkulasi server
    if (Math.abs(serverNetAmount - data.net_amount) > 1) {
      throw new Error(`Jumlah payout tidak sesuai. Server menghitung Rp ${serverNetAmount.toLocaleString('id-ID')}`)
    }

    // FIX: Cek saldo menggunakan amount yang sudah divalidasi server
    if (cashAccount.balance < serverNetAmount) {
      throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup! (Sisa: Rp ${cashAccount.balance.toLocaleString('id-ID')})`)
    }

    dbOps.runRaw(
      'INSERT INTO hotel_payouts (hotel_id, amount, cash_account_id, date) VALUES (?, ?, ?, ?)',
      [data.hotel_id, serverNetAmount, data.cash_account_id, data.date]
    )
    const { id: payoutId } = dbOps.get('SELECT last_insert_rowid() as id')

    // FIX #2: Update hanya rental IDs yang sudah divalidasi (bukan wildcard)
    const rentalIds = validRentals.map(r => r.id)
    const placeholders = rentalIds.map(() => '?').join(',')
    dbOps.run(
      `UPDATE rentals SET hotel_payout_id = ? WHERE id IN (${placeholders})`,
      [payoutId, ...rentalIds]
    )

    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
      VALUES (?, 'out', ?, 'hotel_payout', ?, ?, ?)
    `, [data.cash_account_id, serverNetAmount, payoutId,
        `Komisi Vendor ${data.hotel_name || ''}`,
        data.date])

    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [serverNetAmount, data.cash_account_id])

    return { success: true, payoutId }
  })
}
