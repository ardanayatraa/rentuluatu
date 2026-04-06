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

  ipcMain.handle('owner:get-by-id', (_, id) => {
    const owner = dbOps.get('SELECT * FROM owners WHERE id = ?', [id])
    const motors = dbOps.all('SELECT * FROM motors WHERE owner_id = ?', [id])
    return { ...owner, motors }
  })

  ipcMain.handle('owner:create', (_, data) => {
    dbOps.runRaw(
      'INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)',
      [data.name, data.phone, data.bank_account, data.bank_name]
    )
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()
    return { id: row.id }
  })

  ipcMain.handle('owner:update', (_, { id, ...data }) => {
    dbOps.run(
      'UPDATE owners SET name=?, phone=?, bank_account=?, bank_name=?, is_active=? WHERE id=?',
      [data.name, data.phone, data.bank_account, data.bank_name, data.is_active ?? 1, id]
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

  ipcMain.handle('owner:get-payout-history', (_, { ownerId }) => {
    const payouts = dbOps.all(`
      SELECT p.*, ca.name as cash_account_name,
        ct.description as tx_description
      FROM payouts p
      JOIN cash_accounts ca ON p.cash_account_id = ca.id
      LEFT JOIN cash_transactions ct ON ct.reference_type = 'owner_payout' AND ct.reference_id = p.id
      WHERE p.owner_id = ?
      ORDER BY p.date DESC, p.id DESC
    `, [ownerId])

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

  // Preview payout: hitung komisi kotor, pengeluaran motor belum dipotong, dan bersih
  ipcMain.handle('owner:payout-preview', (_, { ownerId }) => {
    // Komisi kotor (rental belum dibayar)
    const rentals = dbOps.all(`
      SELECT r.id, r.date_time, r.owner_gets, r.total_price, r.period_days,
             m.model, m.plate_number, m.id as motor_id
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      WHERE m.owner_id = ? AND r.payout_id IS NULL AND r.status != 'refunded' AND r.owner_gets > 0
      ORDER BY r.date_time DESC
    `, [ownerId])

    const grossCommission = rentals.reduce((s, r) => s + (r.owner_gets || 0), 0)

    // Pengeluaran motor yang belum dipotong dari payout manapun
    const expenses = dbOps.all(`
      SELECT e.id, e.date, e.category, e.type, e.amount, e.description,
             m.model, m.plate_number, m.id as motor_id
      FROM expenses e
      JOIN motors m ON e.motor_id = m.id
      WHERE m.owner_id = ? AND e.payout_id IS NULL AND e.type = 'motor'
      ORDER BY e.date DESC
    `, [ownerId])

    const totalDeductions = expenses.reduce((s, e) => s + (e.amount || 0), 0)
    const netAmount = Math.max(0, grossCommission - totalDeductions)

    return { rentals, expenses, grossCommission, totalDeductions, netAmount }
  })

  ipcMain.handle('owner:payout', (_, data) => {
    const cashAccount = dbOps.get('SELECT * FROM cash_accounts WHERE id = ?', [data.cash_account_id])
    if (!cashAccount) throw new Error('Akun kas tidak ditemukan')

    // FIX: Recalculate server-side — jangan percaya net_amount dari client
    const validRentals = dbOps.all(`
      SELECT id, owner_gets FROM rentals
      WHERE payout_id IS NULL AND status != 'refunded' AND owner_gets > 0
      AND motor_id IN (SELECT id FROM motors WHERE owner_id = ?)
    `, [data.owner_id])

    const validExpenses = data.expense_ids && data.expense_ids.length > 0
      ? dbOps.all(
          `SELECT id, amount FROM expenses WHERE id IN (${data.expense_ids.map(() => '?').join(',')}) AND payout_id IS NULL`,
          data.expense_ids
        )
      : []

    const serverGross = validRentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
    const serverDeductions = validExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const serverNetAmount = Math.max(0, serverGross - serverDeductions)

    // Toleransi Rp 1 untuk floating point
    if (Math.abs(serverNetAmount - data.net_amount) > 1) {
      throw new Error(`Jumlah payout tidak sesuai. Server menghitung Rp ${serverNetAmount.toLocaleString('id-ID')}`)
    }

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
          `Komisi ${data.owner_name || 'Vendor'} (Kotor: ${serverGross.toLocaleString('id-ID')} - Potongan: ${serverDeductions.toLocaleString('id-ID')})`,
          data.date])
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [serverNetAmount, data.cash_account_id])
    }

    return { success: true, payoutId }
  })
}
