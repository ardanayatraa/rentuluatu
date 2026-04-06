import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'

export function registerExpenseHandlers() {
  ipcMain.handle('expense:get-all', (_, filters = {}) => {
    let query = `
      SELECT e.*, m.model as motor_model, m.plate_number
      FROM expenses e LEFT JOIN motors m ON e.motor_id = m.id WHERE 1=1
    `
    const params = []
    if (filters.startDate) { query += ' AND e.date >= ?'; params.push(filters.startDate) }
    if (filters.endDate) { query += ' AND e.date <= ?'; params.push(filters.endDate) }
    if (filters.type) { query += ' AND e.type = ?'; params.push(filters.type) }
    if (filters.motorId) { query += ' AND e.motor_id = ?'; params.push(filters.motorId) }
    query += ' ORDER BY e.date DESC'
    return dbOps.all(query, params)
  })
  ipcMain.handle('expense:create', (_, data) => {
    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [data.payment_method])
    if (cashAccount) {
      if (cashAccount.balance < data.amount) {
        throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup! (Sisa: Rp ${cashAccount.balance.toLocaleString('id-ID')})`)
      }
    }

    dbOps.runRaw(
      'INSERT INTO expenses (type, motor_id, category, amount, payment_method, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.type, data.motor_id || null, data.category, data.amount, data.payment_method, data.description, data.date]
    )
    const { id: expenseId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    if (cashAccount) {
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'out', ?, 'expense', ?, ?, ?)
      `, [cashAccount.id, data.amount, expenseId, data.description || data.category, data.date])
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [data.amount, cashAccount.id])
    }

    return { id: expenseId }
  })

  ipcMain.handle('expense:delete', (_, id) => {
    const expense = dbOps.get('SELECT * FROM expenses WHERE id = ?', [id])
    if (expense) {
      const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [expense.payment_method])
      if (cashAccount) {
        dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [expense.amount, cashAccount.id])
        dbOps.run("DELETE FROM cash_transactions WHERE reference_type = 'expense' AND reference_id = ?", [id])
      }
    }
    dbOps.run('DELETE FROM expenses WHERE id = ?', [id])
    return { success: true }
  })
}
