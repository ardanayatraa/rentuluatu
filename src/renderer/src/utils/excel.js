// Excel export helpers — kirim data ke main process via IPC

const rp = (n) => Number(n || 0)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID') : '-'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('id-ID') : '-'
const paymentLabel = (method) => ({
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  debit_card: 'Debit Card'
}[method] || method || '-')

export async function saveFinancialExcel({ rows, period, groupLabel, fileLabel }) {
  const columns = [
    { header: 'Periode', key: 'period', width: 15 },
    { header: 'Jumlah Rental', key: 'rental_count', width: 15 },
    { header: 'Pemasukan', key: 'income', width: 20 },
    { header: 'Pengeluaran', key: 'expenses', width: 20 },
    { header: 'Wavy Gets', key: 'wavy_gets', width: 20 },
    { header: 'Bagian Mitra', key: 'owner_gets', width: 20 },
    { header: 'Profit', key: 'profit', width: 20 }
  ]
  const dataRows = rows.map(r => ({
    period: r.period, rental_count: r.rental_count,
    income: rp(r.income), expenses: rp(r.expenses),
    wavy_gets: rp(r.wavy_gets), owner_gets: rp(r.owner_gets), profit: rp(r.profit)
  }))
  const totals = {
    period: 'TOTAL', rental_count: rows.reduce((s,r)=>s+r.rental_count,0),
    income: rp(rows.reduce((s,r)=>s+r.income,0)),
    expenses: rp(rows.reduce((s,r)=>s+r.expenses,0)),
    wavy_gets: rp(rows.reduce((s,r)=>s+r.wavy_gets,0)),
    owner_gets: rp(rows.reduce((s,r)=>s+r.owner_gets,0)),
    profit: rp(rows.reduce((s,r)=>s+r.profit,0))
  }
  return window.api.saveExcel({
    defaultName: `Laporan_Keuangan_${fileLabel || period.replace(/\//g,'-')}.xlsx`,
    sheets: [{ name: 'Laporan Keuangan', columns, rows: dataRows, totals,
      currencyKeys: ['income','expenses','wavy_gets','owner_gets','profit'] }]
  })
}

export async function saveMotorIncomeExcel({ rentals, period, motorName, fileLabel }) {
  const columns = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'Pelanggan', key: 'customer', width: 22 },
    { header: 'Hotel / Vendor Hotel', key: 'hotel', width: 20 },
    { header: 'Motor', key: 'motor', width: 22 },
    { header: 'Durasi (hari)', key: 'days', width: 14 },
    { header: 'Pembayaran', key: 'payment', width: 14 },
    { header: 'Total', key: 'total', width: 18 },
    { header: 'Fee Vendor', key: 'vendor_fee', width: 18 },
    { header: 'Wavy Gets', key: 'wavy', width: 18 },
    { header: 'Bagian Mitra', key: 'owner', width: 18 }
  ]
  const dataRows = rentals.map(r => ({
    date: fmtDateTime(r.date_time), customer: r.customer_name, hotel: r.hotel || '-',
    motor: r.model + ' ' + r.plate_number, days: r.period_days,
    payment: paymentLabel(r.payment_method), total: rp(r.total_price),
    vendor_fee: rp(r.vendor_fee),
    wavy: rp(r.wavy_gets), owner: rp(r.owner_gets)
  }))
  const totals = {
    date: 'TOTAL', customer: '', hotel: '', motor: '',
    days: rentals.reduce((s,r)=>s+r.period_days,0), payment: '',
    total: rp(rentals.reduce((s,r)=>s+r.total_price,0)),
    vendor_fee: rp(rentals.reduce((s,r)=>s+Number(r.vendor_fee||0),0)),
    wavy: rp(rentals.reduce((s,r)=>s+r.wavy_gets,0)),
    owner: rp(rentals.reduce((s,r)=>s+r.owner_gets,0))
  }
  return window.api.saveExcel({
    defaultName: `Pendapatan_Motor_${(motorName||'Semua').replace(/\s/g,'_')}_${fileLabel || period.replace(/\//g,'-')}.xlsx`,
    sheets: [{ name: 'Pendapatan Motor', columns, rows: dataRows, totals,
      currencyKeys: ['total','vendor_fee','wavy','owner'] }]
  })
}

