import { ipcMain } from 'electron'
import { dbOps } from '../db'
import { calcCommission } from '../lib/finance'

function normalizeNumber(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

function roundCurrency(value) {
  return Math.round(normalizeNumber(value))
}

function sameAmount(left, right, tolerance = 1) {
  return Math.abs(roundCurrency(left) - roundCurrency(right)) <= tolerance
}

function formatRp(value) {
  return `Rp ${roundCurrency(value).toLocaleString('id-ID')}`
}

function pushFinding(findings, severity, category, message, meta = {}) {
  findings.push({ severity, category, message, ...meta })
}

function getSingleCashMutation(referenceType, referenceId) {
  return dbOps.get(
    `SELECT ct.*, ca.type as account_type, ca.name as account_name
     FROM cash_transactions ct
     LEFT JOIN cash_accounts ca ON ca.id = ct.cash_account_id
     WHERE ct.reference_type = ? AND ct.reference_id = ?
     ORDER BY ct.id DESC
     LIMIT 1`,
    [referenceType, referenceId]
  )
}

export function registerAuditHandlers() {
  ipcMain.handle('audit:run-system-check', () => {
    const findings = []

    const cashAccounts = dbOps.all('SELECT * FROM cash_accounts ORDER BY type ASC') || []
    const cashTotals = dbOps.all(`
      SELECT cash_account_id,
        COALESCE(SUM(CASE WHEN type = 'out' THEN -amount ELSE amount END), 0) as ledger_balance
      FROM cash_transactions
      GROUP BY cash_account_id
    `) || []
    const cashMap = new Map(cashTotals.map((row) => [Number(row.cash_account_id), normalizeNumber(row.ledger_balance)]))

    cashAccounts.forEach((account) => {
      const stored = normalizeNumber(account.balance)
      const ledger = normalizeNumber(cashMap.get(Number(account.id)) || 0)
      if (!sameAmount(stored, ledger)) {
        pushFinding(
          findings,
          'error',
          'cash',
          `Saldo akun ${account.name} tidak cocok. Tersimpan ${formatRp(stored)}, histori mutasi ${formatRp(ledger)}.`,
          { accountId: Number(account.id) }
        )
      }
    })

    const rentals = dbOps.all(`
      SELECT r.*, m.type as motor_type
      FROM rentals r
      LEFT JOIN motors m ON m.id = r.motor_id
      ORDER BY r.id ASC
    `) || []

    rentals.forEach((rental) => {
      const relationType = String(rental.relation_type || 'rental').toLowerCase()
      const rentalTotal = normalizeNumber(rental.total_price)
      const vendorFee = normalizeNumber(rental.vendor_fee)
      const { sisa, wavy_gets, owner_gets } = calcCommission(rental.motor_type, rentalTotal, vendorFee)

      if (!sameAmount(rental.sisa, sisa) || !sameAmount(rental.wavy_gets, wavy_gets) || !sameAmount(rental.owner_gets, owner_gets)) {
        pushFinding(
          findings,
          'error',
          'rental',
          `Komisi rental #${rental.id} tidak konsisten dengan hitungan sistem.`,
          { rentalId: Number(rental.id) }
        )
      }

      if ((relationType === 'rental' || relationType === 'extend') && String(rental.status || '').toLowerCase() !== 'refunded') {
        const rentalTx = getSingleCashMutation('rental', rental.id)
        if (!rentalTx) {
          pushFinding(findings, 'error', 'cash', `Mutasi kas masuk untuk rental #${rental.id} tidak ditemukan.`, { rentalId: Number(rental.id) })
        } else {
          const expectedDate = String(rental.date_time || '').split('T')[0]
          if (String(rentalTx.type || '').toLowerCase() !== 'in') {
            pushFinding(findings, 'error', 'cash', `Mutasi rental #${rental.id} harus bertipe masuk.`, { rentalId: Number(rental.id) })
          }
          if (!sameAmount(rentalTx.amount, rentalTotal)) {
            pushFinding(findings, 'error', 'cash', `Nominal mutasi rental #${rental.id} tidak cocok. Expected ${formatRp(rentalTotal)}, actual ${formatRp(rentalTx.amount)}.`, { rentalId: Number(rental.id) })
          }
          if (String(rentalTx.account_type || '') !== String(rental.payment_method || '')) {
            pushFinding(findings, 'warning', 'cash', `Metode mutasi rental #${rental.id} berbeda dari metode bayar transaksi.`, { rentalId: Number(rental.id) })
          }
          if (expectedDate && String(rentalTx.date || '') !== expectedDate) {
            pushFinding(findings, 'warning', 'cash', `Tanggal mutasi rental #${rental.id} belum sinkron dengan tanggal transaksi.`, { rentalId: Number(rental.id) })
          }
        }
      }

      if (vendorFee > 0) {
        const vendorTx = getSingleCashMutation('rental_vendor_fee', rental.id)
        const expectedDate = String(rental.date_time || '').split('T')[0]
        if (!vendorTx) {
          pushFinding(findings, 'error', 'cash', `Mutasi fee vendor untuk rental #${rental.id} tidak ditemukan.`, { rentalId: Number(rental.id) })
        } else {
          if (String(vendorTx.type || '').toLowerCase() !== 'out') {
            pushFinding(findings, 'error', 'cash', `Mutasi fee vendor rental #${rental.id} harus bertipe keluar.`, { rentalId: Number(rental.id) })
          }
          if (!sameAmount(vendorTx.amount, vendorFee)) {
            pushFinding(findings, 'error', 'cash', `Nominal fee vendor rental #${rental.id} tidak cocok. Expected ${formatRp(vendorFee)}, actual ${formatRp(vendorTx.amount)}.`, { rentalId: Number(rental.id) })
          }
          if (expectedDate && String(vendorTx.date || '') !== expectedDate) {
            pushFinding(findings, 'warning', 'cash', `Tanggal mutasi fee vendor rental #${rental.id} belum sinkron.`, { rentalId: Number(rental.id) })
          }
        }
      }
    })

    const expenses = dbOps.all('SELECT * FROM expenses ORDER BY id ASC') || []
    expenses.forEach((expense) => {
      const expenseTx = getSingleCashMutation('expense', expense.id)
      if (!expenseTx) {
        pushFinding(findings, 'error', 'expense', `Mutasi kas pengeluaran #${expense.id} tidak ditemukan.`, { expenseId: Number(expense.id) })
        return
      }
      if (String(expenseTx.type || '').toLowerCase() !== 'out') {
        pushFinding(findings, 'error', 'expense', `Mutasi pengeluaran #${expense.id} harus bertipe keluar.`, { expenseId: Number(expense.id) })
      }
      if (!sameAmount(expenseTx.amount, expense.amount)) {
        pushFinding(findings, 'error', 'expense', `Nominal mutasi pengeluaran #${expense.id} tidak cocok.`, { expenseId: Number(expense.id) })
      }
      if (String(expenseTx.account_type || '') !== String(expense.payment_method || '')) {
        pushFinding(findings, 'warning', 'expense', `Metode bayar pengeluaran #${expense.id} berbeda dengan mutasi kasnya.`, { expenseId: Number(expense.id) })
      }
      if (String(expenseTx.date || '') !== String(expense.date || '')) {
        pushFinding(findings, 'warning', 'expense', `Tanggal mutasi pengeluaran #${expense.id} belum sinkron.`, { expenseId: Number(expense.id) })
      }
    })

    const refunds = dbOps.all(`
      SELECT rf.*, r.payment_method
      FROM refunds rf
      LEFT JOIN rentals r ON r.id = rf.rental_id
      ORDER BY rf.id ASC
    `) || []
    refunds.forEach((refund) => {
      const refundTx = getSingleCashMutation('refund', refund.id)
      if (!refundTx) {
        pushFinding(findings, 'error', 'refund', `Mutasi refund #${refund.id} tidak ditemukan.`, { refundId: Number(refund.id) })
        return
      }
      if (String(refundTx.type || '').toLowerCase() !== 'out') {
        pushFinding(findings, 'error', 'refund', `Mutasi refund #${refund.id} harus bertipe keluar.`, { refundId: Number(refund.id) })
      }
      if (!sameAmount(refundTx.amount, refund.refund_amount)) {
        pushFinding(findings, 'error', 'refund', `Nominal mutasi refund #${refund.id} tidak cocok.`, { refundId: Number(refund.id) })
      }
      if (refund.payment_method && String(refundTx.account_type || '') !== String(refund.payment_method || '')) {
        pushFinding(findings, 'warning', 'refund', `Metode bayar refund #${refund.id} berbeda dengan metode rental asalnya.`, { refundId: Number(refund.id) })
      }
    })

    const payouts = dbOps.all('SELECT * FROM payouts ORDER BY id ASC') || []
    payouts.forEach((payout) => {
      if (normalizeNumber(payout.amount) <= 0) return
      const payoutTx = getSingleCashMutation('owner_payout', payout.id)
      if (!payoutTx) {
        pushFinding(findings, 'error', 'payout', `Mutasi pencairan mitra #${payout.id} tidak ditemukan.`, { payoutId: Number(payout.id) })
        return
      }
      if (String(payoutTx.type || '').toLowerCase() !== 'out') {
        pushFinding(findings, 'error', 'payout', `Mutasi pencairan mitra #${payout.id} harus bertipe keluar.`, { payoutId: Number(payout.id) })
      }
      if (!sameAmount(payoutTx.amount, payout.amount)) {
        pushFinding(findings, 'error', 'payout', `Nominal mutasi pencairan mitra #${payout.id} tidak cocok.`, { payoutId: Number(payout.id) })
      }
      if (Number(payoutTx.cash_account_id || 0) !== Number(payout.cash_account_id || 0)) {
        pushFinding(findings, 'warning', 'payout', `Akun kas pencairan mitra #${payout.id} berbeda dengan data payout.`, { payoutId: Number(payout.id) })
      }
      if (String(payoutTx.date || '') !== String(payout.date || '')) {
        pushFinding(findings, 'warning', 'payout', `Tanggal mutasi pencairan mitra #${payout.id} belum sinkron.`, { payoutId: Number(payout.id) })
      }
    })

    const swaps = dbOps.all('SELECT * FROM rental_swaps ORDER BY id ASC') || []
    swaps.forEach((swap) => {
      const settlementType = String(swap.settlement_type || '').toLowerCase()
      const settlementAmount = normalizeNumber(swap.settlement_amount)
      if (!settlementAmount || settlementType === 'none') return
      const settlementTx = getSingleCashMutation('rental_swap_settlement', swap.replacement_rental_id)
      const expectedDate = String(swap.switch_date_time || '').split('T')[0]
      if (!settlementTx) {
        pushFinding(findings, 'error', 'swap', `Mutasi settlement ganti unit #${swap.id} tidak ditemukan.`, { swapId: Number(swap.id) })
        return
      }
      const expectedType = settlementType === 'topup' ? 'in' : 'out'
      if (String(settlementTx.type || '').toLowerCase() !== expectedType) {
        pushFinding(findings, 'error', 'swap', `Tipe mutasi settlement ganti unit #${swap.id} tidak sesuai.`, { swapId: Number(swap.id) })
      }
      if (!sameAmount(settlementTx.amount, settlementAmount)) {
        pushFinding(findings, 'error', 'swap', `Nominal settlement ganti unit #${swap.id} tidak cocok.`, { swapId: Number(swap.id) })
      }
      if (String(settlementTx.account_type || '') !== String(swap.settlement_payment_method || '')) {
        pushFinding(findings, 'warning', 'swap', `Metode settlement ganti unit #${swap.id} berbeda dengan mutasi kasnya.`, { swapId: Number(swap.id) })
      }
      if (expectedDate && String(settlementTx.date || '') !== expectedDate) {
        pushFinding(findings, 'warning', 'swap', `Tanggal settlement ganti unit #${swap.id} belum sinkron.`, { swapId: Number(swap.id) })
      }
    })

    const summary = {
      checkedAt: new Date().toISOString(),
      totalFindings: findings.length,
      errors: findings.filter((item) => item.severity === 'error').length,
      warnings: findings.filter((item) => item.severity === 'warning').length,
      ok: findings.length === 0,
      checked: {
        cashAccounts: cashAccounts.length,
        rentals: rentals.length,
        expenses: expenses.length,
        refunds: refunds.length,
        payouts: payouts.length,
        swaps: swaps.length
      }
    }

    return {
      summary,
      findings: findings.sort((left, right) => {
        const score = { error: 0, warning: 1 }
        return (score[left.severity] ?? 9) - (score[right.severity] ?? 9)
      })
    }
  })
}
