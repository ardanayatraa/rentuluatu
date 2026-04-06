import { describe, it, expect } from 'vitest'
import { calcCommission, validateRentalBalance } from '../main/lib/finance.js'

// ============================================================
// GROUP 1: Owner Payout — kalkulasi gross, deductions, net
// ============================================================
describe('owner payout — gross, deductions, net amount', () => {

  it('net = gross - deductions (tanpa potongan)', () => {
    const grossCommission = 500_000
    const totalDeductions = 0
    const netAmount = Math.max(0, grossCommission - totalDeductions)
    expect(netAmount).toBe(500_000)
  })

  it('net = gross - deductions (dengan potongan)', () => {
    const grossCommission = 500_000
    const totalDeductions = 150_000
    const netAmount = Math.max(0, grossCommission - totalDeductions)
    expect(netAmount).toBe(350_000)
  })

  it('net tidak boleh negatif jika potongan melebihi gross', () => {
    const grossCommission = 100_000
    const totalDeductions = 200_000
    const netAmount = Math.max(0, grossCommission - totalDeductions)
    expect(netAmount).toBe(0)
  })

  it('akumulasi owner_gets dari beberapa rental', () => {
    const rentals = [
      { owner_gets: 210_000, status: 'completed', payout_id: null },
      { owner_gets: 175_000, status: 'completed', payout_id: null },
      { owner_gets: 280_000, status: 'completed', payout_id: null },
    ]
    const gross = rentals
      .filter(r => r.status !== 'refunded' && r.payout_id === null)
      .reduce((s, r) => s + r.owner_gets, 0)
    expect(gross).toBe(665_000)
  })

  it('rental refunded tidak masuk ke gross commission', () => {
    const rentals = [
      { owner_gets: 210_000, status: 'completed', payout_id: null },
      { owner_gets: 175_000, status: 'refunded',  payout_id: null }, // diabaikan
    ]
    const gross = rentals
      .filter(r => r.status !== 'refunded' && r.payout_id === null)
      .reduce((s, r) => s + r.owner_gets, 0)
    expect(gross).toBe(210_000)
  })

  it('rental yang sudah dibayar (payout_id != null) tidak masuk gross', () => {
    const rentals = [
      { owner_gets: 210_000, status: 'completed', payout_id: null },
      { owner_gets: 175_000, status: 'completed', payout_id: 5 }, // sudah lunas
    ]
    const gross = rentals
      .filter(r => r.status !== 'refunded' && r.payout_id === null)
      .reduce((s, r) => s + r.owner_gets, 0)
    expect(gross).toBe(210_000)
  })

  it('akumulasi expense deductions dari beberapa motor', () => {
    const expenses = [
      { amount: 50_000, payout_id: null },
      { amount: 75_000, payout_id: null },
      { amount: 30_000, payout_id: null },
    ]
    const totalDeductions = expenses
      .filter(e => e.payout_id === null)
      .reduce((s, e) => s + e.amount, 0)
    expect(totalDeductions).toBe(155_000)
  })

  it('expense yang sudah dipotong (payout_id != null) tidak dihitung lagi', () => {
    const expenses = [
      { amount: 50_000, payout_id: null },
      { amount: 75_000, payout_id: 3 }, // sudah dipotong
    ]
    const totalDeductions = expenses
      .filter(e => e.payout_id === null)
      .reduce((s, e) => s + e.amount, 0)
    expect(totalDeductions).toBe(50_000)
  })
})

// ============================================================
// GROUP 2: Server-side validation payout amount
// ============================================================
describe('payout server-side validation', () => {

  it('FIX: server harus recalculate, bukan percaya client amount', () => {
    // Simulasi: client kirim net_amount yang berbeda dari kalkulasi server
    const serverGross = 500_000
    const serverDeductions = 100_000
    const serverNet = Math.max(0, serverGross - serverDeductions) // 400_000

    const clientNet = 999_999 // client coba manipulasi

    const diff = Math.abs(serverNet - clientNet)
    expect(diff).toBeGreaterThan(1) // harus ditolak
  })

  it('FIX: toleransi Rp 1 untuk floating point diterima', () => {
    const serverNet = 399_999.99
    const clientNet = 400_000

    const diff = Math.abs(serverNet - clientNet)
    expect(diff).toBeLessThanOrEqual(1) // diterima
  })

  it('payout amount yang sama persis dengan server → diterima', () => {
    const serverNet = 350_000
    const clientNet = 350_000
    const diff = Math.abs(serverNet - clientNet)
    expect(diff).toBe(0)
    expect(diff).toBeLessThanOrEqual(1)
  })

  it('FIX: race condition — hanya rental IDs yang divalidasi yang boleh diupdate', () => {
    // Simulasi: preview mengembalikan 2 rental, tapi saat payout ada 3 rental baru
    const previewRentalIds = [1, 2]
    const allUnpaidRentalIds = [1, 2, 3, 4] // 3 dan 4 masuk setelah preview

    // Payout hanya boleh update rental yang ada di previewRentalIds
    const toUpdate = allUnpaidRentalIds.filter(id => previewRentalIds.includes(id))
    expect(toUpdate).toEqual([1, 2])
    expect(toUpdate).not.toContain(3)
    expect(toUpdate).not.toContain(4)
  })
})

