import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { cpSync, existsSync, mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb, dbOps, forceSaveDb } from './db'
import { registerAllHandlers } from './ipc'
import { runAutoCloseBackup, shouldAutoBackupOnClose } from './ipc/backup'

const STABLE_USER_DATA_DIR = 'Wavy Rental'

function configureStableUserDataPath() {
  const legacyUserDataPath = app.getPath('userData')
  const stableUserDataPath = join(app.getPath('appData'), STABLE_USER_DATA_DIR)
  const stableDbPath = join(stableUserDataPath, 'wavy.db')

  mkdirSync(stableUserDataPath, { recursive: true })

  if (!existsSync(stableDbPath)) {
    const appDataRoot = app.getPath('appData')
    const legacyCandidates = [
      legacyUserDataPath,
      join(appDataRoot, 'wavy'),
      join(appDataRoot, 'Wavy'),
      join(appDataRoot, 'Wavy - CashFlow Monitoring')
    ]

    const sourcePath = legacyCandidates.find((candidatePath) => {
      if (!candidatePath || candidatePath === stableUserDataPath) return false
      return existsSync(join(candidatePath, 'wavy.db'))
    })

    if (sourcePath) {
      cpSync(sourcePath, stableUserDataPath, { recursive: true, force: false, errorOnExist: false })
    }
  }

  app.setPath('userData', stableUserDataPath)
}

configureStableUserDataPath()

