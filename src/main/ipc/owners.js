import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'

export function registerOwnerHandlers() {
  ipcMain.handle('owner:get-all', (_, { activeOnly = false } = {}) => {
    const where = activeOnly ? 'WHERE o.is_active = 1' : ''
    return dbOps.all(`
      SELECT o.*, 
        (SELECT COALESCE(SUM(r.owner_gets), 0) FROM rentals r 
         JOIN motors m ON r.motor_id = m.id 
         WHERE m.owner_id = o.id AND r.payout_id IS NULL AND r.status != 'refunded') as unpaid_commission
      FROM owners o ${where} ORDER BY name ASC
    `)
  })

  ipcMain.handle('owner:get-by-id', (_, payload) => {
    const ownerId = typeof payload === 'object' && payload !== null ? Number(payload.id) : Number(payload)
    const startDate = typeof payload === 'object' && payload !== null ? payload.startDate || null : null
    const endDate = typeof payload === 'object' && payload !== null ? payload.endDate || null : null
    const owner = dbOps.get('SELECT * FROM owners WHERE id = ?', [ownerId])
    const motors = dbOps.all('SELECT * FROM motors WHERE owner_id = ?', [ownerId])

    // Tambah summary finansial per motor
    const motorsWithSummary = motors.map(m => {
      const pendingCommission = dbOps.get(`
        SELECT COALESCE(SUM(owner_gets), 0) as total
        FROM rentals
        WHERE motor_id = ? AND payout_id IS NULL AND status != 'refunded'
          ${startDate ? 'AND date(date_time) >= ?' : ''}
          ${endDate ? 'AND date(date_time) <= ?' : ''}
      `, [m.id, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])])

      const pendingExpenses = dbOps.all(`
        SELECT id, date, category, description, amount
        FROM expenses
        WHERE motor_id = ? AND payout_id IS NULL AND type = 'motor'
          ${startDate ? 'AND date >= ?' : ''}
          ${endDate ? 'AND date <= ?' : ''}
        ORDER BY date DESC
      `, [m.id, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])])

      const totalExpenses = pendingExpenses.reduce((s, e) => s + (e.amount || 0), 0)
      const netCommission = Math.max(0, (pendingCommission?.total || 0) - totalExpenses)

      return {
        ...m,
        pending_commission: pendingCommission?.total || 0,
        pending_expenses: pendingExpenses,
        total_pending_expenses: totalExpenses,
        net_commission: netCommission
      }
    })

    return { ...owner, motors: motorsWithSummary }
  })

  ipcMain.handle('owner:create', (_, data) => {
    dbOps.runRaw(
      'INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)',
      [data.name, data.phone, null, null]
    )
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()
    return { id: row.id }
  })

  ipcMain.handle('owner:update', (_, { id, ...data }) => {
    dbOps.run(
      'UPDATE owners SET name=?, phone=?, bank_account=?, bank_name=?, is_active=? WHERE id=?',
      [data.name, data.phone, null, null, data.is_active ?? 1, id]
    )
    return { success: true }
  })

  ipcMain.handle('owner:delete', (_, id) => {
    // Cek apakah owner punya motor atau riwayat payout
    const hasMotors = dbOps.get('SELECT id FROM motors WHERE owner_id = ? LIMIT 1', [id])
    const hasPayouts = dbOps.get('SELECT id FROM payouts WHERE owner_id = ? LIMIT 1', [id])
    const hasRentals = dbOps.get(`
      SELECT r.id FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? LIMIT 1
    `, [id])

    if (hasMotors || hasPayouts || hasRentals) {
      // Ada data terkait → soft delete saja
      dbOps.run('UPDATE owners SET is_active = 0 WHERE id = ?', [id])
      return { success: true, softDeleted: true }
    }

    // Tidak ada data terkait → hard delete
    dbOps.run('DELETE FROM owners WHERE id = ?', [id])
    return { success: true, softDeleted: false }
  })

  ipcMain.handle('owner:get-payout-history', (_, { ownerId, startDate, endDate }) => {
    const params = [ownerId]
    let dateFilter = ''
    if (startDate) {
      dateFilter += ' AND p.date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ' AND p.date <= ?'
      params.push(endDate)
    }

    const payouts = dbOps.all(`
      SELECT p.*, ca.name as cash_account_name,
        ct.description as tx_description
      FROM payouts p
      JOIN cash_accounts ca ON p.cash_account_id = ca.id
      LEFT JOIN cash_transactions ct ON ct.reference_type = 'owner_payout' AND ct.reference_id = p.id
      WHERE p.owner_id = ?
      ${dateFilter}
      ORDER BY p.date DESC, p.id DESC
    `, params)

    // Expense motor yang belum masuk ke payout manapun
    const unpaidExpenses = dbOps.all(`
      SELECT e.id, e.date, e.category, e.description, e.amount,
             m.model, m.plate_number
      FROM expenses e
      JOIN motors m ON e.motor_id = m.id
      WHERE m.owner_id = ? AND e.payout_id IS NULL AND e.type = 'motor'
      ORDER BY e.date DESC
    `, [ownerId])

    return {
      payouts: payouts.map(p => {
        const deductions = dbOps.all(`
          SELECT pd.amount, e.category, e.description, e.date,
                 m.model, m.plate_number
          FROM payout_deductions pd
          JOIN expenses e ON pd.expense_id = e.id
          LEFT JOIN motors m ON e.motor_id = m.id
          WHERE pd.payout_id = ?
          ORDER BY m.model, e.category
        `, [p.id])

        const rentals = dbOps.all(`
          SELECT r.date_time, r.owner_gets, r.period_days, m.model, m.plate_number
          FROM rentals r JOIN motors m ON r.motor_id = m.id
          WHERE r.payout_id = ?
          ORDER BY r.date_time DESC
        `, [p.id])

        const grossAmount = p.gross_amount || p.amount
        return { ...p, deductions, rentals, grossAmount }
      }),
      unpaidExpenses
    }
  })

  ipcMain.handle('owner:get-slip-period-meta', (_, { ownerId }) => {
    const latestPayout = dbOps.get(`
      SELECT p.date
      FROM payouts p
      WHERE p.owner_id = ?
      ORDER BY p.date DESC, p.id DESC
      LIMIT 1
    `, [ownerId])

    const firstRental = dbOps.get(`
      SELECT date(MIN(r.date_time)) as first_date
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.status != 'refunded'
    `, [ownerId])

    const firstExpense = dbOps.get(`
      SELECT MIN(e.date) as first_date
      FROM expenses e
      JOIN motors m ON e.motor_id = m.id
      WHERE m.owner_id = ? AND e.type = 'motor'
    `, [ownerId])

    const dates = [firstRental?.first_date, firstExpense?.first_date].filter(Boolean).sort()
    return {
      latestPayoutDate: latestPayout?.date || null,
      firstActivityDate: dates[0] || null
    }
  })

  ipcMain.handle('owner:get-commission-summary', (_, { ownerId, startDate, endDate }) => {
    let query = `
      SELECT r.*, m.model, m.plate_number,
             (CASE WHEN r.payout_id IS NOT NULL THEN 1 ELSE 0 END) as is_paid
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.status != 'refunded'
    `
    const params = [ownerId]

    if (startDate) { query += ' AND date(r.date_time) >= ?'; params.push(startDate) }
    if (endDate) { query += ' AND date(r.date_time) <= ?'; params.push(endDate) }

    query += ' ORDER BY r.date_time DESC'
    return dbOps.all(query, params)
  })

  // Preview payout: hitung hak mitra kotor, pengeluaran motor belum dipotong, dan bersih
  ipcMain.handle('owner:payout-preview', (_, { ownerId, motorIds = null }) => {
    const hasFilter = motorIds && motorIds.length > 0
    const motorFilter = hasFilter ? `AND m.id IN (${motorIds.map(() => '?').join(',')})` : ''
    const motorParams = hasFilter ? motorIds : []

    const rentals = dbOps.all(`
      SELECT r.id, r.date_time, r.owner_gets, r.total_price, r.period_days,
             m.model, m.plate_number, m.id as motor_id
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.payout_id IS NULL AND r.status != 'refunded' AND r.owner_gets > 0
      ${motorFilter}
      ORDER BY m.model, r.date_time DESC
    `, [ownerId, ...motorParams])

    const expenses = dbOps.all(`
      SELECT e.id, e.date, e.category, e.type, e.amount, e.description,
             m.model, m.plate_number, m.id as motor_id
      FROM expenses e
      JOIN motors m ON e.motor_id = m.id
      WHERE m.owner_id = ? AND e.payout_id IS NULL AND e.type = 'motor'
      ${motorFilter}
      ORDER BY m.model, e.date DESC
    `, [ownerId, ...motorParams])

    const grossCommission = rentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
    const totalDeductions = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const netAmount = Math.max(0, grossCommission - totalDeductions)

    const motorMap = {}
    for (const r of rentals) {
      if (!motorMap[r.motor_id]) motorMap[r.motor_id] = { motor_id: r.motor_id, model: r.model, plate_number: r.plate_number, rentals: [], expenses: [], rental_total: 0, expense_total: 0 }
      motorMap[r.motor_id].rentals.push(r)
      motorMap[r.motor_id].rental_total += r.owner_gets || 0
    }
    for (const e of expenses) {
      if (!motorMap[e.motor_id]) motorMap[e.motor_id] = { motor_id: e.motor_id, model: e.model, plate_number: e.plate_number, rentals: [], expenses: [], rental_total: 0, expense_total: 0 }
      motorMap[e.motor_id].expenses.push(e)
      motorMap[e.motor_id].expense_total += e.amount || 0
    }
    const byMotor = Object.values(motorMap).sort((a, b) => a.model.localeCompare(b.model))

    return { rentals, expenses, byMotor, grossCommission, totalDeductions, netAmount }
  })

  ipcMain.handle('owner:payout', (_, data) => {
    // FIX: Recalculate server-side — jangan percaya net_amount dari client
    const hasMotorFilter = data.motor_ids && data.motor_ids.length > 0
    const motorFilter = hasMotorFilter ? `AND motor_id IN (${data.motor_ids.map(() => '?').join(',')})` : ''
    const motorParams = hasMotorFilter ? data.motor_ids : []

    const validRentals = dbOps.all(`
      SELECT id, owner_gets FROM rentals
      WHERE payout_id IS NULL AND status != 'refunded' AND owner_gets > 0
      AND motor_id IN (SELECT id FROM motors WHERE owner_id = ?)
      ${motorFilter}
    `, [data.owner_id, ...motorParams])

    const expenseMotorFilter = hasMotorFilter ? `AND e.motor_id IN (${data.motor_ids.map(() => '?').join(',')})` : ''
    const validExpenses = data.expense_ids && data.expense_ids.length > 0
      ? dbOps.all(
          `SELECT e.id, e.amount
           FROM expenses e
           JOIN motors m ON e.motor_id = m.id
           WHERE e.id IN (${data.expense_ids.map(() => '?').join(',')})
             AND e.payout_id IS NULL
             AND e.type = 'motor'
             AND m.owner_id = ?
             ${expenseMotorFilter}`,
          [...data.expense_ids, data.owner_id, ...motorParams]
        )
      : []

    const serverGross = validRentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
    const serverDeductions = validExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const serverNetAmount = Math.max(0, serverGross - serverDeductions)

    // Toleransi Rp 1 untuk floating point
    if (Math.abs(serverNetAmount - data.net_amount) > 1) {
      throw new Error(`Jumlah payout tidak sesuai. Server menghitung Rp ${serverNetAmount.toLocaleString('id-ID')}`)
    }

    const cashAccount = serverNetAmount > 0
      ? dbOps.get('SELECT * FROM cash_accounts WHERE id = ?', [data.cash_account_id])
      : null
    if (serverNetAmount > 0 && !cashAccount) throw new Error('Akun kas tidak ditemukan')

    if (serverNetAmount > 0 && cashAccount.balance < serverNetAmount) {
      throw new Error(`Saldo Kas ${cashAccount.name} tidak cukup! (Sisa: Rp ${cashAccount.balance.toLocaleString('id-ID')})`)
    }

    // Simpan payout dengan gross dan deduction
    dbOps.runRaw(
      'INSERT INTO payouts (owner_id, amount, gross_amount, deduction_amount, cash_account_id, date) VALUES (?, ?, ?, ?, ?, ?)',
      [data.owner_id, serverNetAmount, serverGross, serverDeductions, data.cash_account_id, data.date]
    )
    const { id: payoutId } = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()

    // Tandai rentals sebagai lunas (hanya yang sudah divalidasi)
    if (validRentals.length > 0) {
      const rentalIds = validRentals.map(r => r.id)
      const placeholders = rentalIds.map(() => '?').join(',')
      dbOps.run(
        `UPDATE rentals SET payout_id = ? WHERE id IN (${placeholders})`,
        [payoutId, ...rentalIds]
      )
    }

    // Catat potongan pengeluaran dan tandai expense sebagai sudah dipotong
    for (const exp of validExpenses) {
      dbOps.run(
        'INSERT INTO payout_deductions (payout_id, expense_id, amount) VALUES (?, ?, ?)',
        [payoutId, exp.id, exp.amount]
      )
      dbOps.run('UPDATE expenses SET payout_id = ? WHERE id = ?', [payoutId, exp.id])
    }

    if (serverNetAmount > 0) {
      dbOps.run(`
        INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
        VALUES (?, 'out', ?, 'owner_payout', ?, ?, ?)
      `, [data.cash_account_id, serverNetAmount, payoutId,
          `Hak Mitra ${data.owner_name || 'Vendor'} (Kotor: ${serverGross.toLocaleString('id-ID')} - Potongan: ${serverDeductions.toLocaleString('id-ID')})`,
          data.date])
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [serverNetAmount, data.cash_account_id])
    }

    return { success: true, payoutId }
  })
}
