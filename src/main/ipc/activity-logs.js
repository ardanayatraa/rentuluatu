import { ipcMain } from 'electron'
import { dbOps } from '../db'

function clampLimit(value) {
  const parsed = Number(value) || 100
  return Math.max(1, Math.min(300, parsed))
}

export function registerActivityLogHandlers() {
  ipcMain.handle('logs:get-activities', (_, filters = {}) => {
    const where = []
    const params = []

    if (filters?.dateFrom) {
      where.push('date(created_at) >= date(?)')
      params.push(String(filters.dateFrom))
    }
    if (filters?.dateTo) {
      where.push('date(created_at) <= date(?)')
      params.push(String(filters.dateTo))
    }
    if (filters?.search) {
      const term = `%${String(filters.search).trim()}%`
      if (term !== '%%') {
        where.push('(actor_username LIKE ? OR action LIKE ? OR detail LIKE ?)')
        params.push(term, term, term)
      }
    }
    if (filters?.source) {
      where.push('source = ?')
      params.push(String(filters.source).trim().toLowerCase())
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const limit = clampLimit(filters?.limit)
    params.push(limit)

    return dbOps.all(
      `SELECT id, actor_user_id, actor_username, source, action, detail, metadata, created_at
       FROM activity_logs
       ${whereSql}
       ORDER BY id DESC
       LIMIT ?`,
      params
    )
  })
}
