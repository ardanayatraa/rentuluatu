import { ipcMain, dialog } from 'electron'
import ExcelJS from 'exceljs'
import { dbOps, saveDb } from '../db'

function normalizePlate(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function plateKey(input) {
  return normalizePlate(input).replace(/\s+/g, '')
}

function normalizeNameKey(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function parseVehiclesXlsx(filePath) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)

  const ws = wb.getWorksheet('ALL VEHICLES') || wb.worksheets[0]
  if (!ws) throw new Error('Sheet Excel tidak ditemukan')

  // Cari baris header (format lama atau format baru yang punya kolom STATUS).
  let headerRowIndex = null
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    const row = ws.getRow(r)
    const c1 = String(row.getCell(1).value ?? '').trim().toUpperCase()
    const c2 = String(row.getCell(2).value ?? '').trim().toUpperCase()
    const c3 = String(row.getCell(3).value ?? '').trim().toUpperCase()
    const c6 = String(row.getCell(6).value ?? '').trim().toUpperCase()
    // Format baru:
    // NO | STATUS | PEMILIK | NAMA KENDARAAN | WARNA | NO KENDARAAN | KET
    if (c1 === 'NO' && c2 === 'STATUS' && c3.includes('PEMILIK') && c6.includes('KENDARAAN')) {
      headerRowIndex = r
      break
    }
    // Format lama:
    // NO | OWNER | NAMA KENDARAAN | WARNA | NO KENDARAAN
    const c5 = String(row.getCell(5).value ?? '').trim().toUpperCase()
    if (c1 === 'NO' && c2 === 'OWNER' && c3.includes('KENDARAAN') && c5.includes('KENDARAAN')) {
      headerRowIndex = r
      break
    }
  }
  if (!headerRowIndex) throw new Error('Format Excel tidak dikenali (header tidak ditemukan)')

  // Detect format berdasarkan header row
  const headerRow = ws.getRow(headerRowIndex)
  const h2 = String(headerRow.getCell(2).value ?? '').trim().toUpperCase()
  const isNewFormat = h2 === 'STATUS'

  const records = []
  for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const no = String(row.getCell(1).value ?? '').trim()
    const status = isNewFormat ? String(row.getCell(2).value ?? '').trim() : ''
    const owner = isNewFormat ? String(row.getCell(3).value ?? '').trim() : String(row.getCell(2).value ?? '').trim()
    const model = isNewFormat ? String(row.getCell(4).value ?? '').trim() : String(row.getCell(3).value ?? '').trim()
    const plate = isNewFormat ? String(row.getCell(6).value ?? '').trim() : String(row.getCell(5).value ?? '').trim()

    // Stop jika sudah benar-benar kosong (biasanya footer)
    if (!no && !owner && !model && !plate) continue
    if (!plate) continue

    records.push({
      status,
      owner_name: owner,
      model,
      plate_number: normalizePlate(plate)
    })
  }

  if (!records.length) throw new Error('Tidak ada data kendaraan yang bisa diimport dari Excel')
  return records
}

export function registerImportHandlers() {
  ipcMain.handle('import:vehicles-from-xlsx', async (_, { path } = {}) => {
    let filePath = path
    if (!filePath) {
      const picked = await dialog.showOpenDialog({
        title: 'Pilih File Excel Kendaraan',
        properties: ['openFile'],
        filters: [
          { name: 'Excel', extensions: ['xlsx'] }
        ]
      })
      if (picked.canceled || !picked.filePaths?.length) return { canceled: true }
      filePath = picked.filePaths[0]
    }

    const rows = await parseVehiclesXlsx(filePath)

    const ownerCache = new Map() // nameKey -> ownerId
    const summary = {
      file: filePath,
      total_rows: rows.length,
      owners_created: 0,
      owners_skipped: 0,
      motors_created: 0,
      motors_updated: 0,
      motors_skipped: 0,
      warnings: []
    }

    dbOps.runRaw('BEGIN TRANSACTION')
    try {
      for (const row of rows) {
        const ownerName = String(row.owner_name || '').trim()
        const model = String(row.model || '').trim()
        const plate = normalizePlate(row.plate_number)
        const statusRaw = String(row.status || '').trim().toLowerCase()
        const motorType = statusRaw.includes('pribadi') ? 'aset_pt' : statusRaw.includes('titip') ? 'milik_pemilik' : 'milik_pemilik'
        const isAsetPt = motorType === 'aset_pt'

        if (!plate) {
          summary.motors_skipped++
          continue
        }

        let ownerId = null
        if (!isAsetPt) {
          if (!ownerName) {
            summary.warnings.push(`Plat ${plate}: pemilik kosong, dilewati`)
            summary.motors_skipped++
            continue
          }

          const ownerKey = normalizeNameKey(ownerName)
          ownerId = ownerCache.get(ownerKey)
          if (!ownerId) {
            const existingOwner = dbOps.get(
              "SELECT id FROM owners WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
              [ownerName]
            )
            if (existingOwner?.id) {
              ownerId = Number(existingOwner.id)
              summary.owners_skipped++
            } else {
              dbOps.runRaw('INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)', [
                ownerName,
                null,
                null,
                null
              ])
              ownerId = Number(dbOps.get('SELECT last_insert_rowid() as id')?.id || 0)
              summary.owners_created++
            }
            ownerCache.set(ownerKey, ownerId)
          }
        }

        const key = plateKey(plate)
        const existingMotor = dbOps.get(
          "SELECT id, owner_id, type FROM motors WHERE UPPER(REPLACE(plate_number,' ','')) = ? LIMIT 1",
          [key]
        )

        if (!existingMotor?.id) {
          dbOps.runRaw(
            'INSERT INTO motors (model, plate_number, type, owner_id) VALUES (?, ?, ?, ?)',
            [model || plate, plate, motorType, isAsetPt ? null : ownerId]
          )
          summary.motors_created++
          continue
        }

        // Jika format Excel menyatakan Aset PT, pastikan owner_id NULL dan type sesuai.
        if (isAsetPt) {
          const existingType = String(existingMotor.type || '').toLowerCase()
          const hasOwner = Boolean(existingMotor.owner_id)
          if (existingType !== 'aset_pt' || hasOwner) {
            dbOps.runRaw('UPDATE motors SET owner_id = NULL, type = ? WHERE id = ?', [
              'aset_pt',
              existingMotor.id
            ])
            summary.motors_updated++
          } else {
            summary.motors_skipped++
          }
          continue
        }

        // Jika motor sudah ada tapi belum punya pemilik, kita isi.
        if (!existingMotor.owner_id) {
          dbOps.runRaw('UPDATE motors SET owner_id = ?, type = ? WHERE id = ?', [
            ownerId,
            motorType,
            existingMotor.id
          ])
          summary.motors_updated++
        } else {
          summary.motors_skipped++
        }
      }

      dbOps.runRaw('COMMIT')
      saveDb()
      return { success: true, ...summary }
    } catch (e) {
      dbOps.runRaw('ROLLBACK')
      throw e
    }
  })
}
