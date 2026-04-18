// Single source of truth for the in-app "Catatan Rilis (Changelog)" modal.
// Update this file each time the app version is bumped.

export const CHANGELOG = [
  {
    version: '1.0.12',
    date: '2026-04-18',
    badge: { text: 'Backup Bulanan', tone: 'emerald' },
    intro: 'Backup sekarang mengikuti format bulanan agar lebih rapi dan tidak menumpuk file.',
    items: [
      {
        title: '1 File per Bulan',
        desc: 'Backup lokal dan Google Drive akan overwrite dalam bulan yang sama, dan hanya membuat file baru saat bulan berganti.'
      }
    ]
  },
  {
    version: '1.0.11',
    date: '2026-04-18',
    badge: { text: 'Ganti Unit', tone: 'emerald' },
    intro: 'Penyempurnaan input Ganti Unit agar lebih sesuai proses bisnis di lapangan.',
    items: [
      {
        title: 'Harga Total (Bukan Per Hari)',
        desc: 'Saat ganti unit, input sekarang menggunakan harga total untuk sisa sewa setelah ganti motor.'
      }
    ]
  },
  {
    version: '1.0.10',
    date: '2026-04-18',
    badge: { text: 'Backup & Restore', tone: 'emerald' },
    intro: 'Rilis ini merapikan backup harian dan memastikan restore benar-benar terpakai.',
    items: [
      {
        title: 'Backup Harian Tidak Menumpuk',
        desc: 'Backup lokal dan upload Google Drive sekarang 1 file per hari (overwrite), bukan membuat banyak file dalam hari yang sama.'
      },
      {
        title: 'Restore Auto Restart',
        desc: 'Setelah restore, aplikasi otomatis restart agar database baru terbaca dan tidak tertimpa state lama.'
      }
    ]
  },
  {
    version: '1.0.9',
    date: '2026-04-18',
    badge: { text: 'Vendor Hotel', tone: 'emerald' },
    intro: 'Perbaikan tampilan Fee Vendor di menu Hotel/Vendor agar mengikuti data Daily Record.',
    items: [
      {
        title: 'Fee Vendor Muncul di List Hotel',
        desc: 'Kolom Fee Vendor (Tunai) sekarang menghitung total vendor_fee dari transaksi rental yang terhubung ke vendor.'
      }
    ]
  },
  {
    version: '1.0.8',
    date: '2026-04-18',
    badge: { text: 'Perhitungan Dashboard', tone: 'slate' },
    intro: 'Rilis ini memastikan ringkasan Dashboard konsisten dengan pencatatan kas dan pembagian hasil.',
    items: [
      {
        title: 'Profit Dashboard Konsisten',
        desc: 'Profit Bersih dihitung dari (Wavy Gets + Kas Masuk Manual) dikurangi (Pengeluaran Operasional + Kas Keluar Manual).'
      },
      {
        title: 'Bagian Perusahaan Tetap Murni',
        desc: 'Bagian Perusahaan hanya berasal dari Wavy Gets rental (tidak mencampur pemasukan kas manual).'
      }
    ]
  },
  {
    version: '1.0.7',
    date: '2026-04-18',
    badge: { text: 'Export & Konsistensi', tone: 'emerald' },
    intro: 'Rilis ini fokus pada export data inti (Motor dan Mitra) serta merapikan pengalaman tabel agar konsisten.',
    items: [
      {
        title: 'Export Motor dan Mitra',
        desc: 'Halaman Motor dan Mitra kini punya tombol Cetak (Preview PDF) dan Simpan Excel yang mengikuti filter/pencarian.'
      },
      {
        title: 'Ringkasan Mitra Lebih Lengkap',
        desc: 'Di cetak/Excel Mitra, tampil Hak Mengendap dan Sudah Dibayarkan agar rekapan lebih jelas.'
      },
      {
        title: 'Pagination Seragam',
        desc: 'Tampilan pagination distandarkan lewat komponen TablePagination untuk semua tabel yang perlu.'
      },
      {
        title: 'Tombol Cetak Tidak Nyangkut',
        desc: 'Ada fail-safe supaya tombol Cetak tidak terkunci disable ketika preview/print membutuhkan waktu.'
      }
    ]
  },
  {
    version: '1.0.6',
    date: '2026-04-17',
    badge: { text: 'Stabilitas', tone: 'slate' },
    intro: 'Rilis ini memperkuat perhitungan dan alur Daily Record (Extend dan Ganti Unit) agar aman untuk operasional.',
    items: [
      { title: 'Daily Record Lebih Stabil', desc: 'Penyempurnaan alur Extend dan Ganti Unit agar tidak membingungkan dan mengurangi potensi salah input.' },
      { title: 'Hardening Hitungan', desc: 'Perbaikan hitungan dashboard/laporan untuk mencegah mismatch pada kasus tertentu.' }
    ]
  },
  {
    version: '1.0.5',
    date: '2026-04-13',
    badge: { text: 'Daily Record', tone: 'emerald' },
    intro: 'Rilis ini fokus pada navigasi sumber transaksi dan kenyamanan filter di Daily Record.',
    items: [
      { title: 'Navigasi Sumber Transaksi', desc: 'Link sumber dari Extend/Ganti Unit dipertegas agar mudah menelusuri transaksi awal.' },
      { title: 'Reset Filter', desc: 'Tambah aksi reset filter supaya balik cepat ke tampilan default.' }
    ]
  }
]
