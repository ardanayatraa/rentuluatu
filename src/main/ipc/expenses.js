import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'

export function registerExpenseHandlers() {
  const allowedPaymentMethods = ['tunai', 'transfer', 'qris', 'debit_card']
  const normalizePaymentMethod = (method) => {
    const value = String(method || '').trim().toLowerCase()
    if (value === 'qriss') return 'qris'
    if (value === 'cash') return 'tunai'
    if (value === 'debit' || value === 'debitcard') return 'debit_card'
    return value
  }

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
    const amount = Number(data.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Jumlah pengeluaran harus lebih dari 0')
    }

    const paymentMethod = normalizePaymentMethod(data.payment_method)
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      throw new Error('Metode bayar tidak valid')
    }

    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [paymentMethod])
    if (!cashAccount) {
      throw new Error(`Akun kas untuk metode ${paymentMethod.toUpperCase()} tidak ditemukan`)
    }

    const accountBalance = Number(cashAccount.balance || 0)
    if (accountBalance < amount) {
      throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup! (Sisa: Rp ${accountBalance.toLocaleString('id-ID')})`)
    }

    dbOps.runRaw(
      'INSERT INTO expenses (type, motor_id, category, amount, payment_method, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.type, data.motor_id || null, data.category, amount, paymentMethod, data.description, data.date]
    )
    const { id: expenseId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
      VALUES (?, 'out', ?, 'expense', ?, ?, ?)
    `, [cashAccount.id, amount, expenseId, data.description || data.category, data.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [amount, cashAccount.id])

    return { id: expenseId }
  })

  ipcMain.handle('expense:delete', (_, id) => {
    const expense = dbOps.get('SELECT * FROM expenses WHERE id = ?', [id])
    if (expense) {
      const paymentMethod = normalizePaymentMethod(expense.payment_method)
      const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [paymentMethod])
      if (cashAccount) {
        dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [expense.amount, cashAccount.id])
        dbOps.run("DELETE FROM cash_transactions WHERE reference_type = 'expense' AND reference_id = ?", [id])
      }
    }
    dbOps.run('DELETE FROM expenses WHERE id = ?', [id])
    return { success: true }
  })
}
