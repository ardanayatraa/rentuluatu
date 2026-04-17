import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel, fn) => {
      handlers.set(channel, fn)
    })
  }
}))

vi.mock('../main/db.js', () => ({
  dbOps: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    runRaw: vi.fn()
  },
  saveDb: vi.fn()
}))

import { dbOps, saveDb } from '../main/db.js'
import { registerDashboardHandlers } from '../main/ipc/dashboard.js'
import { registerReportHandlers } from '../main/ipc/reports.js'
import { registerRentalHandlers } from '../main/ipc/rentals.js'
import { registerOwnerHandlers } from '../main/ipc/owners.js'
import { registerHotelHandlers } from '../main/ipc/hotels.js'
import { registerRefundHandlers } from '../main/ipc/refunds.js'
import { registerExpenseHandlers } from '../main/ipc/expenses.js'
import { registerCashHandlers } from '../main/ipc/cash.js'

describe('IPC business logic', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('dashboard summary menghitung profit perusahaan tanpa membebankan pengeluaran motor mitra', async () => {
    dbOps.get.mockImplementation((sql) => {
      if (sql.includes('SUM(total_price)')) return { total: 300_000 }
      if (sql.includes('SUM(e.amount)')) return { total: 30_000 }
      if (sql.includes('SUM(wavy_gets)')) return { total: 75_000 }
      if (sql.includes('SUM(owner_gets)')) return { total: 225_000 }
      if (sql.includes('COUNT(*) as total') && sql.includes("status != 'refunded'")) return { total: 2 }
      if (sql.includes('COUNT(*) as total') && sql.includes("status = 'refunded'")) return { total: 0 }
      if (sql.includes("reference_type = 'manual_income'")) return { total: 5_000 }
      if (sql.includes("reference_type = 'manual_expense'")) return { total: 10_000 }
      return { total: 0 }
    })

    registerDashboardHandlers()
    const summary = await handlers.get('dashboard:summary')(null, {
      startDate: '2026-04-01T00:00:00',
      endDate: '2026-04-07T23:59:59'
    })

    expect(summary).toEqual({
      income: 305_000,
      expenses: 40_000,
      wavy_gets: 75_000,
      owner_gets: 225_000,
      profit: 40_000,
      rental_count: 2,
      refund_count: 0
    })
  })

  it('report owner commission mengelompokkan komisi dan pengeluaran per motor dengan benar', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM owners')) return { id: params[0], name: 'Mitra A' }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM motors WHERE owner_id')) {
        return [
          { id: 10, model: 'Vario', plate_number: 'DK 1234 AA' },
          { id: 11, model: 'NMax', plate_number: 'DK 5555 BB' }
        ]
      }
      if (sql.includes('FROM rentals r') && sql.includes('m.id as motor_id')) {
        return [
          { id: 1, motor_id: 10, model: 'Vario', plate_number: 'DK 1234 AA', owner_gets: 200_000, payout_id: null, date_time: '2026-04-07T10:00:00', customer_name: 'A', period_days: 2, total_price: 300_000 },
          { id: 2, motor_id: 11, model: 'NMax', plate_number: 'DK 5555 BB', owner_gets: 150_000, payout_id: 8, date_time: '2026-04-06T10:00:00', customer_name: 'B', period_days: 1, total_price: 220_000 }
        ]
      }
      if (sql.includes('FROM expenses e') && sql.includes("e.type = 'motor'")) {
        return [
          { id: 21, motor_id: 10, model: 'Vario', plate_number: 'DK 1234 AA', amount: 50_000, category: 'Servis', description: 'Oli' }
        ]
      }
      if (sql.includes('FROM payouts p')) {
        return [{ id: 8, cash_account_name: 'Kas Utama', date: '2026-04-06', amount: 150_000 }]
      }
      return []
    })

    registerReportHandlers()
    const report = await handlers.get('report:owner-commission')(null, {
      ownerId: 2,
      startDate: '2026-04-01T00:00:00',
      endDate: '2026-04-07T23:59:59'
    })

    expect(report.totalOwnerGets).toBe(350_000)
    expect(report.totalPaid).toBe(150_000)
    expect(report.totalUnpaid).toBe(200_000)
    expect(report.totalExpenses).toBe(50_000)
    expect(report.totalNet).toBe(300_000)
    expect(report.byMotor).toEqual([
      {
        motor_id: 11,
        model: 'NMax',
        plate_number: 'DK 5555 BB',
        rentals: [expect.objectContaining({ id: 2, motor_id: 11 })],
        expenses: [],
        rental_total: 150_000,
        expense_total: 0,
        net_total: 150_000
      },
      {
        motor_id: 10,
        model: 'Vario',
        plate_number: 'DK 1234 AA',
        rentals: [expect.objectContaining({ id: 1, motor_id: 10 })],
        expenses: [expect.objectContaining({ id: 21, motor_id: 10 })],
        rental_total: 200_000,
        expense_total: 50_000,
        net_total: 150_000
      }
    ])
  })

  it('owner slip period meta mengambil payout terakhir dan aktivitas paling awal', async () => {
    dbOps.get.mockImplementation((sql) => {
      if (sql.includes('FROM payouts p')) return { date: '2026-04-06' }
      if (sql.includes('date(MIN(r.date_time))')) return { first_date: '2026-03-15' }
      if (sql.includes('SELECT MIN(e.date)')) return { first_date: '2026-03-10' }
      return null
    })

    registerOwnerHandlers()
    const meta = await handlers.get('owner:get-slip-period-meta')(null, { ownerId: 2 })

    expect(meta).toEqual({
      latestPayoutDate: '2026-04-06',
      firstActivityDate: '2026-03-10'
    })
  })

  it('rental create menolak vendor fee negatif atau melebihi total sewa', async () => {
    dbOps.get.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM motors')) return { id: 1, type: 'titipan', model: 'Vario' }
      return null
    })

    registerRentalHandlers()
    const createRental = handlers.get('rental:create')

    expect(() => createRental(null, {
      motor_id: 1,
      total_price: 300_000,
      vendor_fee: -1,
      payment_method: 'tunai'
    })).toThrow('Vendor fee tidak boleh negatif')

    expect(() => createRental(null, {
      motor_id: 1,
      total_price: 300_000,
      vendor_fee: 400_000,
      payment_method: 'tunai'
    })).toThrow('Vendor fee tidak boleh melebihi total harga sewa')
  })

  it('rental create menghasilkan invoice, pembagian komisi, dan transaksi kas yang benar', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM motors')) return { id: 1, type: 'titipan', model: 'Vario' }
      if (sql.includes('COUNT(*) as c FROM rentals WHERE invoice_number LIKE')) return { c: 2 }
      if (sql.includes('SELECT last_insert_rowid() as id')) return { id: 99 }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) return { id: 7, type: params[0] }
      return null
    })

    registerRentalHandlers()
    const result = await handlers.get('rental:create')(null, {
      date_time: '2026-04-07T10:00:00',
      customer_name: 'Budi',
      hotel: 'Hotel A',
      hotel_id: 3,
      motor_id: 1,
      period_days: 2,
      payment_method: 'tunai',
      total_price: 500_000,
      vendor_fee: 100_000
    })

    expect(result).toEqual({ id: 99, invoice_number: 'WVY-2026-04-0003' })
    expect(dbOps.runRaw).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO rentals'),
      expect.arrayContaining([
        '2026-04-07T10:00:00',
        'Budi',
        'Hotel A',
        3,
        1,
        2,
          'tunai',
          500_000,
          250_000,
          100_000,
        400_000,
        120_000,
        280_000,
        'completed',
        'WVY-2026-04-0003'
      ])
    )
    expect(dbOps.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cash_transactions'),
      [7, 500_000, 99, 'Sewa Vario - Budi', '2026-04-07']
    )
    expect(dbOps.run).toHaveBeenCalledWith(
      'UPDATE cash_accounts SET balance = balance + ? WHERE id = ?',
      [500_000, 7]
    )
    expect(saveDb).toHaveBeenCalled()
  })

  it('rental update merekonsiliasi saldo kas lama lalu menulis transaksi kas baru', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM rentals WHERE id = ?')) {
        return {
          id: params[0],
          payout_id: null,
          hotel_payout_id: null,
          relation_type: 'rental',
          status: 'completed'
        }
      }
      if (sql.includes('SELECT * FROM motors WHERE id = ?')) return { id: 2, type: 'titipan', model: 'NMax' }
      if (sql.includes("SELECT * FROM cash_transactions WHERE reference_type = 'rental'")) {
        return { id: 70, cash_account_id: 1, type: 'in', amount: 300_000 }
      }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) return { id: 3, type: params[0], name: 'QRIS' }
      return null
    })

    registerRentalHandlers()
    const result = handlers.get('rental:update')(null, {
      id: 99,
      date_time: '2026-04-08T10:00:00',
      customer_name: 'Dian',
      hotel: null,
      hotel_id: null,
      motor_id: 2,
      period_days: 2,
      payment_method: 'qris',
      total_price: 450_000,
      vendor_fee: 50_000
    })

    expect(result).toEqual({ success: true })
    expect(dbOps.run).toHaveBeenCalledWith(
      'UPDATE cash_accounts SET balance = balance + ? WHERE id = ?',
      [-300_000, 1]
    )
    expect(dbOps.run).toHaveBeenCalledWith(
      'UPDATE cash_accounts SET balance = balance + ? WHERE id = ?',
      [450_000, 3]
    )
    expect(dbOps.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cash_transactions'),
      [3, 450_000, 99, 'Sewa NMax - Dian', '2026-04-08']
    )
    expect(saveDb).toHaveBeenCalled()
  })

  it('rental delete menolak hapus data yang terkait rantai ganti unit', async () => {
    dbOps.get.mockImplementation((sql) => {
      if (sql.includes('SELECT * FROM rentals WHERE id = ?')) {
        return { id: 11, payout_id: null, hotel_payout_id: null, status: 'completed' }
      }
      if (sql.includes('SELECT id FROM rental_swaps')) return { id: 5 }
      return null
    })

    registerRentalHandlers()
    expect(() => handlers.get('rental:delete')(null, 11))
      .toThrow('Rental terkait ganti unit tidak bisa dihapus satuan. Batalkan data ganti unit dari menu Ganti Unit.')
  })

  it('owner payout tetap bisa diproses saat net payout Rp 0 tanpa akun kas', async () => {
    dbOps.get.mockImplementation((sql) => {
      if (sql.includes('SELECT last_insert_rowid() as id')) return { id: 51 }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('SELECT id, owner_gets FROM rentals')) {
        return [{ id: 1, owner_gets: 100_000 }]
      }
      if (sql.includes('FROM expenses e') && sql.includes('JOIN motors m')) {
        return [{ id: 21, amount: 100_000 }]
      }
      return []
    })

    registerOwnerHandlers()
    const result = await handlers.get('owner:payout')(null, {
      owner_id: 2,
      owner_name: 'Mitra A',
      net_amount: 0,
      gross_amount: 100_000,
      deduction_amount: 100_000,
      expense_ids: [21],
      motor_ids: null,
      cash_account_id: null,
      date: '2026-04-07'
    })

    expect(result).toEqual({ success: true, payoutId: 51 })
    expect(dbOps.runRaw).toHaveBeenCalledWith(
      'INSERT INTO payouts (owner_id, amount, gross_amount, deduction_amount, cash_account_id, date) VALUES (?, ?, ?, ?, ?, ?)',
      [2, 0, 100_000, 100_000, null, '2026-04-07']
    )
    expect(dbOps.run).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cash_transactions'),
      expect.anything()
    )
  })

  it('owner payout hanya menerima expense milik mitra yang sama', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM cash_accounts WHERE id = ?')) return { id: params[0], name: 'Kas Utama', balance: 500_000 }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('SELECT id, owner_gets FROM rentals')) return [{ id: 1, owner_gets: 200_000 }]
      if (sql.includes('FROM expenses e') && sql.includes('JOIN motors m')) return []
      return []
    })

    registerOwnerHandlers()
    expect(() => handlers.get('owner:payout')(null, {
      owner_id: 2,
      owner_name: 'Mitra A',
      net_amount: 100_000,
      gross_amount: 200_000,
      deduction_amount: 100_000,
      expense_ids: [999],
      motor_ids: null,
      cash_account_id: 7,
      date: '2026-04-07'
    })).toThrow('Jumlah payout tidak sesuai. Server menghitung Rp 200.000')
  })

  it('hotel payout dinonaktifkan karena fee vendor dibayar tunai saat transaksi', async () => {
    registerHotelHandlers()
    expect(() => handlers.get('hotel:payout')(null, {
      hotel_id: 3,
      hotel_name: 'Hotel A',
      rental_ids: [1],
      net_amount: 50_000,
      cash_account_id: 7,
      date: '2026-04-07'
    })).toThrow('Pembayaran terpisah fee vendor dinonaktifkan. Fee vendor dibayar tunai saat transaksi rental.')
  })

  it('hotel create menyimpan data vendor baru dan memanggil saveDb', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT id FROM hotels WHERE LOWER(TRIM(name))')) return null
      if (sql.includes('SELECT last_insert_rowid() as id')) return { id: 77 }
      return null
    })

    registerHotelHandlers()
    const result = handlers.get('hotel:create')(null, {
      name: 'IBIS Kuta',
      phone: '08123456789',
      bank_account: '',
      bank_name: ''
    })

    expect(result).toEqual({ id: 77 })
    expect(dbOps.runRaw).toHaveBeenCalledWith(
      'INSERT INTO hotels (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)',
      ['IBIS Kuta', '08123456789', null, null]
    )
    expect(saveDb).toHaveBeenCalled()
  })

  it('hotel payout selalu menolak request payout walau payload valid', async () => {
    registerHotelHandlers()
    expect(() => handlers.get('hotel:payout')(null, {
      hotel_id: 3,
      hotel_name: 'Hotel A',
      rental_ids: [2],
      net_amount: 75_000,
      cash_account_id: 7,
      date: '2026-04-07'
    })).toThrow('Pembayaran terpisah fee vendor dinonaktifkan. Fee vendor dibayar tunai saat transaksi rental.')
  })

  it('refund create menolak nominal nol atau melebihi total rental', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT * FROM rentals WHERE id = ?')) {
        return { id: params[0], status: 'completed', total_price: 300_000, payment_method: 'cash' }
      }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) {
        return { id: 1, name: 'Kas Tunai', balance: 500_000 }
      }
      return null
    })

    registerRefundHandlers()
    const createRefund = handlers.get('refund:create')

    expect(() => createRefund(null, {
      rental_id: 1,
      refund_amount: 0,
      remaining_days: 1
    })).toThrow('Nominal refund harus lebih besar dari nol')

    expect(() => createRefund(null, {
      rental_id: 1,
      refund_amount: 400_000,
      remaining_days: 1
    })).toThrow('Nominal refund tidak boleh melebihi total harga rental')
  })

  it('expense create menolak ketika saldo akun kas tidak cukup', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT COALESCE(SUM(balance), 0) as total FROM cash_accounts')) return { total: 100_000 }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) {
        return { id: 3, name: 'QRIS', type: params[0], balance: 1_000 }
      }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('FROM rentals r') && sql.includes('GROUP BY m.owner_id')) return []
      if (sql.includes('FROM expenses e') && sql.includes('GROUP BY m.owner_id')) return []
      return []
    })

    registerExpenseHandlers()
    const createExpense = handlers.get('expense:create')

    expect(() => createExpense(null, {
      type: 'umum',
      motor_id: null,
      category: 'lainnya',
      amount: 10_000,
      payment_method: 'qris',
      description: 'Test overspend',
      date: '2026-04-17'
    })).toThrow('Saldo Kas QRIS tidak cukup! (Sisa: Rp 1.000)')
  })

  it('expense create menormalisasi metode qriss menjadi qris', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT COALESCE(SUM(balance), 0) as total FROM cash_accounts')) return { total: 100_000 }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) {
        expect(params[0]).toBe('qris')
        return { id: 4, name: 'QRIS', type: 'qris', balance: 50_000 }
      }
      if (sql.includes('SELECT last_insert_rowid() as id')) return { id: 123 }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('FROM rentals r') && sql.includes('GROUP BY m.owner_id')) return []
      if (sql.includes('FROM expenses e') && sql.includes('GROUP BY m.owner_id')) return []
      return []
    })

    registerExpenseHandlers()
    const createExpense = handlers.get('expense:create')

    const result = createExpense(null, {
      type: 'umum',
      motor_id: null,
      category: 'lainnya',
      amount: 10_000,
      payment_method: 'qriss',
      description: 'Normalisasi qris',
      date: '2026-04-17'
    })

    expect(result).toEqual({ id: 123 })
    expect(dbOps.runRaw).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO expenses'),
      expect.arrayContaining(['qris'])
    )
  })

  it('expense create menolak pengeluaran operasional jika melanggar proteksi dana mitra', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT COALESCE(SUM(balance), 0) as total FROM cash_accounts')) return { total: 500_000 }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) {
        return { id: 4, name: 'QRIS', type: params[0], balance: 500_000 }
      }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('FROM rentals r') && sql.includes('GROUP BY m.owner_id')) return [{ owner_id: 1, total: 480_000 }]
      if (sql.includes('FROM expenses e') && sql.includes('GROUP BY m.owner_id')) return [{ owner_id: 1, total: 30_000 }]
      return []
    })

    registerExpenseHandlers()
    const createExpense = handlers.get('expense:create')

    expect(() => createExpense(null, {
      type: 'operasional',
      motor_id: null,
      category: 'lainnya',
      amount: 100_000,
      payment_method: 'qris',
      description: 'Biaya operasional',
      date: '2026-04-17'
    })).toThrow('Dana perusahaan tidak cukup. Dana bebas saat ini Rp 50.000 (setelah proteksi hak mitra).')
  })

  it('cash add expense menolak saat dana bebas perusahaan kurang walau saldo akun cukup', async () => {
    dbOps.get.mockImplementation((sql, params) => {
      if (sql.includes('SELECT COALESCE(SUM(balance), 0) as total FROM cash_accounts')) return { total: 300_000 }
      if (sql.includes('SELECT * FROM cash_accounts WHERE type = ?')) {
        return { id: 1, name: 'Kas Tunai', type: params[0], balance: 300_000 }
      }
      return null
    })
    dbOps.all.mockImplementation((sql) => {
      if (sql.includes('FROM rentals r') && sql.includes('GROUP BY m.owner_id')) return [{ owner_id: 1, total: 260_000 }]
      if (sql.includes('FROM expenses e') && sql.includes('GROUP BY m.owner_id')) return [{ owner_id: 1, total: 10_000 }]
      return []
    })

    registerCashHandlers()
    const addExpense = handlers.get('cash:add-expense')

    expect(() => addExpense(null, {
      payment_method: 'tunai',
      amount: 100_000,
      description: 'Beli ATK',
      date: '2026-04-17'
    })).toThrow('Dana perusahaan tidak cukup. Dana bebas saat ini Rp 50.000 (setelah proteksi hak mitra).')
  })
})
