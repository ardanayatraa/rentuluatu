import { dbOps } from '../db'

let currentActor = null
let insertsSincePrune = 0

const LOG_RETENTION_DAYS = 120
const LOG_MAX_ROWS = 50000
const LOG_PRUNE_INTERVAL = 50

export function setCurrentActor(user) {
  if (!user || !user.username) {
    currentActor = null
    return
  }
  currentActor = {
    id: Number(user.id) || null,
    username: String(user.username)
  }
}

export function clearCurrentActor() {
  currentActor = null
}

function normalizeActor(actorOverride) {
  const actor = actorOverride || currentActor
  if (!actor || !actor.username) {
    return { id: null, username: 'guest' }
  }
  return {
    id: Number(actor.id) || null,
    username: String(actor.username)
  }
}

function pruneActivityLogs() {
  dbOps.run(
    "DELETE FROM activity_logs WHERE created_at < datetime('now', ?)",
    [`-${LOG_RETENTION_DAYS} days`]
  )

  const stat = dbOps.get('SELECT COUNT(*) as total, MAX(id) as maxId FROM activity_logs')
  const total = Number(stat?.total || 0)
  const maxId = Number(stat?.maxId || 0)
  if (total <= LOG_MAX_ROWS || maxId <= 0) return

  const cutoffId = maxId - LOG_MAX_ROWS
  dbOps.run('DELETE FROM activity_logs WHERE id <= ?', [cutoffId])
}

export function logActivity({ action, detail = '', metadata = null, actor = null, source = 'system' }) {
  if (!action) return
  const normalized = normalizeActor(actor)
  const normalizedSource = String(source || 'system').trim().toLowerCase() === 'user' ? 'user' : 'system'
  let metadataText = null
  if (metadata && typeof metadata === 'object') {
    try {
      metadataText = JSON.stringify(metadata)
    } catch {
      metadataText = null
    }
  }

  dbOps.run(
    `INSERT INTO activity_logs (actor_user_id, actor_username, source, action, detail, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [normalized.id, normalized.username, normalizedSource, String(action), String(detail || ''), metadataText]
  )

  insertsSincePrune += 1
  if (insertsSincePrune >= LOG_PRUNE_INTERVAL) {
    insertsSincePrune = 0
    pruneActivityLogs()
  }
}
