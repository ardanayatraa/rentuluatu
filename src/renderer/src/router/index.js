import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/setup-password', name: 'SetupPassword', component: () => import('../views/SetupPasswordView.vue'), meta: { requiresAuth: true } },
  { path: '/license', name: 'License', component: () => import('../views/LicenseView.vue'), meta: { requiresAuth: true } },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/DashboardView.vue') },
      { path: 'daily-record', name: 'DailyRecord', component: () => import('../views/DailyRecordView.vue') },
      { path: 'motors', name: 'Motors', component: () => import('../views/MotorsView.vue') },
      { path: 'owners', name: 'Owners', component: () => import('../views/OwnersView.vue') },
      { path: 'owners/:id', name: 'OwnerDetail', component: () => import('../views/OwnerDetailView.vue') },
      { path: 'hotels', name: 'Hotels', component: () => import('../views/HotelsView.vue') },
      { path: 'hotels/:id', name: 'HotelDetail', component: () => import('../views/HotelDetailView.vue') },
      { path: 'kas', name: 'Kas', component: () => import('../views/KasView.vue') },
      { path: 'expenses', name: 'Expenses', component: () => import('../views/ExpensesView.vue') },
      { path: 'reports', name: 'Reports', component: () => import('../views/ReportsView.vue') },
      { path: 'downloads', name: 'Downloads', component: () => import('../views/DownloadsView.vue') },
      { path: 'settings', name: 'Settings', component: () => import('../views/SettingsView.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  linkActiveClass: 'active',
  linkExactActiveClass: 'active'
})

// Track apakah license sudah di-load di sesi ini
let licenseLoaded = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const license = useLicenseStore()

  // Halaman public (login) — bebas akses
  if (to.meta.public) return true

  // Harus login dulu
  if (!auth.isLoggedIn) return '/login'

  // Selalu load license setelah login, tapi hanya sekali per sesi
  if (!licenseLoaded) {
    await license.load()
    licenseLoaded = true
  }

  // Izinkan akses ke setup-password dan license page tanpa redirect loop
  if (to.name === 'SetupPassword' || to.name === 'License') return true

  // First run: belum pernah setup password → wajib setup dulu
  if (license.isFirstRun) {
    return '/setup-password'
  }

  // Trial/lisensi expired → wajib aktivasi
  if (license.isExpired) {
    return '/license'
  }

  return true
})

// Reset flag saat logout (agar re-load saat login ulang)
export function resetLicenseCache() {
  licenseLoaded = false
}

export default router
