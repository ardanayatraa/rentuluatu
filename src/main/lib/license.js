/**
 * license.js — Pure license logic untuk Wavy Rental
 * Offline license verification menggunakan HMAC-SHA256
 */
import { createHmac, createHash } from 'crypto'

const SECRET_KEY = (process.env.WAVY_LICENSE_SECRET || '').trim()
const MIN_SECRET_LENGTH = 32

const TRIAL_DAYS = 7

function getLicenseSecretOrThrow() {
  if (SECRET_KEY.length < MIN_SECRET_LENGTH) {
    throw new Error('WAVY_LICENSE_SECRET belum dikonfigurasi atau terlalu pendek (min 32 karakter).')
  }
  return SECRET_KEY
}

/**
 * Generate machine ID dari info sistem (deterministik per mesin)
 */
export function getMachineIdSync() {
  try {
    const os = require('os')
    const info = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || ''
    ].join('|')
    return createHash('sha256').update(info).digest('hex').slice(0, 16).toUpperCase()
  } catch {
    return 'UNKNOWN-MACHINE'
  }
}

/**
 * Generate serial number untuk customer
 * Format: WAVY-XXXX-XXXX-XXXX-XXXX
 * @param {string} machineId - ID mesin customer
 * @param {string} expiryDate - Tanggal expired 'YYYY-MM-DD' atau 'LIFETIME'
 */
export function generateSerial(machineId, expiryDate) {
  const payload = `${machineId}:${expiryDate}`
  const hmac = createHmac('sha256', getLicenseSecretOrThrow()).update(payload).digest('hex')
  // Ambil 16 karakter pertama, format jadi XXXX-XXXX-XXXX-XXXX
  const raw = hmac.slice(0, 16).toUpperCase()
  return `WAVY-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}`
}

/**
 * Verifikasi serial number
 * @param {string} serial - Serial yang diinput user
 * @param {string} machineId - ID mesin saat ini
 * @param {string} expiryDate - Tanggal expired yang di-encode di serial
 * @returns {{ valid: boolean, expiryDate: string|null }}
 */
export function verifySerial(serial, machineId, expiryDate) {
  const expected = generateSerial(machineId, expiryDate)
  const valid = serial.trim().toUpperCase() === expected
  return { valid, expiryDate: valid ? expiryDate : null }
}

/**
 * Parse serial + expiry dari input user
 * User input format: SERIAL|YYYY-MM-DD atau SERIAL|LIFETIME
 * Contoh: WAVY-A1B2-C3D4-E5F6-G7H8|2027-01-01
 */
export function parseActivationCode(activationCode) {
  const parts = activationCode.trim().split('|')
  if (parts.length !== 2) return { serial: null, expiryDate: null }
  return { serial: parts[0].trim().toUpperCase(), expiryDate: parts[1].trim() }
}

/**
 * Cek status lisensi
 * @param {object} license - Row dari tabel license di DB
 * @returns {{ status: 'trial'|'trial_expired'|'licensed'|'expired'|'none', daysLeft: number }}
 */
export function checkLicenseStatus(license) {
  if (!license) return { status: 'none', daysLeft: 0 }

  const now = new Date()

  // Cek lisensi aktif
  if (license.serial_number && license.licensed_until) {
    if (license.licensed_until === 'LIFETIME') {
      return { status: 'licensed', daysLeft: 99999 }
    }
    const expiry = new Date(license.licensed_until)
    if (expiry > now) {
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
      return { status: 'licensed', daysLeft }
    }
    return { status: 'expired', daysLeft: 0 }
  }

  // Cek trial
  if (license.trial_started_at) {
    const trialStart = new Date(license.trial_started_at)
    const trialEnd = new Date(trialStart.getTime() + (license.trial_days || TRIAL_DAYS) * 24 * 60 * 60 * 1000)
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
      return { status: 'trial', daysLeft }
    }
    return { status: 'trial_expired', daysLeft: 0 }
  }

  return { status: 'none', daysLeft: 0 }
}
