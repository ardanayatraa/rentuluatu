# Catatan Rilis (Changelog)

Format: `MAJOR.MINOR.PATCH` (SemVer)

## 1.0.16 (2026-04-18)
- **Import Motor**: Kolom WARNA sekarang digabung dengan NAMA KENDARAAN (contoh: "N-MAX PUTIH", "Scoopy Merah").
- **Perbaikan Bug**: Fix nama motor berubah jadi "-" saat edit (query SQL diperbaiki dengan kolom eksplisit).
- **Perbaikan Owner Display**: Nama owner sekarang ditampilkan sesuai data asli, bukan label fallback "Owner Pribadi (PT)".
- **UI Improvement**: Semua dialog native (confirm/alert) diganti dengan modal Vue yang konsisten:
  - Modal konfirmasi hapus di Hotel/Vendor, Pengeluaran, Downloads, dan Daily Record
  - Error message inline di form (tidak pakai alert popup lagi)
  - Modal error untuk kasus khusus (hapus rental yang belum bisa dihapus)

## 1.0.7 (2026-04-18)
- Export daftar **Motor** dan **Mitra / Pemilik**: `Cetak (Preview PDF)` dan `Simpan Excel`.
- Export Mitra menampilkan **Hak Mengendap** dan **Sudah Dibayarkan** (ringkasan + kolom).
- Konsistensi pagination: komponen `TablePagination` dipakai untuk tampilan tabel yang seragam.
- Perbaikan UX tombol Cetak: fail-safe supaya tombol tidak nyangkut disable ketika preview/print lambat.

## 1.0.6 (2026-04-17)
- Penyempurnaan alur Daily Record (Extend dan Ganti Unit) dan konsistensi tampilan tabel.
- Hardening hitungan dashboard dan laporan agar tidak double count pada skenario tertentu.

## 1.0.5 (2026-04-13)
- Perbaikan navigasi sumber transaksi (link sumber dari Extend/Ganti Unit).
- Penambahan reset filter pada Daily Record.

## 1.0.4 (2026-04-??)
- Tab Daily Record diselaraskan dengan gaya tab Laporan.
- Alur Extend diperjelas (konteks transaksi rental vs tab Extend).

## 1.0.3 (2026-04-??)
- Penyempurnaan laporan, dokumen, backup, performa, dan kesiapan penggunaan jangka panjang.

