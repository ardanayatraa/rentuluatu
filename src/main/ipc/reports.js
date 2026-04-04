import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerReportHandlers() {
  ipcMain.handle('report:summary', (_, { startDate, endDate }) => {
    const income = dbOps.get(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const expenses = dbOps.get(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?',
      [startDate, endDate]
    )
    const refunds = dbOps.get(
      'SELECT COALESCE(SUM(r.refund_amount), 0) as total FROM refunds r WHERE r.created_at BETWEEN ? AND ?',
      [startDate, endDate]
    )
    const wavyGets = dbOps.get(
      "SELECT COALESCE(SUM(wavy_gets), 0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    return {
      income: income.total,
      expenses: expenses.total,
      refunds: refunds.total,
      wavy_gets: wavyGets.total,
      profit: wavyGets.total - expenses.total
    }
  })

  ipcMain.handle('report:motor-ranking', (_, { startDate, endDate }) => {
    return dbOps.all(`
      SELECT m.id, m.model, m.plate_number, m.type,
        COUNT(r.id) as total_rentals,
        COALESCE(SUM(r.wavy_gets), 0) as total_wavy,
        COALESCE(SUM(r.owner_gets), 0) as total_owner,
        COALESCE(SUM(r.period_days), 0) as total_days
      FROM motors m
      LEFT JOIN rentals r ON m.id = r.motor_id
        AND r.date_time BETWEEN ? AND ? AND r.status != 'refunded'
      GROUP BY m.id ORDER BY total_wavy DESC
    `, [startDate, endDate])
  })

  ipcMain.handle('report:daily', (_, { date }) => {
    return dbOps.all(`
      SELECT r.*, m.model, m.plate_number
      FROM rentals r JOIN motors m ON r.motor_id = m.id
      WHERE date(r.date_time) = ? ORDER BY r.date_time DESC
    `, [date])
  })
}
