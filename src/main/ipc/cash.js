import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerCashHandlers() {
  ipcMain.handle('cash:get-accounts', () => {
    return dbOps.all('SELECT * FROM cash_accounts ORDER BY type ASC')
  })

  ipcMain.handle('cash:set-opening-balance', (_, { accountId, amount }) => {
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE id = ?', [accountId])
    if (!account) throw new Error('Akun tidak ditemukan')
    dbOps.run('UPDATE cash_accounts SET balance = ? WHERE id = ?', [amount, accountId])
    const today = new Date().toISOString().split('T')[0]
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'in', ?, 'opening_balance', 'Saldo Awal', ?)
    `, [accountId, amount, today])
    return { success: true }
  })

  ipcMain.handle('cash:get-transactions', (_, filters = {}) => {
    let query = `
      SELECT ct.*, ca.name as account_name, ca.type as account_type
      FROM cash_transactions ct JOIN cash_accounts ca ON ct.cash_account_id = ca.id WHERE 1=1
    `
    const params = []
    if (filters.accountId) { query += ' AND ct.cash_account_id = ?'; params.push(filters.accountId) }
    if (filters.startDate) { query += ' AND ct.date >= ?'; params.push(filters.startDate) }
    if (filters.endDate) { query += ' AND ct.date <= ?'; params.push(filters.endDate) }
    query += ' ORDER BY ct.created_at DESC'
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit) }
    return dbOps.all(query, params)
  })

  ipcMain.handle('cash:get-summary', () => {
    const accounts = dbOps.all('SELECT * FROM cash_accounts')
    const total = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
    return { accounts, total }
  })

  // Tambah pemasukan manual (misal jual SIM card, dll)
  ipcMain.handle('cash:add-income', (_, data) => {
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [data.payment_method])
    if (!account) throw new Error('Akun kas tidak ditemukan')
    const today = data.date || new Date().toISOString().split('T')[0]
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'in', ?, 'manual_income', ?, ?)
    `, [account.id, data.amount, data.description || 'Pemasukan Manual', today])
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [data.amount, account.id])
    return { success: true }
  })

  // Tambah pengeluaran manual dari kas
  ipcMain.handle('cash:add-expense', (_, data) => {
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [data.payment_method])
    if (!account) throw new Error('Akun kas tidak ditemukan')
    if (account.balance < data.amount) {
      throw new Error(`Saldo Kas ${account.name} tidak cukup! (Sisa: Rp ${account.balance.toLocaleString('id-ID')})`)
    }
    const today = data.date || new Date().toISOString().split('T')[0]
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'out', ?, 'manual_expense', ?, ?)
    `, [account.id, data.amount, data.description || 'Pengeluaran Manual', today])
    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [data.amount, account.id])
    return { success: true }
  })
}
