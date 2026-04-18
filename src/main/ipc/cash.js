import { ipcMain } from 'electron'
import { dbOps } from '../db'

function getReservedOwnerFunds() {
  const ownerRentalRows = dbOps.all(`
    SELECT m.owner_id as owner_id, COALESCE(SUM(r.owner_gets), 0) as total
    FROM rentals r
    JOIN motors m ON r.motor_id = m.id
    WHERE m.owner_id IS NOT NULL
      AND r.payout_id IS NULL
      AND r.status != 'refunded'
    GROUP BY m.owner_id
  `)

  const ownerExpenseRows = dbOps.all(`
    SELECT m.owner_id as owner_id, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e
    JOIN motors m ON e.motor_id = m.id
    WHERE m.owner_id IS NOT NULL
      AND e.type = 'motor'
      AND e.payout_id IS NULL
    GROUP BY m.owner_id
  `)

  const ownerMap = new Map()
  ownerRentalRows.forEach((row) => {
    ownerMap.set(row.owner_id, {
      ownerGets: Number(row.total || 0),
      motorExpenses: 0
    })
  })
  ownerExpenseRows.forEach((row) => {
    const current = ownerMap.get(row.owner_id) || { ownerGets: 0, motorExpenses: 0 }
    current.motorExpenses = Number(row.total || 0)
    ownerMap.set(row.owner_id, current)
  })

  let reserved = 0
  ownerMap.forEach((item) => {
    reserved += Math.max(0, item.ownerGets - item.motorExpenses)
  })
  return reserved
}

function assertCompanyFundsAvailableForOperationalExpense(amount) {
  const cashSummary = dbOps.get('SELECT COALESCE(SUM(balance), 0) as total FROM cash_accounts')
  const totalCashBalance = Number(cashSummary?.total || 0)
  const reservedOwnerFunds = getReservedOwnerFunds()
  const companyFreeFunds = totalCashBalance - reservedOwnerFunds

  if (companyFreeFunds < amount) {
    throw new Error(
      `Dana perusahaan tidak cukup. Dana bebas saat ini Rp ${Math.max(0, companyFreeFunds).toLocaleString('id-ID')} (setelah proteksi hak mitra).`
    )
  }
}

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

  const entryType = mode === 'income'
    ? String(data.entry_type || 'manual_income').trim().toLowerCase()
    : 'manual_expense'

  if (mode === 'income' && !['manual_income', 'capital_injection'].includes(entryType)) {
    throw new Error('Jenis pemasukan tidak valid')
  }

  return {
    amount,
    description,
    paymentMethod,
    date: data.date || new Date().toISOString().split('T')[0],
    entryType,
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

  ipcMain.handle('cash:get-summary', (_, filters = {}) => {
    const snapshotDate = String(filters.endDate || '').trim()
    const accounts = dbOps.all('SELECT * FROM cash_accounts ORDER BY type ASC')
    const accountsWithBalance = snapshotDate
      ? accounts.map((account) => {
        const mutationRows = dbOps.all(
          `SELECT type, amount
           FROM cash_transactions
           WHERE cash_account_id = ?
             AND date <= ?`,
          [account.id, snapshotDate]
        ) || []
        const balance = mutationRows.reduce((sum, row) => {
          const amount = Number(row.amount || 0)
          return String(row.type).toLowerCase() === 'out' ? sum - amount : sum + amount
        }, 0)
        return { ...account, balance }
      })
      : accounts
    const total = accountsWithBalance.reduce((sum, a) => sum + Number(a.balance || 0), 0)
    return { accounts: accountsWithBalance, total }
  })

  // Tambah pemasukan operasional atau tambahan modal.
  ipcMain.handle('cash:add-income', (_, data) => {
    const payload = assertValidManualCashInput(data, 'income')
    const account = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [payload.paymentMethod])
    if (!account) throw new Error('Akun kas tidak ditemukan')
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'in', ?, ?, ?, ?)
    `, [account.id, payload.amount, payload.entryType, payload.description, payload.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [payload.amount, account.id])
    return { success: true }
  })

  // Tambah pengeluaran manual dari kas
  ipcMain.handle('cash:add-expense', (_, data) => {
    const payload = assertValidManualCashInput(data, 'expense')
    assertCompanyFundsAvailableForOperationalExpense(payload.amount)
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
