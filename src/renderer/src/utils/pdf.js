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

const rp = (n) => 'Rp&nbsp;' + Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0 })
const REKENING_METHODS = ['transfer', 'qris', 'debit_card']
const paymentLabel = (method) => ({
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  debit_card: 'Debit Card'
}[method] || method || '-')
const cashBucketLabel = (bucket) => {
  const normalizedBucket = String(bucket || 'pendapatan').trim().toLowerCase()
  if (normalizedBucket === 'modal') return 'Kas Modal Tanam'
  if (normalizedBucket === 'ganti_rugi') return 'Kas Ganti Rugi'
  return 'Kas Pendapatan'
}
const isRekeningMethod = (method) => REKENING_METHODS.includes(String(method || '').trim().toLowerCase())
const paymentGroupLabel = (method, bucket) => {
  const normalizedBucket = String(bucket || 'pendapatan').trim().toLowerCase()
  const normalizedMethod = String(method || '').trim().toLowerCase()
  if (normalizedBucket === 'modal' && normalizedMethod === 'tunai') return 'Modal Tanam'
  if (normalizedBucket === 'ganti_rugi' && normalizedMethod === 'tunai') return 'Ganti Rugi'
  return isRekeningMethod(method) ? 'Saldo Rekening' : paymentLabel(method)
}
const calculateCashSummary = (rows = [], amountKey = 'amount') => rows.reduce((summary, row) => {
  const amount = Number(row?.[amountKey] || 0)
  const normalizedBucket = String(row?.cash_bucket || 'pendapatan').trim().toLowerCase()
  const bucket = normalizedBucket === 'modal' || normalizedBucket === 'ganti_rugi' ? normalizedBucket : 'pendapatan'
  summary[bucket] += amount
  if (isRekeningMethod(row?.payment_method)) summary.rekening += amount
  return summary
}, { pendapatan: 0, modal: 0, ganti_rugi: 0, rekening: 0 })

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

const fmtSlipDate = (d) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const esc = (value) => String(value ?? '-')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const baseStyle = `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 14mm 12mm 18mm 12mm; }
  html, body { background: #fff; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; background: #fff; padding: 0; }
  .pdf-document { width: 100%; }

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
  td.right { white-space: nowrap; word-break: keep-all; overflow-wrap: normal; }
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
  .slip-header { align-items: center; margin-bottom: 14px; padding-bottom: 10px; }
  .slip-title-line { font-size: 12px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; color: #111; line-height: 1.24; }
  .slip-title-company { font-size: 11px; font-weight: 650; letter-spacing: .55px; }
  .slip-title-brand { font-weight: 850; }
  .slip-meta { text-align: right; font-size: 10px; color: #555; line-height: 1.55; }
  .slip-meta strong { color: #111; font-weight: 800; }
  .slip-top { display: grid; grid-template-columns: 1fr 1.2fr; gap: 14px; margin-bottom: 18px; }
  .slip-box { border: 1px solid #999; min-height: 106px; padding: 10px 12px; }
  .slip-detail { display: grid; grid-template-columns: 116px 1fr; gap: 8px; font-size: 10px; line-height: 1.8; }
  .slip-summary { border: 1px solid #999; min-height: 106px; display: grid; grid-template-columns: 1fr 1fr; }
  .slip-summary > div { padding: 8px 12px; border-top: 1px solid #ddd; }
  .slip-summary > div:nth-child(-n+2) { border-top: none; }
  .slip-summary > div:nth-child(even) { border-left: 1px solid #ddd; }
  .slip-summary .label { font-size: 9px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: .4px; }
  .slip-summary .value { font-size: 11px; font-weight: 800; color: #111; margin-top: 2px; }
  .slip-summary .wide { grid-column: 1 / -1; border-top: 1px solid #999; padding-top: 7px; background: #eef2ff; text-align: center; }
  .slip-table { table-layout: fixed; font-size: 9.5px; }
  .slip-table th, .slip-table td { padding: 6px 8px; }
  .slip-table th { white-space: normal; line-height: 1.15; letter-spacing: .2px; vertical-align: middle; }
  .slip-table td.right { white-space: nowrap !important; word-break: keep-all; overflow-wrap: normal; }
  .slip-total-row td.right { white-space: nowrap !important; word-break: keep-all; overflow-wrap: normal; }
  .slip-transaction-table col:nth-child(1) { width: 13%; }
  .slip-transaction-table col:nth-child(2) { width: 21%; }
  .slip-transaction-table col:nth-child(3) { width: 12%; }
  .slip-transaction-table col:nth-child(4) { width: 9%; }
  .slip-transaction-table col:nth-child(5) { width: 15%; }
  .slip-transaction-table col:nth-child(6) { width: 15%; }
  .slip-transaction-table col:nth-child(7) { width: 15%; }
  .slip-extension-table col:nth-child(1) { width: 16%; }
  .slip-extension-table col:nth-child(2) { width: 33%; }
  .slip-extension-table col:nth-child(3) { width: 17%; }
  .slip-extension-table col:nth-child(4) { width: 17%; }
  .slip-extension-table col:nth-child(5) { width: 17%; }
  .slip-expense-table col:nth-child(1) { width: 16%; }
  .slip-expense-table col:nth-child(2) { width: 30%; }
  .slip-expense-table col:nth-child(3) { width: 36%; }
  .slip-expense-table col:nth-child(4) { width: 18%; }
  .slip-vendor-table col:nth-child(1) { width: 18%; }
  .slip-vendor-table col:nth-child(2) { width: 20%; }
  .slip-vendor-table col:nth-child(3) { width: 32%; }
  .slip-vendor-table col:nth-child(4) { width: 12%; }
  .slip-vendor-table col:nth-child(5) { width: 18%; }
  .slip-total-row td { font-weight: 800 !important; border-top: 1px solid #111; background: #fff !important; }
  .slip-sign-area { margin-top: 24px; display: flex; justify-content: flex-end; }
  .slip-sign-box { text-align: center; min-width: 180px; font-size: 10px; color: #111; line-height: 1.7; }
  .slip-sign-name { font-weight: 800; }

  @media print {
    body { padding: 0; }
    .pdf-document { width: 100%; }
  }
</style>`

