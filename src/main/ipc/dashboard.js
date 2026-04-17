import { ipcMain } from 'electron'
import { dbOps } from '../db'

const COMPANY_EXPENSE_WHERE = `
  FROM expenses e
  WHERE e.date BETWEEN ? AND ?
    AND (e.type IS NULL OR e.type != 'motor')
`

function getReservedOwnerFundsAllTime() {
  const ownerRentalRows = dbOps.all(`
    SELECT m.owner_id as owner_id, COALESCE(SUM(r.owner_gets), 0) as total
    FROM rentals r
    JOIN motors m ON r.motor_id = m.id
    WHERE m.owner_id IS NOT NULL
      AND r.payout_id IS NULL
      AND r.status != 'refunded'
    GROUP BY m.owner_id
  `) || []

  const ownerExpenseRows = dbOps.all(`
    SELECT m.owner_id as owner_id, COALESCE(SUM(e.amount), 0) as total
    FROM expenses e
    JOIN motors m ON e.motor_id = m.id
    WHERE m.owner_id IS NOT NULL
      AND e.type = 'motor'
      AND e.payout_id IS NULL
    GROUP BY m.owner_id
  `) || []

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

export function registerDashboardHandlers() {
  ipcMain.handle('dashboard:summary', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    const income = dbOps.get(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM rentals WHERE date(date_time) BETWEEN ? AND ? AND status != 'refunded'",
      [start, end]
    )
    const expenses = dbOps.get(
      `SELECT COALESCE(SUM(e.amount), 0) as total ${COMPANY_EXPENSE_WHERE}`,
      [start, end]
    )
    
    // Pengeluaran motor
    const motorExpenses = dbOps.get(
      "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date BETWEEN ? AND ? AND type = 'motor'",
      [start, end]
    )
    
    const wavyGets = dbOps.get(
      "SELECT COALESCE(SUM(wavy_gets), 0) as total FROM rentals WHERE date(date_time) BETWEEN ? AND ? AND status != 'refunded'",
      [start, end]
    )
    const ownerGets = dbOps.get(
      "SELECT COALESCE(SUM(owner_gets), 0) as total FROM rentals WHERE date(date_time) BETWEEN ? AND ? AND status != 'refunded'",
      [start, end]
    )
    const ownerMotorExpenses = dbOps.get(
      `SELECT COALESCE(SUM(e.amount), 0) as total
       FROM expenses e
       JOIN motors m ON e.motor_id = m.id
       WHERE e.type = 'motor'
         AND m.owner_id IS NOT NULL
         AND e.date BETWEEN ? AND ?`,
      [start, end]
    )
    const rentalCount = dbOps.get(
      "SELECT COUNT(*) as total FROM rentals WHERE date(date_time) BETWEEN ? AND ? AND status != 'refunded'",
      [start, end]
    )
    const refundCount = dbOps.get(
      "SELECT COUNT(*) as total FROM rentals WHERE date(date_time) BETWEEN ? AND ? AND status = 'refunded'",
      [start, end]
    )

    // Manual transactions
    const manualIncome = dbOps.get(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE reference_type = 'manual_income' AND date BETWEEN ? AND ?",
      [start, end]
    )
    const manualExpense = dbOps.get(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE reference_type = 'manual_expense' AND date BETWEEN ? AND ?",
      [start, end]
    )

    const totalIncome = income.total + manualIncome.total
    const totalExpenses = expenses.total + manualExpense.total
    // FIX: wavy_gets hanya dari rental, bukan ditambah manual income
  // manual income adalah pemasahan Wavy tapi bukan bagi hasil rental
    const totalWavyGets = wavyGets.total
    // FIX: profit = (wavy_gets dari rental + manual income) - (expenses + manual expense)
    const wavyTotal = wavyGets.total + manualIncome.total
    const ownerGetsNet = Math.max(0, Number(ownerGets.total || 0) - Number(ownerMotorExpenses?.total || 0))

    const cashSummary = dbOps.get('SELECT COALESCE(SUM(balance), 0) as total FROM cash_accounts')
    const totalCashBalance = Number(cashSummary?.total || 0)
    const ownerReservedFunds = getReservedOwnerFundsAllTime()
    const availableOperationalFunds = Math.max(0, totalCashBalance - ownerReservedFunds)

    return {
      income: totalIncome,
      expenses: totalExpenses,
      motor_expenses: motorExpenses.total,
      motor_expenses_count: motorExpenses.count,
      wavy_gets: totalWavyGets,
      owner_gets: ownerGets.total,
      owner_gets_net: ownerGetsNet,
      owner_motor_expenses: Number(ownerMotorExpenses?.total || 0),
      owner_reserved_funds: ownerReservedFunds,
      available_operational_funds: availableOperationalFunds,
      profit: wavyTotal - totalExpenses,
      rental_count: rentalCount.total,
      refund_count: refundCount.total
    }
  })

  ipcMain.handle('dashboard:daily-income', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    const rentals = dbOps.all(`
      SELECT date(date_time) as date,
        COALESCE(SUM(total_price), 0) as income,
        COALESCE(SUM(wavy_gets), 0) as wavy_gets,
        COALESCE(SUM(owner_gets), 0) as owner_gets,
        COUNT(*) as count
      FROM rentals
      WHERE date(date_time) BETWEEN ? AND ? AND status != 'refunded'
      GROUP BY date(date_time)
    `, [start, end])

    const manuals = dbOps.all(`
      SELECT date, COALESCE(SUM(amount), 0) as amount
      FROM cash_transactions 
      WHERE reference_type = 'manual_income' AND date BETWEEN ? AND ?
      GROUP BY date
    `, [start, end])

    const map = new Map()
    rentals.forEach(r => map.set(r.date, { ...r }))
    manuals.forEach(m => {
      const ex = map.get(m.date) || { date: m.date, income: 0, wavy_gets: 0, owner_gets: 0, count: 0 }
      // FIX: manual income tambah ke income saja, bukan wavy_gets
      ex.income += m.amount
      map.set(m.date, ex)
    })
    return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date))
  })

  ipcMain.handle('dashboard:daily-expenses', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    const expenses = dbOps.all(`
      SELECT e.date as date, COALESCE(SUM(e.amount), 0) as total
      ${COMPANY_EXPENSE_WHERE}
      GROUP BY e.date
    `, [start, end])

    const manuals = dbOps.all(`
      SELECT date, COALESCE(SUM(amount), 0) as amount
      FROM cash_transactions
      WHERE reference_type = 'manual_expense' AND date BETWEEN ? AND ?
      GROUP BY date
    `, [start, end])

    const map = new Map()
    expenses.forEach(e => map.set(e.date, { ...e }))
    manuals.forEach(m => {
      const ex = map.get(m.date) || { date: m.date, total: 0 }
      ex.total += m.amount
      map.set(m.date, ex)
    })
    return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date))
  })

  ipcMain.handle('dashboard:payment-breakdown', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    const rentals = dbOps.all(`
      SELECT payment_method, COALESCE(SUM(total_price), 0) as total, COUNT(*) as count
      FROM rentals
      WHERE date(date_time) BETWEEN ? AND ? AND status != 'refunded'
      GROUP BY payment_method
    `, [start, end])

    const manuals = dbOps.all(`
      SELECT ca.type as payment_method, COALESCE(SUM(ct.amount), 0) as amount, COUNT(*) as count
      FROM cash_transactions ct
      JOIN cash_accounts ca ON ct.cash_account_id = ca.id
      WHERE ct.reference_type = 'manual_income' AND ct.date BETWEEN ? AND ?
      GROUP BY ca.type
    `, [start, end])

    const map = new Map()
    rentals.forEach(r => map.set(r.payment_method, { ...r }))
    manuals.forEach(m => {
      const ex = map.get(m.payment_method) || { payment_method: m.payment_method, total: 0, count: 0 }
      ex.total += m.amount
      ex.count += m.count
      map.set(m.payment_method, ex)
    })
    return Array.from(map.values())
  })

  ipcMain.handle('dashboard:top-motors', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    return dbOps.all(`
      SELECT m.model, m.plate_number, m.type,
        COUNT(r.id) as rental_count,
        COALESCE(SUM(r.total_price), 0) as total_income,
        COALESCE(SUM(r.wavy_gets), 0) as wavy_gets
      FROM motors m
      LEFT JOIN rentals r ON m.id = r.motor_id
        AND date(r.date_time) BETWEEN ? AND ? AND r.status != 'refunded'
      GROUP BY m.id
      HAVING rental_count > 0
    `, [start, end])
  })

  ipcMain.handle('dashboard:expense-categories', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    
    const categories = dbOps.all(`
      SELECT e.category as category, COALESCE(SUM(e.amount), 0) as total
      ${COMPANY_EXPENSE_WHERE}
      GROUP BY e.category
    `, [start, end])

    const manualExpense = dbOps.get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_transactions
      WHERE reference_type = 'manual_expense' AND date BETWEEN ? AND ?
    `, [start, end])

    if (manualExpense && manualExpense.total > 0) {
      categories.push({ category: 'Manual / Lainnya', total: manualExpense.total })
    }

    return categories.sort((a,b) => b.total - a.total)
  })
}
