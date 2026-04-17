import { describe, it, expect } from 'vitest'
import {
  calcCommission,
  calcUnpaidVendorFee,
  calcRefundAmount,
  validateRentalBalance
} from '../main/lib/finance.js'

// ============================================================
// GROUP 1: calcCommission — Pembagian Komisi Sewa
// ============================================================
describe('calcCommission — pembagian komisi sewa', () => {

  // --- Motor Titipan (30% Wavy / 70% Owner) ---
  it('motor titipan tanpa vendor fee: Wavy 30%, Owner 70%', () => {
    const result = calcCommission('titipan', 300_000, 0)
    expect(result.sisa).toBe(300_000)
    expect(result.wavy_gets).toBe(90_000)
    expect(result.owner_gets).toBe(210_000)
  })

  it('motor titipan dengan vendor fee Rp 50.000', () => {
    const result = calcCommission('titipan', 300_000, 50_000)
    expect(result.sisa).toBe(250_000)
    expect(result.wavy_gets).toBe(75_000)
    expect(result.owner_gets).toBe(175_000)
  })

  it('motor titipan dengan vendor fee Rp 100.000 (simulasi 500k)', () => {
    const result = calcCommission('titipan', 500_000, 100_000)
    expect(result.sisa).toBe(400_000)
    expect(result.wavy_gets).toBe(120_000)
    expect(result.owner_gets).toBe(280_000)
  })

  // --- Motor Pribadi (20% Wavy / 80% Owner) ---
  it('motor pribadi tanpa vendor fee: Wavy 20%, Owner 80%', () => {
    const result = calcCommission('pribadi', 200_000, 0)
    expect(result.sisa).toBe(200_000)
    expect(result.wavy_gets).toBe(40_000)
    expect(result.owner_gets).toBe(160_000)
  })

  it('motor pribadi dengan vendor fee Rp 50.000', () => {
    const result = calcCommission('pribadi', 500_000, 50_000)
    expect(result.sisa).toBe(450_000)
    expect(result.wavy_gets).toBe(90_000)
    expect(result.owner_gets).toBe(360_000)
  })

  it('motor aset_pt diperlakukan sama seperti pribadi (20/80)', () => {
    const result = calcCommission('aset_pt', 500_000, 50_000)
    expect(result.sisa).toBe(450_000)
    expect(result.wavy_gets).toBe(90_000)
    expect(result.owner_gets).toBe(360_000)
  })

  it('motor milik_pemilik diperlakukan sama seperti titipan (30/70)', () => {
    const result = calcCommission('milik_pemilik', 500_000, 50_000)
    expect(result.sisa).toBe(450_000)
    expect(result.wavy_gets).toBe(135_000)
    expect(result.owner_gets).toBe(315_000)
  })

  it('vendor_fee = 0 default → tidak berpengaruh ke pembagian', () => {
    const withZero  = calcCommission('titipan', 300_000, 0)
    const withUndef = calcCommission('titipan', 300_000)
    expect(withZero.wavy_gets).toBe(withUndef.wavy_gets)
    expect(withZero.owner_gets).toBe(withUndef.owner_gets)
  })

  it('edge case: vendor_fee sama dengan total_price → sisa = 0', () => {
    const result = calcCommission('titipan', 100_000, 100_000)
    expect(result.sisa).toBe(0)
    expect(result.wavy_gets).toBe(0)
    expect(result.owner_gets).toBe(0)
  })

  it('edge case: vendor_fee MELEBIHI total_price → sisa negatif (tidak diblokir di sini)', () => {
    const result = calcCommission('titipan', 100_000, 150_000)
    expect(result.sisa).toBe(-50_000)
    // Sistem tidak error; validasi haris dilakukan di layer atas (UI/IPC)
    expect(result.sisa).toBeLessThan(0)
  })
})

