import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { logActivity } from '../lib/activity-log'

export function registerRefundHandlers() {
  ipcMain.handle('refund:calculate', (_, { rentalId, remainingDays, percentage }) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [rentalId])
    if (!rental) throw new Error('Rental tidak ditemukan')
    // FIX: gunakan total_price / period_days, bukan price_per_day (konsisten dengan finance.js)
    const pricePerDay = rental.period_days > 0 ? rental.total_price / rental.period_days : rental.total_price
    const baseAmount = remainingDays * pricePerDay
    const refundAmount = percentage ? (baseAmount * percentage) / 100 : baseAmount
    return { baseAmount, refundAmount, remainingDays }
  })

  ipcMain.handle('refund:create', (_, data) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [data.rental_id])
    if (!rental) throw new Error('Rental tidak ditemukan')
    if (rental.status === 'refunded') throw new Error('Rental ini sudah direfund sebelumnya')
    if (Number(data.refund_amount || 0) <= 0) throw new Error('Nominal refund harus lebih besar dari nol')
    if (Number(data.refund_amount || 0) > Number(rental.total_price || 0)) {
      throw new Error('Nominal refund tidak boleh melebihi total harga rental')
    }
    if (Number(data.remaining_days || 0) < 0) throw new Error('Sisa hari refund tidak valid')

    // FIX: Cek saldo DULU sebelum ubah status apapun
    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [rental.payment_method])
    if (cashAccount && cashAccount.balance < data.refund_amount) {
      throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup untuk refund! (Sisa: Rp ${cashAccount.balance.toLocaleString('id-ID')})`)
    }

    dbOps.runRaw(
      'INSERT INTO refunds (rental_id, refund_percentage, refund_amount, remaining_days, reason) VALUES (?, ?, ?, ?, ?)',
      [data.rental_id, data.refund_percentage, data.refund_amount, data.remaining_days, data.reason]
    )
    const { id: refundId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    // FIX: Update status SETELAH semua validasi lolos
    dbOps.run("UPDATE rentals SET status = 'refunded' WHERE id = ?", [data.rental_id])

    if (cashAccount) {
      const today = new Date().toISOString().split('T')[0]
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'out', ?, 'refund', ?, ?, ?)
      `, [cashAccount.id, data.refund_amount, refundId, `Refund rental #${data.rental_id}`, today])
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [data.refund_amount, cashAccount.id])
    }
    logActivity({
      source: 'user',
      action: 'refund.create',
      detail: `Refund rental #${data.rental_id} sebesar Rp ${Math.round(Number(data.refund_amount || 0)).toLocaleString('id-ID')}`
    })

    return { id: refundId }
  })
}
