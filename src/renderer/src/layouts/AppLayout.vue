<template>
  <div class="flex h-screen overflow-hidden bg-surface">
    <!-- Sidebar -->
    <aside class="w-64 flex-shrink-0 bg-primary flex flex-col py-8 z-50 shadow-xl">
      <!-- Logo -->
      <div class="px-6 mb-10 flex items-center gap-3">
        <div class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
          <span class="text-white font-black text-lg font-headline italic">W</span>
        </div>
        <div>
          <h1 class="text-2xl font-black text-white italic leading-none font-headline">WAVY</h1>
          <p class="text-[10px] text-blue-200/60 uppercase tracking-widest font-bold">Motor Rental</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 space-y-1 px-4">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="sidebar-link"
          active-class="active"
        >
          <span class="material-symbols-outlined">{{ item.icon }}</span>
          <span class="text-sm font-medium">{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- Footer -->
      <div class="px-6 mt-auto">
        <div class="bg-white/5 rounded-xl p-4 border border-white/5 mb-3">
          <p class="text-[10px] text-blue-200/50 uppercase font-bold tracking-tighter mb-2">Login sebagai</p>
          <div class="flex items-center justify-between">
            <span class="text-xs text-white font-semibold">{{ auth.user?.username }}</span>
            <button @click="handleLogout" class="text-blue-200/50 hover:text-white transition-colors border-none bg-transparent m-0 p-0">
              <span class="material-symbols-outlined text-base">logout</span>
            </button>
          </div>
        </div>
        <div class="text-center">
          <button @click="showChangelog = true" class="text-[10px] text-blue-200/40 hover:text-blue-200 transition-colors font-bold tracking-widest uppercase border-none bg-transparent">
            Wavy Rental v1.0.0
          </button>
        </div>
      </div>
    </aside>

    <!-- Changelog Modal -->
    <n-modal v-model:show="showChangelog" preset="card" title="Catatan Rilis (Changelog)" class="max-w-2xl" :auto-focus="false" :trap-focus="false">
      <div class="max-h-[60vh] overflow-y-auto pr-4 space-y-6 text-sm text-slate-600">
        <!-- v1.0.0 -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-black text-primary font-headline">Versi 1.0.0</h3>
            <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Rilis Perdana</span>
          </div>
          <p class="mb-3 text-slate-500 font-medium">Wavy Rental v1.0.0 diluncurkan dengan fitur-fitur dasar operasional:</p>
          <ul class="space-y-3 list-disc pl-5 m-0 marker:text-slate-300">
            <li>
              <div>
                <strong class="text-slate-700">Dashboard Analitik</strong>
                <p class="text-xs text-slate-500 mt-0.5">Menampilkan ringkasan pendapatan, pengeluaran, profit, dan performa motor (Paling Untung & Paling Sering Disewa).</p>
              </div>
            </li>
            <li>
              <div>
                <strong class="text-slate-700">Manajemen Profil Pemilik Motor</strong>
                <p class="text-xs text-slate-500 mt-0.5">Pencatatan bagi hasil motor titipan dan pelacakan daftar riwayat komisi (Lunas / Belum Dibayar).</p>
              </div>
            </li>
            <li>
              <div>
                <strong class="text-slate-700">Sistem Payout Komisi</strong>
                <p class="text-xs text-slate-500 mt-0.5">Pembayaran klaim komisi ke vendor terintegrasi langsung dengan pemotongan saldo kas perusahaan.</p>
              </div>
            </li>
            <li>
              <div>
                <strong class="text-slate-700">Manajemen Kas Pribadi & Pengeluaran</strong>
                <p class="text-xs text-slate-500 mt-0.5">Pencatatan arus kas (masuk/keluar) dengan validasi nominal agar saldo tidak bernada minus.</p>
              </div>
            </li>
            <li>
              <div>
                <strong class="text-slate-700">Sistem Rental & Pengembalian Dana</strong>
                <p class="text-xs text-slate-500 mt-0.5">Pencatatan order sewa dan kalkulasi skema pembatalan sewa (berdasarkan persentase atau Rupiah kustom).</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div class="mt-6 pt-4 border-t border-slate-100 flex justify-end">
        <button @click="showChangelog = false" class="btn-primary px-6">Tutup</button>
      </div>
    </n-modal>

    <!-- Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <main class="flex-1 overflow-y-auto p-8">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const showChangelog = ref(false)

const navItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/daily-record', icon: 'receipt_long', label: 'Daily Record' },
  { to: '/motors', icon: 'two_wheeler', label: 'Manajemen Motor' },
  { to: '/owners', icon: 'person_pin', label: 'Pemilik Motor' },
  { to: '/kas', icon: 'account_balance_wallet', label: 'Manajemen Kas' },
  { to: '/expenses', icon: 'payments', label: 'Pengeluaran' },
  { to: '/reports', icon: 'assessment', label: 'Laporan' },
  { to: '/settings', icon: 'settings', label: 'Pengaturan' }
]

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