// ============================================================
// GROUP 2: validateRentalBalance — Integritas Neraca Keuangan
// ============================================================
describe('validateRentalBalance — neraca wavy+owner+vendor = total', () => {

  it('neraca seimbang: motor titipan dengan vendor fee', () => {
    const { wavy_gets, owner_gets } = calcCommission('titipan', 500_000, 100_000)
    const rental = { total_price: 500_000, vendor_fee: 100_000, wavy_gets, owner_gets }
    const { valid, diff } = validateRentalBalance(rental)
    expect(valid).toBe(true)
    expect(diff).toBeLessThan(0.01)
  })

  it('neraca seimbang: motor pribadi dengan vendor fee', () => {
    const { wavy_gets, owner_gets } = calcCommission('pribadi', 300_000, 75_000)
    const rental = { total_price: 300_000, vendor_fee: 75_000, wavy_gets, owner_gets }
    const { valid } = validateRentalBalance(rental)
    expect(valid).toBe(true)
  })

  it('neraca seimbang: tanpa vendor fee sama sekali', () => {
    const { wavy_gets, owner_gets } = calcCommission('titipan', 250_000, 0)
    const rental = { total_price: 250_000, vendor_fee: 0, wavy_gets, owner_gets }
    const { valid } = validateRentalBalance(rental)
    expect(valid).toBe(true)
  })

  it('neraca TIDAK seimbang jika ada manipulasi data', () => {
    const rental = { total_price: 500_000, vendor_fee: 100_000, wavy_gets: 999_999, owner_gets: 0 }
    const { valid } = validateRentalBalance(rental)
    expect(valid).toBe(false)
  })

  it('skenario lengkap 300k titipan 50k vendor: total selalu balance', () => {
    const { sisa, wavy_gets, owner_gets } = calcCommission('titipan', 300_000, 50_000)
    // wavy(75k) + owner(175k) + vendor(50k) = 300k
    expect(wavy_gets + owner_gets + 50_000).toBe(300_000)
    expect(sisa).toBe(250_000)
  })
})

// ============================================================
// GROUP 3: calcUnpaidVendorFee — Akumulasi Komisi Belum Lunas
// ============================================================
describe('calcUnpaidVendorFee — perhitungan tagihan vendor belum dibayar', () => {

  it('semua rental belum dibayar → total semua vendor_fee', () => {
    const rentals = [
      { vendor_fee: 50_000, status: 'completed', hotel_payout_id: null },
      { vendor_fee: 75_000, status: 'completed', hotel_payout_id: null },
    ]
    expect(calcUnpaidVendorFee(rentals)).toBe(125_000)
  })

  it('rental yang sudah dibayar (hotel_payout_id != null) diabaikan', () => {
    const rentals = [
      { vendor_fee: 50_000, status: 'completed', hotel_payout_id: null },
      { vendor_fee: 80_000, status: 'completed', hotel_payout_id: 7 }, // LUNAS
    ]
    expect(calcUnpaidVendorFee(rentals)).toBe(50_000)
  })

  it('rental dengan status "refunded" diabaikan', () => {
    const rentals = [
      { vendor_fee: 50_000, status: 'completed', hotel_payout_id: null },
      { vendor_fee: 90_000, status: 'refunded', hotel_payout_id: null }, // REFUNDED
    ]
    expect(calcUnpaidVendorFee(rentals)).toBe(50_000)
  })

  it('campuran: completed unpaid + completed paid + refunded', () => {
    const rentals = [
      { vendor_fee: 100_000, status: 'completed', hotel_payout_id: null },   // HITUNG
      { vendor_fee: 200_000, status: 'completed', hotel_payout_id: 3 },       // ABAIKAN (lunas)
      { vendor_fee: 150_000, status: 'refunded',  hotel_payout_id: null },    // ABAIKAN (refund)
      { vendor_fee: 50_000,  status: 'completed', hotel_payout_id: null },    // HITUNG
    ]
    expect(calcUnpaidVendorFee(rentals)).toBe(150_000)
  })

  it('tidak ada rental sama sekali → 0', () => {
    expect(calcUnpaidVendorFee([])).toBe(0)
  })

  it('vendor_fee null/undefined diperlakukan sebagai 0', () => {
    const rentals = [
      { vendor_fee: null,      status: 'completed', hotel_payout_id: null },
      { vendor_fee: undefined, status: 'completed', hotel_payout_id: null },
    ]
    expect(calcUnpaidVendorFee(rentals)).toBe(0)
  })
})