export async function saveMotorExpensesExcel({ expenses, period, motorName, fileLabel }) {
  const columns = [
    { header: 'Tanggal', key: 'date', width: 18 },
    { header: 'Motor', key: 'motor', width: 22 },
    { header: 'Tipe', key: 'type', width: 12 },
    { header: 'Kategori', key: 'category', width: 16 },
    { header: 'Keterangan', key: 'desc', width: 24 },
    { header: 'Pembayaran', key: 'payment', width: 14 },
    { header: 'Jumlah', key: 'amount', width: 18 }
  ]
  const dataRows = expenses.map(e => ({
    date: fmtDate(e.date), motor: e.model ? e.model+' '+e.plate_number : 'Umum',
    type: e.type, category: e.category, desc: e.description || '-',
    payment: paymentLabel(e.payment_method), amount: rp(e.amount)
  }))
  const totals = { date: 'TOTAL', motor:'', type:'', category:'', desc:'', payment:'',
    amount: rp(expenses.reduce((s,e)=>s+e.amount,0)) }
  return window.api.saveExcel({
    defaultName: `Pengeluaran_Motor_${(motorName||'Semua').replace(/\s/g,'_')}_${fileLabel || period.replace(/\//g,'-')}.xlsx`,
    sheets: [{ name: 'Pengeluaran Motor', columns, rows: dataRows, totals, currencyKeys: ['amount'] }]
  })
}

export async function saveTransactionsExcel({ rentals, operationalExpenses, motorExpenses, period, fileLabel }) {
  const rentalCols = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'Pelanggan', key: 'desc', width: 22 },
    { header: 'Motor', key: 'motor', width: 22 },
    { header: 'Pembayaran', key: 'payment', width: 14 },
    { header: 'Jumlah', key: 'amount', width: 18 },
    { header: 'Status', key: 'status', width: 12 }
  ]
  const expCols = [
    { header: 'Tanggal', key: 'date', width: 18 },
    { header: 'Kategori', key: 'desc', width: 22 },
    { header: 'Motor', key: 'motor', width: 22 },
    { header: 'Pembayaran', key: 'payment', width: 14 },
    { header: 'Jumlah', key: 'amount', width: 18 }
  ]
  return window.api.saveExcel({
      defaultName: `Transaksi_${fileLabel || period.replace(/\//g,'-')}.xlsx`,
      sheets: [
        { name: 'Pemasukan', columns: rentalCols, currencyKeys: ['amount'],
          rows: rentals.map(r => ({ date: fmtDateTime(r.date), desc: r.description, motor: r.motor, payment: paymentLabel(r.payment_method), amount: rp(r.amount), status: r.status })),
          totals: { date:'TOTAL', desc:'', motor:'', payment:'', amount: rp(rentals.filter(r=>r.status!=='refunded').reduce((s,r)=>s+r.amount,0)), status:'' }
        },
        { name: 'Pengeluaran Operasional', columns: expCols, currencyKeys: ['amount'],
          rows: operationalExpenses.map(e => ({ date: fmtDate(e.date), desc: e.description, motor: e.motor, payment: paymentLabel(e.payment_method), amount: rp(e.amount) })),
          totals: { date:'TOTAL', desc:'', motor:'', payment:'', amount: rp(operationalExpenses.reduce((s,e)=>s+e.amount,0)) }
        },
        { name: 'Pengeluaran Motor', columns: expCols, currencyKeys: ['amount'],
          rows: motorExpenses.map(e => ({ date: fmtDate(e.date), desc: e.description, motor: e.motor, payment: paymentLabel(e.payment_method), amount: rp(e.amount) })),
          totals: { date:'TOTAL', desc:'', motor:'', payment:'', amount: rp(motorExpenses.reduce((s,e)=>s+e.amount,0)) }
        }
      ]
  })
}

export async function saveCommissionExcel({ data, period, fileLabel }) {
  const { owner, rentals } = data
  const columns = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'Motor', key: 'motor', width: 22 },
    { header: 'Pelanggan', key: 'customer', width: 22 },
    { header: 'Durasi (hari)', key: 'days', width: 14 },
    { header: 'Total Sewa', key: 'total', width: 18 },
    { header: 'Bagian Mitra', key: 'commission', width: 18 },
    { header: 'Status', key: 'status', width: 12 }
  ]
  const dataRows = rentals.map(r => ({
    date: fmtDateTime(r.date_time), motor: r.model+' '+r.plate_number,
    customer: r.customer_name, days: r.period_days,
    total: rp(r.total_price), commission: rp(r.owner_gets),
    status: r.payout_id ? 'Lunas' : 'Belum'
  }))
  const totals = { date:'TOTAL', motor:'', customer:'', days: rentals.reduce((s,r)=>s+r.period_days,0),
    total: rp(rentals.reduce((s,r)=>s+r.total_price,0)),
    commission: rp(rentals.reduce((s,r)=>s+r.owner_gets,0)), status:'' }
  return window.api.saveExcel({
    defaultName: `Hak_Mitra_${owner.name.replace(/\s/g,'_')}_${fileLabel || period.replace(/\//g,'-')}.xlsx`,
    sheets: [{ name: 'Hak Mitra', columns, rows: dataRows, totals, currencyKeys: ['total','commission'] }]
  })
}

