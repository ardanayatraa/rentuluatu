import { ipcMain, app, shell, dialog } from 'electron'
import { basename, dirname, join } from 'path'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { createServer } from 'http'
import { forceSaveDb, reloadDbFromBuffer } from '../db'
import { Readable } from 'stream'
import { logActivity } from '../lib/activity-log'
import { fileURLToPath } from 'url'

// googleapis di-lazy load supaya tidak crash saat startup
let _google = null
let _sql = null
let skipAutoBackupOnClose = false
const MODULE_DIRNAME = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
async function getGoogle() {
  if (!_google) {
    const mod = await import('googleapis')
    _google = mod.google
  }
  return _google
}

async function getSqlJs() {
  if (_sql) return _sql
  const mod = await import('sql.js')
  const initSqlJs = mod.default || mod
  const wasmPath = join(
    app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
      : join(MODULE_DIRNAME, '../../../node_modules/sql.js/dist/sql-wasm.wasm')
  )
  _sql = await initSqlJs({ locateFile: () => wasmPath })
  return _sql
}

// ── Load .env manual ──────────────────────────────────────────────────────────
function loadEnvFile() {
  const candidates = [
    join(process.cwd(), '.env'),
    join(MODULE_DIRNAME, '../../../.env'),
    join(MODULE_DIRNAME, '../../.env'),
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
const DEFAULT_RECOVERY_PASSWORD = (process.env.BACKUP_RECOVERY_PASSWORD || '').trim()
const LEGACY_RECOVERY_PASSWORD = 'wavy2026'
const REQUIRED_BACKUP_TABLES = [
  'users',
  'owners',
  'motors',
  'cash_accounts',
  'rentals',
  'expenses',
  'cash_transactions'
]
const RETENTION_POLICY = {
  keepAllDays: 7,
  keepDailyDays: 30,
  keepMonthlyMonths: 24
}

// Port untuk localhost callback — Google Cloud Console harus punya:
// http://127.0.0.1:42813/callback di Authorized Redirect URIs
const CALLBACK_PORT = 42813
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`

// ── Encryption ───────────────────────────────────────────────────────────────
// Format file terenkripsi: [salt 32B][iv 12B][authTag 16B][ciphertext]
const ENC_MAGIC = Buffer.from('WAVY01') // 6 byte header penanda file terenkripsi

function getRecoveryPasswordOrThrow() {
  if (DEFAULT_RECOVERY_PASSWORD.length < 16) {
    return LEGACY_RECOVERY_PASSWORD
  }
  return DEFAULT_RECOVERY_PASSWORD
}

function getRecoveryPasswordsForDecrypt() {
  const configured = DEFAULT_RECOVERY_PASSWORD.length >= 16 ? [DEFAULT_RECOVERY_PASSWORD] : []
  // Tetap dukung backup lama agar restore lintas versi tidak putus.
  return [...configured, LEGACY_RECOVERY_PASSWORD]
}

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
    q: `'${folderId}' in parents and name contains 'wavy_backup' and not name contains '${RECOVERY_KEY_SUFFIX}' and trashed=false`,
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

function timestampStampLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d}_${hh}-${mm}-${ss}`
}

function createBackupFilename(kind, date = new Date()) {
  return `wavy_backup_${kind}_${timestampStampLocal(date)}.wavy`
}

function createSafetyBackupFilename(date = new Date()) {
  return `wavy_before_restore_${timestampStampLocal(date)}.wavy`
}

function safeUnlink(filePath) {
  try { unlinkSync(filePath) } catch { /* ignore */ }
}

function parseBackupDateFromName(name) {
  const timestampMatch = String(name).match(/^wavy_backup_(?:manual|auto_close)_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.wavy$/)
  if (timestampMatch) {
    return new Date(
      Number(timestampMatch[1]),
      Number(timestampMatch[2]) - 1,
      Number(timestampMatch[3]),
      Number(timestampMatch[4]),
      Number(timestampMatch[5]),
      Number(timestampMatch[6])
    )
  }

  const legacyMonthlyMatch = String(name).match(/^wavy_backup_monthly_(\d{4})-(\d{2})\.wavy$/)
  if (legacyMonthlyMatch) {
    return new Date(Number(legacyMonthlyMatch[1]), Number(legacyMonthlyMatch[2]) - 1, 1)
  }

  return null
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function monthKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0')
  ].join('-')
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function addMonths(date, amount) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

function pickBackupsToPrune(files, now = new Date()) {
  const allCutoff = addDays(now, -RETENTION_POLICY.keepAllDays)
  const dailyCutoff = addDays(now, -RETENTION_POLICY.keepDailyDays)
  const monthlyCutoff = addMonths(now, -RETENTION_POLICY.keepMonthlyMonths)
  const keptDays = new Set()
  const keptMonths = new Set()

  return files
    .map((file) => ({
      ...file,
      backupDate: parseBackupDateFromName(file.name) || new Date(file.modifiedTime || 0)
    }))
    .filter((file) => file.backupDate instanceof Date && !Number.isNaN(file.backupDate.getTime()))
    .sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime())
    .filter((file) => {
      if (file.backupDate >= allCutoff) return false

      if (file.backupDate >= dailyCutoff) {
        const key = dateKey(file.backupDate)
        if (keptDays.has(key)) return true
        keptDays.add(key)
        return false
      }

      if (file.backupDate >= monthlyCutoff) {
        const key = monthKey(file.backupDate)
        if (keptMonths.has(key)) return true
        keptMonths.add(key)
        return false
      }

      return true
    })
}