// PDF generator — kirim ke main process untuk save dialog
function wrapPdfHtml(content, documentTitle = 'Laporan_Wavy.pdf') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${documentTitle}</title>${baseStyle}</head><body><div class="pdf-document">${content}</div></body></html>`
}

function showPreviewLoading(message = 'Menyiapkan preview PDF...') {
  const existing = document.getElementById('pdf-preview-loading')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'pdf-preview-loading'
  overlay.className = 'app-loading-overlay'
  overlay.innerHTML = `
    <div class="app-loading-card">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="material-symbols-outlined" style="font-size:26px;color:#1d4ed8;animation:spin 1s linear infinite">progress_activity</span>
        <div>
          <p style="margin:0;font-size:14px;font-weight:800;color:#0f172a">Preview PDF</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b">${message}</p>
        </div>
      </div>
    </div>
  `

  const spinStyle = document.createElement('style')
  spinStyle.id = 'pdf-preview-loading-style'
  spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
  document.head.appendChild(spinStyle)
  document.body.appendChild(overlay)
}

function hidePreviewLoading() {
  document.getElementById('pdf-preview-loading')?.remove()
  document.getElementById('pdf-preview-loading-style')?.remove()
}

async function waitForNextPaint() {
  await new Promise(resolve => requestAnimationFrame(() => resolve()))
  await new Promise(resolve => setTimeout(resolve, 0))
}

export async function runWithPdfLoading(message, work) {
  showPreviewLoading(message)
  await waitForNextPaint()
  try {
    return await work()
  } finally {
    hidePreviewLoading()
  }
}

export async function savePdfReport(html, defaultName) {
  // Pastikan logo base64 sudah ter-load
  if (!_logoBase64) _logoBase64 = await getLogoBase64()
  const fullHtml = wrapPdfHtml(html, defaultName || 'Laporan_Wavy.pdf')
  return window.api.savePdf({ html: fullHtml, defaultName })
}

// Preview di window baru — ada tombol Download PDF dan tutup
export async function previewReport(html, defaultName, options = {}) {
  const runPreview = async () => {
    if (!_logoBase64) _logoBase64 = await getLogoBase64()
    const fullHtml = wrapPdfHtml(html, defaultName || 'Laporan_Wavy.pdf')
    await window.api.previewPdfWindow({
      html: fullHtml,
      defaultName: defaultName || 'Laporan_Wavy.pdf'
    })
  }

  if (options.skipLoading) {
    return runPreview()
  }

  return runWithPdfLoading('Sedang merender dokumen. Mohon tunggu sebentar...', runPreview)

  const w = window.open('', '_blank', 'width=960,height=720')
  w.document.open()
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    ${baseStyle}
    <style>
      .preview-bar {
        position: fixed; top: 0; left: 0; right: 0;
        background: #1e3a5f; padding: 10px 20px;
        display: flex; gap: 10px; align-items: center; z-index: 999;
      }
      .preview-bar button {
        padding: 8px 18px; border-radius: 8px; font-size: 13px;
        font-weight: 700; cursor: pointer; border: none;
      }
      .preview-bar button:disabled { cursor: wait; opacity: 0.7; }
      .btn-download { background: #10b981; color: white; }
      .btn-download:hover:not(:disabled) { background: #059669; }
      .preview-bar span { color: #94a3b8; font-size: 12px; }
      body { padding-top: 60px; background: #e2e8f0; }
      .preview-shell { max-width: 210mm; margin: 0 auto; background: white; min-height: calc(100vh - 92px); box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16); }
    </style>
  </head><body>
    <div class="preview-bar">
      <button class="btn-download" id="btnDl">Download PDF</button>
      <span>Preview — klik Download PDF untuk menyimpan</span>
    </div>
    <div class="preview-shell">${html}</div>
  </body></html>`)
  w.document.close()
  w.focus()

  // Inject handler setelah window siap — akses fullHtml dari closure, bukan embed di string
  w._pdfHtml = fullHtml
  w._pdfName = defaultName || 'Laporan_Wavy.pdf'
  w.document.getElementById('btnDl').addEventListener('click', async function () {
    const btn = this
    btn.disabled = true
    btn.textContent = 'Menyimpan...'
    try {
      const api = window.api // akses dari parent (renderer Electron)
      await api.savePdf({ html: w._pdfHtml, defaultName: w._pdfName })
    } catch (e) {
      console.error('savePdf error:', e)
      alert('Gagal menyimpan PDF: ' + e.message)
    } finally {
      btn.disabled = false
      btn.textContent = 'Download PDF'
    }
  })
}

