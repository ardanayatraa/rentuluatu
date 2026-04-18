import { ipcMain } from 'electron'
import { dbOps } from '../db'

const COMPANY_EXPENSE_WHERE = `
  FROM expenses e
  WHERE e.date BETWEEN ? AND ?
    AND (e.type IS NULL OR e.type != 'motor')
`
const NET_RENTAL_INCOME_EXPR = `
  CASE
    WHEN COALESCE(r.sisa, 0) > 0 THEN COALESCE(r.sisa, 0)
    WHEN (COALESCE(r.wavy_gets, 0) + COALESCE(r.owner_gets, 0)) > 0 THEN (COALESCE(r.wavy_gets, 0) + COALESCE(r.owner_gets, 0))
    ELSE (COALESCE(r.total_price, 0) - COALESCE(r.vendor_fee, 0))
  END
`

export function registerReportHandlers() {
  ipcMain.handle('report:summary', (_, { startDate, endDate }) => {
    const start = startDate.split('T')[0]
    const end = endDate.split('T')[0]
    const income = dbOps.get(
      `SELECT COALESCE(SUM(${NET_RENTAL_INCOME_EXPR}), 0) as total
       FROM rentals r
       WHERE r.date_time BETWEEN ? AND ? AND r.status != 'refunded'`,
      [startDate, endDate]
    )
    const expenses = dbOps.get(
      `SELECT COALESCE(SUM(e.amount), 0) as total ${COMPANY_EXPENSE_WHERE}`,
      [start, end]
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
	             CASE
	               WHEN LOWER(COALESCE(m.type, '')) IN ('aset_pt', 'pribadi') THEN 'Owner Pribadi (PT)'
	               ELSE o.name
	             END as owner_name
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
        AND e.type = 'motor'
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
             r.payment_method,
             CASE
               WHEN COALESCE(r.sisa, 0) > 0 THEN COALESCE(r.sisa, 0)
               WHEN (COALESCE(r.wavy_gets, 0) + COALESCE(r.owner_gets, 0)) > 0 THEN (COALESCE(r.wavy_gets, 0) + COALESCE(r.owner_gets, 0))
               ELSE (COALESCE(r.total_price, 0) - COALESCE(r.vendor_fee, 0))
             END as amount,
             r.status,
             r.invoice_number, r.relation_type, r.parent_rental_id, r.period_days,
             m.model as motor_model, m.plate_number,
             pr.invoice_number as parent_invoice_number,
             pm.model as parent_motor_model, pm.plate_number as parent_plate_number
      FROM rentals r JOIN motors m ON r.motor_id = m.id
      LEFT JOIN rentals pr ON pr.id = r.parent_rental_id
      LEFT JOIN motors pm ON pm.id = pr.motor_id
      WHERE r.date_time BETWEEN ? AND ?
      ORDER BY r.date_time DESC
    `, [startDate, endDate])

    const operationalExpenses = dbOps.all(`
      SELECT e.id, e.date, 'expense' as type,
             e.category as description,
             COALESCE(m.model || ' (' || m.plate_number || ')', 'Umum') as motor,
             e.payment_method, e.amount, 'completed' as status
      FROM expenses e LEFT JOIN motors m ON e.motor_id = m.id
      WHERE e.date BETWEEN ? AND ?
        AND e.type != 'motor'
      ORDER BY e.date DESC
    `, [startDate.split('T')[0], endDate.split('T')[0]])

    const motorExpenses = dbOps.all(`
      SELECT e.id, e.date, 'expense' as type,
             e.category as description,
             COALESCE(m.model || ' (' || m.plate_number || ')', 'Motor') as motor,
             e.payment_method, e.amount, 'completed' as status
      FROM expenses e LEFT JOIN motors m ON e.motor_id = m.id
      WHERE e.date BETWEEN ? AND ?
        AND e.type = 'motor'
      ORDER BY e.date DESC
    `, [startDate.split('T')[0], endDate.split('T')[0]])

    return { rentals, operationalExpenses, motorExpenses }
  })

  // Laporan hak mitra owner (untuk cetak PDF pembayaran hak mitra)
  ipcMain.handle('report:owner-commission', (_, { ownerId, startDate, endDate, motorId = null }) => {
    const owner = dbOps.get('SELECT * FROM owners WHERE id = ?', [ownerId])
    const motors = dbOps.all(
      `SELECT * FROM motors WHERE owner_id = ? ${motorId ? 'AND id = ?' : ''}`,
      motorId ? [ownerId, motorId] : [ownerId]
    )
    const motorFilter = motorId ? ' AND m.id = ?' : ''
    const rentalParams = motorId ? [ownerId, startDate, endDate, motorId] : [ownerId, startDate, endDate]

    const rentals = dbOps.all(`
      SELECT r.id, r.date_time, r.customer_name, r.period_days,
             r.total_price, r.owner_gets, r.wavy_gets, r.sisa,
             r.payment_method, r.payout_id,
             m.id as motor_id, m.model, m.plate_number
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.status != 'refunded'
        AND r.date_time BETWEEN ? AND ?
        ${motorFilter}
      ORDER BY r.date_time DESC
    `, rentalParams)

    const expenseParams = motorId
      ? [ownerId, startDate.split('T')[0], endDate.split('T')[0], motorId]
      : [ownerId, startDate.split('T')[0], endDate.split('T')[0]]
    const totalOwnerGets = rentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
    const totalPaid = rentals.filter(r => r.payout_id).reduce((s, r) => s + (r.owner_gets || 0), 0)
    const totalUnpaid = rentals.filter(r => !r.payout_id).reduce((s, r) => s + (r.owner_gets || 0), 0)
    const expenses = dbOps.all(`
      SELECT e.id, e.date, e.category, e.type, e.amount, e.description, e.payout_id,
             m.id as motor_id, m.model, m.plate_number
      FROM expenses e
      JOIN motors m ON e.motor_id = m.id
      WHERE m.owner_id = ? AND e.type = 'motor'
        AND e.date BETWEEN ? AND ?
        ${motorFilter}
      ORDER BY m.model, e.date DESC
    `, expenseParams)

    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const totalNet = totalOwnerGets - totalExpenses

    const motorMap = {}
    for (const motor of motors) {
      motorMap[motor.id] = {
        motor_id: motor.id,
        model: motor.model,
        plate_number: motor.plate_number,
        rentals: [],
        expenses: [],
        rental_total: 0,
        expense_total: 0,
        net_total: 0
      }
    }
    for (const rental of rentals) {
      if (!motorMap[rental.motor_id]) {
        motorMap[rental.motor_id] = {
          motor_id: rental.motor_id,
          model: rental.model,
          plate_number: rental.plate_number,
          rentals: [],
          expenses: [],
          rental_total: 0,
          expense_total: 0,
          net_total: 0
        }
      }
      motorMap[rental.motor_id].rentals.push(rental)
      motorMap[rental.motor_id].rental_total += rental.owner_gets || 0
    }
    for (const expense of expenses) {
      if (!motorMap[expense.motor_id]) {
        motorMap[expense.motor_id] = {
          motor_id: expense.motor_id,
          model: expense.model,
          plate_number: expense.plate_number,
          rentals: [],
          expenses: [],
          rental_total: 0,
          expense_total: 0,
          net_total: 0
        }
      }
      motorMap[expense.motor_id].expenses.push(expense)
      motorMap[expense.motor_id].expense_total += expense.amount || 0
    }
    const byMotor = Object.values(motorMap)
      .map(item => ({
        ...item,
        net_total: (item.rental_total || 0) - (item.expense_total || 0)
      }))
      .filter(item => item.rentals.length || item.expenses.length)
      .sort((a, b) => a.model.localeCompare(b.model))

    const payoutMotorFilter = motorId
      ? `AND EXISTS (
          SELECT 1 FROM rentals r
          WHERE r.payout_id = p.id AND r.motor_id = ?
        )`
      : ''
    const payouts = dbOps.all(`
      SELECT p.*, ca.name as cash_account_name
      FROM payouts p JOIN cash_accounts ca ON p.cash_account_id = ca.id
      WHERE p.owner_id = ? AND p.date BETWEEN ? AND ?
      ${payoutMotorFilter}
      ORDER BY p.date DESC
    `, motorId
      ? [ownerId, startDate.split('T')[0], endDate.split('T')[0], motorId]
      : [ownerId, startDate.split('T')[0], endDate.split('T')[0]])

    return { owner, motors, rentals, expenses, byMotor, payouts, totalOwnerGets, totalPaid, totalUnpaid, totalExpenses, totalNet }
  })

  // Laporan per pemilik motor
  ipcMain.handle('report:owner-summary', (_, { startDate, endDate, ownerId }) => {
    const sd = startDate.split('T')[0]
    const ed = endDate.split('T')[0]
    const ownerFilter = ownerId ? 'AND o.id = ?' : ''
    // FIX: bind params harus sesuai urutan placeholder di query
    // subquery pakai sd/ed (date only), JOIN rentals pakai startDate/endDate (datetime)
    const params = [sd, ed, sd, ed, startDate, endDate]
    if (ownerId) params.push(ownerId)

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
    `, params)
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
      `SELECT e.category as category, e.type as type, COALESCE(SUM(e.amount),0) as total
       ${COMPANY_EXPENSE_WHERE}
       GROUP BY e.category, e.type
       ORDER BY e.type, total DESC`,
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

  // Neraca sederhana berbasis data yang tersedia di sistem
  ipcMain.handle('report:balance-sheet', (_, { endDate }) => {
    const cutoffDate = (endDate || new Date().toISOString()).split('T')[0]
    const cutoffDateTime = `${cutoffDate}T23:59:59`

    const cashAccounts = dbOps.all(
      `SELECT id, name, type, COALESCE(balance, 0) as balance
       FROM cash_accounts
       ORDER BY type ASC, name ASC`
    )

    const receivableRentals = dbOps.get(
      `SELECT COALESCE(SUM(sisa), 0) as total
       FROM rentals
       WHERE status != 'refunded'
         AND date_time <= ?
         AND COALESCE(sisa, 0) > 0`,
      [cutoffDateTime]
    )

    const ownerPayable = dbOps.get(
      `SELECT COALESCE(SUM(owner_gets), 0) as total
       FROM rentals
       WHERE status != 'refunded'
         AND date_time <= ?
         AND payout_id IS NULL`,
      [cutoffDateTime]
    )

    const hotelPayable = dbOps.get(
      `SELECT COALESCE(SUM(vendor_fee), 0) as total
       FROM rentals
       WHERE status != 'refunded'
         AND date_time <= ?
         AND hotel_id IS NOT NULL
         AND COALESCE(relation_type, 'rental') IN ('rental', 'swap_source')
         AND hotel_payout_id IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM cash_transactions ct
           WHERE ct.reference_type = 'rental_vendor_fee'
             AND ct.reference_id = rentals.id
         )`,
      [cutoffDateTime]
    )

    const ownerExpensePayable = dbOps.get(
      `SELECT COALESCE(SUM(e.amount), 0) as total
       FROM expenses e
       JOIN motors m ON e.motor_id = m.id
       WHERE e.type = 'motor'
         AND e.date <= ?
         AND e.payout_id IS NULL
         AND m.owner_id IS NOT NULL`,
      [cutoffDate]
    )

    const currentPeriodProfit = dbOps.get(
      `SELECT
        COALESCE((
          SELECT SUM(wavy_gets)
          FROM rentals
          WHERE status != 'refunded' AND date_time <= ?
        ), 0)
        -
        COALESCE((
          SELECT SUM(refund_amount)
          FROM refunds
          WHERE created_at <= ?
        ), 0)
        -
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          LEFT JOIN motors m ON e.motor_id = m.id
          WHERE e.date <= ?
            AND (
              e.type != 'motor'
              OR e.motor_id IS NULL
              OR m.owner_id IS NULL
            )
        ), 0) as total`,
      [cutoffDateTime, cutoffDateTime, cutoffDate]
    )

    const cashRows = cashAccounts.map(account => ({
      label: account.name,
      amount: Number(account.balance || 0)
    }))

    const assetRows = [
      ...cashRows,
      { label: 'Piutang Pelanggan (Sisa Tagihan)', amount: Number(receivableRentals?.total || 0) }
    ].filter(row => Math.abs(row.amount) > 0.0001)

    const liabilityRows = [
      { label: 'Utang Hak Mitra / Pemilik Motor', amount: Number(ownerPayable?.total || 0) },
      { label: 'Utang Fee Vendor Hotel', amount: Number(hotelPayable?.total || 0) },
      { label: 'Utang Pengeluaran Motor ke Mitra', amount: Number(ownerExpensePayable?.total || 0) }
    ].filter(row => Math.abs(row.amount) > 0.0001)

    const totalAssets = assetRows.reduce((sum, row) => sum + row.amount, 0)
    const totalLiabilities = liabilityRows.reduce((sum, row) => sum + row.amount, 0)
    const equityAmount = totalAssets - totalLiabilities
    const profitToDate = Number(currentPeriodProfit?.total || 0)
    const retainedEarnings = equityAmount - profitToDate

    return {
      asOfDate: cutoffDate,
      assets: {
        current: assetRows,
        total: totalAssets
      },
      liabilities: {
        current: liabilityRows,
        total: totalLiabilities
      },
      equity: {
        rows: [
          { label: 'Saldo Ditahan', amount: retainedEarnings },
          { label: 'Laba Bersih s/d Tanggal Laporan', amount: profitToDate }
        ],
        total: equityAmount
      },
      totals: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: equityAmount,
        liabilitiesAndEquity: totalLiabilities + equityAmount
      }
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
        `SELECT COALESCE(SUM(${NET_RENTAL_INCOME_EXPR}),0) as total, COUNT(*) as count
         FROM rentals r
         WHERE r.date_time BETWEEN ? AND ? AND r.status != 'refunded'`,
        [start, end]
      )
      const wavyGets = dbOps.get(
        "SELECT COALESCE(SUM(wavy_gets),0) as total FROM rentals WHERE date_time BETWEEN ? AND ? AND status != 'refunded'",
        [start, end]
      )
      const exp = dbOps.get(
        `SELECT COALESCE(SUM(e.amount),0) as total ${COMPANY_EXPENSE_WHERE}`,
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
      SELECT strftime('${fmt}', r.date_time) as period,
             COALESCE(SUM(${NET_RENTAL_INCOME_EXPR}), 0) as income,
             COALESCE(SUM(wavy_gets), 0) as wavy_gets,
             COALESCE(SUM(owner_gets), 0) as owner_gets,
             COUNT(id) as rental_count
      FROM rentals r
      WHERE r.date_time BETWEEN ? AND ? AND r.status != 'refunded'
      GROUP BY period ORDER BY period ASC
    `, [startDate, endDate])

    const expensesByPeriod = dbOps.all(`
      SELECT strftime('${fmt}', e.date) as period,
             COALESCE(SUM(e.amount), 0) as expenses
      ${COMPANY_EXPENSE_WHERE}
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
