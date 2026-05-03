# Catatan Rilis (Changelog)

Format: `MAJOR.MINOR.PATCH` (SemVer)

## 1.0.39 (2026-05-03)
- **Slip Mitra**:
  - Ringkasan atas disesuaikan menjadi `Jumlah Transaksi`, `Pendapatan Transaksi`, `Total Pendapatan Rental`, `Pengeluaran Mitra`, dan `Pendapatan Bersih Mitra`.
  - `Pendapatan Bersih Mitra` diberi warna pembeda dan nominal rupiah dikunci satu baris agar `Rp` tidak turun sendiri.
  - Perhitungan jumlah transaksi dan total transaksi/extension dirapikan supaya seimbang dengan ganti motor dan extension.
- **Slip Fee Partner**:
  - Kop disamakan dengan slip mitra dan judul diganti menjadi `SLIP FEE PARTNER`.
  - Status dokumen, rata-rata fee, dan istilah vendor pada rincian diganti sesuai draft partner.
  - Rincian fee partner menampilkan total pendapatan di baris bawah.

## 1.0.38 (2026-05-01)
- **Backup/Restore**:
  - Restore sekarang memulihkan semua tabel bisnis penting, termasuk vendor, payout, refund, ganti unit, pengeluaran, dan mutasi kas.
  - Restore diverifikasi setelah database diganti supaya jumlah row dan total nominal aktif sama dengan isi backup.
  - Sesi Google Drive yang tidak valid akan diminta hubungkan ulang, bukan membuat error teknis.
  - Auto backup saat app ditutup dinonaktifkan; upload Google Drive tetap manual dari tombol Upload.
- **Data Persisten**:
  - Simpan database dibuat langsung ke file supaya pemasukan Daily Record, pengeluaran, mitra, dan vendor tidak hilang setelah app ditutup cepat.
- **Laporan Mitra**:
  - Slip laporan pendapatan mitra disesuaikan dengan draft: header lebih rapi, data mitra disederhanakan, tabel transaksi/extension/pengeluaran, dan ringkasan total.
- **Daily Record & Dashboard**:
  - Setelah restore, periode data dari backup dipakai untuk membantu Daily Record dan Dashboard menampilkan data backup yang baru dipulihkan.
  - Halaman Pengeluaran punya opsi Semua Data dan otomatis membuka semua data jika bulan berjalan kosong tetapi database berisi pengeluaran.
- **Vendor Hotel**:
  - Filter periode vendor hotel diperbaiki agar akhir bulan tidak terpotong karena timezone dan data vendor lama yang hanya punya nama hotel tetap ikut masuk rekap/slip.
- **Slip Mitra**:
  - Rincian transaksi extension sekarang menampilkan baris Total Extension.
  - Label ringkasan slip mitra `Total Hak Mitra` diganti menjadi `Total Pendapatan`.
  - `Jumlah Transaksi` di ringkasan slip mitra sekarang menghitung transaksi sewa utama dan extension.
  - Ringkasan atas slip mitra diatur ulang sesuai draft 2 kolom: `Jumlah Transaksi`, `Total Pendapatan`, `Total Pendapatan Mitra`, `Total Pendapatan Rental`, `Pengeluaran`, dan `Pendapatan Bersih`. `Total Pendapatan` memakai pendapatan bersih transaksi setelah fee vendor supaya konsisten dengan pembagian mitra dan rental.

## 1.0.28 (2026-04-29)
- **Daily Record - Extend**:
  - Extend sekarang disimpan sebagai transaksi mandiri, bukan relasi dari rental lama.
  - Nama pelanggan kosong otomatis tersimpan sebagai `-`.
  - Form Extend mendukung input motor, hotel/vendor, fee vendor, harga kotor, metode bayar, dan preview pembagian Wavy/Mitra.
- **Laporan & Komisi**:
  - Fee vendor dari Extend ikut dihitung di laporan vendor dan neraca.
  - Jejak laporan transaksi hanya menampilkan Ganti Unit, bukan Extend.
- **Backup/Restore**:
  - Restore lokal dibatasi ke folder backup aplikasi.
  - Restore membuat safety backup sebelum mengganti database.
  - Backup lama yang masih menyimpan parent Extend otomatis dinormalisasi saat dibuka/restore.

## 1.0.19 (2026-04-19)
- **Pengaturan - Reset Transaksi**:
  - Tambah tab khusus **Reset Transaksi** untuk kebutuhan testing admin.
  - Reset hanya menghapus data transaksi (rental, pengeluaran, refund, payout, mutasi kas, ganti unit), **data motor/pemilik/hotel tetap aman**.
  - Fitur reset transaksi dibatasi masa aktif **3 hari**, setelah habis tab otomatis tidak tampil lagi.

## 1.0.18 (2026-04-18)
- **Dashboard & Kas**:
  - Saldo kas di dashboard sekarang mengikuti tanggal akhir filter yang dipilih, jadi tidak lagi membingungkan dengan saldo live lintas periode.
  - Periode dashboard dirapikan menjadi **Per Bulan / Per Tahun / Semua Data**.
- **Kas & Modal**:
  - Modal awal dan tambahan modal tetap masuk ke kas tetapi dipisahkan dari pendapatan operasional.
  - Proteksi dan snapshot saldo kas diperkuat.
- **Daily Record & Detail**:
  - Total transaksi tampil net setelah fee vendor.
  - Ringkasan pembayaran `extend` dan `ganti unit` diperjelas.
  - Popup/detail mitra mendukung filter rentang tanggal yang lebih lengkap.
- **Audit Data Baru**:
  - Di Pengaturan tersedia fitur audit untuk mengecek mismatch saldo akun, mutasi kas, payout, refund, rental, dan settlement ganti unit.

## 1.0.17 (2026-04-18)
- **Vendor Hotel (Detail)**: Tampilan fee vendor diperjelas sebagai **dibayar otomatis saat transaksi**, termasuk ringkasan dibayar otomatis per periode.
- **Mitra Detail**: Filter pada kartu motor sekarang mendukung **rentang tanggal** (Per Bulan / Rentang Tanggal / Semua Data) dengan tombol Terapkan/Reset.
- **Daily Record - Ganti Unit**:
  - Catatan ganti unit sekarang tampil di baris transaksi setelah disimpan.
  - Informasi selisih (top up/refund) dan metode pembayarannya ditampilkan langsung di tabel.

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
