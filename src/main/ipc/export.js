import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import ExcelJS from 'exceljs'

// ── PDF via printToPDF ────────────────────────────────────────────────────────
ipcMain.handle('export:save-pdf', async (_, { html, defaultName }) => {
  const win = BrowserWindow.getFocusedWindow()

  // Dialog simpan
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Simpan Laporan PDF',
    defaultPath: defaultName || 'laporan.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return { success: false }

  // Buat hidden window untuk render HTML → PDF
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  
  // Load HTML via data URL agar style ter-render dengan benar
  await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  
  // Tunggu sebentar agar render selesai
  await new Promise(r => setTimeout(r, 800))

  const pdfBuffer = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    landscape: false,
    margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
  })
  pdfWin.destroy()

  writeFileSync(filePath, pdfBuffer)
  return { success: true, filePath }
})

// ── Excel export ──────────────────────────────────────────────────────────────
ipcMain.handle('export:save-excel', async (_, { sheets, defaultName }) => {
  const win = BrowserWindow.getFocusedWindow()

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Simpan Laporan Excel',
    defaultPath: defaultName || 'laporan.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { success: false }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Wavy CashFlow Monitoring'
  workbook.created = new Date()

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name)

    // Header style
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }

    // Columns
    ws.columns = sheet.columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }))

    // Style header row
    ws.getRow(1).eachCell(cell => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF0284C7' } } }
    })
    ws.getRow(1).height = 28

    // Data rows
    for (const row of sheet.rows) {
      const added = ws.addRow(row)
      added.eachCell(cell => {
        cell.alignment = { vertical: 'middle' }
        // Format angka Rupiah
        if (typeof cell.value === 'number' && sheet.currencyKeys?.includes(
          sheet.columns[cell._column._number - 1]?.key
        )) {
          cell.numFmt = '"Rp "#,##0'
        }
      })
    }

    // Totals row jika ada
    if (sheet.totals) {
      const totalRow = ws.addRow(sheet.totals)
      totalRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
        if (typeof cell.value === 'number' && sheet.currencyKeys?.includes(
          sheet.columns[cell._column._number - 1]?.key
        )) {
          cell.numFmt = '"Rp "#,##0'
        }
      })
    }

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  writeFileSync(filePath, buffer)
  return { success: true, filePath }
})
