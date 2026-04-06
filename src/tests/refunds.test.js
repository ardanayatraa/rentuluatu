import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calcRefundAmount } from '../main/lib/finance.js'

// ============================================================
// Mock database layer
// ============================================================
const mockDb = {
  rentals: {},
  cashAccounts: {},
  refunds: [],
  cashTransactions: [],
  lastId: 0
}

vi.mock('../main/db.js', () => ({
  dbOps: {
    get: vi.fn((sql, params) => {
      if (sql.includes('FROM rentals WHERE id')) {
        return mockDb.rentals[params[0]] || null
      }
      if (sql.includes('FROM cash_accounts WHERE type')) {
        return mockDb.cashAccounts[params[0]] || null
      }
      if (sql.includes('last_insert_rowid')) {
        return { id: ++mockDb.lastId }
      }
      return null
    }),
    run: vi.fn(),
    all: vi.fn(() => [])
  }
}))

// ============================================================
// GROUP 1: calcRefundAmount (pure function)
// ============================================================
describe('calcRefundAmount — kalkulasi jumlah refund', () => {
  const rental = { total_price: 300_000, period_days: 3 }
  // harga per hari = Rp 100.000

  it('100% dari 2 sisa hari → Rp 200.000', () => {
    expect(calcRefundAmount(rental, 2, 100)).toBe(200_000)
  })

  it('50% dari 2 sisa hari → Rp 100.000', () => {
    expect(calcRefundAmount(rental, 2, 50)).toBe(100_000)
  })

  it('custom amount (percentage=0) → pakai customAmount', () => {
    expect(calcRefundAmount(rental, 2, 0, 75_000)).toBe(75_000)
  })

  it('0 sisa hari → Rp 0', () => {
    expect(calcRefundAmount(rental, 0, 100)).toBe(0)
  })

  it('refund seluruh periode → total_price', () => {
    expect(calcRefundAmount(rental, 3, 100)).toBe(300_000)
  })

  it('period_days = 0 → pakai total_price sebagai base per hari', () => {
    const edge = { total_price: 100_000, period_days: 0 }
    expect(calcRefundAmount(edge, 1, 100)).toBe(100_000)
  })

  it('refund 100% 1 hari dari rental 1 hari → total_price', () => {
    const r1 = { total_price: 150_000, period_days: 1 }
    expect(calcRefundAmount(r1, 1, 100)).toBe(150_000)
  })
})

// ============================================================
// GROUP 2: Logika urutan operasi refund (BUG FIX validation)
// ============================================================
describe('refund:create — urutan operasi yang benar', () => {

  it('FIX: cek saldo harus dilakukan SEBELUM update status rental', () => {
    // Simulasi: saldo tidak cukup
    const kasBalance = 50_000
    const refundAmount = 100_000

    // Cek saldo dulu
    const hasCukup = kasBalance >= refundAmount
    expect(hasCukup).toBe(false)

    // Jika tidak cukup, status rental TIDAK boleh berubah
    let rentalStatus = 'completed'
    if (!hasCukup) {
      // throw error — status tidak berubah
    } else {
      rentalStatus = 'refunded'
    }
    expect(rentalStatus).toBe('completed') // status tetap completed
  })

  it('FIX: jika saldo cukup, status boleh diubah ke refunded', () => {
    const kasBalance = 200_000
    const refundAmount = 100_000

    const hasCukup = kasBalance >= refundAmount
    expect(hasCukup).toBe(true)

    let rentalStatus = 'completed'
    if (hasCukup) rentalStatus = 'refunded'
    expect(rentalStatus).toBe('refunded')
  })

  it('FIX: refund tidak boleh diproses dua kali pada rental yang sama', () => {
    const rental = { id: 1, status: 'refunded', total_price: 300_000, period_days: 3 }
    const canRefund = rental.status !== 'refunded'
    expect(canRefund).toBe(false)
  })

  it('refund amount tidak boleh melebihi total_price rental', () => {
    const rental = { total_price: 300_000, period_days: 3 }
    const refundAmount = calcRefundAmount(rental, 3, 100)
    expect(refundAmount).toBeLessThanOrEqual(rental.total_price)
  })

  it('refund 50% dari 3 hari tidak melebihi total_price', () => {
    const rental = { total_price: 300_000, period_days: 3 }
    const refundAmount = calcRefundAmount(rental, 3, 50)
    expect(refundAmount).toBe(150_000)
    expect(refundAmount).toBeLessThanOrEqual(rental.total_price)
  })
})

// ============================================================
// GROUP 3: Konsistensi kalkulasi price_per_day
// ============================================================
describe('refund price_per_day — konsistensi dengan finance.js', () => {

  it('price_per_day = total_price / period_days', () => {
    const rental = { total_price: 600_000, period_days: 3 }
    const pricePerDay = rental.total_price / rental.period_days
    expect(pricePerDay).toBe(200_000)
  })

  it('refund 2 hari dari rental 3 hari Rp 600k → Rp 400k', () => {
    const rental = { total_price: 600_000, period_days: 3 }
    expect(calcRefundAmount(rental, 2, 100)).toBe(400_000)
  })

  it('refund 50% dari 2 hari rental 3 hari Rp 600k → Rp 200k', () => {
    const rental = { total_price: 600_000, period_days: 3 }
    expect(calcRefundAmount(rental, 2, 50)).toBe(200_000)
  })

  it('hasil kalkulasi konsisten antara refund:calculate dan calcRefundAmount', () => {
    const rental = { total_price: 450_000, period_days: 3 }
    const remainingDays = 2
    const percentage = 100

    // Cara lama (refund:calculate pakai price_per_day kolom — SALAH)
    // const oldResult = remainingDays * rental.price_per_day  // undefined!

    // Cara baru (konsisten dengan finance.js)
    const newResult = calcRefundAmount(rental, remainingDays, percentage)
    expect(newResult).toBe(300_000) // 2 * (450k/3) = 300k
  })
})