export async function saveProfitLossExcel({ data, period, fileLabel }) {
  const columns = [
    { header: 'Keterangan', key: 'label', width: 35 },
    { header: 'Jumlah', key: 'amount', width: 20 }
  ]
  const rows = [
    { label: 'PENDAPATAN', amount: '' },
    { label: 'Total Omzet Sewa', amount: rp(data.omzet) },
    { label: '  Refund / Pembatalan', amount: `(${rp(data.refunds)})` },
    { label: '  Bagian Mitra', amount: `(${rp(data.owner_gets)})` },
    { label: 'Pendapatan Bersih (Wavy Gets)', amount: rp(data.wavy_gets) },
    { label: '', amount: '' },
    { label: 'BEBAN OPERASIONAL', amount: '' },
    ...data.expenses.map(e => ({ label: `  ${e.category} (${e.type})`, amount: `(${rp(e.total)})` })),
    { label: 'Total Beban', amount: `(${rp(data.total_expenses)})` },
    { label: '', amount: '' },
    { label: 'LABA BERSIH', amount: rp(data.laba_bersih) }
  ]
  return window.api.saveExcel({
    defaultName: `Laba_Rugi_${fileLabel || period.replace(/\s/g,'_')}.xlsx`,
    sheets: [{ name: 'Laba Rugi', columns, rows }]
  })
}

export async function saveBalanceSheetExcel({ data, period, fileLabel }) {
  const columns = [
    { header: 'Kelompok', key: 'group', width: 22 },
    { header: 'Keterangan', key: 'label', width: 38 },
    { header: 'Jumlah', key: 'amount', width: 20 }
  ]

  const rows = [
    ...data.assets.current.map(row => ({ group: 'Aset', label: row.label, amount: Number(row.amount) })),
    { group: 'Aset', label: 'TOTAL ASET', amount: Number(data.assets.total) },
    ...data.liabilities.current.map(row => ({ group: 'Kewajiban', label: row.label, amount: Number(row.amount) })),
    { group: 'Kewajiban', label: 'TOTAL KEWAJIBAN', amount: Number(data.liabilities.total) },
    ...data.equity.rows.map(row => ({ group: 'Ekuitas', label: row.label, amount: Number(row.amount) })),
    { group: 'Ekuitas', label: 'TOTAL EKUITAS', amount: Number(data.equity.total) },
    { group: 'Kontrol', label: 'TOTAL KEWAJIBAN + EKUITAS', amount: Number(data.totals.liabilitiesAndEquity) }
  ]

  return window.api.saveExcel({
    defaultName: `Neraca_${fileLabel || period.replace(/\s/g,'_')}.xlsx`,
    sheets: [{ name: 'Neraca', columns, rows, currencyKeys: ['amount'] }]
  })
}

export async function saveAnnualExcel({ rows, year }) {
  const columns = [
    { header: 'Bulan', key: 'month_name', width: 16 },
    { header: 'Jumlah Rental', key: 'rental_count', width: 15 },
    { header: 'Omzet', key: 'omzet', width: 20 },
    { header: 'Wavy Gets', key: 'wavy_gets', width: 20 },
    { header: 'Pengeluaran', key: 'expenses', width: 20 },
    { header: 'Laba', key: 'laba', width: 20 }
  ]
  const dataRows = rows.map(r => ({
    month_name: r.month_name, rental_count: r.rental_count,
    omzet: Number(r.omzet), wavy_gets: Number(r.wavy_gets),
    expenses: Number(r.expenses), laba: Number(r.laba)
  }))
  const totals = {
    month_name: `TOTAL ${year}`,
    rental_count: rows.reduce((s,r)=>s+r.rental_count,0),
    omzet: Number(rows.reduce((s,r)=>s+r.omzet,0)),
    wavy_gets: Number(rows.reduce((s,r)=>s+r.wavy_gets,0)),
    expenses: Number(rows.reduce((s,r)=>s+r.expenses,0)),
    laba: Number(rows.reduce((s,r)=>s+r.laba,0))
  }
  return window.api.saveExcel({
    defaultName: `Rekap_Tahunan_${year}.xlsx`,
    sheets: [{ name: `Rekap ${year}`, columns, rows: dataRows, totals,
      currencyKeys: ['omzet','wavy_gets','expenses','laba'] }]
  })
}

export async function saveMotorsExcel({ motors, fileLabel }) {
  const columns = [
    { header: 'Model', key: 'model', width: 22 },
    { header: 'Plat Nomor', key: 'plate_number', width: 16 },
    { header: 'Tipe', key: 'type', width: 14 },
    { header: 'Porsi Wavy', key: 'wavy_share', width: 14 },
    { header: 'Pemilik', key: 'owner_name', width: 22 }
  ]
  const rows = (motors || []).map((m) => ({
    model: m.model || '-',
    plate_number: m.plate_number || '-',
    type: m.type_label || m.type || '-',
    wavy_share: m.wavy_share || '-',
    owner_name: m.owner_name || '-'
  }))
  return window.api.saveExcel({
    defaultName: `Daftar_Motor_${fileLabel}.xlsx`,
    sheets: [{ name: 'Motor', columns, rows }]
  })
}

