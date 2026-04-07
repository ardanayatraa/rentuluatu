#!/usr/bin/env node
/**
 * Tool untuk generate kode aktivasi Wavy Rental
 * Jalankan: node tools/generate-serial.js <machineId> <expiryDate>
 *
 * Contoh:
 *   node tools/generate-serial.js A1B2C3D4E5F6G7H8 2027-01-01
 *   node tools/generate-serial.js A1B2C3D4E5F6G7H8 LIFETIME
 */

import { createHmac } from 'crypto'

// HARUS SAMA dengan SECRET_KEY di src/main/lib/license.js
const SECRET_KEY = process.env.WAVY_LICENSE_SECRET || 'wavy-rental-secret-2024-artha-bali-wisata'

function generateSerial(machineId, expiryDate) {
  const payload = `${machineId}:${expiryDate}`
  const hmac = createHmac('sha256', SECRET_KEY).update(payload).digest('hex')
  const raw = hmac.slice(0, 16).toUpperCase()
  return `WAVY-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}`
}

const [,, machineId, expiryDate] = process.argv

if (!machineId || !expiryDate) {
  console.log('Usage: node tools/generate-serial.js <machineId> <expiryDate>')
  console.log('Example: node tools/generate-serial.js A1B2C3D4E5F6G7H8 2027-01-01')
  console.log('Example: node tools/generate-serial.js A1B2C3D4E5F6G7H8 LIFETIME')
  process.exit(1)
}

const serial = generateSerial(machineId.toUpperCase(), expiryDate)
const activationCode = `${serial}|${expiryDate}`

console.log('\n=== WAVY RENTAL LICENSE GENERATOR ===')
console.log(`Machine ID  : ${machineId.toUpperCase()}`)
console.log(`Expiry Date : ${expiryDate}`)
console.log(`Serial      : ${serial}`)
console.log(`\nKode Aktivasi (berikan ke customer):`)
console.log(`\n  ${activationCode}\n`)