function retentionPayload(deletedCount = 0) {
  return { ...RETENTION_POLICY, deleted: deletedCount }
}

function pruneLocalBackups() {
  const dir = getBackupDir()
  const files = readdirSync(dir)
    .filter((f) => f.startsWith('wavy_backup_') && f.endsWith('.wavy') && !f.endsWith(RECOVERY_KEY_SUFFIX))
    .map((name) => {
      const path = join(dir, name)
      const stat = statSync(path)
      return { name, path, modifiedTime: stat.mtime.toISOString() }
    })
  const toDelete = pickBackupsToPrune(files)
  for (const f of toDelete) {
    safeUnlink(f.path)
    safeUnlink(getRecoveryKeyPathForLocalBackup(f.path))
  }
  return retentionPayload(toDelete.length)
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
  return encryptBuffer(Buffer.from(JSON.stringify(payload), 'utf-8'), getRecoveryPasswordOrThrow())
}

function parseRecoveryKeyBuffer({ buffer, backupFilename }) {
  let decrypted = null
  let lastError = null
  for (const password of getRecoveryPasswordsForDecrypt()) {
    try {
      decrypted = decryptBuffer(buffer, password)
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!decrypted) throw lastError || new Error('Recovery key tidak bisa didecrypt')
  const parsed = JSON.parse(decrypted.toString('utf-8'))
  if (!parsed || typeof parsed !== 'object' || !parsed.passphrase) {
    throw new Error('Recovery key tidak valid')
  }
  // Jangan blok restore hanya karena nama file berbeda (misal file di-rename saat copy/download).
  // Selama key bisa didecrypt dan passphrase valid, backup tetap dapat direstore.
  return String(parsed.passphrase)
}

function readPlainLocalBackup(backupPath) {
  if (!existsSync(backupPath)) throw new Error('File backup tidak ditemukan')
  const fileData = readFileSync(backupPath)
  if (!backupPath.endsWith('.wavy')) return fileData

  try {
    return decryptBackupWithLocalPassphrase({ fileData })
  } catch (error) {
    const recoveryKeyPath = getRecoveryKeyPathForLocalBackup(backupPath)
    if (!existsSync(recoveryKeyPath)) throw new Error('Backup terenkripsi butuh file key pendamping (*.key.wavy)')
    const keyBuffer = readFileSync(recoveryKeyPath)
    return decryptBackupWithRecoveryKey({
      fileData,
      keyBuffer,
      backupFilename: basename(backupPath)
    })
  }
}

function oneFromDb(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  let row = null
  if (stmt.step()) row = stmt.getAsObject()
  stmt.free()
  return row || {}
}

function allFromDb(db, sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

async function validateBackupBuffer(plainData) {
  const SQL = await getSqlJs()
  const db = new SQL.Database(plainData)
  try {
    const integrity = oneFromDb(db, 'PRAGMA integrity_check')
    const integrityValue = Object.values(integrity)[0]
    if (String(integrityValue).toLowerCase() !== 'ok') {
      throw new Error(`Database backup rusak (${integrityValue || 'integrity_check gagal'})`)
    }

    const tableRows = allFromDb(db, "SELECT name FROM sqlite_master WHERE type = 'table'")
    const tableNames = new Set(tableRows.map((row) => String(row.name || '').toLowerCase()))
    const missingTables = REQUIRED_BACKUP_TABLES.filter((name) => !tableNames.has(name))
    if (missingTables.length) {
      throw new Error(`Backup tidak valid. Tabel wajib hilang: ${missingTables.join(', ')}`)
    }

    const countTable = (tableName) => {
      if (!tableNames.has(tableName)) return 0
      return Number(oneFromDb(db, `SELECT COUNT(*) AS n FROM ${tableName}`).n || 0)
    }

    return {
      motors: countTable('motors'),
      owners: countTable('owners'),
      hotels: countTable('hotels'),
      rentals: countTable('rentals'),
      expenses: countTable('expenses'),
      cashTransactions: countTable('cash_transactions'),
      rentalsMinDate: String(oneFromDb(db, 'SELECT MIN(date_time) AS v FROM rentals').v || ''),
      rentalsMaxDate: String(oneFromDb(db, 'SELECT MAX(date_time) AS v FROM rentals').v || ''),
      rentalTotal: Number(oneFromDb(db, 'SELECT COALESCE(SUM(total_price), 0) AS v FROM rentals').v || 0),
      expenseTotal: Number(oneFromDb(db, 'SELECT COALESCE(SUM(amount), 0) AS v FROM expenses').v || 0)
    }
  } finally {
    db.close()
  }
}

async function inspectBackupFile(backupPath) {
  const plainData = readPlainLocalBackup(backupPath)
  return validateBackupBuffer(plainData)
}

function writeEncryptedBackupPair({ filename, plainData, directory = getBackupDir() }) {
  const passphrase = getOrCreatePassphrase()
  const backupPath = join(directory, filename)
  const recoveryKeyPath = getRecoveryKeyPathForLocalBackup(backupPath)
  const encData = encryptBuffer(plainData, passphrase)
  const recoveryKeyBuffer = buildRecoveryKeyBuffer({ backupFilename: filename, passphrase })
  writeFileSync(backupPath, encData)
  writeFileSync(recoveryKeyPath, recoveryKeyBuffer)
  return { filename, path: backupPath, recoveryKeyPath, encrypted: true }
}

function writeSafetyBackupIfPossible() {
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) return null
  const filename = createSafetyBackupFilename()
  return writeEncryptedBackupPair({ filename, plainData: readFileSync(dbPath) })
}

function replaceDbFileAtomically(plainData) {
  const dbPath = getDbPath()
  const tempPath = `${dbPath}.restore-${Date.now()}.tmp`
  writeFileSync(tempPath, plainData)
  try {
    renameSync(tempPath, dbPath)
  } catch (error) {
    safeUnlink(tempPath)
    throw error
  }
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
  if (skipAutoBackupOnClose) return false
  const settings = loadBackupSettings()
  return Boolean(settings.autoBackupOnClose && CLIENT_ID && CLIENT_SECRET && loadToken())
}

export function skipAutoBackupForNextClose() {
  skipAutoBackupOnClose = true
}

async function getDriveContext() {
  const auth = await getAuthenticatedClient()
  if (!auth) throw new Error('Belum terhubung ke Google Drive')

  const google = await getGoogle()
  const drive = google.drive({ version: 'v3', auth })
  const folderId = await getOrCreateFolder(drive)
  return { drive, folderId }
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

async function pruneDriveBackups({ drive, folderId }) {
  const files = await listBackupFiles(drive, folderId)
  const toDelete = pickBackupsToPrune(files.map((file) => ({
    ...file,
    modifiedTime: file.modifiedTime
  })))

  for (const file of toDelete) {
    if (file.name) {
      const keyFile = await findFileInFolderByName(drive, folderId, getRecoveryKeyFilename(file.name))
      if (keyFile?.id) {
        try { await drive.files.delete({ fileId: keyFile.id }) } catch { /* ignore */ }
      }
    }
    try { await drive.files.delete({ fileId: file.id }) } catch { /* ignore */ }
  }

  return retentionPayload(toDelete.length)
}

async function downloadDriveBackupPlain({ drive, folderId, fileId, fileName }) {
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
  const fileData = Buffer.from(res.data)
  if (!String(fileName || '').endsWith('.wavy')) return fileData

  try {
    return decryptBackupWithLocalPassphrase({ fileData })
  } catch (error) {
    const keyFilename = getRecoveryKeyFilename(fileName)
    const keyFile = await findFileInFolderByName(drive, folderId, keyFilename)
    if (!keyFile?.id) throw error
    const keyRes = await drive.files.get({ fileId: keyFile.id, alt: 'media' }, { responseType: 'arraybuffer' })
    const keyBuffer = Buffer.from(keyRes.data)
    return decryptBackupWithRecoveryKey({
      fileData,
      keyBuffer,
      backupFilename: fileName
    })
  }
}

export async function runAutoCloseBackup() {
  forceSaveDb()
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) throw new Error('File database tidak ditemukan')

  const passphrase = getOrCreatePassphrase()
  const plainData = readFileSync(dbPath)
  const summary = await validateBackupBuffer(plainData)
  const encData = encryptBuffer(plainData, passphrase)
  const filename = createBackupFilename('auto_close')
  const keyFilename = getRecoveryKeyFilename(filename)
  const keyBuffer = buildRecoveryKeyBuffer({ backupFilename: filename, passphrase })
  const { drive, folderId } = await getDriveContext()

  const result = await uploadFileToDrive({ drive, folderId, filename, buffer: encData })
  await uploadFileToDrive({ drive, folderId, filename: keyFilename, buffer: keyBuffer })
  const retention = await pruneDriveBackups({ drive, folderId })
  return { ...result, summary, retention }
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
  ipcMain.handle('backup:create-local', async () => {
    forceSaveDb()
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) throw new Error('File database tidak ditemukan')

    const plainData = readFileSync(dbPath)
    const summary = await validateBackupBuffer(plainData)
    const backupName = createBackupFilename('manual')
    const backup = writeEncryptedBackupPair({ filename: backupName, plainData })
    const retention = pruneLocalBackups()
    logActivity({
      action: 'backup.create-local',
      detail: `Checkpoint lokal dibuat (${backupName})`
    })

    return { success: true, ...backup, summary, retention }
  })

  // List backup lokal
  ipcMain.handle('backup:list-local', () => {
    const dir = getBackupDir()
    return readdirSync(dir)
      .filter((f) => {
        if (!f.startsWith('wavy_backup') && !f.startsWith('wavy_before_restore')) return false
        if (f.endsWith(RECOVERY_KEY_SUFFIX)) return false
        return f.endsWith('.wavy') || f.endsWith('.db')
      })
      .map(f => {
        const stat = statSync(join(dir, f))
        return { name: f, size: stat.size, modifiedTime: stat.mtime.toISOString(), path: join(dir, f), encrypted: f.endsWith('.wavy') }
      })
      .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
  })

  ipcMain.handle('backup:import-local', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Pilih file backup dari luar',
      buttonLabel: 'Import',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Backup Wavy', extensions: ['wavy', 'db'] },
        { name: 'Semua File', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePaths?.length) {
      return { success: false, canceled: true, imported: [], skipped: [] }
    }

    const backupDir = getBackupDir()
    const imported = []
    const skipped = []
    const importedSet = new Set()

    const tryImportFile = (sourcePath, targetName) => {
      const targetPath = join(backupDir, targetName)
      if (importedSet.has(targetPath)) return
      copyFileSync(sourcePath, targetPath)
      importedSet.add(targetPath)
      imported.push(targetName)
    }

    for (const sourcePath of result.filePaths) {
      const sourceName = String(sourcePath).split(/[/\\]/).pop() || ''
      const lower = sourceName.toLowerCase()
      const isKey = lower.endsWith(RECOVERY_KEY_SUFFIX.toLowerCase())
      const isBackup = lower.endsWith('.wavy') || lower.endsWith('.db')

      if (!isKey && !isBackup) {
        skipped.push({ file: sourceName, reason: 'Format tidak didukung' })
        continue
      }

      tryImportFile(sourcePath, sourceName)

      // Jika user pilih file .wavy, import juga key pendamping bila ada.
      if (!isKey && lower.endsWith('.wavy')) {
        const siblingKeyPath = `${sourcePath}${RECOVERY_KEY_SUFFIX}`
        if (existsSync(siblingKeyPath)) {
          tryImportFile(siblingKeyPath, `${sourceName}${RECOVERY_KEY_SUFFIX}`)
        }
      }
    }

    if (!imported.length) {
      throw new Error('Tidak ada file backup yang berhasil diimport.')
    }

    logActivity({
      action: 'backup.import-local',
      detail: `Import backup dari file luar (${imported.length} file)`
    })

    return { success: true, canceled: false, imported, skipped }
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

  ipcMain.handle('backup:inspect-local', async (_, { path: backupPath }) => {
    if (!backupPath) throw new Error('Path backup tidak valid')
    const normalizedPath = String(backupPath)
    const backupDir = getBackupDir()
    if (!normalizedPath.startsWith(backupDir)) {
      throw new Error('Lokasi file backup tidak valid')
    }
    const summary = await inspectBackupFile(normalizedPath)
    return { success: true, summary }
  })

  // Restore dari backup lokal
  ipcMain.handle('backup:restore-local', async (_, { path: backupPath }) => {
    if (!existsSync(backupPath)) throw new Error('File backup tidak ditemukan')

    forceSaveDb()
    const plainData = readPlainLocalBackup(backupPath)
    const summary = await validateBackupBuffer(plainData)
    const safetyBackup = writeSafetyBackupIfPossible()
    replaceDbFileAtomically(plainData)
    reloadDbFromBuffer(plainData)
    logActivity({
      action: 'backup.restore-local',
      detail: `Restore backup lokal (${basename(backupPath) || backupPath})`
    })
    return {
      success: true,
      summary,
      safetyBackupName: safetyBackup?.filename || null,
      safetyBackupPath: safetyBackup?.path || null,
      relaunching: false
    }
  })

  // ── Upload ke Google Drive (terenkripsi) ───────────────────────────────────
  ipcMain.handle('backup:gdrive-upload', async () => {
    forceSaveDb()
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) throw new Error('File database tidak ditemukan')

    const passphrase = getOrCreatePassphrase()
    const plainData = readFileSync(dbPath)
    const summary = await validateBackupBuffer(plainData)
    const encData = encryptBuffer(plainData, passphrase)
    const filename = createBackupFilename('manual')
    const keyFilename = getRecoveryKeyFilename(filename)
    const keyBuffer = buildRecoveryKeyBuffer({ backupFilename: filename, passphrase })
    const { drive, folderId } = await getDriveContext()
    const result = await uploadFileToDrive({ drive, folderId, filename, buffer: encData })
    await uploadFileToDrive({ drive, folderId, filename: keyFilename, buffer: keyBuffer })
    const retention = await pruneDriveBackups({ drive, folderId })
    logActivity({
      action: 'backup.gdrive-upload',
      detail: `Backup berhasil di-upload ke Google Drive (${filename})`
    })
    return { ...result, encrypted: true, summary, retention }
  })

  ipcMain.handle('backup:gdrive-list', async () => {
    const { drive, folderId } = await getDriveContext()
    return listBackupFiles(drive, folderId)
  })

  ipcMain.handle('backup:gdrive-inspect', async (_, { fileId, fileName }) => {
    if (!fileId) throw new Error('File backup tidak valid')
    const { drive, folderId } = await getDriveContext()
    const plainData = await downloadDriveBackupPlain({ drive, folderId, fileId, fileName })
    const summary = await validateBackupBuffer(plainData)
    return { success: true, summary }
  })

  // Download & restore dari Google Drive (decrypt otomatis)
  ipcMain.handle('backup:gdrive-restore', async (_, { fileId, fileName }) => {
    forceSaveDb()

    const { drive, folderId } = await getDriveContext()
    const plainData = await downloadDriveBackupPlain({ drive, folderId, fileId, fileName })
    const summary = await validateBackupBuffer(plainData)
    const safetyBackup = writeSafetyBackupIfPossible()
    replaceDbFileAtomically(plainData)
    reloadDbFromBuffer(plainData)
    logActivity({
      action: 'backup.gdrive-restore',
      detail: `Restore backup dari Google Drive (${fileName || fileId})`
    })
    return {
      success: true,
      filename: fileName,
      summary,
      safetyBackupName: safetyBackup?.filename || null,
      relaunching: false
    }
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
