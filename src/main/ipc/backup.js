import { ipcMain, app, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { createServer } from 'http'
import { forceSaveDb } from '../db'
import { Readable } from 'stream'
import { logActivity } from '../lib/activity-log'

// googleapis di-lazy load supaya tidak crash saat startup
let _google = null
async function getGoogle() {
  if (!_google) {
    const mod = await import('googleapis')
    _google = mod.google
  }
  return _google
}

// ── Load .env manual ──────────────────────────────────────────────────────────
function loadEnvFile() {
  const candidates = [
    join(process.cwd(), '.env'),
    join(__dirname, '../../../.env'),
    join(__dirname, '../../.env'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      const lines = readFileSync(p, 'utf-8').split('\n')
      for (const line of lines) {
        const match = line.match(/^\s*([\w]+)\s*=\s*(.+)\s*$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
        }
      }
      break
    }
  }
}
loadEnvFile()

// ── Google OAuth Config ──────────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const DRIVE_FOLDER_NAME = 'Wavy Rental Backups'
const DB_FILENAME = 'wavy.db'
const BACKUP_SETTINGS_FILENAME = 'backup-settings.json'
const RECOVERY_KEY_SUFFIX = '.key.wavy'
const DEFAULT_RECOVERY_PASSWORD = process.env.BACKUP_RECOVERY_PASSWORD || 'wavy2026'

// Port untuk localhost callback — Google Cloud Console harus punya:
// http://127.0.0.1:42813/callback di Authorized Redirect URIs
const CALLBACK_PORT = 42813
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`

// ── Encryption ───────────────────────────────────────────────────────────────
// Format file terenkripsi: [salt 32B][iv 12B][authTag 16B][ciphertext]
const ENC_MAGIC = Buffer.from('WAVY01') // 6 byte header penanda file terenkripsi

function deriveKey(passphrase, salt) {
  // scrypt: N=2^14, r=8, p=1 → 32 byte key
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 })
}

function encryptBuffer(plainBuffer, passphrase) {
  const salt = randomBytes(32)
  const iv = randomBytes(12)
  const key = deriveKey(passphrase, salt)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()])
  const authTag = cipher.getAuthTag() // 16 bytes

  // Layout: magic(6) + salt(32) + iv(12) + authTag(16) + ciphertext
  return Buffer.concat([ENC_MAGIC, salt, iv, authTag, encrypted])
}

function decryptBuffer(encBuffer, passphrase) {
  const magic = encBuffer.slice(0, 6)
  if (!magic.equals(ENC_MAGIC)) throw new Error('File bukan backup Wavy terenkripsi atau sudah rusak')

  const salt = encBuffer.slice(6, 38)
  const iv = encBuffer.slice(38, 50)
  const authTag = encBuffer.slice(50, 66)
  const ciphertext = encBuffer.slice(66)

  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new Error('Passphrase salah atau file backup rusak')
  }
}

// ── Passphrase storage (simpan di userData, bukan hardcode) ──────────────────
function getPassphrasePath() {
  return join(app.getPath('userData'), '.backup-key')
}

function getOrCreatePassphrase() {
  const p = getPassphrasePath()
  if (existsSync(p)) return readFileSync(p, 'utf-8').trim()
  // Generate random passphrase pertama kali
  const key = randomBytes(32).toString('hex')
  writeFileSync(p, key, { mode: 0o600 })
  return key
}

function setCustomPassphrase(passphrase) {
  writeFileSync(getPassphrasePath(), passphrase, { mode: 0o600 })
}

// ── Token storage ────────────────────────────────────────────────────────────
function getTokenPath() {
  return join(app.getPath('userData'), 'gdrive-token.json')
}

function loadToken() {
  const p = getTokenPath()
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
  }
  return null
}

function saveToken(token) { writeFileSync(getTokenPath(), JSON.stringify(token)) }

function clearToken() {
  const p = getTokenPath()
  if (existsSync(p)) try { unlinkSync(p) } catch { /* ignore */ }
}

// ── OAuth2 ───────────────────────────────────────────────────────────────────
async function createOAuth2Client() {
  const google = await getGoogle()
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

async function getAuthenticatedClient() {
  const token = loadToken()
  if (!token) return null
  const auth = await createOAuth2Client()
  auth.setCredentials(token)
  return auth
}

// ── Drive helpers ────────────────────────────────────────────────────────────
async function getOrCreateFolder(drive) {
  const res = await drive.files.list({
    q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  })
  if (res.data.files.length > 0) return res.data.files[0].id
  const folder = await drive.files.create({
    requestBody: { name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  })
  return folder.data.id
}

async function listBackupFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'wavy_backup' and name does not contain '${RECOVERY_KEY_SUFFIX}' and trashed=false`,
    fields: 'files(id, name, size, modifiedTime)',
    orderBy: 'modifiedTime desc'
  })
  return res.data.files
}

