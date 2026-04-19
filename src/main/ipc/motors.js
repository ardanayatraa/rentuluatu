import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { logActivity } from '../lib/activity-log'

export function registerMotorHandlers() {
  const ownerLabelForAsetPt = 'Owner Pribadi (PT)'
  const isAsetPtType = (t) => String(t || '').toLowerCase() === 'aset_pt' || String(t || '').toLowerCase() === 'pribadi'

  ipcMain.handle('motor:get-all', () => {
    const cols = dbOps.all("PRAGMA table_info(motors)")
    const hasIsActive = cols.some(c => c.name === 'is_active')
    const whereClause = hasIsActive ? 'WHERE (m.is_active = 1 OR m.is_active IS NULL)' : ''
    const isActiveSelect = hasIsActive ? 'm.is_active,' : 'NULL as is_active,'
    return dbOps.all(`
      SELECT
        m.id,
        m.model,
        m.plate_number,
        m.type,
        m.owner_id,
        ${isActiveSelect}
        m.created_at,
        o.name as owner_name
      FROM motors m
      LEFT JOIN owners o ON m.owner_id = o.id
      ${whereClause}
      ORDER BY m.model ASC
    `)
  })

  ipcMain.handle('motor:get-by-id', (_, id) => {
    const cols = dbOps.all("PRAGMA table_info(motors)")
    const hasIsActive = cols.some(c => c.name === 'is_active')
    const isActiveSelect = hasIsActive ? 'm.is_active,' : 'NULL as is_active,'
    return dbOps.get(`
      SELECT
        m.id,
        m.model,
        m.plate_number,
        m.type,
        m.owner_id,
        ${isActiveSelect}
        m.created_at,
        o.name as owner_name
      FROM motors m
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.id = ?
    `, [id])
  })

  ipcMain.handle('motor:create', (_, data) => {
    const ownerId = data.owner_id ? Number(data.owner_id) : null
    const cols = dbOps.all("PRAGMA table_info(motors)")
    const hasIsActive = cols.some(c => c.name === 'is_active')

    if (!ownerId && !isAsetPtType(data.type)) {
      throw new Error('Pemilik motor wajib dipilih.')
    }

    if (hasIsActive) {
      dbOps.runRaw(
        'INSERT INTO motors (model, plate_number, type, owner_id, is_active) VALUES (?, ?, ?, ?, 1)',
        [data.model, data.plate_number, data.type, ownerId]
      )
    } else {
      dbOps.runRaw(
        'INSERT INTO motors (model, plate_number, type, owner_id) VALUES (?, ?, ?, ?)',
        [data.model, data.plate_number, data.type, ownerId]
      )
    }
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    saveDb()
    logActivity({
      source: 'user',
      action: 'motor.create',
      detail: `Tambah motor ${data.model} (${data.plate_number})`
    })
    return { id: row.id }
  })

  ipcMain.handle('motor:update', (_, { id, ...data }) => {
    const ownerId = data.owner_id ? Number(data.owner_id) : null
    if (!ownerId && !isAsetPtType(data.type)) {
      throw new Error('Pemilik motor wajib dipilih.')
    }
    dbOps.run(
      'UPDATE motors SET model=?, plate_number=?, type=?, owner_id=? WHERE id=?',
      [data.model, data.plate_number, data.type, ownerId, id]
    )
    logActivity({
      source: 'user',
      action: 'motor.update',
      detail: `Update motor #${id} menjadi ${data.model} (${data.plate_number})`
    })
    return { success: true }
  })

  ipcMain.handle('motor:delete', (_, id) => {
    const hasRentals = dbOps.get('SELECT id FROM rentals WHERE motor_id = ? LIMIT 1', [id])
    if (hasRentals) {
      const cols = dbOps.all("PRAGMA table_info(motors)")
      const hasIsActive = cols.some(c => c.name === 'is_active')
      if (hasIsActive) {
        dbOps.run('UPDATE motors SET is_active = 0 WHERE id = ?', [id])
      } else {
        throw new Error('Motor tidak bisa dihapus karena memiliki riwayat sewa.')
      }
      logActivity({
        source: 'user',
        action: 'motor.soft-delete',
        detail: `Nonaktifkan motor #${id} karena memiliki riwayat transaksi`
      })
    } else {
      dbOps.run('DELETE FROM motors WHERE id = ?', [id])
      logActivity({
        source: 'user',
        action: 'motor.delete',
        detail: `Hapus motor #${id}`
      })
    }
    return { success: true }
  })
}
