#!/usr/bin/env node
import { createDecipheriv, scryptSync } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import os from 'os'

const ENC_MAGIC = Buffer.from('WAVY01')
const KEY_SUFFIX = '.key.wavy'

function parseArgs(argv) {
  const result = { _: [] }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      result._.push(token)
      continue
    }

    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      result[key] = true
      continue
    }
    result[key] = next
    i += 1
  }
  return result
}

function usage() {
  console.log(`\nWavy Recovery Admin Tool (Node.js, no Python)\n\nUsage:\n  node tools/recovery-admin-tool.js inspect-key --key-file <path> [--backup-name <name>] [--recovery-password <secret>] [--show-passphrase]\n  node tools/recovery-admin-tool.js check-pair --backup-file <path.wavy> --key-file <path.key.wavy> [--recovery-password <secret>]\n  node tools/recovery-admin-tool.js decrypt-backup --backup-file <path.wavy> --key-file <path.key.wavy> --out <path.db> [--recovery-password <secret>]\n  node tools/recovery-admin-tool.js apply-key --key-file <path.key.wavy> [--key-path <path/.backup-key>] [--recovery-password <secret>]\n\nNotes:\n  - recovery password default diambil dari env BACKUP_RECOVERY_PASSWORD.\n  - untuk production, set BACKUP_RECOVERY_PASSWORD yang sama dengan app build.\n`) 
}

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 })
}

function decryptBuffer(encBuffer, passphrase) {
  if (!Buffer.isBuffer(encBuffer)) throw new Error('Data tidak valid')
  const magic = encBuffer.slice(0, 6)
  if (!magic.equals(ENC_MAGIC)) throw new Error('File bukan backup/key Wavy terenkripsi atau rusak')

  const salt = encBuffer.slice(6, 38)
  const iv = encBuffer.slice(38, 50)
  const authTag = encBuffer.slice(50, 66)
  const ciphertext = encBuffer.slice(66)

  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

function getRecoveryPassword(args) {
  const pass = String(args['recovery-password'] || process.env.BACKUP_RECOVERY_PASSWORD || '').trim()
  if (pass.length < 16) {
    throw new Error('BACKUP_RECOVERY_PASSWORD wajib diisi (minimal 16 karakter).')
  }
  return pass
}

function parseRecoveryKeyFile({ keyFile, recoveryPassword, backupName }) {
  if (!existsSync(keyFile)) throw new Error(`File key tidak ditemukan: ${keyFile}`)
  const keyBuffer = readFileSync(keyFile)
  const plain = decryptBuffer(keyBuffer, recoveryPassword)
  const payload = JSON.parse(plain.toString('utf-8'))

  if (!payload || typeof payload !== 'object' || !payload.passphrase) {
    throw new Error('Payload recovery key tidak valid')
  }

  if (backupName && payload.backupFilename && payload.backupFilename !== backupName) {
    throw new Error(`Recovery key mismatch. expected=${backupName}, actual=${payload.backupFilename}`)
  }

  return payload
}

function resolveDefaultBackupKeyPath() {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || resolve(home, 'AppData', 'Roaming')
    return resolve(appData, 'Wavy Rental', '.backup-key')
  }
  if (process.platform === 'darwin') {
    return resolve(home, 'Library', 'Application Support', 'Wavy Rental', '.backup-key')
  }
  return resolve(home, '.config', 'Wavy Rental', '.backup-key')
}

function commandInspectKey(args) {
  const keyFile = args['key-file']
  if (!keyFile) throw new Error('--key-file wajib diisi')

  const recoveryPassword = getRecoveryPassword(args)
  const payload = parseRecoveryKeyFile({
    keyFile: resolve(keyFile),
    recoveryPassword,
    backupName: args['backup-name'] ? String(args['backup-name']) : null
  })

  console.log('\nRecovery key valid')
  console.log(`  backupFilename : ${payload.backupFilename || '(none)'}`)
  console.log(`  createdAt      : ${payload.createdAt || '(none)'}`)
  console.log(`  passphraseLen  : ${String(payload.passphrase || '').length}`)
  if (args['show-passphrase']) {
    console.log(`  passphrase     : ${payload.passphrase}`)
  }
}

function commandCheckPair(args) {
  const backupFile = args['backup-file']
  const keyFile = args['key-file']
  if (!backupFile || !keyFile) throw new Error('--backup-file dan --key-file wajib diisi')

  const backupAbs = resolve(backupFile)
  const keyAbs = resolve(keyFile)
  if (!existsSync(backupAbs)) throw new Error(`Backup tidak ditemukan: ${backupAbs}`)

  const recoveryPassword = getRecoveryPassword(args)
  const backupName = backupAbs.split(/[/\\]/).pop()
  const payload = parseRecoveryKeyFile({ keyFile: keyAbs, recoveryPassword, backupName })

  const backupBuffer = readFileSync(backupAbs)
  decryptBuffer(backupBuffer, String(payload.passphrase))

  console.log('\nPair valid: backup + recovery key cocok dan bisa didecrypt.')
}

function commandDecryptBackup(args) {
  const backupFile = args['backup-file']
  const keyFile = args['key-file']
  const out = args.out
  if (!backupFile || !keyFile || !out) {
    throw new Error('--backup-file, --key-file, dan --out wajib diisi')
  }

  const backupAbs = resolve(backupFile)
  const keyAbs = resolve(keyFile)
  const outAbs = resolve(out)

  if (!existsSync(backupAbs)) throw new Error(`Backup tidak ditemukan: ${backupAbs}`)

  const recoveryPassword = getRecoveryPassword(args)
  const backupName = backupAbs.split(/[/\\]/).pop()
  const payload = parseRecoveryKeyFile({ keyFile: keyAbs, recoveryPassword, backupName })

  const backupBuffer = readFileSync(backupAbs)
  const plainDb = decryptBuffer(backupBuffer, String(payload.passphrase))

  mkdirSync(dirname(outAbs), { recursive: true })
  writeFileSync(outAbs, plainDb)

  console.log('\nDecrypt sukses')
  console.log(`  output DB: ${outAbs}`)
  console.log(`  size     : ${plainDb.length} bytes`)
}

function commandApplyKey(args) {
  const keyFile = args['key-file']
  if (!keyFile) throw new Error('--key-file wajib diisi')

  const keyPath = resolve(String(args['key-path'] || resolveDefaultBackupKeyPath()))
  const recoveryPassword = getRecoveryPassword(args)

  const payload = parseRecoveryKeyFile({
    keyFile: resolve(keyFile),
    recoveryPassword,
    backupName: args['backup-name'] ? String(args['backup-name']) : null
  })

  mkdirSync(dirname(keyPath), { recursive: true })
  writeFileSync(keyPath, String(payload.passphrase), { mode: 0o600 })

  console.log('\nApply passphrase sukses')
  console.log(`  key path : ${keyPath}`)
  console.log(`  source   : ${resolve(keyFile)}`)
}

function run() {
  const args = parseArgs(process.argv)
  const command = String(args._[0] || '').trim()

  if (!command || command === 'help' || command === '--help') {
    usage()
    process.exit(0)
  }

  if (command === 'inspect-key') return commandInspectKey(args)
  if (command === 'check-pair') return commandCheckPair(args)
  if (command === 'decrypt-backup') return commandDecryptBackup(args)
  if (command === 'apply-key') return commandApplyKey(args)

  throw new Error(`Command tidak dikenal: ${command}`)
}

try {
  run()
} catch (error) {
  console.error(`\nERROR: ${error.message}`)
  process.exit(1)
}