async function findFileInFolderByName(drive, folderId, filename) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name='${filename}' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1
  })
  return res.data.files?.[0] || null
}

// ── Paths ────────────────────────────────────────────────────────────────────
function getDbPath() { return join(app.getPath('userData'), DB_FILENAME) }

function getBackupDir() {
  const dir = join(app.getPath('userData'), 'backups')
  mkdirSync(dir, { recursive: true })
  return dir
}

function getRecoveryKeyPathForLocalBackup(backupPath) {
  return `${backupPath}${RECOVERY_KEY_SUFFIX}`
}

function decryptBackupWithLocalPassphrase({ fileData }) {
  const passphrase = getOrCreatePassphrase()
  return decryptBuffer(fileData, passphrase)
}

function decryptBackupWithRecoveryKey({ fileData, keyBuffer, backupFilename }) {
  const recoveredPassphrase = parseRecoveryKeyBuffer({ buffer: keyBuffer, backupFilename })
  return decryptBuffer(fileData, recoveredPassphrase)
}


function monthStampLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function safeUnlink(filePath) {
  try { unlinkSync(filePath) } catch { /* ignore */ }
}

function pruneLocalBackups({ keepMonths = 24 } = {}) {
  const dir = getBackupDir()
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('wavy_backup_monthly_') && f.endsWith('.wavy'))
    .map((name) => ({ name, path: join(dir, name) }))
  if (!files.length) return

  const cutoff = new Date()
  cutoff.setDate(1)
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setMonth(cutoff.getMonth() - keepMonths)
  for (const f of files) {
    const m = f.name.match(/^wavy_backup_monthly_(\d{4})-(\d{2})\.wavy$/)
    if (!m) continue
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1)
    if (d < cutoff) safeUnlink(f.path)
  }
}

function getRecoveryKeyFilename(backupFilename) {
  return `${backupFilename}${RECOVERY_KEY_SUFFIX}`
}

function buildRecoveryKeyBuffer({ backupFilename, passphrase }) {
  const payload = {
    backupFilename: String(backupFilename || ''),
    passphrase: String(passphrase || ''),
    createdAt: new Date().toISOString()
  }
  return encryptBuffer(Buffer.from(JSON.stringify(payload), 'utf-8'), DEFAULT_RECOVERY_PASSWORD)
}

function parseRecoveryKeyBuffer({ buffer, backupFilename }) {
  const decrypted = decryptBuffer(buffer, DEFAULT_RECOVERY_PASSWORD)
  const parsed = JSON.parse(decrypted.toString('utf-8'))
  if (!parsed || typeof parsed !== 'object' || !parsed.passphrase) {
    throw new Error('Recovery key tidak valid')
  }
  if (backupFilename && parsed.backupFilename && parsed.backupFilename !== backupFilename) {
    throw new Error('Recovery key tidak cocok dengan file backup')
  }
  return String(parsed.passphrase)
}

function getBackupSettingsPath() {
  return join(app.getPath('userData'), BACKUP_SETTINGS_FILENAME)
}

function loadBackupSettings() {
  const defaults = { autoBackupOnClose: true }
  const p = getBackupSettingsPath()
  if (!existsSync(p)) return defaults
  try {
    return { ...defaults, ...JSON.parse(readFileSync(p, 'utf-8')) }
  } catch {
    return defaults
  }
}

function saveBackupSettings(nextSettings) {
  writeFileSync(getBackupSettingsPath(), JSON.stringify(nextSettings, null, 2))
}

export function shouldAutoBackupOnClose() {
  const settings = loadBackupSettings()
  return Boolean(settings.autoBackupOnClose && CLIENT_ID && CLIENT_SECRET && loadToken())
}

async function uploadBackupToDrive({ filename, buffer }) {
  const auth = await getAuthenticatedClient()
  if (!auth) throw new Error('Belum terhubung ke Google Drive')

  const google = await getGoogle()
  const drive = google.drive({ version: 'v3', auth })
  const folderId = await getOrCreateFolder(drive)

  return uploadFileToDrive({ drive, folderId, filename, buffer })
}

