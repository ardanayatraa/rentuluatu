import { ipcMain } from 'electron'
import { dbOps } from '../db'

export function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    try {
      const user = dbOps.get('SELECT * FROM users WHERE username = ?', [username])
      if (!user) return { success: false, message: 'Username tidak ditemukan' }

      let valid = false

      // Akun baru dengan placeholder hash → izinkan login dengan password apapun
      // agar admin bisa set password pertama kali
      if (user.password_hash === '$2b$10$placeholder') {
        valid = true
      } else {
        try {
          const bcrypt = await import('bcryptjs')
          valid = await bcrypt.default.compare(password, user.password_hash)
        } catch {
          // Fallback jika bcrypt tidak tersedia (dev only)
          valid = user.password_hash === password
        }
      }

      if (!valid) return { success: false, message: 'Kode akses salah' }
      return { success: true, user: { id: user.id, username: user.username } }
    } catch (e) {
      console.error('[auth:login]', e)
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('auth:change-password', async (_, { userId, oldPassword, newPassword }) => {
    const user = dbOps.get('SELECT * FROM users WHERE id = ?', [userId])
    if (!user) return { success: false, message: 'User tidak ditemukan' }

    // Validasi password baru
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, message: 'Password baru minimal 4 karakter' }
    }

    // Jika masih placeholder, skip validasi password lama
    let valid = false
    if (user.password_hash === '$2b$10$placeholder') {
      valid = true
    } else {
      try {
        const bcrypt = await import('bcryptjs')
        valid = await bcrypt.default.compare(oldPassword, user.password_hash)
      } catch {
        valid = user.password_hash === oldPassword
      }
    }

    if (!valid) return { success: false, message: 'Password lama salah' }

    let newHash = newPassword
    try {
      const bcrypt = await import('bcryptjs')
      newHash = await bcrypt.default.hash(newPassword, 10)
    } catch { /* simpan plain jika bcrypt tidak tersedia */ }

    dbOps.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId])
    return { success: true }
  })
}
