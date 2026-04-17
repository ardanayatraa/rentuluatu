import { ipcMain } from 'electron'
import { dbOps } from '../db'

function assertValidManualCashInput(data = {}, mode = 'income') {
  const amount = Number(data.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Jumlah harus lebih dari 0')
  }

  const description = String(data.description || '').trim()
  if (!description) {
    throw new Error('Catatan transaksi wajib diisi')
  }

  const paymentMethod = String(data.payment_method || '').trim()
  if (!paymentMethod) {
    throw new Error('Metode bayar wajib dipilih')
  }

  return {
    amount,
    description,
    paymentMethod,
    date: data.date || new Date().toISOString().split('T')[0],
    mode
  }
}

export function registerCashHandlers() {
  ipcMain.handle('cash:get-accounts', () => {
    return dbOps.all('SELECT * FROM cash_accounts ORDER BY type ASC')
  })

  ipcMain.handle('cash:set-opening-balance', (_, { accountId, amount }) => {
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE id = ?', [accountId])
    if (!account) throw new Error('Akun tidak ditemukan')
    // FIX: Hapus transaksi opening_balance lama agar tidak double
    dbOps.run(
      "DELETE FROM cash_transactions WHERE cash_account_id = ? AND reference_type = 'opening_balance'",
      [accountId]
    )
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
    if (filters.type) { query += ' AND ct.type = ?'; params.push(filters.type) }
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
    const payload = assertValidManualCashInput(data, 'income')
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [payload.paymentMethod])
    if (!account) throw new Error('Akun kas tidak ditemukan')
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'in', ?, 'manual_income', ?, ?)
    `, [account.id, payload.amount, payload.description, payload.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [payload.amount, account.id])
    return { success: true }
  })

  // Tambah pengeluaran manual dari kas
  ipcMain.handle('cash:add-expense', (_, data) => {
    const payload = assertValidManualCashInput(data, 'expense')
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [payload.paymentMethod])
    if (!account) throw new Error('Akun kas tidak ditemukan')
    if (account.balance < payload.amount) {
      throw new Error(`Saldo Kas ${account.name} tidak cukup! (Sisa: Rp ${account.balance.toLocaleString('id-ID')})`)
    }
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'out', ?, 'manual_expense', ?, ?)
    `, [account.id, payload.amount, payload.description, payload.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [payload.amount, account.id])
    return { success: true }
  })
}