async function uploadFileToDrive({ drive, folderId, filename, buffer }) {
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name='${filename}' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1
  })

  const media = { mimeType: 'application/octet-stream', body: Readable.from(buffer) }
  if (existing.data.files.length > 0) {
    const fileId = existing.data.files[0].id
    await drive.files.update({ fileId, media })
    return { success: true, filename, updated: true, fileId }
  }

  const created = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media,
    fields: 'id, name'
  })

  return { success: true, filename, updated: false, fileId: created.data.id }
}

export async function runAutoCloseBackup() {
  forceSaveDb()
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) throw new Error('File database tidak ditemukan')

  const passphrase = getOrCreatePassphrase()
  const plainData = readFileSync(dbPath)
  const encData = encryptBuffer(plainData, passphrase)
  // Standar: 1 file per bulan (overwrite). File baru hanya dibuat saat bulan berganti.
  const filename = `wavy_backup_monthly_${monthStampLocal()}.wavy`
  const keyFilename = getRecoveryKeyFilename(filename)
  const keyBuffer = buildRecoveryKeyBuffer({ backupFilename: filename, passphrase })

  const result = await uploadBackupToDrive({ filename, buffer: encData })
  await uploadBackupToDrive({ filename: keyFilename, buffer: keyBuffer })
  return result
}

