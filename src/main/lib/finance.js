/**
 * finance.js — Pure Business Logic for Wavy Rental
 * Fungsi ini tidak bergantung pada Electron/IPC/Database.
 * Bisa di-import di IPC handler maupun di unit test.
 */

/**
 * Hitung pembagian hasil berdasarkan tipe motor dan vendor fee.
 * Mendukung label lama dan baru:
 * - aset_pt == pribadi (Wavy 20%)
 * - milik_pemilik == titipan (Wavy 30%)
 * @param {'pribadi'|'titipan'|'aset_pt'|'milik_pemilik'|string} motorType
 * @param {number} totalPrice - Harga kotor dari pelanggan
 * @param {number} vendorFee  - Fee yang dialokasikan ke hotel/vendor
 * @returns {{ sisa: number, wavy_gets: number, owner_gets: number }}
 */
export function normalizeMotorType(motorType) {
  const raw = String(motorType || '').trim().toLowerCase()
  if (raw === 'aset_pt' || raw === 'asset_pt' || raw === 'pribadi') return 'aset_pt'
  if (raw === 'milik_pemilik' || raw === 'titipan') return 'milik_pemilik'
  // fallback aman: jika tipe tidak dikenali, perlakukan sebagai motor mitra (30%)
  return 'milik_pemilik'
}

export function getWavyPctByMotorType(motorType) {
  return normalizeMotorType(motorType) === 'aset_pt' ? 0.20 : 0.30
}

export function calcCommission(motorType, totalPrice, vendorFee = 0) {
  const total = Number(totalPrice || 0)
  const fee = Number(vendorFee || 0)
  const sisa = total - fee
  const wavyPct = getWavyPctByMotorType(motorType)
  return {
    sisa,
    wavy_gets: sisa * wavyPct,
    owner_gets: sisa * (1 - wavyPct)
  }
}

/**
 * Hitung total vendor fee yang belum dibayarkan (unpaid).
 * Mengabaikan rental yang sudah punya hotel_payout_id (lunas)
 * dan rental yang berstatus 'refunded'.
 * @param {Array} rentals - Array of rental objects dari database
 * @returns {number}
 */
export function calcUnpaidVendorFee(rentals) {
  return rentals.reduce((sum, r) => {
    if (r.status === 'refunded') return sum
    if (r.hotel_payout_id != null) return sum
    return sum + (r.vendor_fee || 0)
  }, 0)
}

/**
 * Hitung jumlah yang harus dikembalikan saat refund.
 * @param {object} rental - Rental object (butuh total_price & period_days)
 * @param {number} remainingDays - Jumlah hari yang di-refund
 * @param {number} percentage - Persentase refund (100, 50, atau 0 untuk custom)
 * @param {number} customAmount - Jumlah custom jika percentage === 0
 * @returns {number}
 */
export function calcRefundAmount(rental, remainingDays, percentage, customAmount = 0) {
  if (percentage === 0) return customAmount
  const pricePerDay = rental.period_days > 0
    ? rental.total_price / rental.period_days
    : rental.total_price
  const base = remainingDays * pricePerDay
  return base * (percentage / 100)
}

/**
 * Validasi neraca keuangan setelah transaksi sewa:
 * wavy_gets + owner_gets + vendor_fee harus === total_price (dalam toleransi floating point)
 * @param {object} rental
 * @returns {{ valid: boolean, diff: number }}
 */
export function validateRentalBalance(rental) {
  const total = (rental.wavy_gets || 0) + (rental.owner_gets || 0) + (rental.vendor_fee || 0)
  const diff = Math.abs(total - rental.total_price)
  return {
    valid: diff < 0.01, // toleransi Rp 1 untuk floating point
    diff
  }
}
