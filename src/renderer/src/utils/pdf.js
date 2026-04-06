// PDF generator via print window
import logoUrl from '../assets/logo.png'

// Convert logo ke base64 untuk embed di PDF (agar bisa diakses hidden window)
async function getLogoBase64() {
  try {
    const res = await fetch(logoUrl)
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch { return '' }
}

let _logoBase64 = ''
getLogoBase64().then(b64 => { _logoBase64 = b64 })

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0 })

const fmtDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const fmtDateTime = (d) => {
  if (!d) return '-'
  const dt = new Date(d)
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const baseStyle = `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; background: #fff; padding: 36px 40px; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #111; }
  .brand { font-size: 18px; font-weight: 900; color: #111; letter-spacing: 1px; text-transform: uppercase; }
  .brand span { font-weight: 400; font-size: 11px; display: block; color: #555; letter-spacing: 2px; margin-top: 2px; }
  .report-title { font-size: 14px; font-weight: 700; color: #111; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .report-period { font-size: 10px; color: #555; margin-top: 3px; }
  .meta { text-align: right; font-size: 10px; color: #555; line-height: 1.6; }
  .meta strong { color: #111; }

  /* ── Summary ── */
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-bottom: 24px; border: 1px solid #ccc; }
  .summary-card { padding: 12px 14px; border-right: 1px solid #ccc; }
  .summary-card:last-child { border-right: none; }
  .summary-card .label { font-size: 9px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px; }
  .summary-card .value { font-size: 15px; font-weight: 700; color: #111; }
  .summary-card .value.neg { color: #111; }

  /* ── Section title ── */
  .section-title { font-size: 10px; font-weight: 700; color: #111; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px; border-bottom: 1px solid #111; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
  thead tr { background: #111; }
  th { font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; padding: 7px 10px; text-align: left; }
  th.right, td.right { text-align: right; }
  td { padding: 6px 10px; border-bottom: 1px solid #e8e8e8; color: #222; }
  tbody tr:nth-child(even) td { background: #f9f9f9; }
  tbody tr:last-child td { border-bottom: 1px solid #ccc; font-weight: 600; }

  /* ── Badge → plain text ── */
  .badge { font-size: 9px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.3px; }

  /* ── Footer ── */
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 9px; color: #888; }

  /* ── Signature ── */
  .sign-area { margin-top: 48px; display: flex; justify-content: flex-end; }
  .sign-box { text-align: center; width: 180px; }
  .sign-box .sign-line { border-top: 1px solid #111; margin-top: 52px; padding-top: 5px; font-size: 10px; font-weight: 700; }

  /* ── Vendor info box ── */
  .info-box { border: 1px solid #ccc; padding: 12px 14px; margin-bottom: 16px; }
  .info-box .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; margin-bottom: 6px; }
  .info-box .info-name { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .info-box .info-detail { font-size: 10px; color: #444; line-height: 1.6; }

  @media print { body { padding: 20px 24px; } }
</style>`

// PDF generator — kirim ke main process untuk save dialog
export async function savePdfReport(html, defaultName) {
  // Pastikan logo base64 sudah ter-load
  if (!_logoBase64) _logoBase64 = await getLogoBase64()
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyle}</head><body>${html}</body></html>`
  return window.api.savePdf({ html: fullHtml, defaultName })
}

// Tetap ada printWindow untuk preview di window baru
function printWindow(html) {
  const w = window.open('', '_blank', 'width=900,height=700')
  w.document.open()
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    ${baseStyle}
    <style>
      .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1e293b; padding: 10px 20px; display: flex; gap: 10px; align-items: center; z-index: 999; }
      .print-bar button { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; }
      .btn-save { background: #0ea5e9; color: white; }
      .btn-save:hover { background: #0284c7; }
      .btn-close { background: #475569; color: white; }
      .print-bar span { color: #94a3b8; font-size: 12px; }
      body { padding-top: 60px; }
      @media print { .print-bar { display: none; } body { padding-top: 32px; } }
    </style>
  </head><body>
    <div class="print-bar">
      <button class="btn-save" onclick="window.print()">Simpan PDF</button>
      <button class="btn-close" onclick="window.close()">Tutup</button>
      <span>Gunakan "Save as PDF" di dialog print</span>
    </div>
    ${html}
  </body></html>`)
  w.document.close()
  w.focus()
}

