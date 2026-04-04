import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
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
      { path: 'kas', name: 'Kas', component: () => import('../views/KasView.vue') },
      { path: 'expenses', name: 'Expenses', component: () => import('../views/ExpensesView.vue') },
      { path: 'reports', name: 'Reports', component: () => import('../views/ReportsView.vue') },
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

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
})

export default router
