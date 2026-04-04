import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerDashboardHandlers() {
  ipcMain.handle('dashboard:summary', (_, { startDate, endDate }) => {
    const income = dbOps.get(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const expenses = dbOps.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?',
      [startDate, endDate]
    )
    const wavyGets = dbOps.get(
      "SELECT COALESCE(SUM(wavy_gets), 0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const ownerGets = dbOps.get(
      "SELECT COALESCE(SUM(owner_gets), 0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const rentalCount = dbOps.get(
      "SELECT COUNT(*) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const refundCount = dbOps.get(
      "SELECT COUNT(*) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status = 'refunded'",
      [startDate, endDate]
    )

    // Manual transactions
    const manualIncome = dbOps.get(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE reference_type = 'manual_income' AND date BETWEEN ? AND ?",
      [startDate, endDate]
    )
    const manualExpense = dbOps.get(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE reference_type = 'manual_expense' AND date BETWEEN ? AND ?",
      [startDate, endDate]
    )

    const totalIncome = income.total + manualIncome.total
    const totalExpenses = expenses.total + manualExpense.total
    const totalWavyGets = wavyGets.total + manualIncome.total

    return {
      income: totalIncome,
      expenses: totalExpenses,
      wavy_gets: totalWavyGets,
      owner_gets: ownerGets.total,
      profit: totalWavyGets - totalExpenses,
      rental_count: rentalCount.total,
      refund_count: refundCount.total
    }
  })

  ipcMain.handle('dashboard:daily-income', (_, { startDate, endDate }) => {
    const rentals = dbOps.all(`
      SELECT date(date_time) as date,
        COALESCE(SUM(total_price), 0) as income,
        COALESCE(SUM(wavy_gets), 0) as wavy_gets,
        COALESCE(SUM(owner_gets), 0) as owner_gets,
        COUNT(*) as count
      FROM rentals
      WHERE date_time BETWEEN ? AND ? AND status != 'refunded'
      GROUP BY date(date_time)
    `, [startDate, endDate])

    const manuals = dbOps.all(`
      SELECT date, COALESCE(SUM(amount), 0) as amount
      FROM cash_transactions 
      WHERE reference_type = 'manual_income' AND date BETWEEN ? AND ?
      GROUP BY date
    `, [startDate, endDate])

    const map = new Map()
    rentals.forEach(r => map.set(r.date, { ...r }))
    manuals.forEach(m => {
      const ex = map.get(m.date) || { date: m.date, income: 0, wavy_gets: 0, owner_gets: 0, count: 0 }
      ex.income += m.amount
      ex.wavy_gets += m.amount
      map.set(m.date, ex)
    })
    return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date))
  })

  ipcMain.handle('dashboard:daily-expenses', (_, { startDate, endDate }) => {
    const expenses = dbOps.all(`
      SELECT date, COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date BETWEEN ? AND ?
      GROUP BY date
    `, [startDate, endDate])

    const manuals = dbOps.all(`
      SELECT date, COALESCE(SUM(amount), 0) as amount
      FROM cash_transactions
      WHERE reference_type = 'manual_expense' AND date BETWEEN ? AND ?
      GROUP BY date
    `, [startDate, endDate])

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
    const rentals = dbOps.all(`
      SELECT payment_method, COALESCE(SUM(total_price), 0) as total, COUNT(*) as count
      FROM rentals
      WHERE date_time BETWEEN ? AND ? AND status != 'refunded'
      GROUP BY payment_method
    `, [startDate, endDate])

    const manuals = dbOps.all(`
      SELECT ca.type as payment_method, COALESCE(SUM(ct.amount), 0) as amount, COUNT(*) as count
      FROM cash_transactions ct
      JOIN cash_accounts ca ON ct.cash_account_id = ca.id
      WHERE ct.reference_type = 'manual_income' AND ct.date BETWEEN ? AND ?
      GROUP BY ca.type
    `, [startDate, endDate])

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
    return dbOps.all(`
      SELECT m.model, m.plate_number, m.type,
        COUNT(r.id) as rental_count,
        COALESCE(SUM(r.total_price), 0) as total_income,
        COALESCE(SUM(r.wavy_gets), 0) as wavy_gets
      FROM motors m
      LEFT JOIN rentals r ON m.id = r.motor_id
        AND r.date_time BETWEEN ? AND ? AND r.status != 'refunded'
      GROUP BY m.id
      HAVING rental_count > 0
    `, [startDate, endDate])
  })

  ipcMain.handle('dashboard:expense-categories', (_, { startDate, endDate }) => {
    const categories = dbOps.all(`
      SELECT category, COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date BETWEEN ? AND ?
      GROUP BY category
    `, [startDate, endDate])

    const manualExpense = dbOps.get(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM cash_transactions
      WHERE reference_type = 'manual_expense' AND date BETWEEN ? AND ?
    `, [startDate, endDate])

    if (manualExpense && manualExpense.total > 0) {
      categories.push({ category: 'Manual / Lainnya', total: manualExpense.total })
    }

    return categories.sort((a,b) => b.total - a.total)
  })
}
