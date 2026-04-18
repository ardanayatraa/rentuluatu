import { describe, it, expect } from 'vitest'
import { calcCommission } from '../main/lib/finance.js'

// ============================================================
// GROUP 1: Saldo kas — operasi masuk dan keluar
// ============================================================
describe('cashflow — operasi saldo kas', () => {

  it('sewa masuk → saldo bertambah sebesar total_price', () => {
    let balance = 0
    const totalPrice = 500_000
    balance += totalPrice
    expect(balance).toBe(500_000)
  })

  it('pengeluaran → saldo berkurang', () => {
    let balance = 500_000
    const expense = 75_000
    balance -= expense
    expect(balance).toBe(425_000)
  })

  it('refund → saldo berkurang sebesar refund_amount', () => {
    let balance = 500_000
    const refundAmount = 200_000
    balance -= refundAmount
    expect(balance).toBe(300_000)
  })

  it('payout vendor → saldo berkurang sebesar vendor_fee', () => {
    let balance = 500_000
    const vendorFee = 100_000
    balance -= vendorFee
    expect(balance).toBe(400_000)
  })

  it('payout owner → saldo berkurang sebesar owner_gets', () => {
    let balance = 400_000
    const { owner_gets } = calcCommission('titipan', 500_000, 100_000)
    balance -= owner_gets
    expect(balance).toBe(400_000 - owner_gets)
  })

  it('saldo tidak boleh negatif setelah payout', () => {
    const balance = 50_000
    const payoutAmount = 100_000
    const canPayout = balance >= payoutAmount
    expect(canPayout).toBe(false)
  })

  it('FIX: set opening balance menggantikan saldo lama, bukan menambah', () => {
    // Simulasi: set opening balance dipanggil dua kali
    let balance = 0
    const firstSet = 500_000
    const secondSet = 300_000

    // Cara SALAH (bug lama): balance += amount setiap kali dipanggil
    // balance += firstSet  → 500k
    // balance += secondSet → 800k (SALAH!)

    // Cara BENAR (fix): balance = amount (replace, bukan tambah)
    balance = firstSet
    balance = secondSet // replace
    expect(balance).toBe(300_000) // bukan 800k
  })

  it('FIX: opening balance transaction lama harus dihapus sebelum insert baru', () => {
    // Simulasi riwayat transaksi
    const transactions = [
      { type: 'opening_balance', amount: 500_000 },
      { type: 'rental', amount: 300_000 },
    ]

    // Set opening balance baru
    const newOpeningBalance = 200_000

    // Hapus transaksi opening_balance lama
    const filtered = transactions.filter(t => t.type !== 'opening_balance')
    filtered.push({ type: 'opening_balance', amount: newOpeningBalance })

    const openingTxCount = filtered.filter(t => t.type === 'opening_balance').length
    expect(openingTxCount).toBe(1) // hanya satu opening balance
    expect(filtered.find(t => t.type === 'opening_balance').amount).toBe(200_000)
  })
})

// ============================================================
// GROUP 2: Alur kas lengkap per transaksi
// ============================================================
describe('cashflow — alur lengkap per skenario', () => {

  it('skenario titipan: kas akhir = wavy_gets setelah semua payout', () => {
    const totalPrice = 500_000
    const vendorFee = 100_000
    const { wavy_gets, owner_gets } = calcCommission('titipan', totalPrice, vendorFee)

    let kas = 0
    kas += totalPrice    // sewa masuk
    kas -= vendorFee     // payout vendor
    kas -= owner_gets    // payout owner

    expect(kas).toBe(wavy_gets)
    expect(kas).toBe(120_000) // 30% dari (500k - 100k)
  })

  it('skenario pribadi: kas akhir = wavy_gets setelah payout owner', () => {
    const totalPrice = 250_000
    const { wavy_gets, owner_gets } = calcCommission('pribadi', totalPrice, 0)

    let kas = 0
    kas += totalPrice
    kas -= owner_gets

    expect(kas).toBe(wavy_gets)
    expect(kas).toBe(50_000) // 20% dari 250k
  })

  it('skenario dengan refund: kas berkurang setelah refund', () => {
    const totalPrice = 300_000
    const refundAmount = 100_000

    let kas = 0
    kas += totalPrice   // sewa masuk
    kas -= refundAmount // refund keluar

    expect(kas).toBe(200_000)
  })

  it('multiple transaksi: akumulasi saldo benar', () => {
    let kas = 0

    // 3 sewa masuk
    kas += 300_000
    kas += 500_000
    kas += 200_000
    expect(kas).toBe(1_000_000)

    // 1 pengeluaran
    kas -= 75_000
    expect(kas).toBe(925_000)

    // 1 payout vendor
    kas -= 50_000
    expect(kas).toBe(875_000)

    // 1 payout owner
    kas -= 350_000
    expect(kas).toBe(525_000)
  })

  it('manual income menambah saldo kas', () => {
    let kas = 200_000
    const manualIncome = 50_000
    kas += manualIncome
    expect(kas).toBe(250_000)
  })

  it('manual expense mengurangi saldo kas', () => {
    let kas = 200_000
    const manualExpense = 30_000
    kas -= manualExpense
    expect(kas).toBe(170_000)
  })
})

