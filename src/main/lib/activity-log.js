import { dbOps } from '../db'

let currentActor = null

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
}
