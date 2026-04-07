import { ipcMain } from 'electron'
import { dbOps, saveDb } from '../db'
import { getMachineIdSync, checkLicenseStatus, parseActivationCode, verifySerial } from '../lib/license'

export function registerLicenseHandlers() {

  // Ambil status lisensi lengkap
  ipcMain.handle('license:status', () => {
    const license = dbOps.get('SELECT * FROM license WHERE id = 1')
    const machineId = getMachineIdSync()
    const status = checkLicenseStatus(license)
    return {
      ...status,
      machineId,
      trialStartedAt: license?.trial_started_at || null,
      licensedUntil: license?.licensed_until || null,
      isFirstRun: !license?.trial_started_at && !license?.serial_number
    }
  })

  // Mulai trial — dipanggil setelah user set password pertama kali
  ipcMain.handle('license:start-trial', () => {
    const existing = dbOps.get('SELECT * FROM license WHERE id = 1')
    if (existing?.trial_started_at) {
      return { success: false, message: 'Trial sudah pernah dimulai' }
    }
    const now = new Date().toISOString()
    const machineId = getMachineIdSync()
    if (existing) {
      dbOps.run(
        'UPDATE license SET trial_started_at = ?, machine_id = ? WHERE id = 1',
        [now, machineId]
      )
    } else {
      dbOps.run(
        'INSERT INTO license (id, trial_started_at, trial_days, machine_id) VALUES (1, ?, 7, ?)',
        [now, machineId]
      )
    }
    return { success: true }
  })

  // Aktivasi dengan kode aktivasi (format: SERIAL|EXPIRY_DATE)
  ipcMain.handle('license:activate', (_, { activationCode }) => {
    if (!activationCode?.trim()) {
      return { success: false, message: 'Kode aktivasi tidak boleh kosong' }
    }

    const { serial, expiryDate } = parseActivationCode(activationCode)
    if (!serial || !expiryDate) {
      return { success: false, message: 'Format kode aktivasi tidak valid. Format: SERIAL|TANGGAL' }
    }

    const machineId = getMachineIdSync()
    const { valid } = verifySerial(serial, machineId, expiryDate)

    if (!valid) {
      return { success: false, message: 'Kode aktivasi tidak valid atau tidak sesuai dengan perangkat ini' }
    }

    // Simpan lisensi
    const existing = dbOps.get('SELECT * FROM license WHERE id = 1')
    if (existing) {
      dbOps.run(
        'UPDATE license SET serial_number = ?, licensed_until = ? WHERE id = 1',
        [serial, expiryDate]
      )
    } else {
      const now = new Date().toISOString()
      const mid = getMachineIdSync()
      dbOps.run(
        'INSERT INTO license (id, trial_started_at, trial_days, serial_number, licensed_until, machine_id) VALUES (1, ?, 7, ?, ?, ?)',
        [now, serial, expiryDate, mid]
      )
    }

    const license = dbOps.get('SELECT * FROM license WHERE id = 1')
    const status = checkLicenseStatus(license)
    return { success: true, ...status }
  })
}
