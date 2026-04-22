import { ipcMain } from 'electron'
import { dbOps } from '../db'
import { clearCurrentActor, logActivity, setCurrentActor } from '../lib/activity-log'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    try {
      const user = dbOps.get('SELECT * FROM users WHERE username = ?', [username])
      if (!user) {
        clearCurrentActor()
        logActivity({
          action: 'auth.login.failed',
          detail: `Login gagal: username "${username}" tidak ditemukan`,
          actor: { id: null, username: 'guest' },
          source: 'user'
        })
        return { success: false, message: 'Username tidak ditemukan' }
      }

      let valid = false
      if (user.password_hash === '$2b$10$placeholder') {
        valid = String(password || '').trim().length === 0
        if (!valid) {
          clearCurrentActor()
          logActivity({
            action: 'auth.login.failed',
            detail: `Login gagal untuk "${username}" (setup awal wajib kode akses kosong)`,
            actor: { id: null, username: 'guest' },
            source: 'user'
          })
          return { success: false, message: 'Login pertama: kosongkan kode akses, lalu buat password baru.' }
        }
      } else if (user.password_hash.startsWith('$2')) {
        try {
          const bcrypt = await import('bcryptjs')
          valid = await bcrypt.default.compare(password, user.password_hash)
        } catch {
          valid = false
        }
      } else {
        valid = user.password_hash === password
      }

      if (!valid) {
        clearCurrentActor()
        logActivity({
          action: 'auth.login.failed',
          detail: `Login gagal untuk "${username}" (kode akses salah)`,
          actor: { id: null, username: 'guest' },
          source: 'user'
        })
        return { success: false, message: 'Kode akses salah' }
      }

      const authUser = { id: user.id, username: user.username }
      setCurrentActor(authUser)
      logActivity({
        action: 'auth.login.success',
        detail: `Login berhasil oleh ${authUser.username}`,
        actor: authUser,
        source: 'user'
      })
      return { success: true, user: authUser }
    } catch (e) {
      clearCurrentActor()
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('auth:set-initial-password', async (_, { userId, newPassword }) => {
    const user = dbOps.get('SELECT * FROM users WHERE id = ?', [userId])
    if (!user) return { success: false, message: 'User tidak ditemukan' }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'Password minimal 4 karakter' }
    }
    let newHash = newPassword
    try {
      const bcrypt = await import('bcryptjs')
      newHash = await bcrypt.default.hash(newPassword, 10)
    } catch {
      newHash = newPassword
    }
    dbOps.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])
    logActivity({
      action: 'auth.set-initial-password',
      detail: `Setup password awal untuk user ${user.username}`,
      actor: { id: user.id, username: user.username },
      source: 'user'
    })
    return { success: true }
  })

  ipcMain.handle('auth:change-password', async (_, { userId, oldPassword, newPassword }) => {
    const user = dbOps.get('SELECT * FROM users WHERE id = ?', [userId])
    if (!user) return { success: false, message: 'User tidak ditemukan' }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'Password baru minimal 4 karakter' }
    }

    let valid = false
    if (user.password_hash === '$2b$10$placeholder') {
      valid = true
    } else if (user.password_hash.startsWith('$2')) {
      try {
        const bcrypt = await import('bcryptjs')
        valid = await bcrypt.default.compare(oldPassword, user.password_hash)
      } catch {
        valid = false
      }
    } else {
      valid = user.password_hash === oldPassword
    }

    if (!valid) {
      logActivity({
        action: 'auth.change-password.failed',
        detail: `Gagal ganti password untuk user ${user.username} (password lama salah)`,
        actor: { id: user.id, username: user.username },
        source: 'user'
      })
      return { success: false, message: 'Password lama salah' }
    }

    let newHash = newPassword
    try {
      const bcrypt = await import('bcryptjs')
      newHash = await bcrypt.default.hash(newPassword, 10)
    } catch {
      newHash = newPassword
    }

    dbOps.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])
    logActivity({
      action: 'auth.change-password.success',
      detail: `Password berhasil diubah oleh ${user.username}`,
      actor: { id: user.id, username: user.username },
      source: 'user'
    })
    return { success: true }
  })

  ipcMain.handle('auth:set-active-user', (_, user) => {
    setCurrentActor(user)
    return { success: true }
  })

  ipcMain.handle('auth:clear-active-user', () => {
    clearCurrentActor()
    return { success: true }
  })
}