export async function saveOwnersExcel({ owners, fileLabel }) {
  const columns = [
    { header: 'Nama', key: 'name', width: 22 },
    { header: 'WhatsApp', key: 'phone', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Sudah Dibayarkan', key: 'paid_amount', width: 20 },
    { header: 'Hak Mitra Mengendap', key: 'unpaid_commission', width: 20 }
  ]
  const rows = (owners || []).map((o) => ({
    name: o.name || '-',
    phone: o.phone || '-',
    status: o.is_active ? 'Aktif' : 'Nonaktif',
    paid_amount: Number(o.paid_amount || 0),
    unpaid_commission: Number(o.unpaid_commission || 0)
  }))
  const totals = {
    name: 'TOTAL',
    phone: `${rows.length} mitra`,
    status: '',
    paid_amount: rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0),
    unpaid_commission: rows.reduce((s, r) => s + Number(r.unpaid_commission || 0), 0)
  }
  return window.api.saveExcel({
    defaultName: `Daftar_Mitra_${fileLabel}.xlsx`,
    sheets: [{ name: 'Mitra', columns, rows, totals, currencyKeys: ['paid_amount','unpaid_commission'] }]
  })
}

export async function saveOwnerReportExcel({ rows, period, fileLabel }) {
  const columns = [
    { header: 'Mitra', key: 'name', width: 22 },
    { header: 'No. HP', key: 'phone', width: 16 },
    { header: 'Jml Motor', key: 'motor_count', width: 12 },
    { header: 'Jml Rental', key: 'rental_count', width: 12 },
    { header: 'Total Omzet', key: 'total_omzet', width: 20 },
    { header: 'Hak Mitra Kotor', key: 'gross_commission', width: 20 },
    { header: 'Total Pengeluaran', key: 'total_expenses', width: 20 },
    { header: 'Hak Mitra Bersih', key: 'net_commission', width: 20 }
  ]
  const dataRows = rows.map(o => ({
    name: o.name, phone: o.phone||'-', motor_count: o.motor_count,
    rental_count: o.rental_count, total_omzet: Number(o.total_omzet),
    gross_commission: Number(o.gross_commission), total_expenses: Number(o.total_expenses),
    net_commission: Number(o.gross_commission - o.total_expenses)
  }))
  const totals = {
    name: `TOTAL (${rows.length} mitra)`, phone:'',
    motor_count: rows.reduce((s,o)=>s+o.motor_count,0),
    rental_count: rows.reduce((s,o)=>s+o.rental_count,0),
    total_omzet: Number(rows.reduce((s,o)=>s+o.total_omzet,0)),
    gross_commission: Number(rows.reduce((s,o)=>s+o.gross_commission,0)),
    total_expenses: Number(rows.reduce((s,o)=>s+o.total_expenses,0)),
    net_commission: Number(rows.reduce((s,o)=>s+(o.gross_commission-o.total_expenses),0))
  }
  return window.api.saveExcel({
    defaultName: `Laporan_Mitra_${fileLabel || period.replace(/\s/g,'_')}.xlsx`,
    sheets: [{ name: 'Laporan Mitra', columns, rows: dataRows, totals,
      currencyKeys: ['total_omzet','gross_commission','total_expenses','net_commission'] }]
  })
}

export async function saveRankingExcel({ rows, period, fileLabel }) {
  const columns = [
    { header: '#', key: 'rank', width: 6 },
    { header: 'Motor', key: 'model', width: 22 },
    { header: 'Plat', key: 'plate', width: 14 },
    { header: 'Tipe', key: 'type', width: 12 },
    { header: 'Total Rental', key: 'total_rentals', width: 14 },
    { header: 'Total Hari', key: 'total_days', width: 14 },
    { header: 'Wavy Gets', key: 'total_wavy', width: 20 },
    { header: 'Bagian Mitra', key: 'total_owner', width: 20 }
  ]
  const dataRows = rows.map((m, i) => ({
    rank: i + 1, model: m.model, plate: m.plate_number, type: m.type,
    total_rentals: m.total_rentals, total_days: m.total_days,
    total_wavy: Number(m.total_wavy), total_owner: Number(m.total_owner)
  }))
  return window.api.saveExcel({
    defaultName: `Ranking_Motor_${fileLabel || period.replace(/\s/g,'_')}.xlsx`,
    sheets: [{ name: 'Ranking Motor', columns, rows: dataRows,
      currencyKeys: ['total_wavy', 'total_owner'] }]
  })
}
