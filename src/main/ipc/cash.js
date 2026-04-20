import { ipcMain } from 'electron'
import { dbOps } from '../db'
import { logActivity } from '../lib/activity-log'

const ALLOWED_CASH_BUCKETS = ['pendapatan', 'modal']

function normalizeCashBucket(value, fallback = 'pendapatan') {
  const bucket = String(value || '').trim().toLowerCase()
  return ALLOWED_CASH_BUCKETS.includes(bucket) ? bucket : fallback
}

function getCashAccountByTypeAndBucket(type, bucket = 'pendapatan') {
  return dbOps.get(
    "SELECT * FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = ? ORDER BY id ASC LIMIT 1",
    [type, normalizeCashBucket(bucket)]
  )
}

function cashBucketLabel(bucket) {
  return normalizeCashBucket(bucket) === 'modal' ? 'Modal' : 'Pendapatan'
}

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
  const cashBucket = mode === 'income'
    ? (entryType === 'capital_injection' ? 'modal' : 'pendapatan')
    : normalizeCashBucket(data.cash_bucket, 'pendapatan')

  if (mode === 'income' && !['manual_income', 'capital_injection'].includes(entryType)) {
    throw new Error('Jenis pemasukan tidak valid')
  }

  return {
    amount,
    description,
    paymentMethod,
    date: data.date || new Date().toISOString().split('T')[0],
    entryType,
    cashBucket,
    mode
  }
}

export function registerCashHandlers() {
  ipcMain.handle('cash:get-accounts', () => {
    return dbOps.all("SELECT * FROM cash_accounts ORDER BY COALESCE(bucket, 'pendapatan') ASC, type ASC")
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
    const accounts = dbOps.all("SELECT * FROM cash_accounts ORDER BY COALESCE(bucket, 'pendapatan') ASC, type ASC")
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
    const account = getCashAccountByTypeAndBucket(payload.paymentMethod, payload.cashBucket)
    if (!account) {
      throw new Error(`Akun kas ${cashBucketLabel(payload.cashBucket)} untuk metode ${payload.paymentMethod.toUpperCase()} tidak ditemukan`)
    }
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'in', ?, ?, ?, ?)
    `, [account.id, payload.amount, payload.entryType, payload.description, payload.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [payload.amount, account.id])
    logActivity({
      source: 'user',
      action: 'cash.add-income',
      detail: `Input pemasukan manual Rp ${Math.round(payload.amount).toLocaleString('id-ID')} (${payload.entryType})`
    })
    return { success: true }
  })

  // Tambah pengeluaran manual dari kas
  ipcMain.handle('cash:add-expense', (_, data) => {
    const payload = assertValidManualCashInput(data, 'expense')
    assertCompanyFundsAvailableForOperationalExpense(payload.amount)
    const account = getCashAccountByTypeAndBucket(payload.paymentMethod, payload.cashBucket)
    if (!account) {
      throw new Error(`Akun kas ${cashBucketLabel(payload.cashBucket)} untuk metode ${payload.paymentMethod.toUpperCase()} tidak ditemukan`)
    }
    if (account.balance < payload.amount) {
      throw new Error(`Saldo Kas ${account.name} tidak cukup! (Sisa: Rp ${account.balance.toLocaleString('id-ID')})`)
    }
    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, description, date)
      VALUES (?, 'out', ?, 'manual_expense', ?, ?)
    `, [account.id, payload.amount, payload.description, payload.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [payload.amount, account.id])
    logActivity({
      source: 'user',
      action: 'cash.add-expense',
      detail: `Input pengeluaran manual Rp ${Math.round(payload.amount).toLocaleString('id-ID')}`
    })
    return { success: true }
  })
}