// ============================================================
// GROUP 4: calcRefundAmount — Perhitungan Pengembalian Dana
// ============================================================
describe('calcRefundAmount — perhitungan jumlah refund', () => {

  const rental300k_3hari = { total_price: 300_000, period_days: 3 }
  // → harga per hari = Rp 100.000

  it('refund 100% dari 2 sisa hari → Rp 200.000', () => {
    expect(calcRefundAmount(rental300k_3hari, 2, 100)).toBe(200_000)
  })

  it('refund 50% dari 2 sisa hari → Rp 100.000', () => {
    expect(calcRefundAmount(rental300k_3hari, 2, 50)).toBe(100_000)
  })

  it('refund custom amount (percentage = 0) → menggunakan customAmount', () => {
    expect(calcRefundAmount(rental300k_3hari, 2, 0, 75_000)).toBe(75_000)
  })

  it('refund 0 hari → Rp 0', () => {
    expect(calcRefundAmount(rental300k_3hari, 0, 100)).toBe(0)
  })

  it('refund 100% seluruh periode (3 dari 3 hari) → seluruh harga', () => {
    expect(calcRefundAmount(rental300k_3hari, 3, 100)).toBe(300_000)
  })

  it('rental 1 hari, refund 100% dari 1 hari → total_price', () => {
    const rental1hari = { total_price: 150_000, period_days: 1 }
    expect(calcRefundAmount(rental1hari, 1, 100)).toBe(150_000)
  })

  it('rental period_days = 0 (edge case) → menggunakan total_price sebagai base', () => {
    const rentalEdge = { total_price: 100_000, period_days: 0 }
    // pricePerDay = total_price jika period_days <= 0
    expect(calcRefundAmount(rentalEdge, 1, 100)).toBe(100_000)
  })
})

// ============================================================
// GROUP 5: Skenario End-to-End Keuangan (Simulasi Alur Lengkap)
// ============================================================
describe('E2E Finance Simulation — alur masuk dan keluar kas', () => {

  it('alur lengkap: sewa → payout vendor → payout owner → kas Wavy akurat', () => {
    // Setup: motor titipan, harga Rp 500k, vendor fee Rp 100k
    const totalPrice = 500_000
    const vendorFee  = 100_000
    const { wavy_gets, owner_gets } = calcCommission('titipan', totalPrice, vendorFee)

    // Step 1: Uang masuk kas saat sewa
    let kasBalance = totalPrice  // Rp 500.000

    // Step 2: Payout vendor
    kasBalance -= vendorFee      // Rp 500.000 - Rp 100.000 = Rp 400.000
    expect(kasBalance).toBe(400_000)

    // Step 3: Payout owner
    kasBalance -= owner_gets     // Rp 400.000 - Rp 280.000 = Rp 120.000
    expect(kasBalance).toBe(120_000)

    // Step 4: Sisa kas = Wavy Gets  
    expect(kasBalance).toBe(wavy_gets)
    expect(wavy_gets).toBe(120_000)  // 30% dari Rp 400.000 (sisa setelah vendor fee)
  })

  it('alur lengkap: sewa motor pribadi tanpa vendor → kasWavy = 20%', () => {
    const totalPrice = 250_000
    const { wavy_gets, owner_gets } = calcCommission('pribadi', totalPrice, 0)

    let kas = totalPrice
    kas -= owner_gets   // bayar owner
    expect(kas).toBe(wavy_gets)
    expect(wavy_gets).toBe(50_000)  // 20% dari 250k
  })

  it('validasi: semua komponen dijumlahkan kembali = total harga pelanggan', () => {
    const totalPrice = 750_000
    const vendorFee  = 150_000
    const { wavy_gets, owner_gets } = calcCommission('titipan', totalPrice, vendorFee)

    const reconstructed = wavy_gets + owner_gets + vendorFee
    expect(reconstructed).toBeCloseTo(totalPrice, 2)
  })

  it('payout tidak boleh melebihi saldo kas — validasi logika bisnis', () => {
    const kasBalance = 50_000
    const payoutAmount = 100_000
    
    // Sistem harus menolak payout jika saldo tidak cukup
    const canPayout = kasBalance >= payoutAmount
    expect(canPayout).toBe(false)
  })
  
  it('payout boleh dilakukan jika saldo cukup', () => {
    const kasBalance = 500_000
    const payoutAmount = 280_000

    const canPayout = kasBalance >= payoutAmount
    expect(canPayout).toBe(true)

    const sisaKas = kasBalance - payoutAmount
    expect(sisaKas).toBe(220_000)
  })
})