function headerHtml(title, period, subtitle = '') {
  const logoImg = _logoBase64
    ? `<img src="${_logoBase64}" alt="Logo" style="width:44px;height:44px;border-radius:8px;object-fit:cover" />`
    : `<div style="width:44px;height:44px;border-radius:8px;background:#0ea5e9;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white">W</div>`
  return `<div class="header">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoImg}
      <div>
        <div class="brand">PT. Artha Bali Wisata<span>The Wavy Rental</span></div>
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

function ownerSlipHeaderHtml(period, title = 'LAPORAN PENDAPATAN') {
  const logoImg = _logoBase64
    ? `<img src="${_logoBase64}" alt="Logo" style="width:50px;height:50px;border-radius:9px;object-fit:cover" />`
    : `<div style="width:50px;height:50px;border-radius:9px;background:#0ea5e9;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:white">W</div>`

  return `<div class="header slip-header">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoImg}
      <div>
        <div class="slip-title-line slip-title-company">PT. ARTHA BALI WISATA</div>
        <div class="slip-title-line slip-title-brand">THE WAVY RENTAL</div>
        <div class="slip-title-line">${esc(title)}</div>
      </div>
    </div>
    <div class="slip-meta">
      <div>Periode: <strong>${esc(period || '-')}</strong></div>
      <div>Dicetak: ${fmtDateTime(new Date())}</div>
    </div>
  </div>`
}

function footerHtml() {
  return `<div class="footer"><span>PT. Artha Bali Wisata - The Wavy Rental</span><span>Dokumen ini digenerate otomatis oleh sistem</span></div>`
}

export function buildSimpleTableHtml({
  title,
  subtitle = '',
  period = '-',
  summary = [],
  columns = [],
  rows = [],
  emptyMessage = 'Tidak ada data'
}) {
  const safeColumns = columns.map(col => ({
    ...col,
    alignClass: col.align === 'right' ? 'right' : ''
  }))

  const summaryHtml = summary.length
    ? `<div class="summary-grid">${summary.map(item => `
      <div class="summary-card">
        <div class="label">${esc(item.label)}</div>
        <div class="value">${esc(item.value)}</div>
      </div>
    `).join('')}</div>`
    : ''

  const headHtml = safeColumns.map(col => `<th class="${col.alignClass}">${esc(col.label)}</th>`).join('')
  const bodyHtml = rows.length
    ? rows.map(row => `<tr>${safeColumns.map(col => `<td class="${col.alignClass}">${esc(row[col.key])}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${Math.max(1, safeColumns.length)}" style="text-align:center;padding:20px;color:#888">${esc(emptyMessage)}</td></tr>`

  return `${headerHtml(title, period, subtitle)}
    ${summaryHtml}
    <div class="section-title">Data Tabel</div>
    <table>
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
    ${footerHtml()}`
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
    <th class="right">Pengeluaran</th><th class="right">Wavy Gets</th><th class="right">Bagian Mitra</th><th class="right">Profit</th>
  </tr></thead><tbody>${rowsHtml}</tbody></table>
  ${footerHtml()}`
}
export function printFinancialReport(args) { printWindow(buildFinancialHtml(args)) }

// ─── 2. Laporan Pendapatan per Motor ───────────────────────────────────────
export function buildMotorIncomeHtml({ rentals, period, motorName }) {
  const total = rentals.reduce((s, r) => s + (r.total_price || 0), 0)
  const totalVendor = rentals.reduce((s, r) => s + (r.vendor_fee || 0), 0)
  const totalWavy = rentals.reduce((s, r) => s + (r.wavy_gets || 0), 0)
  const totalOwner = rentals.reduce((s, r) => s + (r.owner_gets || 0), 0)
  const cashSummary = calculateCashSummary(rentals, 'total_price')
  const rowsHtml = rentals.map(r => `<tr>
    <td>${fmtDateTime(r.date_time)}</td>
    <td>${r.customer_name}${r.hotel ? '<br><span style="color:#94a3b8;font-size:10px">' + r.hotel + '</span>' : ''}</td>
    <td>${r.model} <span style="color:#94a3b8">${r.plate_number}</span></td>
    <td class="right">${r.period_days} hari</td>
    <td>${cashBucketLabel(r.cash_bucket)}</td>
    <td><span class="badge badge-blue">${paymentGroupLabel(r.payment_method, r.cash_bucket)}</span></td>
    <td class="right" style="font-weight:700">${rp(r.total_price)}</td>
    <td class="right">${rp(r.vendor_fee || 0)}</td>
    <td class="right">${rp(r.wavy_gets)}</td>
    <td class="right">${rp(r.owner_gets)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Pendapatan per Motor', period, motorName || 'Semua Motor')}
  <div class="summary-grid" style="grid-template-columns:repeat(8,1fr)">
    <div class="summary-card"><div class="label">Total Transaksi</div><div class="value">${rentals.length}x</div></div>
    <div class="summary-card"><div class="label">Total Pendapatan</div><div class="value">${rp(total)}</div></div>
    <div class="summary-card"><div class="label">Fee Vendor</div><div class="value">${rp(totalVendor)}</div></div>
    <div class="summary-card"><div class="label">Wavy Gets</div><div class="value">${rp(totalWavy)}</div></div>
    <div class="summary-card"><div class="label">Bagian Mitra</div><div class="value">${rp(totalOwner)}</div></div>
    <div class="summary-card"><div class="label">Kas Pendapatan</div><div class="value">${rp(cashSummary.pendapatan)}</div></div>
    <div class="summary-card"><div class="label">Kas Modal Tanam</div><div class="value">${rp(cashSummary.modal)}</div></div>
    <div class="summary-card"><div class="label">Kas Ganti Rugi</div><div class="value">${rp(cashSummary.ganti_rugi)}</div></div>
    <div class="summary-card"><div class="label">Total Saldo Rekening</div><div class="value">${rp(cashSummary.rekening)}</div></div>
  </div>
  <div class="section-title">Detail Transaksi Rental</div>
  <table><thead><tr>
    <th>Tanggal</th><th>Pelanggan</th><th>Motor</th><th class="right">Durasi</th>
    <th>Sumber Kas</th><th>Pembayaran</th><th class="right">Total</th><th class="right">Fee Vendor</th><th class="right">Wavy Gets</th><th class="right">Bagian Mitra</th>
  </tr></thead><tbody>${rowsHtml || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#888">Tidak ada data</td></tr>'}</tbody></table>
  ${footerHtml()}`
}
export function printMotorIncomeReport(args) { printWindow(buildMotorIncomeHtml(args)) }

// ─── 3. Laporan Pengeluaran per Motor ──────────────────────────────────────
export function buildMotorExpensesHtml({ expenses, period, motorName }) {
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const cashSummary = calculateCashSummary(expenses, 'amount')
  const rowsHtml = expenses.map(e => `<tr>
    <td>${fmtDate(e.date)}</td>
    <td>${e.model ? e.model + ' <span style="color:#94a3b8">' + e.plate_number + '</span>' : '<span style="color:#94a3b8">Umum</span>'}</td>
    <td><span class="badge badge-orange">${e.type}</span></td>
    <td>${e.category}</td>
    <td>${e.description || '-'}</td>
    <td>${cashBucketLabel(e.cash_bucket)}</td>
    <td><span class="badge badge-blue">${paymentGroupLabel(e.payment_method, e.cash_bucket)}</span></td>
    <td class="right" style="color:#dc2626;font-weight:700">${rp(e.amount)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Pengeluaran per Motor', period, motorName || 'Semua Motor')}
  <div class="summary-grid" style="grid-template-columns:repeat(6,1fr)">
    <div class="summary-card"><div class="label">Total Pengeluaran</div><div class="value">${rp(total)}</div></div>
    <div class="summary-card"><div class="label">Jumlah Transaksi</div><div class="value">${expenses.length}x</div></div>
    <div class="summary-card"><div class="label">Kas Pendapatan</div><div class="value">${rp(cashSummary.pendapatan)}</div></div>
    <div class="summary-card"><div class="label">Kas Modal Tanam</div><div class="value">${rp(cashSummary.modal)}</div></div>
    <div class="summary-card"><div class="label">Kas Ganti Rugi</div><div class="value">${rp(cashSummary.ganti_rugi)}</div></div>
    <div class="summary-card"><div class="label">Total Saldo Rekening</div><div class="value">${rp(cashSummary.rekening)}</div></div>
  </div>
  <div class="section-title">Detail Pengeluaran</div>
  <table><thead><tr>
    <th>Tanggal</th><th>Motor</th><th>Tipe</th><th>Kategori</th><th>Keterangan</th><th>Sumber Kas</th><th>Pembayaran</th><th class="right">Jumlah</th>
  </tr></thead><tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">Tidak ada data</td></tr>'}</tbody></table>
  ${footerHtml()}`
}
export function printMotorExpensesReport(args) { printWindow(buildMotorExpensesHtml(args)) }

// ─── 4. Laporan Transaksi (Semua) ──────────────────────────────────────────
export function buildTransactionsHtml({ rentals, operationalExpenses, motorExpenses, journeys = [], period }) {
  const totalIn = rentals.filter(r => r.status !== 'refunded').reduce((s, r) => s + (r.amount || 0), 0)
  const totalOperational = operationalExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalMotor = motorExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const totalOut = totalOperational + totalMotor
  const rentalCash = calculateCashSummary(rentals, 'amount')
  const operationalCash = calculateCashSummary(operationalExpenses, 'amount')
  const motorCash = calculateCashSummary(motorExpenses, 'amount')
  const rentalRows = rentals.map(r => `<tr>
    <td>${fmtDateTime(r.date)}</td><td>Pemasukan</td>
    <td>${r.description}</td><td>${r.motor}</td>
    <td>${cashBucketLabel(r.cash_bucket)}</td>
    <td>${paymentGroupLabel(r.payment_method, r.cash_bucket)}</td>
    <td class="right">${rp(r.amount)}</td>
    <td>${r.status}</td>
  </tr>`).join('')
  const operationalRows = operationalExpenses.map(e => `<tr>
    <td>${fmtDate(e.date)}</td><td>Pengeluaran</td>
    <td>${e.description}</td><td>${e.motor}</td>
    <td>${cashBucketLabel(e.cash_bucket)}</td>
    <td>${paymentGroupLabel(e.payment_method, e.cash_bucket)}</td>
    <td class="right">${rp(e.amount)}</td>
    <td>-</td>
  </tr>`).join('')
  const motorRows = motorExpenses.map(e => `<tr>
    <td>${fmtDate(e.date)}</td><td>Pengeluaran Motor</td>
    <td>${e.description}</td><td>${e.motor}</td>
    <td>${cashBucketLabel(e.cash_bucket)}</td>
    <td>${paymentGroupLabel(e.payment_method, e.cash_bucket)}</td>
    <td class="right">${rp(e.amount)}</td>
    <td>-</td>
  </tr>`).join('')
  const journeyRows = journeys.map(j => `<tr>
    <td>${esc(j.root)}</td>
    <td>${(j.steps || []).map(step => `&rarr; ${esc(step)}`).join('<br>')}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan Semua Transaksi', period)}
  <div class="summary-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="summary-card"><div class="label">Total Pemasukan</div><div class="value">${rp(totalIn)}</div></div>
    <div class="summary-card"><div class="label">Pengeluaran Operasional</div><div class="value">${rp(totalOperational)}</div></div>
    <div class="summary-card"><div class="label">Pengeluaran Motor</div><div class="value">${rp(totalMotor)}</div></div>
    <div class="summary-card"><div class="label">Selisih</div><div class="value">${rp(totalIn - totalOut)}</div></div>
  </div>
  <div class="section-title">Pemasukan (Rental)</div>
  <div style="font-size:10px;color:#555;margin-bottom:6px">Kas Pendapatan: ${rp(rentalCash.pendapatan)} | Kas Modal Tanam: ${rp(rentalCash.modal)} | Kas Ganti Rugi: ${rp(rentalCash.ganti_rugi)} | Total Saldo Rekening: ${rp(rentalCash.rekening)}</div>
  <table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Pelanggan</th><th>Motor</th><th>Sumber Kas</th><th>Pembayaran</th><th class="right">Jumlah</th><th>Status</th></tr></thead>
  <tbody>${rentalRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">Tidak ada data</td></tr>'}</tbody></table>
  <div class="section-title">Jejak Ganti Unit</div>
  <table><thead><tr><th>Transaksi Awal</th><th>Riwayat</th></tr></thead>
  <tbody>${journeyRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:16px">Tidak ada data ganti unit</td></tr>'}</tbody></table>
  <div class="section-title">Pengeluaran Operasional</div>
  <div style="font-size:10px;color:#555;margin-bottom:6px">Kas Pendapatan: ${rp(operationalCash.pendapatan)} | Kas Modal Tanam: ${rp(operationalCash.modal)} | Kas Ganti Rugi: ${rp(operationalCash.ganti_rugi)} | Total Saldo Rekening: ${rp(operationalCash.rekening)}</div>
  <table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Motor</th><th>Sumber Kas</th><th>Pembayaran</th><th class="right">Jumlah</th><th>Status</th></tr></thead>
  <tbody>${operationalRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">Tidak ada data</td></tr>'}</tbody></table>
  <div class="section-title">Pengeluaran Motor</div>
  <div style="font-size:10px;color:#555;margin-bottom:6px">Kas Pendapatan: ${rp(motorCash.pendapatan)} | Kas Modal Tanam: ${rp(motorCash.modal)} | Kas Ganti Rugi: ${rp(motorCash.ganti_rugi)} | Total Saldo Rekening: ${rp(motorCash.rekening)}</div>
  <table><thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Motor</th><th>Sumber Kas</th><th>Pembayaran</th><th class="right">Jumlah</th><th>Status</th></tr></thead>
  <tbody>${motorRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px">Tidak ada data</td></tr>'}</tbody></table>
  ${footerHtml()}`
}
export function printTransactionsReport(args) { printWindow(buildTransactionsHtml(args)) }

// ─── 5. Laporan Hak Mitra (Slip Pembayaran) ─────────────────────────────
export function buildOwnerCommissionHtml({ data, period }) {
  const { owner = {}, motors = [], rentals = [], byMotor = [], totalOwnerGets = 0, totalExpenses = 0, totalNet = 0 } = data || {}
  const totalOwnedMotors = Array.isArray(motors) ? motors.length : 0
  const byDateAsc = (items, dateKey) => [...items].sort((a, b) => new Date(a?.[dateKey] || 0) - new Date(b?.[dateKey] || 0))
  const sumBy = (items, key) => items.reduce((sum, item) => sum + Number(item?.[key] || 0), 0)
  const rentalIncome = (item) => {
    if (item?.rental_income !== undefined && item?.rental_income !== null) {
      const explicitIncome = Number(item.rental_income)
      if (Number.isFinite(explicitIncome)) return explicitIncome
    }
    const splitTotal = Number(item?.wavy_gets || 0) + Number(item?.owner_gets || 0)
    if (Number(item?.sisa || 0) > 0) return Number(item.sisa || 0)
    if (splitTotal > 0) return splitTotal
    return Number(item?.total_price || 0) - Number(item?.vendor_fee || 0)
  }
  const sumIncome = (items) => items.reduce((sum, item) => sum + rentalIncome(item), 0)
  const motorLabel = (item) => `${esc(item?.model || '-')} ${esc(item?.plate_number || '')}`.trim()
  const regularRentals = byDateAsc(rentals.filter((r) => String(r.relation_type || 'rental') !== 'extend'), 'date_time')
  const extendRentals = byDateAsc(rentals.filter((r) => String(r.relation_type || 'rental') === 'extend'), 'date_time')
  const regularTotals = {
    total: sumIncome(regularRentals),
    rental: sumBy(regularRentals, 'wavy_gets'),
    mitra: sumBy(regularRentals, 'owner_gets')
  }
  const extendTotals = {
    total: sumIncome(extendRentals),
    rental: sumBy(extendRentals, 'wavy_gets'),
    mitra: sumBy(extendRentals, 'owner_gets')
  }
  const totalGlobalIncome = Number(data?.totalIncome ?? sumIncome(rentals))
  const totalRentalGets = sumBy(rentals, 'wavy_gets')
  const rentalShareBase = totalRentalGets + Number(totalOwnerGets || 0)
  const rentalSharePct = rentalShareBase > 0 ? Math.round((totalRentalGets / rentalShareBase) * 100) : 0
  const rentalShareLabel = rentalSharePct > 0 ? `Total Pendapatan Rental (${rentalSharePct}%)` : 'Total Pendapatan Rental'
  const expenseNote = (expense) => {
    const parts = [expense?.category, expense?.description]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
    const unique = parts.filter((part, index) =>
      parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index
    )
    return unique.length ? unique.join(' - ') : '-'
  }
  const regularRentalRows = regularRentals.map(r => `<tr>
    <td>${fmtDateTime(r.date_time)}</td>
    <td>${motorLabel(r)}</td>
    <td>${esc(r.customer_name || '-')}</td>
    <td class="right">${esc(r.period_days || 0)} hari</td>
    <td class="right">${rp(rentalIncome(r))}</td>
    <td class="right">${rp(r.wavy_gets)}</td>
    <td class="right">${rp(r.owner_gets)}</td>
  </tr>`).join('')
  const regularTotalRow = `<tr class="slip-total-row">
    <td colspan="4">Total Transaksi</td>
    <td class="right">${rp(regularTotals.total)}</td>
    <td class="right">${rp(regularTotals.rental)}</td>
    <td class="right">${rp(regularTotals.mitra)}</td>
  </tr>`
  const extendRentalRows = extendRentals.map(r => `<tr>
    <td>${fmtSlipDate(r.date_time)}</td>
    <td>${motorLabel(r)}</td>
    <td class="right">${rp(rentalIncome(r))}</td>
    <td class="right">${rp(r.wavy_gets)}</td>
    <td class="right">${rp(r.owner_gets)}</td>
  </tr>`).join('')
  const extendTotalRow = `<tr class="slip-total-row">
    <td colspan="2">Total Extension</td>
    <td class="right">${rp(extendTotals.total)}</td>
    <td class="right">${rp(extendTotals.rental)}</td>
    <td class="right">${rp(extendTotals.mitra)}</td>
  </tr>`
  const motorExpenseItems = byDateAsc(byMotor.flatMap(m => (m.expenses || []).map(e => ({
    ...e,
    model: e.model || m.model,
    plate_number: e.plate_number || m.plate_number
  }))), 'date')
  const motorExpenseRows = motorExpenseItems.map(e => `<tr>
    <td>${fmtSlipDate(e.date)}</td>
    <td>${motorLabel(e)}</td>
    <td>${esc(expenseNote(e))}</td>
    <td class="right">${rp(e.amount)}</td>
  </tr>`).join('')
  const noRegularRows = '<tr><td colspan="7" style="text-align:center;padding:16px;color:#888">Tidak ada data</td></tr>'
  const noExtendRows = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#888">Tidak ada data extension</td></tr>'
  const noExpenseRows = '<tr><td colspan="4" style="text-align:center;padding:16px;color:#888">Tidak ada pengeluaran kendaraan</td></tr>'

  return `${ownerSlipHeaderHtml(period)}
  <div class="slip-top">
    <div class="slip-box">
      <div class="slip-detail"><strong>Nama Pemilik</strong><span>: ${esc(owner.name || '-')}</span></div>
      <div class="slip-detail"><strong>Nomor Handphone</strong><span>: ${esc(owner.phone || '-')}</span></div>
      <div class="slip-detail"><strong>Jumlah Kendaraan</strong><span>: ${totalOwnedMotors} unit</span></div>
    </div>
    <div class="slip-summary">
      <div><div class="label">Jumlah Transaksi</div><div class="value">${rentals.length}x</div></div>
      <div><div class="label">Pendapatan Transaksi</div><div class="value">${rp(totalGlobalIncome)}</div></div>
      <div><div class="label">${rentalShareLabel}</div><div class="value">${rp(totalRentalGets)}</div></div>
      <div><div class="label">Pengeluaran Mitra</div><div class="value">${rp(totalExpenses)}</div></div>
      <div class="wide"><div class="label">Pendapatan Bersih Mitra</div><div class="value">${rp(totalNet)}</div></div>
    </div>
  </div>
  <div class="section-title">Rincian Transaksi</div>
  <table class="slip-table slip-transaction-table">
  <colgroup><col><col><col><col><col><col><col></colgroup>
  <thead><tr>
    <th>Tanggal</th><th>Model</th><th>Penyewa</th><th class="right">Durasi</th>
    <th class="right">Pendapatan</th><th class="right">Pendapatan Rental</th><th class="right">Pendapatan Mitra</th>
  </tr></thead><tbody>${regularRentalRows || noRegularRows}${regularTotalRow}</tbody></table>
  <div class="section-title">Rincian Transaksi Extension</div>
  <table class="slip-table slip-extension-table">
  <colgroup><col><col><col><col><col></colgroup>
  <thead><tr>
    <th>Tanggal</th><th>Model</th>
    <th class="right">Pendapatan</th><th class="right">Pendapatan Rental</th><th class="right">Pendapatan Mitra</th>
  </tr></thead><tbody>${extendRentalRows || noExtendRows}${extendTotalRow}</tbody></table>
  <div class="section-title">Pengeluaran Kendaraan</div>
  <table class="slip-table slip-expense-table">
    <colgroup><col><col><col><col></colgroup>
    <thead><tr><th>Tanggal</th><th>Model</th><th>Keterangan</th><th class="right">Jumlah</th></tr></thead>
    <tbody>
      ${motorExpenseRows || noExpenseRows}
      <tr class="slip-total-row"><td colspan="3">Total Pengeluaran</td><td class="right">( ${rp(totalExpenses)} )</td></tr>
    </tbody>
  </table>
  <div class="slip-sign-area"><div class="slip-sign-box">
    <div>Hormat kami,</div>
    <div class="slip-sign-name">The Wavy Rental</div>
  </div></div>
  `
}
export function printOwnerCommissionReport(args) { printWindow(buildOwnerCommissionHtml(args)) }

export function buildHotelCommissionHtml({ hotel, rentals = [], period }) {
  const totalCommission = rentals.reduce((sum, item) => sum + Number(item.vendor_fee || 0), 0)

  const rentalRows = rentals.map(r => `<tr>
    <td>${fmtDateTime(r.date_time)}</td>
    <td>${esc(r.customer_name)}</td>
    <td>${esc(r.model)} ${esc(r.plate_number)}</td>
    <td class="right">${esc(r.period_days)} hari</td>
    <td class="right">${rp(r.vendor_fee)}</td>
  </tr>`).join('')
  const noRentalRows = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#888">Tidak ada fee partner pada periode ini</td></tr>'
  const totalRow = `<tr class="slip-total-row"><td colspan="4">Total Pendapatan</td><td class="right">${rp(totalCommission)}</td></tr>`

  return `${ownerSlipHeaderHtml(period, 'SLIP FEE PARTNER')}
  <div style="display:flex;gap:20px;margin-bottom:20px">
    <div class="info-box" style="flex:1">
      <div class="info-label">Data Partner</div>
      <div class="info-name">${esc(hotel?.name || '-')}</div>
      <div class="info-detail">
        Telepon: ${esc(hotel?.phone || '-')}
      </div>
    </div>
	    <div style="flex:1">
	      <div class="summary-grid" style="grid-template-columns:repeat(2,1fr)">
	        <div class="summary-card"><div class="label">Jumlah Transaksi</div><div class="value">${rentals.length}x</div></div>
	        <div class="summary-card"><div class="label">Total Pendapatan</div><div class="value">${rp(totalCommission)}</div></div>
	      </div>
	    </div>
	  </div>
	  <div class="section-title">Rincian Fee Partner</div>
	  <table class="slip-table slip-vendor-table">
      <colgroup><col><col><col><col><col></colgroup>
      <thead><tr>
	    <th>Tanggal</th><th>Pelanggan</th><th>Motor</th><th class="right">Durasi</th>
	    <th class="right">Fee Partner</th>
	  </tr></thead><tbody>${rentalRows || noRentalRows}${totalRow}</tbody></table>
	  <div class="slip-sign-area"><div class="slip-sign-box">
	    <div>Hormat kami,</div>
	    <div class="slip-sign-name">The Wavy Rental</div>
	  </div></div>
	  `
}

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
export function buildBalanceSheetHtml({ data, period }) {
  const assetRows = data.assets.current.map(row => `<tr><td>${row.label}</td><td class="right">${rp(row.amount)}</td></tr>`).join('')
  const liabilityRows = data.liabilities.current.map(row => `<tr><td>${row.label}</td><td class="right">${rp(row.amount)}</td></tr>`).join('')
  const equityRows = data.equity.rows.map(row => `<tr><td>${row.label}</td><td class="right">${rp(row.amount)}</td></tr>`).join('')

  return `${headerHtml('Laporan Neraca', period, 'Posisi keuangan per ' + fmtDate(data.asOfDate))}
  <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="summary-card"><div class="label">Total Aset</div><div class="value">${rp(data.totals.assets)}</div></div>
    <div class="summary-card"><div class="label">Total Kewajiban</div><div class="value">${rp(data.totals.liabilities)}</div></div>
    <div class="summary-card"><div class="label">Total Ekuitas</div><div class="value">${rp(data.totals.equity)}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div>
      <div class="section-title">Aset</div>
      <table><thead><tr><th>Keterangan</th><th class="right">Jumlah</th></tr></thead><tbody>
        ${assetRows || '<tr><td colspan="2" style="text-align:center;padding:16px;color:#888">Tidak ada data</td></tr>'}
        <tr style="font-weight:700;border-top:2px solid #111;background:#f9f9f9"><td>TOTAL ASET</td><td class="right">${rp(data.assets.total)}</td></tr>
      </tbody></table>
    </div>
    <div>
      <div class="section-title">Kewajiban & Ekuitas</div>
      <table><thead><tr><th>Keterangan</th><th class="right">Jumlah</th></tr></thead><tbody>
        <tr style="background:#f1f5f9"><td colspan="2" style="font-weight:700;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px">Kewajiban</td></tr>
        ${liabilityRows || '<tr><td colspan="2" style="text-align:center;padding:16px;color:#888">Tidak ada data</td></tr>'}
        <tr style="font-weight:700"><td>Total Kewajiban</td><td class="right">${rp(data.liabilities.total)}</td></tr>
        <tr style="background:#f1f5f9"><td colspan="2" style="font-weight:700;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px">Ekuitas</td></tr>
        ${equityRows}
        <tr style="font-weight:700"><td>Total Ekuitas</td><td class="right">${rp(data.equity.total)}</td></tr>
        <tr style="font-weight:700;border-top:2px solid #111;background:#f9f9f9"><td>TOTAL KEWAJIBAN + EKUITAS</td><td class="right">${rp(data.totals.liabilitiesAndEquity)}</td></tr>
      </tbody></table>
    </div>
  </div>
  ${footerHtml()}`
}
export function printBalanceSheetReport(args) { printWindow(buildBalanceSheetHtml(args)) }

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
    <td class="right">${o.motor_count}</td>
    <td class="right">${o.rental_count}x</td>
    <td class="right">${rp(o.total_omzet)}</td>
    <td class="right">${rp(o.gross_commission)}</td>
    <td class="right">${rp(o.total_expenses)}</td>
    <td class="right" style="font-weight:700">${rp(o.gross_commission - o.total_expenses)}</td>
  </tr>`).join('')
  return `${headerHtml('Laporan per Mitra', period)}
  <table><thead><tr>
    <th>Mitra</th><th class="right">Motor</th><th class="right">Rental</th>
    <th class="right">Omzet</th><th class="right">Hak Mitra Kotor</th><th class="right">Pengeluaran</th><th class="right">Hak Mitra Bersih</th>
  </tr></thead><tbody>
    ${rowsHtml}
    <tr style="font-weight:700;border-top:2px solid #111;background:#f9f9f9">
      <td colspan="3">TOTAL (${rows.length} mitra)</td>
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
<th class="right">Wavy Gets</th><th class="right">Bagian Mitra</th>
  </tr></thead><tbody>
    ${rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888">Tidak ada data</td></tr>'}
  </tbody></table>
  ${footerHtml()}`
}