function headerHtml(title, period, subtitle = '') {
  const logoImg = _logoBase64
    ? `<img src="${_logoBase64}" alt="Logo" style="width:44px;height:44px;border-radius:8px;object-fit:cover" />`
    : `<div style="width:44px;height:44px;border-radius:8px;background:#0ea5e9;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white">W</div>`
  return `<div class="header">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoImg}
      <div>
        <div class="brand">The Wavy Rental Uluwatu<span>PT. Artha Bali Wisata</span></div>
        <div class="report-title">${title}</div>
        <div class="report-period">${subtitle || ''}</div>
      </div>
    </div>
    <div class="meta">
      <div>Periode: <strong>${period}</strong></div>
      <div>Dicetak: ${fmtDateTime(new Date())}</div>
    </div>
  </div>`
}

function footerHtml() {
  return `<div class="footer"><span>The Wavy Rental Uluwatu — PT. Artha Bali Wisata</span><span>Dokumen ini digenerate otomatis oleh sistem</span></div>`
}

// ─── 1. Laporan Keuangan ───────────────────────────────────────────────────
export function buildFinancialHtml({ summary, rows, period, groupLabel }) {
  const rowsHtml = rows.map(r => `<tr>
    <td>${r.period}</td>
    <td class="right">${r.rental_count}x</td>
    <td class="right">${rp(r.income)}</td>
    <td class="right">${rp(r.expenses)}</td>
    <td class="right">${rp(r.wavy_gets)}</td>
    <td class="right">${rp(r.owner_gets)}</td>
    <td class="right">${rp(r.profit)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Keuangan', period, 'Dikelompokkan per ' + groupLabel)}
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Pemasukan</div><div class="value">${rp(summary.income)}</div></div>
    <div class="summary-card"><div class="label">Total Pengeluaran</div><div class="value neg">${rp(summary.expenses)}</div></div>
    <div class="summary-card"><div class="label">Wavy Gets</div><div class="value">${rp(summary.wavy_gets)}</div></div>
    <div class="summary-card"><div class="label">Profit Bersih</div><div class="value">${rp(summary.profit)}</div></div>
  </div>
  <div class="section-title">Rincian per ${groupLabel}</div>
  <table><thead><tr>
    <th>Periode</th><th class="right">Rental</th><th class="right">Pemasukan</th>
    <th class="right">Pengeluaran</th><th class="right">Wavy Gets</th><th class="right">Owner Gets</th><th class="right">Profit</th>
  </tr></thead><tbody>${rowsHtml}</tbody></table>
  ${footerHtml()}`
}
export function printFinancialReport(args) { printWindow(buildFinancialHtml(args)) }

// ─── 2. Laporan Pendapatan per Motor ───────────────────────────────────────
export function buildMotorIncomeHtml({ rentals, period, motorName }) {
  const total = rentals.reduce((s, r) => s + (r.total_price || 0), 0)
  const totalWavy = rentals.reduce((s, r) => s + (r.wavy_gets || 0), 0)
  const totalOwner = rentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
  const rowsHtml = rentals.map(r => `<tr>
    <td>${fmtDateTime(r.date_time)}</td>
    <td>${r.customer_name}${r.hotel ? '<br><span style="color:#94a3b8;font-size:10px">' + r.hotel + '</span>' : ''}</td>
    <td>${r.model} <span style="color:#94a3b8">${r.plate_number}</span></td>
    <td class="right">${r.period_days} hari</td>
    <td><span class="badge badge-blue">${r.payment_method}</span></td>
    <td class="right" style="font-weight:700">${rp(r.total_price)}</td>
    <td class="right">${rp(r.wavy_gets)}</td>
    <td class="right">${rp(r.owner_gets)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Pendapatan per Motor', period, motorName || 'Semua Motor')}
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Transaksi</div><div class="value">${rentals.length}x</div></div>
    <div class="summary-card"><div class="label">Total Pendapatan</div><div class="value">${rp(total)}</div></div>
    <div class="summary-card"><div class="label">Wavy Gets</div><div class="value">${rp(totalWavy)}</div></div>
    <div class="summary-card"><div class="label">Owner Gets</div><div class="value">${rp(totalOwner)}</div></div>
  </div>
  <div class="section-title">Detail Transaksi Rental</div>
  <table><thead><tr>
    <th>Tanggal</th><th>Pelanggan</th><th>Motor</th><th class="right">Durasi</th>
    <th>Pembayaran</th><th class="right">Total</th><th class="right">Wavy Gets</th><th class="right">Owner Gets</th>
  </tr></thead><tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">Tidak ada data</td></tr>'}</tbody></table>
  ${footerHtml()}`
}
export function printMotorIncomeReport(args) { printWindow(buildMotorIncomeHtml(args)) }

// ─── 3. Laporan Pengeluaran per Motor ──────────────────────────────────────
export function buildMotorExpensesHtml({ expenses, period, motorName }) {
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const rowsHtml = expenses.map(e => `<tr>
    <td>${fmtDate(e.date)}</td>
    <td>${e.model ? e.model + ' <span style="color:#94a3b8">' + e.plate_number + '</span>' : '<span style="color:#94a3b8">Umum</span>'}</td>
    <td><span class="badge badge-orange">${e.type}</span></td>
    <td>${e.category}</td>
    <td>${e.description || '-'}</td>
    <td><span class="badge badge-blue">${e.payment_method}</span></td>
    <td class="right" style="color:#dc2626;font-weight:700">${rp(e.amount)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Pengeluaran per Motor', period, motorName || 'Semua Motor')}
  <div class="summary-grid" style="grid-template-columns:repeat(2,1fr)">
    <div class="summary-card"><div class="label">Total Pengeluaran</div><div class="value">${rp(total)}</div></div>
    <div class="summary-card"><div class="label">Jumlah Transaksi</div><div class="value">${expenses.length}x</div></div>
  </div>
  <div class="section-title">Detail Pengeluaran</div>
  <table><thead><tr>
    <th>Tanggal</th><th>Motor</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th>Pembayaran</th><th class="right">Jumlah</th>
  </tr></thead><tbody>${rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888">Tidak ada data</td></tr>'}</tbody></table>
  ${footerHtml()}`
}
export function printMotorExpensesReport(args) { printWindow(buildMotorExpensesHtml(args)) }

// ─── 4. Laporan Transaksi (Semua) ──────────────────────────────────────────
export function buildTransactionsHtml({ rentals, expenses, period }) {
  const totalIn = rentals.filter(r => r.status !== 'refunded').reduce((s, r) => s + (r.amount || 0), 0)
  const totalOut = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const rentalRows = rentals.map(r => `<tr>
    <td>${fmtDateTime(r.date)}</td><td>Pemasukan</td>
    <td>${r.description}</td><td>${r.motor}</td>
    <td>${r.payment_method}</td>
    <td class="right">${rp(r.amount)}</td>
    <td>${r.status}</td>
  </tr>`).join('')
  const expenseRows = expenses.map(e => `<tr>
    <td>${fmtDate(e.date)}</td><td>Pengeluaran</td>
    <td>${e.description}</td><td>${e.motor}</td>
    <td>${e.payment_method}</td>
    <td class="right">${rp(e.amount)}</td>
    <td>-</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Semua Transaksi', period)}
  <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="summary-card"><div class="label">Total Pemasukan</div><div class="value">${rp(totalIn)}</div></div>
    <div class="summary-card"><div class="label">Total Pengeluaran</div><div class="value">${rp(totalOut)}</div></div>
    <div class="summary-card"><div class="label">Selisih</div><div class="value">${rp(totalIn - totalOut)}</div></div>
  </div>
  <div class="section-title">Pemasukan (Rental)</div>
  <table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Pelanggan</th><th>Motor</th><th>Pembayaran</th><th class="right">Jumlah</th><th>Status</th></tr></thead>
  <tbody>${rentalRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">Tidak ada data</td></tr>'}</tbody></table>
  <div class="section-title">Pengeluaran</div>
  <table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Motor</th><th>Pembayaran</th><th class="right">Jumlah</th><th>Status</th></tr></thead>
  <tbody>${expenseRows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">Tidak ada data</td></tr>'}</tbody></table>
  ${footerHtml()}`
}
export function printTransactionsReport(args) { printWindow(buildTransactionsHtml(args)) }

// ─── 5. Laporan Komisi Owner (Slip Pembayaran) ─────────────────────────────
export function buildOwnerCommissionHtml({ data, period }) {
  const { owner, motors, rentals, payouts, totalOwnerGets, totalPaid, totalUnpaid } = data
  const motorList = motors.map(m => m.model + ' (' + m.plate_number + ')').join(', ')
  const rentalRows = rentals.map(r => `<tr>
    <td>${fmtDateTime(r.date_time)}</td>
    <td>${r.model} ${r.plate_number}</td>
    <td>${r.customer_name}</td>
    <td class="right">${r.period_days} hari</td>
    <td class="right">${rp(r.total_price)}</td>
    <td class="right">${rp(r.owner_gets)}</td>
    <td>${r.payout_id ? 'Lunas' : 'Belum Dibayar'}</td>
  </tr>`).join('')
  const payoutRows = payouts.map(p => `<tr>
    <td>${fmtDate(p.date)}</td><td>${p.cash_account_name}</td>
    <td class="right">${rp(p.amount)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Komisi Vendor', period, 'Vendor: ' + owner.name)}
  <div style="display:flex;gap:20px;margin-bottom:20px">
    <div class="info-box" style="flex:1">
      <div class="info-label">Data Vendor</div>
      <div class="info-name">${owner.name}</div>
      <div class="info-detail">No. HP: ${owner.phone || '-'}<br>Bank: ${owner.bank_name || '-'} &mdash; ${owner.bank_account || '-'}<br>Motor: ${motorList || '-'}</div>
    </div>
    <div style="flex:1">
      <div class="summary-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="summary-card"><div class="label">Total Komisi</div><div class="value">${rp(totalOwnerGets)}</div></div>
        <div class="summary-card"><div class="label">Sudah Dibayar</div><div class="value">${rp(totalPaid)}</div></div>
        <div class="summary-card"><div class="label">Belum Dibayar</div><div class="value">${rp(totalUnpaid)}</div></div>
        <div class="summary-card"><div class="label">Jml Transaksi</div><div class="value">${rentals.length}x</div></div>
      </div>
    </div>
  </div>
  <div class="section-title">Rincian Rental</div>
  <table><thead><tr>
    <th>Tanggal</th><th>Motor</th><th>Pelanggan</th><th class="right">Durasi</th>
    <th class="right">Total Sewa</th><th class="right">Komisi Vendor</th><th>Status</th>
  </tr></thead><tbody>${rentalRows || '<tr><td colspan="7" style="text-align:center;padding:16px;color:#888">Tidak ada data</td></tr>'}</tbody></table>
  ${payouts.length ? '<div class="section-title">Riwayat Pembayaran</div><table><thead><tr><th>Tanggal</th><th>Akun Kas</th><th class="right">Jumlah Dibayar</th></tr></thead><tbody>' + payoutRows + '</tbody></table>' : ''}
  <div class="sign-area"><div class="sign-box">
    <div style="font-size:10px;color:#555">Hormat kami,</div>
    <div class="sign-line">Wavy CashFlow Monitoring</div>
  </div></div>
  ${footerHtml()}`
}
export function printOwnerCommissionReport(args) { printWindow(buildOwnerCommissionHtml(args)) }

// ─── 6. Laporan Laba Rugi ──────────────────────────────────────────────────
export function buildProfitLossHtml({ data, period }) {
  const expRows = data.expenses.map(e => `<tr>
    <td class="right" style="padding-left:24px">${e.category} <span style="color:#888;font-size:9px">(${e.type})</span></td>
    <td class="right">( ${rp(e.total)} )</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Laba Rugi', period)}
  <table style="max-width:500px">
    <thead><tr><th>Keterangan</th><th class="right">Jumlah</th></tr></thead>
    <tbody>
      <tr style="background:#f1f5f9"><td colspan="2" style="font-weight:700;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px">Pendapatan</td></tr>
      <tr><td>Total Omzet Sewa</td><td class="right">${rp(data.omzet)}</td></tr>
      <tr><td style="padding-left:16px;color:#555">Refund / Pembatalan</td><td class="right">( ${rp(data.refunds)} )</td></tr>
      <tr><td style="padding-left:16px;color:#555">Bagian Mitra</td><td class="right">( ${rp(data.owner_gets)} )</td></tr>
      <tr style="font-weight:700;border-top:2px solid #ccc"><td>Pendapatan Bersih</td><td class="right">${rp(data.wavy_gets)}</td></tr>
      <tr style="background:#f1f5f9"><td colspan="2" style="font-weight:700;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px">Beban Operasional</td></tr>
      ${expRows}
      <tr style="font-weight:700;border-top:1px solid #ccc"><td>Total Beban</td><td class="right">( ${rp(data.total_expenses)} )</td></tr>
      <tr style="font-weight:700;font-size:13px;border-top:2px solid #111;background:#f9f9f9"><td>LABA BERSIH</td><td class="right">${rp(data.laba_bersih)}</td></tr>
    </tbody>
  </table>
  ${footerHtml()}`
}
export function printProfitLossReport(args) { printWindow(buildProfitLossHtml(args)) }

// ─── 7. Rekap Tahunan ──────────────────────────────────────────────────────
export function buildAnnualHtml({ rows, year }) {
  const rowsHtml = rows.map(r => `<tr>
    <td>${r.month_name}</td>
    <td class="right">${r.rental_count}x</td>
    <td class="right">${rp(r.omzet)}</td>
    <td class="right">${rp(r.wavy_gets)}</td>
    <td class="right">${rp(r.expenses)}</td>
    <td class="right" style="font-weight:700">${rp(r.laba)}</td>
  </tr>`).join('')
  const totals = {
    rental: rows.reduce((s,r)=>s+r.rental_count,0),
    omzet: rows.reduce((s,r)=>s+r.omzet,0),
    wavy: rows.reduce((s,r)=>s+r.wavy_gets,0),
    exp: rows.reduce((s,r)=>s+r.expenses,0),
    laba: rows.reduce((s,r)=>s+r.laba,0)
  }
  return `${headerHtml('Rekap Omzet Tahunan', String(year))}
  <table><thead><tr>
    <th>Bulan</th><th class="right">Rental</th><th class="right">Omzet</th>
    <th class="right">Wavy Gets</th><th class="right">Pengeluaran</th><th class="right">Laba</th>
  </tr></thead><tbody>
    ${rowsHtml}
    <tr style="font-weight:700;border-top:2px solid #111;background:#f9f9f9">
      <td>TOTAL ${year}</td>
      <td class="right">${totals.rental}x</td>
      <td class="right">${rp(totals.omzet)}</td>
      <td class="right">${rp(totals.wavy)}</td>
      <td class="right">${rp(totals.exp)}</td>
      <td class="right">${rp(totals.laba)}</td>
    </tr>
  </tbody></table>
  ${footerHtml()}`
}
export function printAnnualReport(args) { printWindow(buildAnnualHtml(args)) }

// ─── 8. Laporan per Mitra ──────────────────────────────────────────────────
export function buildOwnerReportHtml({ rows, period }) {
  const rowsHtml = rows.map(o => `<tr>
    <td>${o.name}<br><span style="color:#888;font-size:9px">${o.phone||'-'}</span></td>
    <td>${o.bank_name||'-'}<br><span style="font-family:monospace;font-size:9px">${o.bank_account||'-'}</span></td>
    <td class="right">${o.motor_count}</td>
    <td class="right">${o.rental_count}x</td>
    <td class="right">${rp(o.total_omzet)}</td>
    <td class="right">${rp(o.gross_commission)}</td>
    <td class="right">${rp(o.total_expenses)}</td>
    <td class="right" style="font-weight:700">${rp(o.gross_commission - o.total_expenses)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan per Mitra', period)}
  <table><thead><tr>
    <th>Mitra</th><th>Bank</th><th class="right">Motor</th><th class="right">Rental</th>
    <th class="right">Omzet</th><th class="right">Komisi Kotor</th><th class="right">Pengeluaran</th><th class="right">Komisi Bersih</th>
  </tr></thead><tbody>
    ${rowsHtml}
    <tr style="font-weight:700;border-top:2px solid #111;background:#f9f9f9">
      <td colspan="4">TOTAL (${rows.length} mitra)</td>
      <td class="right">${rp(rows.reduce((s,o)=>s+o.total_omzet,0))}</td>
      <td class="right">${rp(rows.reduce((s,o)=>s+o.gross_commission,0))}</td>
      <td class="right">${rp(rows.reduce((s,o)=>s+o.total_expenses,0))}</td>
      <td class="right">${rp(rows.reduce((s,o)=>s+(o.gross_commission-o.total_expenses),0))}</td>
    </tr>
  </tbody></table>
  ${footerHtml()}`
}
export function printOwnerReport(args) { printWindow(buildOwnerReportHtml(args)) }

// ─── 9. Ranking Motor ──────────────────────────────────────────────────────
export function buildRankingHtml({ rows, period }) {
  const rowsHtml = rows.map((m, i) => `<tr>
    <td style="font-weight:700;color:#94a3b8">${i + 1}</td>
    <td>${m.model} <span style="color:#94a3b8">${m.plate_number}</span></td>
    <td><span class="badge">${m.type}</span></td>
    <td class="right">${m.total_rentals}x</td>
    <td class="right">${m.total_days} hari</td>
    <td class="right" style="font-weight:700">${rp(m.total_wavy)}</td>
    <td class="right">${rp(m.total_owner)}</td>
  </tr>`).join('')
  return `${headerHtml('Ranking Motor', period)}
  <table><thead><tr>
    <th>#</th><th>Motor</th><th>Tipe</th>
    <th class="right">Total Rental</th><th class="right">Total Hari</th>
    <th class="right">Wavy Gets</th><th class="right">Owner Gets</th>
  </tr></thead><tbody>
    ${rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888">Tidak ada data</td></tr>'}
  </tbody></table>
  ${footerHtml()}`
}
