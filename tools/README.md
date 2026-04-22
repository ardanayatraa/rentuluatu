# Wavy Tools

Tools untuk debugging dan maintenance aplikasi Wavy.

## Generate Serial (License)

Tool untuk generate serial number license.

```bash
node tools/generate-serial.js <machineId> <expiryDate>
```

Contoh:

```bash
node tools/generate-serial.js A1B2C3D4E5F6G7H8 2027-01-01
node tools/generate-serial.js A1B2C3D4E5F6G7H8 LIFETIME
```

---

## Recovery Admin Tool (Node.js, No Python)

Tool internal khusus admin/dev untuk skenario pindah laptop atau recovery backup.

### Jalankan

```bash
npm run recovery:tool -- help
```

### 1) Cek recovery key valid + metadata

```bash
npm run recovery:tool -- inspect-key --key-file "D:\\restore\\wavy_backup_monthly_2026-04.wavy.key.wavy"
```

### 2) Validasi pasangan backup + key

```bash
npm run recovery:tool -- check-pair --backup-file "D:\\restore\\wavy_backup_monthly_2026-04.wavy" --key-file "D:\\restore\\wavy_backup_monthly_2026-04.wavy.key.wavy"
```

### 3) Decrypt backup jadi file `.db`

```bash
npm run recovery:tool -- decrypt-backup --backup-file "D:\\restore\\wavy_backup_monthly_2026-04.wavy" --key-file "D:\\restore\\wavy_backup_monthly_2026-04.wavy.key.wavy" --out "D:\\restore\\wavy_restored.db"
```

### 4) Apply passphrase ke laptop ini (`.backup-key`)

```bash
npm run recovery:tool -- apply-key --key-file "D:\\restore\\wavy_backup_monthly_2026-04.wavy.key.wavy"
```

Secara default tool akan menulis ke path:
- Windows: `C:\\Users\\<user>\\AppData\\Roaming\\Wavy Rental\\.backup-key`
- macOS: `~/Library/Application Support/Wavy Rental/.backup-key`
- Linux: `~/.config/Wavy Rental/.backup-key`

### Opsi penting

- `--recovery-password "..."` jika tidak pakai env var.
- `--backup-name "wavy_backup_monthly_2026-04.wavy"` untuk validasi nama backup saat inspect/apply.
- `--show-passphrase` untuk tampilkan passphrase asli saat `inspect-key`.

### Environment variable

Set `BACKUP_RECOVERY_PASSWORD` yang sama dengan build app production:

```bash
# PowerShell
$env:BACKUP_RECOVERY_PASSWORD="ISI_SECRET_RECOVERY_KAMU"
```

atau langsung saat command:

```bash
npm run recovery:tool -- inspect-key --key-file "..." --recovery-password "ISI_SECRET_RECOVERY_KAMU"
```
