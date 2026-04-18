<template>
  <div class="app-shell flex h-screen overflow-hidden bg-surface">
    <!-- Sidebar -->
    <aside class="app-sidebar flex-shrink-0 bg-primary flex flex-col py-5 xl:py-8 z-50 shadow-xl">
      <!-- Logo -->
      <div class="px-4 xl:px-6 mb-6 xl:mb-8 flex items-center gap-3">
        <img src="../assets/logo.png" alt="Wavy Logo" class="w-9 h-9 xl:w-10 xl:h-10 rounded-lg object-cover flex-shrink-0" />
        <div class="min-w-0">
          <h1 class="text-[13px] xl:text-sm font-black text-white leading-tight font-headline">The Wavy Rental</h1>
          <p class="text-[8px] xl:text-[9px] text-blue-200/50 font-bold truncate">PT. Artha Bali Wisata</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 xl:px-4 overflow-y-auto space-y-4 xl:space-y-5">
        <div v-for="group in navGroups" :key="group.label">
          <p class="text-[9px] font-bold uppercase tracking-[0.15em] text-blue-200/30 px-2 mb-1">{{ group.label }}</p>
          <div class="space-y-0.5">
            <router-link
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              :class="['sidebar-link', isNavActive(item.to) ? 'active' : '']"
            >
              <span class="material-symbols-outlined text-[17px] xl:text-[18px]">{{ item.icon }}</span>
              <span class="text-[13px] xl:text-sm font-medium">{{ item.label }}</span>
            </router-link>
          </div>
        </div>
      </nav>

      <!-- Footer -->
      <div class="px-4 xl:px-6 mt-auto">
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
            Wavy Rental v{{ appVersion }}
          </button>
        </div>
      </div>
    </aside>

    <!-- Changelog Modal -->
    <n-modal v-model:show="showChangelog" preset="card" title="Catatan Rilis (Changelog)" class="max-w-2xl" :auto-focus="false" :trap-focus="false">
      <div class="max-h-[60vh] overflow-y-auto pr-4 space-y-6 text-sm text-slate-600">
        <div v-for="entry in changelogEntries" :key="entry.version">
          <div class="flex items-center justify-between mb-3">
            <div class="min-w-0">
              <h3 class="text-lg font-black text-primary font-headline">Versi {{ entry.version }}</h3>
              <p v-if="entry.date" class="text-xs text-slate-400 font-bold mt-0.5">{{ entry.date }}</p>
            </div>
            <span
              v-if="entry.badge?.text"
              class="text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap"
              :class="badgeClass(entry.badge.tone)"
            >{{ entry.badge.text }}</span>
          </div>
          <p v-if="entry.intro" class="mb-3 text-slate-500 font-medium">{{ entry.intro }}</p>
          <ul v-if="entry.items?.length" class="space-y-3 list-disc pl-5 m-0 marker:text-slate-300">
            <li v-for="item in entry.items" :key="item.title">
              <div>
                <strong class="text-slate-700">{{ item.title }}</strong>
                <p v-if="item.desc" class="text-xs text-slate-500 mt-0.5">{{ item.desc }}</p>
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
      <!-- Trial banner -->
      <div v-if="license.isTrial"
        class="bg-amber-500 text-white text-xs font-bold px-6 py-2 flex items-center justify-between">
        <span class="flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">timer</span>
          Trial aktif — sisa {{ license.daysLeft }} hari
        </span>
        <router-link to="/settings" class="underline hover:no-underline">Aktifkan Lisensi</router-link>
      </div>
      <main class="app-main flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>

    <div v-if="closingBackup.visible" class="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-6">
      <div class="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 text-center">
        <div :class="['mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center', closingBackup.success ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-600']">
          <span class="material-symbols-outlined text-3xl" :class="closingBackup.success ? 'animate-spin' : ''">
            {{ closingBackup.success ? 'progress_activity' : 'error' }}
          </span>
        </div>
        <h3 class="text-lg font-black text-slate-800 font-headline">Menutup Aplikasi</h3>
        <p class="text-sm text-slate-500 mt-2 leading-relaxed">{{ closingBackup.message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'
import { useRoute, useRouter } from 'vue-router'
import { CHANGELOG } from '../changelog'

const auth = useAuthStore()
const license = useLicenseStore()
const router = useRouter()
const route = useRoute()
const showChangelog = ref(false)
const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'
const changelogEntries = CHANGELOG
const closingBackup = ref({
  visible: false,
  success: true,
  message: ''
})
let removeClosingBackupListener = null

const navGroups = [
  {
    label: 'Utama',
    items: [
      { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    ]
  },
  {
    label: 'Operasional',
    items: [
      { to: '/daily-record', icon: 'receipt_long', label: 'Transaksi Sewa' },
      { to: '/expenses', icon: 'payments', label: 'Pengeluaran' },
      { to: '/kas', icon: 'account_balance_wallet', label: 'Kas & Keuangan' },
    ]
  },
  {
    label: 'Armada',
    items: [
      { to: '/motors', icon: 'two_wheeler', label: 'Motor' },
      { to: '/owners', icon: 'handshake', label: 'Mitra Owner' },
      { to: '/hotels', icon: 'domain', label: 'Hotel / Vendor' },
    ]
  },
  {
    label: 'Analitik',
    items: [
      { to: '/reports', icon: 'bar_chart', label: 'Laporan' },
      { to: '/downloads', icon: 'download', label: 'Unduhan' },
    ]
  },
  {
    label: 'Sistem',
    items: [
      { to: '/settings', icon: 'settings', label: 'Pengaturan' },
    ]
  }
]

function handleLogout() {
  auth.logout()
  router.push('/login')
}

function isNavActive(to) {
  const base = typeof to === 'string' ? to : to?.path
  if (!base) return false
  // Detail route (mis. /owners/:id) adalah sibling, jadi router-link tidak otomatis aktif.
  // Kita anggap aktif kalau path sama atau berada di bawah segmen yang sama.
  return route.path === base || route.path.startsWith(base + '/')
}

function badgeClass(tone) {
  if (tone === 'emerald') return 'text-emerald-700 bg-emerald-50'
  if (tone === 'slate') return 'text-slate-600 bg-slate-100'
  return 'text-emerald-700 bg-emerald-50'
}

onMounted(() => {
  if (window.api?.onAppClosingBackupStatus) {
    removeClosingBackupListener = window.api.onAppClosingBackupStatus((payload) => {
      closingBackup.value = {
        visible: Boolean(payload?.visible),
        success: payload?.success !== false,
        message: payload?.message || ''
      }
    })
  }
})

onBeforeUnmount(() => {
  if (typeof removeClosingBackupListener === 'function') {
    removeClosingBackupListener()
  }
})
</script>

<style scoped>
.app-sidebar {
  width: var(--app-sidebar-width);
}

.app-main {
  padding: var(--app-shell-gap);
}

@media (max-width: 1280px) {
  .app-shell {
    min-width: 0;
  }
}
</style>
