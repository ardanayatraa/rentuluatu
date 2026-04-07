import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerAuthHandlers() {

  ipcMain.handle('auth:login', async (_, { username, password }) => {
    try {
      const user = dbOps.get('SELECT * FROM users WHERE username = ?', [username])
      if (!user) return { success: false, message: 'Username tidak ditemukan' }

      let valid = false
      if (user.password_hash === '$2b$10$placeholder') {
        valid = true
      } else if (user.password_hash.startsWith('$2')) {
        try {
          const bcrypt = await import('bcryptjs')
          valid = await bcrypt.default.compare(password, user.password_hash)
        } catch { valid = false }
      } else {
        valid = user.password_hash === password
      }

      if (!valid) return { success: false, message: 'Kode akses salah' }
      return { success: true, user: { id: user.id, username: user.username } }
    } catch (e) {
      return { success: false, message: e.message }
    }
  })

  // Khusus setup pertama kali — tidak butuh password lama
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
    } catch { newHash = newPassword }
    dbOps.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])
    return { success: true }
  })

  // Ganti password — butuh validasi password lama
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
      } catch { valid = false }
    } else {
      valid = user.password_hash === oldPassword
    }

    if (!valid) return { success: false, message: 'Password lama salah' }

    let newHash = newPassword
    try {
      const bcrypt = await import('bcryptjs')
      newHash = await bcrypt.default.hash(newPassword, 10)
    } catch { newHash = newPassword }

    dbOps.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])
    return { success: true }
  })
}
