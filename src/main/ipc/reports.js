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

  // Laporan pendapatan per motor (detail transaksi per motor)
  ipcMain.handle('report:motor-income', (_, { startDate, endDate, motorId }) => {
    let query = `
      SELECT r.id, r.date_time, r.customer_name, r.hotel, r.period_days,
             r.payment_method, r.total_price, r.vendor_fee, r.sisa,
             r.wavy_gets, r.owner_gets, r.status,
             m.model, m.plate_number, m.type as motor_type,
             o.name as owner_name
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE r.date_time BETWEEN ? AND ? AND r.status != 'refunded'
    `
    const params = [startDate, endDate]
    if (motorId) { query += ' AND r.motor_id = ?'; params.push(motorId) }
    query += ' ORDER BY r.date_time DESC'
    return dbOps.all(query, params)
  })

  // Laporan pengeluaran per motor
  ipcMain.handle('report:motor-expenses', (_, { startDate, endDate, motorId }) => {
    const sd = startDate.split('T')[0]
    const ed = endDate.split('T')[0]
    let query = `
      SELECT e.id, e.date, e.type, e.category, e.amount, e.payment_method, e.description,
             m.model, m.plate_number
      FROM expenses e
      LEFT JOIN motors m ON e.motor_id = m.id
      WHERE e.date BETWEEN ? AND ?
    `
    const params = [sd, ed]
    if (motorId) { query += ' AND e.motor_id = ?'; params.push(motorId) }
    query += ' ORDER BY e.date DESC'
    return dbOps.all(query, params)
  })

  // Laporan semua transaksi (rental + pengeluaran)
  ipcMain.handle('report:transactions', (_, { startDate, endDate }) => {
    const rentals = dbOps.all(`
      SELECT r.id, r.date_time as date, 'rental' as type,
             r.customer_name as description,
             m.model || ' (' || m.plate_number || ')' as motor,
             r.payment_method, r.total_price as amount, r.status
      FROM rentals r JOIN motors m ON r.motor_id = m.id
      WHERE r.date_time BETWEEN ? AND ?
      ORDER BY r.date_time DESC
    `, [startDate, endDate])

    const expenses = dbOps.all(`
      SELECT e.id, e.date, 'expense' as type,
             e.category as description,
             COALESCE(m.model || ' (' || m.plate_number || ')', 'Umum') as motor,
             e.payment_method, e.amount, 'completed' as status
      FROM expenses e LEFT JOIN motors m ON e.motor_id = m.id
      WHERE e.date BETWEEN ? AND ?
      ORDER BY e.date DESC
    `, [startDate.split('T')[0], endDate.split('T')[0]])

    return { rentals, expenses }
  })

  // Laporan komisi owner (untuk cetak PDF pembayaran komisi)
  ipcMain.handle('report:owner-commission', (_, { ownerId, startDate, endDate }) => {
    const owner = dbOps.get('SELECT * FROM owners WHERE id = ?', [ownerId])
    const motors = dbOps.all('SELECT * FROM motors WHERE owner_id = ?', [ownerId])

    const rentals = dbOps.all(`
      SELECT r.id, r.date_time, r.customer_name, r.period_days,
             r.total_price, r.owner_gets, r.wavy_gets, r.sisa,
             r.payment_method, r.payout_id,
             m.model, m.plate_number
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.status != 'refunded'
        AND r.date_time BETWEEN ? AND ?
      ORDER BY r.date_time DESC
    `, [ownerId, startDate, endDate])

    const totalOwnerGets = rentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
    const totalPaid = rentals.filter(r => r.payout_id).reduce((s, r) => s + (r.owner_gets || 0), 0)
    const totalUnpaid = rentals.filter(r => !r.payout_id).reduce((s, r) => s + (r.owner_gets || 0), 0)

    const payouts = dbOps.all(`
      SELECT p.*, ca.name as cash_account_name
      FROM payouts p JOIN cash_accounts ca ON p.cash_account_id = ca.id
      WHERE p.owner_id = ? AND p.date BETWEEN ? AND ?
      ORDER BY p.date DESC
    `, [ownerId, startDate.split('T')[0], endDate.split('T')[0]])

    return { owner, motors, rentals, payouts, totalOwnerGets, totalPaid, totalUnpaid }
  })

  // Laporan per pemilik motor
  ipcMain.handle('report:owner-summary', (_, { startDate, endDate, ownerId }) => {
    let ownerFilter = ownerId ? 'AND o.id = ?' : ''
    const params = ownerId ? [startDate, endDate, startDate.split('T')[0], endDate.split('T')[0], ownerId] : [startDate, endDate, startDate.split('T')[0], endDate.split('T')[0]]

    return dbOps.all(`
      SELECT o.id, o.name, o.phone, o.bank_name, o.bank_account,
        COUNT(DISTINCT m.id) as motor_count,
        COUNT(r.id) as rental_count,
        COALESCE(SUM(r.total_price), 0) as total_omzet,
        COALESCE(SUM(r.owner_gets), 0) as gross_commission,
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          JOIN motors m2 ON e.motor_id = m2.id
          WHERE m2.owner_id = o.id AND e.date BETWEEN ? AND ? AND e.payout_id IS NULL
        ), 0) as pending_expenses,
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          JOIN motors m2 ON e.motor_id = m2.id
          WHERE m2.owner_id = o.id AND e.date BETWEEN ? AND ?
        ), 0) as total_expenses
      FROM owners o
      JOIN motors m ON m.owner_id = o.id
      LEFT JOIN rentals r ON r.motor_id = m.id
        AND r.date_time BETWEEN ? AND ? AND r.status != 'refunded'
      WHERE o.is_active = 1 ${ownerFilter}
      GROUP BY o.id
      ORDER BY gross_commission DESC
    `, [...params, startDate, endDate, ...(ownerId ? [ownerId] : [])])
  })

  // Laporan Laba Rugi
  ipcMain.handle('report:profit-loss', (_, { startDate, endDate }) => {
    const omzet = dbOps.get(
      "SELECT COALESCE(SUM(total_price),0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const wavyGets = dbOps.get(
      "SELECT COALESCE(SUM(wavy_gets),0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const ownerGets = dbOps.get(
      "SELECT COALESCE(SUM(owner_gets),0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
      [startDate, endDate]
    )
    const refunds = dbOps.get(
      "SELECT COALESCE(SUM(refund_amount),0) as total FROM refunds WHERE created_at BETWEEN ? AND ?",
      [startDate, endDate]
    )
    const expenses = dbOps.all(
      "SELECT category, type, COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category, type ORDER BY type, total DESC",
      [startDate.split('T')[0], endDate.split('T')[0]]
    )
    const totalExpenses = expenses.reduce((s, e) => s + e.total, 0)
    const labaKotor = wavyGets.total - refunds.total
    const labaBersih = labaKotor - totalExpenses

    return {
      omzet: omzet.total,
      wavy_gets: wavyGets.total,
      owner_gets: ownerGets.total,
      refunds: refunds.total,
      laba_kotor: labaKotor,
      expenses,
      total_expenses: totalExpenses,
      laba_bersih: labaBersih
    }
  })

  // Rekap omzet bulanan dalam satu tahun
  ipcMain.handle('report:annual-recap', (_, { year }) => {
    const months = []
    for (let m = 1; m <= 12; m++) {
      const mo = String(m).padStart(2, '0')
      const start = `${year}-${mo}-01T00:00:00`
      const end = `${year}-${mo}-31T23:59:59`
      const income = dbOps.get(
        "SELECT COALESCE(SUM(total_price),0) as total, COUNT(*) as count FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
        [start, end]
      )
      const wavyGets = dbOps.get(
        "SELECT COALESCE(SUM(wavy_gets),0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
        [start, end]
      )
      const exp = dbOps.get(
        "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN ? AND ?",
        [`${year}-${mo}-01`, `${year}-${mo}-31`]
      )
      months.push({
        month: m, month_name: new Date(year, m - 1, 1).toLocaleString('id-ID', { month: 'long' }),
        omzet: income.total, rental_count: income.count,
        wavy_gets: wavyGets.total, expenses: exp.total,
        laba: wavyGets.total - exp.total
      })
    }
    return months
  })
  ipcMain.handle('report:financial', (_, { startDate, endDate, groupBy }) => {
    // groupBy: 'day' | 'month' | 'year'
    const fmt = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'month' ? '%Y-%m' : '%Y'

    const incomeByPeriod = dbOps.all(`
      SELECT strftime('${fmt}', date_time) as period,
             COALESCE(SUM(total_price), 0) as income,
             COALESCE(SUM(wavy_gets), 0) as wavy_gets,
             COALESCE(SUM(owner_gets), 0) as owner_gets,
             COUNT(id) as rental_count
      FROM rentals
      WHERE date_time BETWEEN ? AND ? AND status != 'refunded'
      GROUP BY period ORDER BY period ASC
    `, [startDate, endDate])

    const expensesByPeriod = dbOps.all(`
      SELECT strftime('${fmt}', date) as period,
             COALESCE(SUM(amount), 0) as expenses
      FROM expenses
      WHERE date BETWEEN ? AND ?
      GROUP BY period ORDER BY period ASC
    `, [startDate.split('T')[0], endDate.split('T')[0]])

    // Merge by period
    const map = {}
    for (const r of incomeByPeriod) {
      map[r.period] = { period: r.period, income: r.income, wavy_gets: r.wavy_gets, owner_gets: r.owner_gets, rental_count: r.rental_count, expenses: 0 }
    }
    for (const e of expensesByPeriod) {
      if (!map[e.period]) map[e.period] = { period: e.period, income: 0, wavy_gets: 0, owner_gets: 0, rental_count: 0, expenses: 0 }
      map[e.period].expenses = e.expenses
    }

    const rows = Object.values(map).sort((a, b) => a.period.localeCompare(b.period))
    rows.forEach(r => { r.profit = r.wavy_gets - r.expenses })

    return rows
  })
}
