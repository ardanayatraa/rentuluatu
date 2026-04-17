// Single source of truth for the in-app "Catatan Rilis (Changelog)" modal.
// Update this file each time the app version is bumped.

export const CHANGELOG = [
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
