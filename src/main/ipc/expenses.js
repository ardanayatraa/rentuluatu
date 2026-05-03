import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { logActivity } from '../lib/activity-log'

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

export function registerExpenseHandlers() {
  const allowedPaymentMethods = ['tunai', 'transfer', 'qris', 'debit_card']
  const allowedCashBuckets = ['pendapatan', 'modal', 'ganti_rugi']
  const normalizePaymentMethod = (method) => {
    const value = String(method || '').trim().toLowerCase()
    if (value === 'qriss') return 'qris'
    if (value === 'cash') return 'tunai'
    if (value === 'debit' || value === 'debitcard') return 'debit_card'
    return value
  }
  const normalizeCashBucket = (bucket) => {
    const value = String(bucket || '').trim().toLowerCase()
    return allowedCashBuckets.includes(value) ? value : 'pendapatan'
  }
  const getCashAccount = (paymentMethod, cashBucket) => {
    return dbOps.get(
      "SELECT * FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = ? ORDER BY id ASC LIMIT 1",
      [paymentMethod, normalizeCashBucket(cashBucket)]
    )
  }
  const cashBucketLabel = (bucket) => {
    const normalizedBucket = normalizeCashBucket(bucket)
    if (normalizedBucket === 'modal') return 'Modal Tanam'
    if (normalizedBucket === 'ganti_rugi') return 'Ganti Rugi'
    return 'Pendapatan'
  }

  ipcMain.handle('expense:get-all', (_, filters = {}) => {
    let query = `
      SELECT e.*, m.model as motor_model, m.plate_number
      FROM expenses e LEFT JOIN motors m ON e.motor_id = m.id WHERE 1=1
    `
    const params = []
    if (filters.startDate) { query += ' AND date(e.date) >= date(?)'; params.push(filters.startDate) }
    if (filters.endDate) { query += ' AND date(e.date) <= date(?)'; params.push(filters.endDate) }
    if (filters.type === 'motor') {
      query += " AND e.type = 'motor'"
    } else if (filters.type === 'umum') {
      query += " AND (e.type IS NULL OR e.type != 'motor')"
    } else if (filters.type) {
      query += ' AND e.type = ?'
      params.push(filters.type)
    }
    if (filters.motorId) { query += ' AND e.motor_id = ?'; params.push(filters.motorId) }
    query += ' ORDER BY e.date DESC'
    return dbOps.all(query, params)
  })
  ipcMain.handle('expense:create', (_, data) => {
    const amount = Number(data.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Jumlah pengeluaran harus lebih dari 0')
    }

    const expenseType = String(data.type || '').trim().toLowerCase()
    if (expenseType !== 'motor') {
      assertCompanyFundsAvailableForOperationalExpense(amount)
    }

    const paymentMethod = normalizePaymentMethod(data.payment_method)
    const cashBucket = normalizeCashBucket(data.cash_bucket)
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      throw new Error('Metode bayar tidak valid')
    }

    const cashAccount = getCashAccount(paymentMethod, cashBucket)
    if (!cashAccount) {
      throw new Error(`Akun kas ${cashBucketLabel(cashBucket)} untuk metode ${paymentMethod.toUpperCase()} tidak ditemukan`)
    }

    const accountBalance = Number(cashAccount.balance || 0)
    if (accountBalance < amount) {
      throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup! (Sisa: Rp ${accountBalance.toLocaleString('id-ID')})`)
    }

    dbOps.runRaw(
      'INSERT INTO expenses (type, motor_id, category, amount, payment_method, cash_bucket, description, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [data.type, data.motor_id || null, data.category, amount, paymentMethod, cashBucket, data.description, data.date]
    )
    const { id: expenseId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    dbOps.run(`
      INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
      VALUES (?, 'out', ?, 'expense', ?, ?, ?)
    `, [cashAccount.id, amount, expenseId, data.description || data.category, data.date])
    dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [amount, cashAccount.id])
    logActivity({
      source: 'user',
      action: 'expense.create',
      detail: `Tambah pengeluaran #${expenseId} sebesar Rp ${Math.round(amount).toLocaleString('id-ID')}`
    })

    return { id: expenseId }
  })

  ipcMain.handle('expense:delete', (_, id) => {
    const expense = dbOps.get('SELECT * FROM expenses WHERE id = ?', [id])
    if (expense) {
      const tx = dbOps.get(
        "SELECT * FROM cash_transactions WHERE reference_type = 'expense' AND reference_id = ? ORDER BY id DESC LIMIT 1",
        [id]
      )
      if (tx?.cash_account_id) {
        dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [expense.amount, tx.cash_account_id])
      }
      dbOps.run("DELETE FROM cash_transactions WHERE reference_type = 'expense' AND reference_id = ?", [id])
    }
    dbOps.run('DELETE FROM expenses WHERE id = ?', [id])
    logActivity({
      source: 'user',
      action: 'expense.delete',
      detail: `Hapus pengeluaran #${id}`
    })
    return { success: true }
  })
}
