# Wavy — CashFlow Monitoring

Aplikasi desktop manajemen rental motor berbasis Electron + Vue. Mengelola data sewa, komisi owner, komisi vendor/hotel, arus kas, laporan keuangan, dan backup data.

---

## Daftar Isi

- [Fitur](#fitur)
- [Setup Development](#setup-development)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Build ke Executable](#build-ke-executable)
- [Login Pertama Kali](#login-pertama-kali)
- [Panduan Penggunaan](#panduan-penggunaan)
- [Database & Migrasi](#database--migrasi)
- [Backup & Restore](#backup--restore)
- [Menjalankan Unit Test](#menjalankan-unit-test)
- [Menambah Fitur Baru (Developer)](#menambah-fitur-baru-developer)

---

## Fitur

- Pencatatan transaksi sewa motor harian
- Manajemen motor, pemilik (owner), dan vendor/hotel
- Kalkulasi komisi otomatis (titipan 30/70, pribadi 20/80)
- Payout komisi owner dengan potongan biaya motor
- Payout komisi vendor/hotel
- Manajemen kas (tunai, transfer, QRIS)
- Laporan keuangan: laba rugi, rekap tahunan, per motor, per owner
- Export PDF dan Excel
- Backup & restore (lokal + Google Drive, terenkripsi)

---

## Setup Development

### Prasyarat

- Node.js >= 18
- npm >= 9

### Install dependensi

```bash
npm install
```

### Jalankan mode development

```bash
npm run dev
```

### Perintah lain

```bash
npm run lint        # cek kode
npm run format      # format kode dengan Prettier
npm run test        # jalankan unit test (sekali)
npm run test:watch  # unit test mode watch
```

---

## Konfigurasi Environment

Buat file `.env` di root folder `wavy/` (sudah ada contohnya). Isi yang dibutuhkan:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Kedua variabel ini hanya diperlukan jika fitur **backup Google Drive** digunakan. Jika tidak, biarkan kosong — aplikasi tetap berjalan normal.

> **Penting:** File `.env` tidak ikut ter-bundle ke dalam `.exe`. Nilai env dibaca saat build dan di-embed ke binary. Jadi pastikan `.env` sudah benar sebelum menjalankan `npm run build:win`.

---

## Build ke Executable

```bash
# Windows (.exe installer)
npm run build:win

# macOS (.dmg)
npm run build:mac

# Linux (.AppImage / .deb)
npm run build:linux
```

File hasil build ada di folder `dist/`.

### Catatan penting saat build

- Database **tidak ikut di-bundle** ke dalam `.exe`. Database dibuat otomatis di folder `userData` milik user saat aplikasi pertama kali dijalankan.
- Lokasi database di Windows: `C:\Users\<nama_user>\AppData\Roaming\wavy\wavy.db`
- Install baru = database kosong, siap dipakai langsung.
- Update app (install ulang `.exe` versi baru) = data lama **tetap aman**, schema otomatis dimigrasi.

---

## Login Pertama Kali

Saat install baru, gunakan kredensial default:

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | (kosongkan / isi apa saja) |

Setelah masuk, **segera ganti password** melalui menu **Settings → Ganti Password**. Password baru minimal 4 karakter.

---

## Panduan Penggunaan

### 1. Setup Awal

Setelah install, lakukan setup awal sebelum mulai mencatat transaksi:

1. **Set Saldo Awal Kas** — buka menu **Kas**, klik "Set Saldo Awal", isi saldo tunai/transfer/QRIS sesuai kondisi nyata.
2. **Tambah Owner/Mitra** — buka menu **Owners**, tambahkan pemilik motor beserta info rekening bank.
3. **Tambah Motor** — buka menu **Motors**, tambahkan motor dengan tipe (pribadi/titipan) dan hubungkan ke owner.
4. **Tambah Vendor/Hotel** — buka menu **Hotels**, tambahkan hotel/vendor rekanan beserta info rekening.

### 2. Mencatat Transaksi Sewa

Buka menu **Daily Record** → klik **Tambah Rental**.

| Field | Keterangan |
|-------|-----------|
| Tanggal & Waktu | Waktu transaksi |
| Nama Pelanggan | Nama penyewa |
| Motor | Cari by model atau plat nomor |
| Hotel / Vendor | Opsional — pilih dari daftar vendor terdaftar agar komisi tercatat |
| Periode (hari) | Durasi sewa |
| Price (Harga Kotor) | Total yang dibayar pelanggan |
| Vendor Fee | Komisi untuk hotel/vendor (harus ≤ harga kotor) |
| Metode Bayar | Tunai / Transfer / QRIS |

Komisi otomatis dihitung:
- **Motor titipan**: Wavy 30%, Owner 70% dari sisa (harga - vendor fee)
- **Motor pribadi**: Wavy 20%, Owner 80% dari sisa

### 3. Proses Refund

Di tabel Daily Record, klik ikon **undo** pada baris rental yang ingin direfund.

- Pilih jumlah sisa hari
- Pilih skema: 100%, 50%, atau custom
- Sistem akan cek saldo kas sebelum memproses — jika tidak cukup, refund ditolak

### 4. Bayar Komisi Owner

Buka menu **Owners** → klik nama owner → klik **Bayar Sekarang**.

- Preview menampilkan komisi kotor, potongan biaya motor, dan jumlah bersih
- Pilih sumber kas
- Klik **Bayar** — saldo kas berkurang, rental ditandai lunas

### 5. Bayar Komisi Vendor/Hotel

Buka menu **Hotels** → klik nama hotel → klik **Bayar Komisi Vendor**.

- Preview menampilkan semua rental yang belum dibayarkan
- Pilih sumber kas
- Klik **Bayar Sekarang**

### 6. Manajemen Kas

Buka menu **Kas**:

- **Tambah Pemasukan** — untuk pemasukan non-rental (jual helm, SIM card, dll)
- **Set Saldo Awal** — atur ulang saldo awal (menggantikan saldo lama, tidak menambah)
- **Riwayat Mutasi** — semua transaksi masuk/keluar per akun kas

### 7. Laporan

Buka menu **Reports**, pilih tab laporan:

| Tab | Isi |
|-----|-----|
| Keuangan | Ringkasan per hari/bulan/tahun |
| Laba Rugi | Omzet, wavy gets, beban, laba bersih |
| Rekap Tahunan | 12 bulan dalam satu tahun |
| Pendapatan Motor | Detail transaksi per motor |
| Pengeluaran Motor | Biaya servis, dll per motor |
| Semua Transaksi | Gabungan pemasukan & pengeluaran |
| Komisi Mitra | Rincian komisi per owner |
| Laporan Mitra | Ringkasan semua owner |
| Ranking Motor | Motor paling produktif |

Semua laporan bisa di-export ke **PDF** atau **Excel**.

---

## Database & Migrasi

Database disimpan di folder `userData` sistem operasi, **bukan** di dalam folder instalasi aplikasi. Ini berarti:

- Uninstall aplikasi **tidak menghapus data**
- Update aplikasi ke versi baru **tidak menghapus data**
- Data hanya hilang jika folder `userData` dihapus manual

### Lokasi database

| OS | Path |
|----|------|
| Windows | `C:\Users\<user>\AppData\Roaming\wavy\wavy.db` |
| macOS | `~/Library/Application Support/wavy/wavy.db` |
| Linux | `~/.config/wavy/wavy.db` |

### Sistem versi schema

Database menggunakan sistem migrasi berbasis versi (`schema_version`). Setiap kali aplikasi dibuka:

1. Cek versi schema saat ini di database
2. Jalankan hanya migrasi yang belum pernah dijalankan
3. Catat versi baru ke tabel `schema_version`

Install baru langsung mendapat schema versi terbaru tanpa menjalankan migrasi satu per satu.

---

## Backup & Restore

### Backup Lokal

Buka **Settings → Backup** → klik **Backup Lokal**.

- File disimpan di `userData/backups/` dengan format `wavy_backup_YYYY-MM-DD.wavy`
- File terenkripsi otomatis (AES-256-GCM)
- Untuk restore: pilih file dari daftar → klik **Restore**

### Backup Google Drive

1. Buka **Settings → Backup**
2. Klik **Hubungkan Google Drive** — browser akan terbuka untuk login Google
3. Setelah terhubung, klik **Upload ke Drive**
4. File tersimpan di folder `Wavy Rental Backups` di Google Drive, terenkripsi

> Untuk menggunakan fitur ini, `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` harus diisi di `.env` sebelum build.

### Set Passphrase Enkripsi

Secara default, enkripsi menggunakan key yang di-generate otomatis dan disimpan di `userData/.backup-key`. Untuk set passphrase sendiri: **Settings → Backup → Set Passphrase**.

> Simpan passphrase di tempat aman. Jika hilang, file backup tidak bisa di-decrypt.

---

## Menjalankan Unit Test

```bash
# Jalankan sekali
npm run test

# Mode watch (otomatis re-run saat file berubah)
npm run test:watch
```

Test files ada di `src/tests/`:

| File | Cakupan |
|------|---------|
| `finance.test.js` | Kalkulasi komisi, neraca, refund amount |
| `refunds.test.js` | Logika refund, urutan validasi, price_per_day |
| `commission.test.js` | Owner/hotel payout, server-side validation, race condition |
| `cashflow.test.js` | Arus kas, opening balance, dashboard summary, laba rugi |

---

## Menambah Fitur Baru (Developer)

### Menambah kolom baru ke tabel yang sudah ada

1. Tambahkan kolom ke definisi tabel di fungsi `createBaseSchema()` di `src/main/db.js` (untuk install baru)
2. Naikkan nilai `SCHEMA_VERSION`
3. Tambahkan entry migrasi baru di array `migrations`:

```js
{
  version: 7, // sesuaikan dengan SCHEMA_VERSION
  up() {
    try { db.run("ALTER TABLE rentals ADD COLUMN notes TEXT") } catch (_) {}
  }
}
```

### Menambah tabel baru

1. Tambahkan `CREATE TABLE IF NOT EXISTS` di `createBaseSchema()`
2. Naikkan `SCHEMA_VERSION`
3. Tidak perlu migrasi untuk tabel baru — `CREATE TABLE IF NOT EXISTS` sudah idempotent

### Aturan migrasi

- **Jangan ubah atau hapus** entry migrasi yang sudah ada
- Setiap `version` harus unik dan berurutan
- Selalu gunakan `try/catch` di dalam `up()` untuk ALTER TABLE
- Test migrasi dengan menjalankan `npm run dev` pada database lama

### Struktur folder

```
src/
├── main/
│   ├── db.js              # Database, schema, migrasi
│   ├── index.js           # Entry point Electron main process
│   ├── ipc/               # Handler IPC per domain
│   │   ├── auth.js
│   │   ├── rentals.js
│   │   ├── hotels.js
│   │   ├── owners.js
│   │   ├── motors.js
│   │   ├── expenses.js
│   │   ├── refunds.js
│   │   ├── cash.js
│   │   ├── dashboard.js
│   │   ├── reports.js
│   │   ├── backup.js
│   │   └── reset.js
│   └── lib/
│       └── finance.js     # Pure business logic (kalkulasi komisi, refund)
├── preload/
│   └── index.js           # Bridge renderer ↔ main (window.api)
├── renderer/
│   └── src/
│       ├── views/         # Halaman Vue
│       ├── components/    # Komponen reusable
│       ├── stores/        # Pinia stores
│       ├── utils/         # Helper (format, pdf, excel)
│       └── router/        # Vue Router
└── tests/                 # Unit tests (Vitest)
```