async function runSeeder() {
  // Seeder data demo hanya untuk development.
  // Production harus mulai dari data kosong (fresh install).
  if (app.isPackaged || !is.dev) return

  const existing = dbOps.get('SELECT COUNT(*) as count FROM motors')
  if (existing && existing.count > 0) return

  console.log('[Seeder] start...')

  const motorModels = ['Honda Beat', 'Honda Vario 125', 'Honda Vario 150', 'Honda PCX 150', 'Honda Scoopy', 'Yamaha NMAX', 'Yamaha Aerox', 'Yamaha Mio M3', 'Yamaha Freego', 'Yamaha Lexi', 'Honda ADV 150', 'Honda CBR 150', 'Yamaha R15', 'Honda Genio', 'Honda Stylo']
  const ownerNames = ['Wayan Suarta', 'Made Artawan', 'Nyoman Sudana', 'Ketut Wirawan', 'Putu Ariana', 'Gede Mahendra', 'Komang Sari', 'Luh Ayu', 'Bagus Pratama', 'Agus Setiawan', 'Budi Santoso', 'Dewa Putu', 'Rai Kusuma', 'Surya Dharma', 'Indra Wijaya']
  const customerNames = ['John Smith', 'Emma Wilson', 'Liam Johnson', 'Olivia Brown', 'Noah Davis', 'Ava Martinez', 'William Garcia', 'Sophia Anderson', 'James Taylor', 'Isabella Thomas', 'Oliver Jackson', 'Mia White', 'Benjamin Harris', 'Charlotte Martin', 'Elijah Thompson', 'Amelia Robinson', 'Lucas Clark', 'Harper Lewis', 'Mason Lee', 'Evelyn Walker', 'Tanaka Hiroshi', 'Kim Minji', 'Wang Wei', 'Priya Sharma', 'Ahmed Hassan', 'Marie Dubois', 'Hans Mueller', 'Sofia Rossi', 'Carlos Lopez', 'Anna Kowalski']
  const hotels = ['Kuta Beach Hotel', 'Seminyak Villas', 'Ubud Resort', 'Nusa Dua Palace', 'Legian Boutique', 'Canggu Surf Lodge', 'Jimbaran Bay Resort', 'Sanur Beach Hotel', 'Uluwatu Cliff Villa', 'Berawa Garden', 'Petitenget Hotel', 'Double Six Luxury', 'The Layar', 'Alaya Resort', 'Katamama', 'Potato Head Suites', 'W Bali', 'Four Seasons Jimbaran', 'Bulgari Resort', 'COMO Uma Canggu']
  const expMotor = ['gps', 'samsat', 'service', 'lainnya']
  const expUmum = ['air', 'listrik', 'bensin', 'aksesori', 'lainnya']
  const prices = [75000, 80000, 85000, 90000, 100000, 110000, 120000, 150000]
  const reasons = ['Perubahan jadwal', 'Cuaca buruk', 'Sakit', 'Lainnya']

  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
  const pick = (a) => a[Math.floor(Math.random() * a.length)]
  const rDate = (n) => { const d = new Date(); d.setDate(d.getDate() - ri(0, n)); return d.toISOString().split('T')[0] }
  const rDT = (n) => { const d = new Date(); d.setDate(d.getDate() - ri(0, n)); d.setHours(ri(7, 20), ri(0, 59)); return d.toISOString().slice(0, 16) }

  let hash = 'wavy2026'
  try {
    const bcrypt = await import('bcryptjs')
    hash = await bcrypt.default.hash('wavy2026', 10)
  } catch { /* simpan plain jika bcrypt belum ada */ }
  dbOps.run('UPDATE users SET password_hash = ? WHERE username = ?', [hash, 'admin'])

  const ownerIds = []
  for (let i = 0; i < 15; i++) {
    dbOps.run('INSERT INTO owners (name, phone, bank_account, bank_name) VALUES (?, ?, ?, ?)', [ownerNames[i], '08' + ri(100000000, 999999999), null, null])
    ownerIds.push(dbOps.get('SELECT last_insert_rowid() as id').id)
  }

  const motorData = []
  const motorIds = []
  for (let i = 0; i < 50; i++) {
    const type = Math.random() > 0.4 ? 'milik_pemilik' : 'aset_pt'
    const ownerId = type === 'milik_pemilik' ? pick(ownerIds) : null
    const plate = 'DK ' + ri(1000, 9999) + ' ' + String.fromCharCode(65 + ri(0, 25)) + String.fromCharCode(65 + ri(0, 25))
    dbOps.run('INSERT INTO motors (model, plate_number, type, owner_id) VALUES (?, ?, ?, ?)', [pick(motorModels), plate, type, ownerId])
    const id = dbOps.get('SELECT last_insert_rowid() as id').id
    motorIds.push(id)
    motorData.push({ id, type })
  }

  let tunai = 2000000
  let transfer = 5000000

  for (let i = 0; i < 1000; i++) {
    const motor = pick(motorData)
    const days = ri(1, 14)
    const price = pick(prices)
    const fee = Math.random() > 0.6 ? ri(10000, 50000) : 0
    const pay = Math.random() > 0.4 ? 'transfer' : 'tunai'
    const dt = rDT(365)
    const gross = price * days
    const sisa = gross - fee
    const wavyPct = motor.type === 'aset_pt' ? 0.20 : 0.30
    const status = Math.random() > 0.1 ? 'completed' : 'refunded'

    dbOps.run('INSERT INTO rentals (date_time, customer_name, hotel, motor_id, period_days, payment_method, price_per_day, vendor_fee, sisa, wavy_gets, owner_gets, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [dt, pick(customerNames), pick(hotels), motor.id, days, pay, price, fee, sisa, sisa * wavyPct, sisa * (1 - wavyPct), status])
    const rentalId = dbOps.get('SELECT last_insert_rowid() as id').id
      const acc = dbOps.get(
        "SELECT * FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = 'pendapatan' ORDER BY id ASC LIMIT 1",
        [pay]
      )

    if (status === 'completed' && acc) {
      dbOps.run("INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (?, 'in', ?, 'rental', ?, ?, ?)", [acc.id, gross, rentalId, 'Sewa - ' + pick(customerNames), dt.split('T')[0]])
      if (pay === 'tunai') tunai += gross; else transfer += gross
    }

    if (status === 'refunded') {
      const remDays = ri(1, days)
      const pct = pick([50, 100])
      const refAmt = remDays * price * (pct / 100)
      dbOps.run('INSERT INTO refunds (rental_id, refund_percentage, refund_amount, remaining_days, reason) VALUES (?, ?, ?, ?, ?)', [rentalId, pct, refAmt, remDays, pick(reasons)])
      if (acc) {
        dbOps.run("INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (?, 'out', ?, 'refund', ?, 'Refund rental', ?)", [acc.id, refAmt, rentalId, dt.split('T')[0]])
        if (pay === 'tunai') tunai -= refAmt; else transfer -= refAmt
      }
    }
  }

  for (let i = 0; i < 1000; i++) {
    const type = Math.random() > 0.5 ? 'motor' : 'umum'
    const motorId = type === 'motor' ? pick(motorIds) : null
    const cat = pick(type === 'motor' ? expMotor : expUmum)
    const amount = ri(25000, 500000)
    const pay = Math.random() > 0.5 ? 'transfer' : 'tunai'
    const date = rDate(365)
    dbOps.run('INSERT INTO expenses (type, motor_id, category, amount, payment_method, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)', [type, motorId, cat, amount, pay, cat + ' - ' + date, date])
    const expId = dbOps.get('SELECT last_insert_rowid() as id').id
      const acc = dbOps.get(
        "SELECT * FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = 'pendapatan' ORDER BY id ASC LIMIT 1",
        [pay]
      )
    if (acc) {
      dbOps.run("INSERT INTO cash_transactions (cash_account_id, type, amount, reference_type, reference_id, description, date) VALUES (?, 'out', ?, 'expense', ?, ?, ?)", [acc.id, amount, expId, cat, date])
      if (pay === 'tunai') tunai -= amount; else transfer -= amount
    }
  }

  const updateCashBalance = (type, bucket, balance) => {
    const account = dbOps.get(
      "SELECT id FROM cash_accounts WHERE type = ? AND COALESCE(bucket, 'pendapatan') = ?",
      [type, bucket]
    ) || dbOps.get('SELECT id FROM cash_accounts WHERE type = ?', [type])
    if (account?.id) {
      dbOps.run('UPDATE cash_accounts SET balance = ? WHERE id = ?', [Math.max(balance, 0), account.id])
    }
  }

  updateCashBalance('tunai', 'pendapatan', tunai)
  updateCashBalance('transfer', 'pendapatan', transfer)
  forceSaveDb()
  console.log('[Seeder] done.')
}

function createWindow() {
  let isClosingAfterBackup = false
  let closeBackupInProgress = false
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.on('close', (event) => {
    if (isClosingAfterBackup || closeBackupInProgress || !shouldAutoBackupOnClose()) return

    event.preventDefault()
    closeBackupInProgress = true
    mainWindow.webContents.send('app:auto-backup-close-state', {
      visible: true,
      success: true,
      message: 'Silakan tunggu, sedang backup data ke Google Drive...'
    })

    runAutoCloseBackup()
      .then((result) => {
        mainWindow.webContents.send('app:auto-backup-close-state', {
          visible: true,
          success: true,
          message: result.updated
            ? 'Backup harian berhasil diperbarui. Aplikasi akan ditutup...'
            : 'Backup harian berhasil dibuat. Aplikasi akan ditutup...'
        })
        setTimeout(() => {
          isClosingAfterBackup = true
          mainWindow.destroy()
        }, 700)
      })
      .catch((error) => {
        mainWindow.webContents.send('app:auto-backup-close-state', {
          visible: true,
          success: false,
          message: `Backup otomatis gagal: ${error.message}. Aplikasi akan tetap ditutup...`
        })
        setTimeout(() => {
          isClosingAfterBackup = true
          mainWindow.destroy()
        }, 1400)
      })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Izinkan window kosong untuk print PDF
    if (!details.url || details.url === 'about:blank') {
      return { action: 'allow' }
    }
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.wavy.rental')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  await initDb()
  await runSeeder()
  registerAllHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  forceSaveDb()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