// ── Register handlers ────────────────────────────────────────────────────────
export function registerBackupHandlers() {

  ipcMain.handle('backup:gdrive-status', () => ({
    connected: !!loadToken(),
    configured: !!(CLIENT_ID && CLIENT_SECRET)
  }))

  ipcMain.handle('backup:auto-close-status', () => {
    const settings = loadBackupSettings()
    return { enabled: Boolean(settings.autoBackupOnClose) }
  })

  ipcMain.handle('backup:auto-close-set', (_, { enabled }) => {
    const current = loadBackupSettings()
    const next = { ...current, autoBackupOnClose: Boolean(enabled) }
    saveBackupSettings(next)
    logActivity({
      action: 'backup.auto-close-set',
      detail: `Backup otomatis saat tutup app ${next.autoBackupOnClose ? 'diaktifkan' : 'dimatikan'}`
    })
    return { success: true, enabled: next.autoBackupOnClose }
  })

  // Buka browser + jalankan localhost callback server, resolve otomatis saat Google redirect balik
  ipcMain.handle('backup:gdrive-connect', () => {
    return new Promise(async (resolve, reject) => {
      const auth = await createOAuth2Client()
      const url = auth.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        prompt: 'consent'
      })

      // Buat HTTP server sementara untuk tangkap callback dari Google
      const server = createServer(async (req, res) => {
        try {
          const urlObj = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`)
          const code = urlObj.searchParams.get('code')
          const error = urlObj.searchParams.get('error')

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Login dibatalkan</h2><p>Silakan tutup tab ini dan coba lagi.</p></body></html>')
            server.close()
            reject(new Error('Login dibatalkan: ' + error))
            return
          }

          if (code) {
            // Tukar code dengan token
            const { tokens } = await auth.getToken(code)
            saveToken(tokens)

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end('<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0fdf4"><h2 style="color:#16a34a">Berhasil terhubung!</h2><p>Google Drive sudah terhubung ke Wavy Rental.</p><p style="color:#64748b">Silakan tutup tab ini dan kembali ke aplikasi.</p></body></html>')
            server.close()
            logActivity({
              action: 'backup.gdrive-connect.success',
              detail: 'Google Drive berhasil dihubungkan'
            })
            resolve({ success: true })
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>Error: ' + err.message + '</h2></body></html>')
          server.close()
          reject(err)
        }
      })

      server.listen(CALLBACK_PORT, '127.0.0.1', () => {
        shell.openExternal(url)
      })

      server.on('error', (err) => {
        reject(new Error('Gagal membuka server callback: ' + err.message))
      })

      // Timeout 5 menit
      setTimeout(() => {
        server.close()
        reject(new Error('Timeout: login tidak diselesaikan dalam 5 menit'))
      }, 5 * 60 * 1000)
    })
  })

  ipcMain.handle('backup:gdrive-disconnect', () => {
    clearToken()
    logActivity({
      action: 'backup.gdrive-disconnect',
      detail: 'Google Drive diputus'
    })
    return { success: true }
  })

  // Cek apakah passphrase sudah di-set (custom atau auto)
  ipcMain.handle('backup:get-passphrase-status', () => {
    const p = getPassphrasePath()
    return { hasCustom: existsSync(p) }
  })

  // Set custom passphrase (dari UI)
  ipcMain.handle('backup:set-passphrase', (_, { passphrase }) => {
    if (!passphrase || passphrase.length < 6) throw new Error('Passphrase minimal 6 karakter')
    setCustomPassphrase(passphrase)
    logActivity({
      action: 'backup.set-passphrase',
      detail: 'Passphrase backup diperbarui'
    })
    return { success: true }
  })

  // ── Backup lokal (terenkripsi) ─────────────────────────────────────────────
  ipcMain.handle('backup:create-local', () => {
    forceSaveDb()
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) throw new Error('File database tidak ditemukan')

    const passphrase = getOrCreatePassphrase()
    const plainData = readFileSync(dbPath)
    const encData = encryptBuffer(plainData, passphrase)

    // Standar: 1 backup per bulan (overwrite) agar tidak menumpuk banyak file.
    const backupName = `wavy_backup_monthly_${monthStampLocal()}.wavy`
    const backupPath = join(getBackupDir(), backupName)
    const recoveryKeyPath = getRecoveryKeyPathForLocalBackup(backupPath)
    const recoveryKeyBuffer = buildRecoveryKeyBuffer({ backupFilename: backupName, passphrase })
    writeFileSync(backupPath, encData)
    writeFileSync(recoveryKeyPath, recoveryKeyBuffer)
    pruneLocalBackups({ keepMonths: 24 })
    logActivity({
      action: 'backup.create-local',
      detail: `Checkpoint lokal dibuat (${backupName})`
    })

    return { success: true, filename: backupName, path: backupPath, encrypted: true, recoveryKeyPath }
  })

  // List backup lokal
  ipcMain.handle('backup:list-local', () => {
    const dir = getBackupDir()
    return readdirSync(dir)
      .filter((f) => {
        if (!f.startsWith('wavy_backup')) return false
        if (f.endsWith(RECOVERY_KEY_SUFFIX)) return false
        return f.endsWith('.wavy') || f.endsWith('.db')
      })
      .map(f => {
        const stat = statSync(join(dir, f))
        return { name: f, size: stat.size, modifiedTime: stat.mtime.toISOString(), path: join(dir, f), encrypted: f.endsWith('.wavy') }
      })
      .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
  })

  ipcMain.handle('backup:show-local-in-folder', (_, { path: backupPath }) => {
    if (!backupPath) throw new Error('Path backup tidak valid')
    const normalizedPath = String(backupPath)
    const backupDir = getBackupDir()
    if (!normalizedPath.startsWith(backupDir)) {
      throw new Error('Lokasi file backup tidak valid')
    }
    if (!existsSync(normalizedPath)) throw new Error('File backup tidak ditemukan')
    shell.showItemInFolder(normalizedPath)
    return { success: true }
  })

  // Restore dari backup lokal
  ipcMain.handle('backup:restore-local', (_, { path: backupPath }) => {
    if (!existsSync(backupPath)) throw new Error('File backup tidak ditemukan')

    // sql.js memuat DB ke memory. Setelah restore file, aplikasi harus relaunch
    // agar DB baru kebaca dan tidak ditimpa state memory lama.
    forceSaveDb()

    const dbPath = getDbPath()
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    // Safety backup sebelum restore (plain, bukan enkripsi)
    if (existsSync(dbPath)) {
      writeFileSync(join(getBackupDir(), `wavy_before_restore_${ts}.db`), readFileSync(dbPath))
    }

    const fileData = readFileSync(backupPath)
    let plainData = fileData

    // Kalau file terenkripsi (.wavy), decrypt dulu
    if (backupPath.endsWith('.wavy')) {
      try {
        plainData = decryptBackupWithLocalPassphrase({ fileData })
      } catch (error) {
        const recoveryKeyPath = getRecoveryKeyPathForLocalBackup(backupPath)
        if (!existsSync(recoveryKeyPath)) throw error
        const keyBuffer = readFileSync(recoveryKeyPath)
        plainData = decryptBackupWithRecoveryKey({
          fileData,
          keyBuffer,
          backupFilename: backupPath.split(/[/\\]/).pop()
        })
      }
    }

    writeFileSync(dbPath, plainData)
    logActivity({
      action: 'backup.restore-local',
      detail: `Restore backup lokal (${backupPath.split(/[/\\]/).pop() || backupPath})`
    })
    setTimeout(() => {
      try { app.relaunch() } catch { /* ignore */ }
      app.exit(0)
    }, 800)

    return { success: true, relaunching: true }
  })

  // ── Upload ke Google Drive (terenkripsi) ───────────────────────────────────
  ipcMain.handle('backup:gdrive-upload', async () => {
    forceSaveDb()
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) throw new Error('File database tidak ditemukan')

    const passphrase = getOrCreatePassphrase()
    const plainData = readFileSync(dbPath)
    const encData = encryptBuffer(plainData, passphrase)

    // Standar: 1 file per bulan (overwrite) agar tidak menumpuk.
    const filename = `wavy_backup_monthly_${monthStampLocal()}.wavy`
    const keyFilename = getRecoveryKeyFilename(filename)
    const keyBuffer = buildRecoveryKeyBuffer({ backupFilename: filename, passphrase })
    const result = await uploadBackupToDrive({ filename, buffer: encData })
    await uploadBackupToDrive({ filename: keyFilename, buffer: keyBuffer })
    logActivity({
      action: 'backup.gdrive-upload',
      detail: `Backup berhasil di-upload ke Google Drive (${filename})`
    })
    return { ...result, encrypted: true }
  })

  ipcMain.handle('backup:gdrive-list', async () => {
    const auth = await getAuthenticatedClient()
    if (!auth) throw new Error('Belum terhubung ke Google Drive')
    const google = await getGoogle()
    const drive = google.drive({ version: 'v3', auth })
    const folderId = await getOrCreateFolder(drive)
    return listBackupFiles(drive, folderId)
  })

  // Download & restore dari Google Drive (decrypt otomatis)
  ipcMain.handle('backup:gdrive-restore', async (_, { fileId, fileName }) => {
    const auth = await getAuthenticatedClient()
    if (!auth) throw new Error('Belum terhubung ke Google Drive')

    forceSaveDb()

    const google = await getGoogle()
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
    const encData = Buffer.from(res.data)

    let plainData = encData
    if (fileName.endsWith('.wavy')) {
      try {
        plainData = decryptBackupWithLocalPassphrase({ fileData: encData })
      } catch (error) {
        const folderId = await getOrCreateFolder(drive)
        const keyFilename = getRecoveryKeyFilename(fileName)
        const keyFile = await findFileInFolderByName(drive, folderId, keyFilename)
        if (!keyFile?.id) throw error
        const keyRes = await drive.files.get({ fileId: keyFile.id, alt: 'media' }, { responseType: 'arraybuffer' })
        const keyBuffer = Buffer.from(keyRes.data)
        plainData = decryptBackupWithRecoveryKey({
          fileData: encData,
          keyBuffer,
          backupFilename: fileName
        })
      }
    }

    const dbPath = getDbPath()
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    if (existsSync(dbPath)) {
      writeFileSync(join(getBackupDir(), `wavy_before_restore_${ts}.db`), readFileSync(dbPath))
    }

    writeFileSync(dbPath, plainData)
    logActivity({
      action: 'backup.gdrive-restore',
      detail: `Restore backup dari Google Drive (${fileName || fileId})`
    })
    setTimeout(() => {
      try { app.relaunch() } catch { /* ignore */ }
      app.exit(0)
    }, 800)

    return { success: true, filename: fileName, relaunching: true }
  })

  ipcMain.handle('backup:gdrive-delete', async (_, { fileId, fileName }) => {
    const auth = await getAuthenticatedClient()
    if (!auth) throw new Error('Belum terhubung ke Google Drive')
    const google = await getGoogle()
    const drive = google.drive({ version: 'v3', auth })
    if (fileName) {
      const folderId = await getOrCreateFolder(drive)
      const keyFile = await findFileInFolderByName(drive, folderId, getRecoveryKeyFilename(fileName))
      if (keyFile?.id) {
        try { await drive.files.delete({ fileId: keyFile.id }) } catch { /* ignore */ }
      }
    }
    await drive.files.delete({ fileId })
    logActivity({
      action: 'backup.gdrive-delete',
      detail: `Backup Google Drive dihapus (${fileId})`
    })
    return { success: true }
  })
}
