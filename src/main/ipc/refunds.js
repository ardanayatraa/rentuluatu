import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerRefundHandlers() {
  ipcMain.handle('refund:calculate', (_, { rentalId, remainingDays, percentage }) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [rentalId])
    if (!rental) throw new Error('Rental tidak ditemukan')
    const baseAmount = remainingDays * rental.price_per_day
    const refundAmount = percentage ? (baseAmount * percentage) / 100 : baseAmount
    return { baseAmount, refundAmount, remainingDays }
  })

  ipcMain.handle('refund:create', (_, data) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [data.rental_id])
    if (!rental) throw new Error('Rental tidak ditemukan')

    dbOps.run(
      'INSERT INTO refunds (rental_id, refund_percentage, refund_amount, remaining_days, reason) VALUES (?, ?, ?, ?, ?)',
      [data.rental_id, data.refund_percentage, data.refund_amount, data.remaining_days, data.reason]
    )
    const { id: refundId } = dbOps.get('SELECT last_insert_rowid() as id')

    dbOps.run("UPDATE rentals SET status = 'refunded' WHERE id = ?", [data.rental_id])

    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [rental.payment_method])
    if (cashAccount) {
      if (cashAccount.balance < data.refund_amount) {
        throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup untuk refund! (Sisa: Rp ${cashAccount.balance.toLocaleString('id-ID')})`)
      }
    }

    if (cashAccount) {
      const today = new Date().toISOString().split('T')[0]
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'out', ?, 'refund', ?, ?, ?)
      `, [cashAccount.id, data.refund_amount, refundId, `Refund rental #${data.rental_id}`, today])
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [data.refund_amount, cashAccount.id])
    }

    return { id: refundId }
  })
}
