import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { calcCommission } from '../lib/finance'

export function registerRentalHandlers() {
  const allowedPaymentMethods = ['tunai', 'transfer', 'qris', 'debit_card']
  const roundCurrency = (value) => Math.round(Number(value || 0))
  const normalizePaymentMethod = (value) => {
    const raw = String(value || '').trim().toLowerCase()
    if (raw === 'qriss') return 'qris'
    if (raw === 'debit card' || raw === 'debit-card' || raw === 'debit') return 'debit_card'
    return raw
  }
  const assertValidPaymentMethod = (value) => {
    const method = normalizePaymentMethod(value)
    if (!allowedPaymentMethods.includes(method)) {
      throw new Error('Metode pembayaran tidak valid')
    }
    return method
  }
  const reverseCashTransactionRows = (rows = []) => {
    for (const tx of rows) {
      const amount = Number(tx?.amount || 0)
      if (amount <= 0) continue
      const reverseAmount = tx.type === 'in' ? -amount : amount
      dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [reverseAmount, tx.cash_account_id])
    }
  }
  const deleteRentalCashTransactions = (rentalId) => {
    const txRows = dbOps.all(
      `SELECT * FROM cash_transactions
       WHERE reference_id = ?
         AND reference_type IN ('rental', 'rental_vendor_fee')
       ORDER BY id DESC`,
      [rentalId]
    )
    if (txRows.length) {
      reverseCashTransactionRows(txRows)
      dbOps.run(
        `DELETE FROM cash_transactions
         WHERE reference_id = ?
           AND reference_type IN ('rental', 'rental_vendor_fee')`,
        [rentalId]
      )
      return
    }

    // Fallback kompatibilitas data/test lama: hanya 1 baris mutasi rental.
    const legacyTx = dbOps.get(
      "SELECT * FROM cash_transactions WHERE reference_type = 'rental' AND reference_id = ? ORDER BY id DESC LIMIT 1",
      [rentalId]
    )
    if (legacyTx) reverseCashTransactionRows([legacyTx])
    dbOps.run("DELETE FROM cash_transactions WHERE reference_type = 'rental' AND reference_id = ?", [rentalId])
  }
  const applyRentalCashTransactions = ({
    rentalId,
    paymentMethod,
    totalPrice,
    vendorFee,
    customerName,
    motorModel,
    dateTime,
    relationType
  }) => {
    const incomeAmount = Number(totalPrice || 0)
    const feeAmount = Number(vendorFee || 0)
    if (incomeAmount <= 0) return
    const txDate = String(dateTime || '').split('T')[0]
    const methodAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [paymentMethod])
    if (!methodAccount) throw new Error('Akun kas metode pembayaran tidak ditemukan')

    dbOps.run(
      `INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
       VALUES (?, 'in', ?, 'rental', ?, ?, ?)`,
      [methodAccount.id, incomeAmount, rentalId, `Sewa ${motorModel} - ${customerName}`, txDate]
    )
    dbOps.run('UPDATE cash_accounts SET balance = balance + ? WHERE id = ?', [incomeAmount, methodAccount.id])

    if (feeAmount > 0) {
      let cashTunai = dbOps.get("SELECT * FROM cash_accounts WHERE type = 'tunai'")
      if (!cashTunai) {
        // Fallback kompatibilitas data lama/testing: pakai akun metode pembayaran bila akun tunai belum tersedia.
        cashTunai = methodAccount
      }
      if (!cashTunai) throw new Error('Akun kas tidak ditemukan untuk pembayaran fee vendor')

      const projectedTunaiBalance =
        Number(cashTunai.balance || 0) +
        (Number(cashTunai.id) === Number(methodAccount.id) ? incomeAmount : 0)
      if (projectedTunaiBalance < feeAmount) {
        throw new Error(`Saldo Kas Tunai tidak cukup untuk membayar fee vendor (butuh Rp ${feeAmount.toLocaleString('id-ID')})`)
      }

      const vendorFeeLabel =
        relationType === 'swap_source' ? 'Fee Vendor (Sumber Ganti Unit)' :
          relationType === 'swap' ? 'Fee Vendor (Motor Pengganti)' :
            relationType === 'extend' ? 'Fee Vendor (Extend)' :
              'Fee Vendor'
      dbOps.run(
        `INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
         VALUES (?, 'out', ?, 'rental_vendor_fee', ?, ?, ?)`,
        [cashTunai.id, feeAmount, rentalId, `${vendorFeeLabel} - ${customerName}`, txDate]
      )
      dbOps.run('UPDATE cash_accounts SET balance = balance - ? WHERE id = ?', [feeAmount, cashTunai.id])
    }
  }

  const generateInvoiceNumber = (dateTime) => {
    const dt = new Date(dateTime)
    const yr = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const existing = dbOps.get("SELECT COUNT(*) as c FROM rentals WHERE invoice_number LIKE ?", [`WVY-${yr}-${mo}-%`])
    const seq = String((existing?.c || 0) + 1).padStart(4, '0')
    return `WVY-${yr}-${mo}-${seq}`
  }

  ipcMain.handle('rental:get-all', (_, filters = {}) => {
    let query = `
      SELECT
        r.*,
        m.model,
        m.plate_number,
        m.type as motor_type,
        h.name as vendor_name,
        COALESCE(rs_rep.settlement_note, rs_src.settlement_note) as swap_note,
        COALESCE(rs_rep.settlement_type, rs_src.settlement_type) as swap_settlement_type,
        COALESCE(rs_rep.settlement_amount, rs_src.settlement_amount) as swap_settlement_amount,
        COALESCE(rs_rep.settlement_payment_method, rs_src.settlement_payment_method) as swap_settlement_payment_method,
        pr.invoice_number as parent_invoice_number,
        pr.date_time as parent_date_time,
        pr.customer_name as parent_customer_name,
        pr.is_extension as parent_is_extension,
        pr.relation_type as parent_relation_type,
        pm.model as parent_model,
        pm.plate_number as parent_plate_number
      FROM rentals r 
      JOIN motors m ON r.motor_id = m.id 
      LEFT JOIN hotels h ON r.hotel_id = h.id 
      LEFT JOIN rental_swaps rs_src ON rs_src.source_rental_id = r.id
      LEFT JOIN rental_swaps rs_rep ON rs_rep.replacement_rental_id = r.id
      LEFT JOIN rentals pr ON r.parent_rental_id = pr.id
      LEFT JOIN motors pm ON pr.motor_id = pm.id
      WHERE 1=1
    `
    const params = []
    if (filters.startDate) { query += ' AND r.date_time >= ?'; params.push(filters.startDate) }
    if (filters.endDate) { query += ' AND r.date_time <= ?'; params.push(filters.endDate) }
    if (filters.status) { query += ' AND r.status = ?'; params.push(filters.status) }
    query += ' ORDER BY r.date_time DESC'
    return dbOps.all(query, params)
  })

  ipcMain.handle('rental:get-by-id', (_, id) => {
    return dbOps.get(`
      SELECT
        r.*,
        m.model,
        m.plate_number,
        m.type as motor_type,
        CASE
          WHEN LOWER(COALESCE(m.type, '')) IN ('aset_pt', 'pribadi') THEN 'Owner Pribadi (PT)'
          ELSE o.name
        END as owner_name
      FROM rentals r
      JOIN motors m ON r.motor_id = m.id
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE r.id = ?
    `, [id])
  })

  ipcMain.handle('rental:create', (_, data) => {
    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    if (!motor) throw new Error('Motor tidak ditemukan')
    const paymentMethod = assertValidPaymentMethod(data.payment_method)

    // FIX #3: Validasi vendor_fee tidak boleh melebihi total_price
    const vendorFee = data.vendor_fee || 0
    if (vendorFee < 0) throw new Error('Vendor fee tidak boleh negatif')
    if (vendorFee > data.total_price) throw new Error('Vendor fee tidak boleh melebihi total harga sewa')

    const { sisa, wavy_gets, owner_gets } = calcCommission(
      motor.type, data.total_price, vendorFee
    )
    const pricePerDay = data.period_days > 0 ? data.total_price / data.period_days : data.total_price

    const invoiceNumber = generateInvoiceNumber(data.date_time)

    dbOps.runRaw('BEGIN TRANSACTION')
    try {
      const rentalStatus = String(data.status || 'completed')
      dbOps.runRaw(`
        INSERT INTO rentals (date_time, customer_name, hotel, hotel_id, motor_id, period_days,
          payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status, invoice_number, relation_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [data.date_time, data.customer_name, data.hotel || null, data.hotel_id || null, data.motor_id,
          data.period_days, paymentMethod, data.total_price, pricePerDay,
          vendorFee, sisa, wavy_gets, owner_gets, rentalStatus, invoiceNumber, 'rental'])

      const { id: rentalId } = dbOps.get('SELECT last_insert_rowid() as id')
      if (rentalStatus !== 'refunded') {
        applyRentalCashTransactions({
          rentalId,
          paymentMethod,
          totalPrice: data.total_price,
          vendorFee,
          customerName: data.customer_name,
          motorModel: motor.model,
          dateTime: data.date_time,
          relationType: 'rental'
        })
      }
      dbOps.runRaw('COMMIT')
      saveDb()
      return { id: rentalId, invoice_number: invoiceNumber }
    } catch (error) {
      dbOps.runRaw('ROLLBACK')
      throw error
    }
  })

  ipcMain.handle('rental:extend', (_, data) => {
    const parentRental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [data.parent_rental_id])
    if (!parentRental) throw new Error('Transaksi awal tidak ditemukan')
    if (parentRental.status === 'refunded') throw new Error('Transaksi refunded tidak bisa di-extend')

    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    if (!motor) throw new Error('Motor tidak ditemukan')

    const periodDays = Number(data.period_days || 0)
    const totalPrice = Number(data.total_price || 0)
    if (!periodDays || periodDays < 1) throw new Error('Periode extend minimal 1 hari')
    if (!totalPrice || totalPrice <= 0) throw new Error('Total harga extend harus lebih dari 0')

    const paymentMethod = assertValidPaymentMethod(data.payment_method)

    // Aturan bisnis: extend tidak membawa fee vendor hotel.
    const vendorFee = 0

    const { sisa, wavy_gets, owner_gets } = calcCommission(motor.type, totalPrice, vendorFee)
    const pricePerDay = periodDays > 0 ? totalPrice / periodDays : totalPrice
    const invoiceNumber = generateInvoiceNumber(data.date_time)

    dbOps.runRaw('BEGIN TRANSACTION')
    try {
      dbOps.runRaw(`
        INSERT INTO rentals (
          date_time, customer_name, hotel, hotel_id, motor_id, period_days,
          payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets,
          status, invoice_number, is_extension, relation_type, parent_rental_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 1, 'extend', ?)
      `, [
        data.date_time,
        parentRental.customer_name,
        parentRental.hotel || null,
        parentRental.hotel_id || null,
        data.motor_id,
        periodDays,
        paymentMethod,
        totalPrice,
        pricePerDay,
        vendorFee,
        sisa,
        wavy_gets,
        owner_gets,
        invoiceNumber,
        parentRental.id
      ])

      const { id: rentalId } = dbOps.get('SELECT last_insert_rowid() as id')
      applyRentalCashTransactions({
        rentalId,
        paymentMethod,
        totalPrice,
        vendorFee,
        customerName: parentRental.customer_name,
        motorModel: motor.model,
        dateTime: data.date_time,
        relationType: 'extend'
      })
      dbOps.runRaw('COMMIT')
      saveDb()
      return { id: rentalId, invoice_number: invoiceNumber }
    } catch (error) {
      dbOps.runRaw('ROLLBACK')
      throw error
    }
  })

  ipcMain.handle('rental:swap-unit', (_, data) => {
    const sourceRentalId = Number(data.source_rental_id || 0)
    const sourceRental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [sourceRentalId])
    if (!sourceRental) throw new Error('Transaksi sumber tidak ditemukan')
    if (sourceRental.status !== 'completed') throw new Error('Hanya transaksi completed yang bisa diganti unit')
    if (sourceRental.payout_id || sourceRental.hotel_payout_id) throw new Error('Transaksi sudah masuk payout, tidak bisa ganti unit')
    if (Number(sourceRental.is_extension || 0) === 1) throw new Error('Transaksi extend tidak bisa dipakai sebagai sumber ganti unit')

    const swapExists = dbOps.get('SELECT id FROM rental_swaps WHERE source_rental_id = ?', [sourceRentalId])
    if (swapExists) throw new Error('Transaksi sumber ini sudah pernah diproses ganti unit')

    const remainingDays = Number(data.remaining_days || 0)
    const sourcePeriodDays = Number(sourceRental.period_days || 0)
    if (!remainingDays || remainingDays < 1 || remainingDays >= sourcePeriodDays) {
      throw new Error(`Sisa hari harus di antara 1 sampai ${Math.max(1, sourcePeriodDays - 1)}`)
    }
    const usedDays = sourcePeriodDays - remainingDays

    const newMotorId = Number(data.new_motor_id || 0)
    if (!newMotorId) throw new Error('Motor pengganti wajib dipilih')
    if (newMotorId === Number(sourceRental.motor_id || 0)) throw new Error('Motor pengganti harus berbeda dari motor awal')
    const newMotor = dbOps.get('SELECT * FROM motors WHERE id = ?', [newMotorId])
    if (!newMotor) throw new Error('Motor pengganti tidak ditemukan')

    // Proses bisnis: saat ganti unit, admin input harga TOTAL untuk sisa sewa (bukan tarif per hari).
    // Untuk kompatibilitas lama, jika new_total_price tidak diisi, fallback ke new_price_per_day * remainingDays.
    const replacementTotalInput = Number(data.new_total_price || 0)
    const replacementPricePerDayInput = Number(data.new_price_per_day || 0)
    const replacementTotal = replacementTotalInput > 0
      ? roundCurrency(replacementTotalInput)
      : replacementPricePerDayInput > 0
        ? roundCurrency(replacementPricePerDayInput * remainingDays)
        : 0
    if (!replacementTotal || replacementTotal <= 0) {
      throw new Error('Harga total motor pengganti wajib diisi')
    }
    const replacementPricePerDay = remainingDays > 0
      ? (replacementTotal / remainingDays)
      : replacementTotal

    const switchDateTime = String(data.switch_date_time || '')
    if (!switchDateTime) throw new Error('Tanggal ganti unit wajib diisi')

    const sourceTotalPrice = Number(sourceRental.total_price || 0)
    const sourceVendorFee = Number(sourceRental.vendor_fee || 0)
    const sourcePricePerDay = sourcePeriodDays > 0
      ? sourceTotalPrice / sourcePeriodDays
      : sourceTotalPrice

    // Credit dari hari yang belum dipakai di transaksi awal.
    const oldRemainingCredit = roundCurrency(sourceTotalPrice * (remainingDays / sourcePeriodDays))
    const sourceUsedTotal = roundCurrency(sourceTotalPrice - oldRemainingCredit)

    const sourceVendorRatio = sourceTotalPrice > 0 ? sourceVendorFee / sourceTotalPrice : 0
    const sourceUsedVendorFee = roundCurrency(sourceVendorRatio * sourceUsedTotal)
    const sourceUsedCommission = calcCommission(
      sourceRental.motor_type || dbOps.get('SELECT type as motor_type FROM motors WHERE id = ?', [sourceRental.motor_id])?.motor_type || 'pribadi',
      sourceUsedTotal,
      sourceUsedVendorFee
    )

    // Aturan bisnis: transaksi motor pengganti tidak membawa fee vendor hotel.
    const replacementVendorFee = 0
    const replacementCommission = calcCommission(newMotor.type, replacementTotal, replacementVendorFee)
    const replacementInvoice = generateInvoiceNumber(switchDateTime)

    // Delta > 0: customer top up. Delta < 0: customer refund.
    const settlementDelta = roundCurrency(replacementTotal - oldRemainingCredit)
    const settlementType = settlementDelta > 0 ? 'topup' : settlementDelta < 0 ? 'refund' : 'none'
    const settlementAmount = Math.abs(settlementDelta)

    const settlementPaymentMethod = settlementType === 'none'
      ? null
      : String(data.settlement_payment_method || '').trim()
    if (settlementType !== 'none' && !allowedPaymentMethods.includes(settlementPaymentMethod)) {
      throw new Error('Metode pembayaran selisih wajib dipilih')
    }

    let settlementAccount = null
    if (settlementType !== 'none') {
      settlementAccount = dbOps.get('SELECT * FROM cash_accounts WHERE type = ?', [settlementPaymentMethod])
      if (!settlementAccount) throw new Error('Akun kas metode bayar selisih tidak ditemukan')
      if (settlementType === 'refund' && Number(settlementAccount.balance || 0) < settlementAmount) {
        throw new Error(`Saldo Kas ${settlementAccount.name} tidak cukup untuk refund selisih (Sisa: Rp ${Number(settlementAccount.balance || 0).toLocaleString('id-ID')})`)
      }
    }

    const settlementDate = switchDateTime.split('T')[0]
    const settlementNote = String(data.settlement_note || '').trim()

    dbOps.runRaw('BEGIN TRANSACTION')
    try {
      dbOps.runRaw(`
        UPDATE rentals
        SET period_days = ?, total_price = ?, price_per_day = ?, vendor_fee = ?, sisa = ?, wavy_gets = ?, owner_gets = ?, relation_type = 'swap_source'
        WHERE id = ?
      `, [
        usedDays,
        sourceUsedTotal,
        usedDays > 0 ? sourceUsedTotal / usedDays : sourceUsedTotal,
        sourceUsedVendorFee,
        sourceUsedCommission.sisa,
        sourceUsedCommission.wavy_gets,
        sourceUsedCommission.owner_gets,
        sourceRentalId
      ])

      dbOps.runRaw(`
        INSERT INTO rentals (
          date_time, customer_name, hotel, hotel_id, motor_id, period_days,
          payment_method, total_price, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets,
          status, invoice_number, is_extension, relation_type, parent_rental_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, 0, 'swap', ?)
      `, [
        switchDateTime,
        sourceRental.customer_name,
        sourceRental.hotel || null,
        sourceRental.hotel_id || null,
        newMotorId,
        remainingDays,
        sourceRental.payment_method,
        replacementTotal,
        replacementPricePerDay,
        replacementVendorFee,
        replacementCommission.sisa,
        replacementCommission.wavy_gets,
        replacementCommission.owner_gets,
        replacementInvoice,
        sourceRentalId
      ])
      const replacementRental = dbOps.get('SELECT last_insert_rowid() as id')
      const replacementRentalId = Number(replacementRental?.id || 0)
      if (!replacementRentalId) throw new Error('Gagal membuat transaksi motor pengganti')

      let settlementTransactionId = null
      if (settlementType !== 'none' && settlementAccount) {
        const txType = settlementType === 'topup' ? 'in' : 'out'
        const description = settlementType === 'topup'
          ? `Top up ganti unit ${sourceRental.invoice_number || sourceRentalId} -> ${replacementInvoice}`
          : `Refund selisih ganti unit ${sourceRental.invoice_number || sourceRentalId} -> ${replacementInvoice}`
        dbOps.runRaw(`
          INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date)
          VALUES (?, ?, ?, 'rental_swap_settlement', ?, ?, ?)
        `, [settlementAccount.id, txType, settlementAmount, replacementRentalId, description, settlementDate])
        const txRow = dbOps.get('SELECT last_insert_rowid() as id')
        settlementTransactionId = Number(txRow?.id || 0)
        dbOps.runRaw(
          'UPDATE cash_accounts SET balance = balance + ? WHERE id = ?',
          [settlementType === 'topup' ? settlementAmount : -settlementAmount, settlementAccount.id]
        )
      }

      dbOps.runRaw(`
        INSERT INTO rental_swaps (
          source_rental_id, replacement_rental_id, switch_date_time, used_days, remaining_days,
          original_price_per_day, original_remaining_credit,
          replacement_price_per_day, replacement_total_price,
          settlement_type, settlement_amount, settlement_payment_method, settlement_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sourceRentalId,
        replacementRentalId,
        switchDateTime,
        usedDays,
        remainingDays,
        sourcePricePerDay,
        oldRemainingCredit,
        replacementPricePerDay,
        replacementTotal,
        settlementType,
        settlementAmount,
        settlementPaymentMethod,
        settlementNote || null
      ])

      dbOps.runRaw('COMMIT')
      saveDb()

      return {
        success: true,
        source_rental_id: sourceRentalId,
        replacement_rental_id: replacementRentalId,
        replacement_invoice_number: replacementInvoice,
        settlement: {
          type: settlementType,
          amount: settlementAmount,
          payment_method: settlementPaymentMethod
        },
        settlement_transaction_id: settlementTransactionId
      }
    } catch (error) {
      dbOps.runRaw('ROLLBACK')
      throw error
    }
  })

  ipcMain.handle('rental:update', (_, { id, ...data }) => {
    const existingRental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [id])
    if (!existingRental) throw new Error('Rental tidak ditemukan')
    if (existingRental.payout_id && existingRental.payout_id !== 0) {
      throw new Error('Rental tidak bisa diubah karena sudah masuk ke pencairan hak mitra')
    }
    if (existingRental.hotel_payout_id) {
      throw new Error('Rental tidak bisa diubah karena sudah masuk ke pencairan fee vendor')
    }

    const motor = dbOps.get('SELECT * FROM motors WHERE id = ?', [data.motor_id])
    if (!motor) throw new Error('Motor tidak ditemukan')
    const paymentMethod = assertValidPaymentMethod(data.payment_method)

    // FIX #3: Validasi vendor_fee saat update juga
    let vendorFee = data.vendor_fee || 0
    if (existingRental.relation_type === 'extend' || existingRental.relation_type === 'swap') {
      vendorFee = 0
    }
    if (vendorFee < 0) throw new Error('Vendor fee tidak boleh negatif')
    if (vendorFee > data.total_price) throw new Error('Vendor fee tidak boleh melebihi total harga sewa')

    const { sisa, wavy_gets, owner_gets } = calcCommission(
      motor.type, data.total_price, vendorFee
    )
    const pricePerDay = data.period_days > 0 ? data.total_price / data.period_days : data.total_price

    dbOps.runRaw('BEGIN TRANSACTION')
    try {
      deleteRentalCashTransactions(id)

      dbOps.run(`
        UPDATE rentals SET date_time=?, customer_name=?, hotel=?, hotel_id=?, motor_id=?, period_days=?,
          payment_method=?, total_price=?, price_per_day=?, vendor_fee=?, sisa=?, wavy_gets=?, owner_gets=?
        WHERE id=?
      `, [data.date_time, data.customer_name, data.hotel || null, data.hotel_id || null, data.motor_id, data.period_days,
          paymentMethod, data.total_price, pricePerDay, vendorFee, sisa, wavy_gets, owner_gets, id])

      if (existingRental.status !== 'refunded') {
        applyRentalCashTransactions({
          rentalId: id,
          paymentMethod,
          totalPrice: data.total_price,
          vendorFee,
          customerName: data.customer_name,
          motorModel: motor.model,
          dateTime: data.date_time,
          relationType: existingRental.relation_type || 'rental'
        })
      }

      dbOps.runRaw('COMMIT')
      saveDb()
    } catch (error) {
      dbOps.runRaw('ROLLBACK')
      throw error
    }
    return { success: true }
  })

  ipcMain.handle('rental:delete', (_, id) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [id])
    if (!rental) throw new Error('Rental tidak ditemukan')

    // Tidak boleh hapus kalau sudah masuk payout owner atau hotel
    if (rental.payout_id && rental.payout_id !== 0) {
      throw new Error('Rental tidak bisa dihapus karena sudah masuk ke pencairan hak mitra')
    }
    if (rental.hotel_payout_id) {
      throw new Error('Rental tidak bisa dihapus karena sudah masuk ke pencairan fee vendor')
    }
    const swapRelation = dbOps.get('SELECT id FROM rental_swaps WHERE source_rental_id = ? OR replacement_rental_id = ?', [id, id])
    if (swapRelation) {
      throw new Error('Rental terkait ganti unit tidak bisa dihapus satuan. Batalkan data ganti unit dari menu Ganti Unit.')
    }

    dbOps.runRaw('BEGIN TRANSACTION')
    try {
      // Kembalikan saldo kas berdasarkan transaksi kas rental + fee vendor yang tercatat.
      deleteRentalCashTransactions(id)

      // Hapus refund terkait jika ada
      dbOps.run('DELETE FROM refunds WHERE rental_id = ?', [id])
      dbOps.run('DELETE FROM rentals WHERE id = ?', [id])
      dbOps.runRaw('COMMIT')
      saveDb()
    } catch (error) {
      dbOps.runRaw('ROLLBACK')
      throw error
    }
    return { success: true }
  })

  ipcMain.handle('rental:complete', (_, id) => {
    const rental = dbOps.get('SELECT * FROM rentals WHERE id = ?', [id])
    if (!rental) throw new Error('Rental tidak ditemukan')
    dbOps.run("UPDATE rentals SET status = 'completed' WHERE id = ?", [id])
    return { success: true }
  })
}
