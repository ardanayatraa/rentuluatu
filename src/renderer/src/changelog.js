// Single source of truth for the in-app "Catatan Rilis (Changelog)" modal.
// Update this file each time the app version is bumped.

export const CHANGELOG = [
  {
    version: '1.0.28',
    date: '2026-04-29',
    badge: { text: 'Extend Standalone & Restore Safety', tone: 'emerald' },
    intro: 'Rilis ini menjadikan Extend sebagai transaksi mandiri, merapikan hitungan laporan/komisi, dan memperketat alur backup restore.',
    items: [
      {
        title: 'Extend Jadi Transaksi Mandiri',
        desc: 'Extend tidak lagi bergantung pada transaksi rental lama. Nama pelanggan kosong disimpan sebagai "-", dan input motor/vendor/harga dihitung seperti transaksi biasa.'
      },
      {
        title: 'Hitungan Komisi dan Vendor Dirapikan',
        desc: 'Fee vendor dari transaksi extend ikut masuk laporan vendor, neraca, dan pembagian Wavy Gets serta Bagian Mitra.'
      },
      {
        title: 'Backup Restore Lebih Aman',
        desc: 'Restore lokal dibatasi ke folder backup aplikasi, membuat safety backup sebelum replace database, dan backup lama dengan relasi extend otomatis dinormalisasi.'
      }
    ]
  },
  {
    version: '1.0.20',
    date: '2026-04-19',
    badge: { text: 'Admin Tooling & Report Cleanup', tone: 'emerald' },
    intro: 'Rilis ini menambahkan kontrol admin untuk recovery data, log aktivitas, dan merapikan layout dokumen Hak Mitra agar lebih hemat kertas.',
    items: [
      {
        title: 'Log Aktivitas Admin',
        desc: 'Aksi manual user (fokus CRUD) kini tercatat di tab Log Aktivitas Admin agar bisa ditelusuri berdasarkan tanggal dan jam.'
      },
      {
        title: 'Reset Transaksi Bertempo',
        desc: 'Tab reset transaksi di Pengaturan tersedia sesuai masa aktif yang ditetapkan untuk kebutuhan testing admin.'
      },
      {
        title: 'Backup/Restore & Recovery Tool',
        desc: 'Alur backup-restore diperkuat untuk skenario pindah perangkat, termasuk utilitas recovery passphrase eksternal untuk kebutuhan dev/admin.'
      },
      {
        title: 'PDF Hak Mitra Lebih Ringkas',
        desc: 'Daftar motor di header mitra disederhanakan, pengeluaran per motor dijadikan satu tabel, dan bagian kosong otomatis disembunyikan.'
      }
    ]
  },
  {
    version: '1.0.18',
    date: '2026-04-18',
    badge: { text: 'Audit & Cash Accuracy', tone: 'emerald' },
    intro: 'Rilis ini fokus pada akurasi saldo kas, pemisahan modal, audit data, dan perapihan alur transaksi turunan.',
    items: [
      {
        title: 'Audit Data di Pengaturan',
        desc: 'Tambah fitur audit untuk mendeteksi mismatch saldo akun, mutasi kas, payout, refund, rental, dan settlement ganti unit.'
      },
      {
        title: 'Saldo Dashboard Ikut Periode',
        desc: 'Kartu saldo kas di dashboard sekarang dihitung sampai tanggal akhir filter yang dipilih, bukan selalu saldo live lintas periode.'
      },
      {
        title: 'Modal Dipisah dari Pendapatan',
        desc: 'Modal awal dan tambahan modal tetap masuk ke kas, tetapi tidak ikut dihitung sebagai pendapatan operasional.'
      },
      {
        title: 'Daily Record Lebih Jelas',
        desc: 'Total transaksi ditampilkan net setelah fee vendor, dan ringkasan pembayaran extend/ganti unit dibuat lebih mudah ditelusuri.'
      }
    ]
  },
  {
    version: '1.0.17',
    date: '2026-04-18',
    badge: { text: 'Filter & Settlement Visibility', tone: 'emerald' },
    intro: 'Perbaikan alur vendor hotel, filter periode mitra, dan visibilitas catatan/selisih ganti unit.',
    items: [
      {
        title: 'Vendor Fee Otomatis Lebih Jelas',
        desc: 'Halaman detail vendor hotel sekarang menegaskan bahwa fee vendor dibayar otomatis saat transaksi, lengkap dengan ringkasan periode.'
      },
      {
        title: 'Filter Rentang Waktu di Detail Mitra',
        desc: 'Kartu motor pada detail mitra kini mendukung Per Bulan, Rentang Tanggal, dan Semua Data, dengan kontrol Terapkan/Reset.'
      },
      {
        title: 'Catatan Ganti Unit Ditampilkan',
        desc: 'Catatan yang diisi saat proses ganti unit kini tampil kembali di baris transaksi setelah disimpan.'
      },
      {
        title: 'Selisih Ganti Unit Terlihat di Tabel',
        desc: 'Nilai top up/refund dan metode pembayarannya kini ditampilkan langsung pada tab Ganti Unit agar mudah ditelusuri.'
      }
    ]
  },
  {
    version: '1.0.16',
    date: '2026-04-18',
    badge: { text: 'Import & UI Fix', tone: 'emerald' },
    intro: 'Perbaikan import motor agar menyertakan warna, fix bug edit motor, dan peningkatan UX dengan modal Vue.',
    items: [
      {
        title: 'Import Motor Menyertakan Warna',
        desc: 'Kolom WARNA dari Excel sekarang digabung dengan NAMA KENDARAAN (contoh: "N-MAX PUTIH", "Scoopy Merah").'
      },
      {
        title: 'Fix Bug Edit Motor',
        desc: 'Perbaiki bug nama motor berubah jadi "-" saat edit dengan memperbaiki query SQL menggunakan kolom eksplisit.'
      },
      {
        title: 'Nama Owner Sesuai Data',
        desc: 'Nama owner sekarang ditampilkan sesuai data asli dari database, bukan label fallback "Owner Pribadi (PT)".'
      },
      {
        title: 'Modal Vue Konsisten',
        desc: 'Semua dialog native (confirm/alert) diganti dengan modal Vue yang konsisten di Hotel/Vendor, Pengeluaran, Downloads, dan Daily Record.'
      }
    ]
  },
  {
    version: '1.0.15',
    date: '2026-04-18',
    badge: { text: 'Bug Fix', tone: 'slate' },
    intro: 'Perbaikan kecil agar fitur import stabil di halaman Motor.',
    items: [
      {
        title: 'Import Motor Tidak Error',
        desc: 'Perbaiki fungsi reload data setelah import supaya tidak muncul error "loadData is not defined".'
      }
    ]
  },
  {
    version: '1.0.14',
    date: '2026-04-18',
    badge: { text: 'Import Status Motor', tone: 'emerald' },
    intro: 'Import Excel kini membaca status motor (Pribadi/Titipan) dan mengisi tipe motor otomatis.',
    items: [
      {
        title: 'Mapping Pribadi dan Titipan',
        desc: 'Kolom STATUS pada Excel akan dipetakan ke Aset PT (Pribadi) atau Milik Mitra (Titipan).'
      }
    ]
  },
  {
    version: '1.0.13',
    date: '2026-04-18',
    badge: { text: 'Import Excel', tone: 'emerald' },
    intro: 'Tambah fitur import motor dan mitra dari file Excel.',
    items: [
      {
        title: 'Import Motor & Mitra',
        desc: 'Di halaman Motor dan Mitra tersedia tombol Import Excel untuk memasukkan data dari template daftar kendaraan.'
      }
    ]
  },
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
