import { ipcMain, app } from 'electron'
import { dbOps, getDb, saveDb } from '../db'

export function registerResetHandlers() {
  ipcMain.handle('db:reset-all', () => {
    // Keamanan: Tolak jika aplikasi sudah di-build (production)
    if (app.isPackaged || process.env.NODE_ENV === 'production') {
      throw new Error('Tindakan ini tidak diizinkan di environment Production!')
    }

    const db = getDb()
    
    // Matikan Foreign Key check sementara agar bisa hapus semua tanpa error urutan
    db.run('PRAGMA foreign_keys = OFF')

    try {
      // Hapus data transaksi
      db.run('DELETE FROM payout_deductions')
      db.run('DELETE FROM refunds')
      db.run('DELETE FROM cash_transactions')
      db.run('DELETE FROM hotel_payouts')
      db.run('DELETE FROM payouts')
      db.run('DELETE FROM rentals')
      db.run('DELETE FROM expenses')

      // Hapus master data
      db.run('DELETE FROM hotels')
      db.run('DELETE FROM motors')
      db.run('DELETE FROM owners')

      // Reset saldo kas kembali ke 0
      db.run('UPDATE cash_accounts SET balance = 0')

      // Reset autoincrement ID kembali ke 1
      db.run(`DELETE FROM sqlite_sequence WHERE name IN (
        'payout_deductions', 'refunds', 'cash_transactions',
        'hotel_payouts', 'rentals', 'expenses', 'payouts',
        'hotels', 'motors', 'owners'
      )`)

    } finally {
      // Hidupkan kembali FK check
      db.run('PRAGMA foreign_keys = ON')
      saveDb()
    }

    return { success: true }
  })
}


