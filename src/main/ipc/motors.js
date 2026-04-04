import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerMotorHandlers() {
  ipcMain.handle('motor:get-all', () => {
    return dbOps.all(`
      SELECT m.*, o.name as owner_name
      FROM motors m
      LEFT JOIN owners o ON m.owner_id = o.id
      ORDER BY m.model ASC
    `)
  })

  ipcMain.handle('motor:get-by-id', (_, id) => {
    return dbOps.get(`
      SELECT m.*, o.name as owner_name
      FROM motors m
      LEFT JOIN owners o ON m.owner_id = o.id
      WHERE m.id = ?
    `, [id])
  })

  ipcMain.handle('motor:create', (_, data) => {
    dbOps.run(
      'INSERT INTO motors (model, plate_number, type, owner_id) VALUES (?, ?, ?, ?)',
      [data.model, data.plate_number, data.type, data.owner_id || null]
    )
    const row = dbOps.get('SELECT last_insert_rowid() as id')
    return { id: row.id }
  })

  ipcMain.handle('motor:update', (_, { id, ...data }) => {
    dbOps.run(
      'UPDATE motors SET model=?, plate_number=?, type=?, owner_id=? WHERE id=?',
      [data.model, data.plate_number, data.type, data.owner_id || null, id]
    )
    return { success: true }
  })

  ipcMain.handle('motor:delete', (_, id) => {
    dbOps.run('DELETE FROM motors WHERE id = ?', [id])
    return { success: true }
  })
}
