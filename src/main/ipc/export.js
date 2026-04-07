import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import { basename, extname, join } from 'path'
import { existsSync, statSync, unlinkSync, writeFileSync } from 'fs'
import ExcelJS from 'exceljs'
import { dbOps } from '../db'

function getWindowIconPath() {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  return candidates.find(path => existsSync(path))
}

function inferFileType(filePath, fallbackType = '') {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (ext === '.xlsx') return 'excel'
  return fallbackType || ext.replace('.', '') || 'file'
}

function inferReportName(defaultName = '') {
  return String(defaultName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function recordDownload(filePath, defaultName, explicitType = '') {
  const stats = statSync(filePath)
  dbOps.run(
    `INSERT INTO downloads (file_name, file_path, file_type, report_name, file_size)
     VALUES (?, ?, ?, ?, ?)`,
    [
      basename(filePath),
      filePath,
      inferFileType(filePath, explicitType),
      inferReportName(defaultName),
      Number(stats.size || 0)
    ]
  )
}

async function waitForPdfDocumentReady(webContents) {
  await webContents.executeJavaScript(`
    new Promise((resolve) => {
      const finish = async () => {
        try {
          if (document.fonts?.ready) await document.fonts.ready
        } catch {}

        const images = Array.from(document.images || [])
        await Promise.all(images.map(img => {
          if (img.complete) return Promise.resolve()
          return new Promise(res => {
            img.addEventListener('load', res, { once: true })
            img.addEventListener('error', res, { once: true })
          })
        }))

        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))
        resolve(true)
      }

      if (document.readyState === 'complete') {
        finish()
      } else {
        window.addEventListener('load', finish, { once: true })
      }
    })
  `)
}

async function printToPdfWithRetry(webContents, options) {
  try {
    return await webContents.printToPDF(options)
  } catch (error) {
    await new Promise(resolve => setTimeout(resolve, 350))
    try {
      return await webContents.printToPDF(options)
    } catch {
      throw new Error(`Failed to generate PDF: ${error?.message || error}`)
    }
  }
}

async function renderPdfBuffer(html, documentTitle = 'Laporan_Wavy.pdf') {
  const pdfWin = new BrowserWindow({
    show: false,
    icon: getWindowIconPath(),
    webPreferences: { sandbox: false }
  })
  const tempHtmlPath = join(app.getPath('temp'), `${Date.now()}_${Math.random().toString(36).slice(2)}.html`)

  try {
    writeFileSync(tempHtmlPath, html, 'utf-8')
    await pdfWin.loadFile(tempHtmlPath)
    await pdfWin.webContents.executeJavaScript(`document.title = ${JSON.stringify(documentTitle)}`)
    await waitForPdfDocumentReady(pdfWin.webContents)

    return await printToPdfWithRetry(pdfWin.webContents, {
      printBackground: true,
      pageSize: 'A4',
      landscape: false,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;padding:0 10mm;font-size:8px;color:#64748b;display:flex;justify-content:flex-end;">
          Halaman&nbsp;<span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span>
        </div>
      `,
      margins: { top: 0.45, bottom: 0.7, left: 0.45, right: 0.45 }
    })
  } finally {
    if (existsSync(tempHtmlPath)) {
      try { unlinkSync(tempHtmlPath) } catch {}
    }
    if (!pdfWin.isDestroyed()) pdfWin.destroy()
  }
}

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

  const pdfBuffer = await renderPdfBuffer(html, defaultName || 'Laporan_Wavy.pdf')
  writeFileSync(filePath, pdfBuffer)
  recordDownload(filePath, defaultName, 'pdf')
  return { success: true, filePath }
})

ipcMain.handle('export:preview-pdf', async (_, { html }) => {
  const pdfBuffer = await renderPdfBuffer(html)
  return {
    success: true,
    base64: pdfBuffer.toString('base64')
  }
})

ipcMain.handle('export:preview-pdf-window', async (_, { html, defaultName }) => {
  const pdfBuffer = await renderPdfBuffer(html, defaultName || 'Preview_Laporan.pdf')
  const safeName = String(defaultName || 'Preview_Laporan.pdf').replace(/[<>:"/\\|?*]+/g, '_')
  const tempPath = join(app.getPath('temp'), `${Date.now()}_${safeName}`)
  writeFileSync(tempPath, pdfBuffer)

  const previewWin = new BrowserWindow({
    width: 1100,
    height: 820,
    autoHideMenuBar: false,
    icon: getWindowIconPath(),
    webPreferences: { sandbox: false }
  })

  const previewSession = previewWin.webContents.session
  const recordedPaths = new Set()

  previewWin.on('closed', () => {
    previewSession.removeListener('will-download', handlePreviewDownload)
    if (existsSync(tempPath)) {
      try { unlinkSync(tempPath) } catch {}
    }
  })

  function handlePreviewDownload(event, item) {
    item.on('done', (_, state) => {
      if (state !== 'completed') return
      const savePath = item.getSavePath()
      if (!savePath || !existsSync(savePath) || recordedPaths.has(savePath)) return
      recordedPaths.add(savePath)

      const url = String(item.getURL() || '')
      const fileName = String(item.getFilename() || '')
      const isPdfDownload = fileName.toLowerCase().endsWith('.pdf')
        || savePath.toLowerCase().endsWith('.pdf')
        || url.toLowerCase().endsWith('.pdf')

      if (!isPdfDownload) return
      recordDownload(savePath, fileName || safeName, 'pdf')
    })
  }

  previewSession.on('will-download', handlePreviewDownload)
  previewWin.setTitle(safeName)
  await previewWin.loadFile(tempPath)
  previewWin.setTitle(safeName)
  return { success: true }
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
  recordDownload(filePath, defaultName, 'excel')
  return { success: true, filePath }
})

ipcMain.handle('downloads:list', () => {
  const rows = dbOps.all(`
    SELECT id, file_name, file_path, file_type, report_name, file_size, created_at
    FROM downloads
    ORDER BY datetime(created_at) DESC, id DESC
  `)

  return rows.map(row => ({
    ...row,
    exists: existsSync(row.file_path)
  }))
})

ipcMain.handle('downloads:open', async (_, id) => {
  const download = dbOps.get('SELECT * FROM downloads WHERE id = ?', [id])
  if (!download) throw new Error('File unduhan tidak ditemukan')
  if (!existsSync(download.file_path)) throw new Error('File sudah tidak ada di lokasi penyimpanan')

  const errorMessage = await shell.openPath(download.file_path)
  if (errorMessage) throw new Error(errorMessage)
  return { success: true }
})

ipcMain.handle('downloads:show-in-folder', (_, id) => {
  const download = dbOps.get('SELECT * FROM downloads WHERE id = ?', [id])
  if (!download) throw new Error('File unduhan tidak ditemukan')
  if (!existsSync(download.file_path)) throw new Error('File sudah tidak ada di lokasi penyimpanan')

  shell.showItemInFolder(download.file_path)
  return { success: true }
})

ipcMain.handle('downloads:delete-record', (_, id) => {
  dbOps.run('DELETE FROM downloads WHERE id = ?', [id])
  return { success: true }
})

ipcMain.handle('downloads:delete-file', (_, id) => {
  const download = dbOps.get('SELECT * FROM downloads WHERE id = ?', [id])
  if (!download) throw new Error('File unduhan tidak ditemukan')

  if (existsSync(download.file_path)) {
    unlinkSync(download.file_path)
  }
  dbOps.run('DELETE FROM downloads WHERE id = ?', [id])
  return { success: true }
})