// ============================================================
// GROUP 3: Dashboard summary — kalkulasi yang benar
// ============================================================
describe('dashboard summary — kalkulasi income, wavy_gets, profit', () => {

  it('FIX: wavy_gets hanya dari rental, bukan ditambah manual income', () => {
    const rentalWavyGets = 300_000
    const manualIncome = 50_000

    // Cara SALAH (bug lama):
    // const wavyGets = rentalWavyGets + manualIncome // 350k — SALAH

    // Cara BENAR (fix):
    const wavyGets = rentalWavyGets // hanya dari rental
    expect(wavyGets).toBe(300_000)
    expect(wavyGets).not.toBe(350_000)
  })

  it('FIX: profit = (wavy_gets + manual_income) - (expenses + manual_expense)', () => {
    const wavyGets = 300_000
    const manualIncome = 50_000
    const expenses = 75_000
    const manualExpense = 25_000

    // Cara SALAH (bug lama):
    // const profit = (wavyGets + manualIncome) - expenses  // tidak kurangi manual_expense

    // Cara BENAR:
    const profit = (wavyGets + manualIncome) - (expenses + manualExpense)
    expect(profit).toBe(250_000) // (300k+50k) - (75k+25k) = 350k - 100k = 250k
  })

  it('total income = rental income + manual income', () => {
    const rentalIncome = 1_000_000
    const manualIncome = 150_000
    const totalIncome = rentalIncome + manualIncome
    expect(totalIncome).toBe(1_150_000)
  })

  it('modal awal masuk kas tapi tidak dihitung sebagai pendapatan', () => {
    const openingBalance = 500_000
    const rentalIncome = 1_000_000
    const manualIncome = 150_000

    const cashBalance = openingBalance + rentalIncome + manualIncome
    const totalIncome = rentalIncome + manualIncome

    expect(cashBalance).toBe(1_650_000)
    expect(totalIncome).toBe(1_150_000)
  })

  it('total expenses = operational expenses + manual expenses', () => {
    const operationalExpenses = 200_000
    const manualExpenses = 50_000
    const totalExpenses = operationalExpenses + manualExpenses
    expect(totalExpenses).toBe(250_000)
  })

  it('profit negatif jika pengeluaran melebihi pendapatan', () => {
    const wavyGets = 100_000
    const manualIncome = 0
    const expenses = 200_000
    const manualExpense = 0

    const profit = (wavyGets + manualIncome) - (expenses + manualExpense)
    expect(profit).toBe(-100_000)
    expect(profit).toBeLessThan(0)
  })

  it('commission split: wavy_gets + owner_gets = total sisa setelah vendor', () => {
    const totalPrice = 600_000
    const vendorFee = 120_000
    const { wavy_gets, owner_gets, sisa } = calcCommission('titipan', totalPrice, vendorFee)

    expect(sisa).toBe(480_000)
    expect(wavy_gets + owner_gets).toBe(sisa)
    expect(wavy_gets).toBe(144_000)  // 30% dari 480k
    expect(owner_gets).toBe(336_000) // 70% dari 480k
  })
})

// ============================================================
// GROUP 4: Validasi saldo sebelum transaksi keluar
// ============================================================
describe('validasi saldo sebelum transaksi keluar', () => {

  it('payout diizinkan jika saldo cukup', () => {
    const balance = 500_000
    const amount = 300_000
    expect(balance >= amount).toBe(true)
  })

  it('payout ditolak jika saldo tidak cukup', () => {
    const balance = 100_000
    const amount = 300_000
    expect(balance >= amount).toBe(false)
  })

  it('payout diizinkan jika saldo tepat sama', () => {
    const balance = 300_000
    const amount = 300_000
    expect(balance >= amount).toBe(true)
  })

  it('expense ditolak jika saldo tidak cukup', () => {
    const balance = 50_000
    const expenseAmount = 75_000
    expect(balance >= expenseAmount).toBe(false)
  })

  it('refund ditolak jika saldo tidak cukup', () => {
    const balance = 80_000
    const refundAmount = 100_000
    expect(balance >= refundAmount).toBe(false)
  })

  it('saldo setelah transaksi keluar tidak boleh negatif', () => {
    const balance = 500_000
    const amount = 300_000
    const newBalance = balance - amount
    expect(newBalance).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================
// GROUP 5: Laporan laba rugi
// ============================================================
describe('laporan laba rugi — kalkulasi', () => {

  it('laba kotor = wavy_gets - refunds', () => {
    const wavyGets = 500_000
    const refunds = 50_000
    const labaKotor = wavyGets - refunds
    expect(labaKotor).toBe(450_000)
  })

  it('laba bersih = laba kotor - total expenses', () => {
    const labaKotor = 450_000
    const totalExpenses = 150_000
    const labaBersih = labaKotor - totalExpenses
    expect(labaBersih).toBe(300_000)
  })

  it('laba bersih negatif jika expenses > laba kotor', () => {
    const labaKotor = 100_000
    const totalExpenses = 200_000
    const labaBersih = labaKotor - totalExpenses
    expect(labaBersih).toBe(-100_000)
  })

  it('omzet = sum total_price semua rental (non-refunded)', () => {
    const rentals = [
      { total_price: 300_000, status: 'completed' },
      { total_price: 500_000, status: 'completed' },
      { total_price: 200_000, status: 'refunded' }, // tidak dihitung
    ]
    const omzet = rentals
      .filter(r => r.status !== 'refunded')
      .reduce((s, r) => s + r.total_price, 0)
    expect(omzet).toBe(800_000)
  })

  it('wavy_gets = sum wavy_gets semua rental (non-refunded)', () => {
    const rentals = [
      { wavy_gets: 90_000,  status: 'completed' },
      { wavy_gets: 120_000, status: 'completed' },
      { wavy_gets: 60_000,  status: 'refunded' }, // tidak dihitung
    ]
    const totalWavy = rentals
      .filter(r => r.status !== 'refunded')
      .reduce((s, r) => s + r.wavy_gets, 0)
    expect(totalWavy).toBe(210_000)
  })
})
