import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerOwnerHandlers() {
  ipcMain.handle('owner:get-all', () => {
    return dbOps.all(`
      SELECT o.*, 
        (SELECT COALESCE(SUM(r.owner_gets), 0) FROM rentals r 
         JOIN motors m ON r.motor_id = m.id 
         WHERE m.owner_id = o.id AND r.payout_id IS NULL AND r.status != 'refunded') as unpaid_commission
      FROM owners o ORDER BY name ASC
    `)
  })

  ipcMain.handle('owner:get-by-id', (_, id) => {
    const owner = dbOps.get('SELECT * FROM owners WHERE id = ?', [id])
    const motors = dbOps.all('SELECT * FROM motors WHERE owner_id = ?', [id])
    return { ...owner, motors }
  })

  ipcMain.handle('owner:create', (_, data) => {
    dbOps.run(
      'INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)',
      [data.name, data.phone, data.bank_account, data.bank_name]
    )
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    return { id: row.id }
  })

  ipcMain.handle('owner:update', (_, { id, ...data }) => {
    dbOps.run(
      'UPDATE owners SET name=?, phone=?, bank_account=?, bank_name=?, is_active=? WHERE id=?',
      [data.name, data.phone, data.bank_account, data.bank_name, data.is_active ?? 1, id]
    )
    return { success: true }
  })

  ipcMain.handle('owner:delete', (_, id) => {
    dbOps.run('UPDATE owners SET is_active = 0 WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('owner:get-commission-summary', (_, { ownerId, startDate, endDate }) => {
    let query = `
      SELECT r.*, m.model, m.plate_number,
             (CASE WHEN r.payout_id IS NOT NULL THEN 1 ELSE 0 END) as is_paid
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.status != 'refunded'
    `
    const params = [ownerId]

    if (startDate) { query += ' AND date(r.date_time) >= ?'; params.push(startDate) }
    if (endDate) { query += ' AND date(r.date_time) <= ?'; params.push(endDate) }

    query += ' ORDER BY r.date_time DESC'
    return dbOps.all(query, params)
  })

  ipcMain.handle('owner:payout', (_, data) => {
    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE id = ?', [data.cash_account_id])
    if (!cashAccount) throw new Error('Akun kas tidak ditemukan')
    if (cashAccount.balance < data.amount) {
      throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup! (Sisa: Rp ${cashAccount.balance.toLocaleString('id-ID')})`)
    }

    dbOps.run('INSERT INTO payouts (owner_id, amount, cash_account_id, date) VALUES (?, ?, ?, ?)', 
      [data.owner_id, data.amount, data.cash_account_id, data.date]
    )
    const { id: payoutId } = dbOps.get('SELECT last_insert_rowid() as id')

    dbOps.run(`
      UPDATE rentals SET payout_id = ? 
      WHERE payout_id IS NULL AND status != 'refunded' AND owner_gets > 0 
      AND motor_id IN (SELECT id FROM motors WHERE owner_id = ?)
    `, [payoutId, data.owner_id])

    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
      VALUES (?, 'out', ?, 'owner_payout', ?, ?, ?)
    `, [data.cash_account_id, data.amount, payoutId, `Bayar Komisi Vendor`, data.date])

    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [data.amount, data.cash_account_id])

    return { success: true }
  })
}