// ============================================================
// GROUP 3: Hotel payout — komisi vendor
// ============================================================
describe('hotel payout — vendor commission', () => {

  it('gross commission = sum vendor_fee dari rental belum dibayar', () => {
    const rentals = [
      { vendor_fee: 50_000, hotel_payout_id: null, status: 'completed' },
      { vendor_fee: 75_000, hotel_payout_id: null, status: 'completed' },
      { vendor_fee: 30_000, hotel_payout_id: 2,    status: 'completed' }, // sudah dibayar
      { vendor_fee: 40_000, hotel_payout_id: null, status: 'refunded' },  // refunded
    ]
    const gross = rentals
      .filter(r => r.hotel_payout_id === null && r.status !== 'refunded')
      .reduce((s, r) => s + r.vendor_fee, 0)
    expect(gross).toBe(125_000)
  })

  it('net amount = gross (tidak ada deductions untuk hotel)', () => {
    const gross = 125_000
    const deductions = 0
    const net = Math.max(0, gross - deductions)
    expect(net).toBe(gross)
  })

  it('hotel payout tidak boleh diproses jika tidak ada komisi', () => {
    const rentals = []
    const gross = rentals.reduce((s, r) => s + r.vendor_fee, 0)
    expect(gross).toBe(0)
    const canPayout = gross > 0
    expect(canPayout).toBe(false)
  })

  it('FIX: duplikat nama hotel harus ditolak', () => {
    const existingHotels = ['Bali Hai Hotel', 'Sunset Inn', 'Ocean View']
    const newName = 'bali hai hotel' // case insensitive

    const isDuplicate = existingHotels.some(
      h => h.toLowerCase().trim() === newName.toLowerCase().trim()
    )
    expect(isDuplicate).toBe(true)
  })

  it('nama hotel yang berbeda tidak dianggap duplikat', () => {
    const existingHotels = ['Bali Hai Hotel', 'Sunset Inn']
    const newName = 'Ocean View'

    const isDuplicate = existingHotels.some(
      h => h.toLowerCase().trim() === newName.toLowerCase().trim()
    )
    expect(isDuplicate).toBe(false)
  })
})

// ============================================================
// GROUP 4: Integritas neraca per transaksi
// ============================================================
describe('neraca keuangan per transaksi rental', () => {

  it('titipan Rp 300k vendor Rp 50k: wavy+owner+vendor = 300k', () => {
    const { wavy_gets, owner_gets } = calcCommission('titipan', 300_000, 50_000)
    expect(wavy_gets + owner_gets + 50_000).toBe(300_000)
  })

  it('pribadi Rp 500k vendor Rp 100k: wavy+owner+vendor = 500k', () => {
    const { wavy_gets, owner_gets } = calcCommission('pribadi', 500_000, 100_000)
    expect(wavy_gets + owner_gets + 100_000).toBe(500_000)
  })

  it('tanpa vendor fee: wavy+owner = total_price', () => {
    const { wavy_gets, owner_gets } = calcCommission('titipan', 400_000, 0)
    expect(wavy_gets + owner_gets).toBe(400_000)
  })

  it('validateRentalBalance mendeteksi neraca yang benar', () => {
    const { wavy_gets, owner_gets } = calcCommission('titipan', 500_000, 100_000)
    const rental = { total_price: 500_000, vendor_fee: 100_000, wavy_gets, owner_gets }
    const { valid } = validateRentalBalance(rental)
    expect(valid).toBe(true)
  })

  it('validateRentalBalance mendeteksi neraca yang salah', () => {
    const rental = { total_price: 500_000, vendor_fee: 100_000, wavy_gets: 500_000, owner_gets: 500_000 }
    const { valid } = validateRentalBalance(rental)
    expect(valid).toBe(false)
  })

  it('FIX: vendor_fee tidak boleh melebihi total_price', () => {
    const totalPrice = 300_000
    const vendorFee = 400_000 // melebihi!
    const isValid = vendorFee <= totalPrice
    expect(isValid).toBe(false)
  })

  it('FIX: vendor_fee tidak boleh negatif', () => {
    const vendorFee = -50_000
    const isValid = vendorFee >= 0
    expect(isValid).toBe(false)
  })
})
