# Wavy Tools

Tools untuk debugging dan maintenance aplikasi Wavy.

## Debug Dashboard

Tool untuk investigasi data dashboard dan verifikasi perhitungan.

### Cara Pakai:

1. **Buka terminal di folder `wavy/`**

2. **Jalankan script:**
   ```bash
   node tools/debug-dashboard.cjs
   ```

3. **Output akan menampilkan:**
   - ✅ Semua rental dalam periode
   - ✅ Semua pengeluaran (motor & operasional)
   - ✅ Saldo kas per akun
   - ✅ Semua transaksi kas
   - ✅ Verifikasi perhitungan
   - ✅ Expected vs Actual cash
   - ✅ Breakdown komisi per rental

### Troubleshooting:

**Error: Cannot find database**
- Pastikan aplikasi Wavy sudah pernah dijalankan minimal 1x
- Database otomatis dibuat di:
  - Windows: `C:\Users\<user>\AppData\Roaming\wavy\wavy.db`
  - macOS: `~/Library/Application Support/wavy/wavy.db`
  - Linux: `~/.config/wavy/wavy.db`

**Error: Cannot find module 'better-sqlite3'**
- Jalankan: `npm install` di folder `wavy/`

### Edit Filter Tanggal:

Buka file `tools/debug-dashboard.cjs` dan ubah:
```javascript
const startDate = '2026-04-01'  // Ubah sesuai kebutuhan
const endDate = '2026-04-30'    // Ubah sesuai kebutuhan
```

---

## Generate Serial (License)

Tool untuk generate serial number license.

```bash
node tools/generate-serial.js
```

---

## Recovery Passphrase Tool (Python)

Tool developer untuk kondisi laptop client hilang: ambil passphrase dari file
recovery key (`*.key.wavy`) lalu apply ke `.backup-key` di laptop baru.

### Install dependency

```bash
pip install cryptography
```

### 1) Cek recovery key valid + lihat metadata

```bash
python tools/recovery-passphrase-tool.py --key-file "D:\restore\wavy_backup_monthly_2026-04.wavy.key.wavy"
```

### 2) Apply passphrase ke mesin sekarang (default userData app `wavy`)

```bash
python tools/recovery-passphrase-tool.py --key-file "D:\restore\wavy_backup_monthly_2026-04.wavy.key.wavy" --apply
```

### 3) Apply dengan path custom

```bash
python tools/recovery-passphrase-tool.py --key-file "D:\restore\xxx.key.wavy" --apply --key-path "C:\Users\Admin\AppData\Roaming\wavy\.backup-key"
```

### Optional flags

- `--backup-name "wavy_backup_monthly_2026-04.wavy"` untuk validasi nama backup.
- `--show-passphrase` untuk tampilkan passphrase asli di console.
- `--recovery-password` kalau password recovery bukan default `wavy2026`.
