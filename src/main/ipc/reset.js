import { ipcMain, app } from 'electron'
import { dbOps } from '../db'

export function registerResetHandlers() {
  ipcMain.handle('db:reset-all', () => {
    // Keamanan: Tolak jika aplikasi sudah di-build (production)
    if (app.isPackaged || process.env.NODE_ENV === 'production') {
      throw new Error('Tindakan ini tidak diizinkan di environment Production!')
    }

    // Hapus semua data transaksi dan master data (kecuali user admin dan akun kas)
    dbOps.run('DELETE FROM refunds')
    dbOps.run('DELETE FROM rentals')
    dbOps.run('DELETE FROM expenses')
    dbOps.run('DELETE FROM cash_transactions')
    dbOps.run('DELETE FROM motors')
    dbOps.run('DELETE FROM owners')

    // Reset saldo kas kembali ke 0
    dbOps.run('UPDATE cash_accounts SET balance = 0')

    // Optional: reset sqlite_sequence (autoincrement ID back to 1)
    try {
      dbOps.run("DELETE FROM sqlite_sequence WHERE name IN ('refunds', 'rentals', 'expenses', 'cash_transactions', 'motors', 'owners')")
    } catch (e) {
      // Abaikan jika sqlite_sequence tidak ada / error
    }

    return { success: true }
  })
}
