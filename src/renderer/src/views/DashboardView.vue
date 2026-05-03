<template>
  <div>
    <div class="mb-6 flex justify-between items-end">
      <div>
        <h2 class="page-title">Dashboard</h2>
        <p class="text-slate-500 text-sm mt-1">Ringkasan operasional dan posisi usaha</p>
      </div>
    </div>

    <!-- Period + Range Filter -->
    <div class="card mb-6 flex gap-4 items-end flex-wrap">
      <div>
        <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Periode</label>
        <select v-model="period" @change="onPeriodChange" class="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium">
          <option value="month">Per Bulan</option>
          <option value="year">Per Tahun</option>
          <option value="custom">Range Tanggal</option>
        </select>
      </div>
      <template v-if="period === 'month'">
        <div>
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bulan</label>
          <input v-model="selectedMonth" @change="onMonthChange" type="month" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </template>
      <template v-else-if="period === 'year'">
        <div>
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tahun</label>
          <select v-model="selectedYear" @change="onYearChange" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>
      </template>
      <div>
        <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal Awal</label>
        <input v-model="filterStartDate" @change="onCustomRangeChange" type="date" :disabled="period !== 'custom'" class="border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal Akhir</label>
        <input v-model="filterEndDate" @change="onCustomRangeChange" type="date" :disabled="period !== 'custom'" class="border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
      </div>
      <button @click="loadAll" class="btn-primary">
        <span class="material-symbols-outlined">refresh</span>
        Tampilkan
      </button>
      <button @click="resetDateRange" class="btn-secondary">
        <span class="material-symbols-outlined">restart_alt</span>
        Reset
      </button>
      <span class="ml-auto text-xs text-slate-400">{{ periodLabel }}</span>
    </div>

    <!-- Summary Cards - Baris 1: Pemasukan & Pengeluaran -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-emerald-600">trending_up</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Pemasukan</span>
        </div>
        <p class="text-2xl font-black text-emerald-600 font-headline">{{ formatRp(summary.income) }}</p>
        <p class="text-xs text-slate-400 mt-1">{{ summary.rental_count }} transaksi</p>
      </div>

      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-red-500">trending_down</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Pengeluaran Operasional</span>
        </div>
        <p class="text-2xl font-black text-red-500 font-headline">{{ formatRp(summary.expenses) }}</p>
      </div>

      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-orange-500">build</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Pengeluaran Motor</span>
        </div>
        <p class="text-2xl font-black text-orange-500 font-headline">{{ formatRp(summary.motor_expenses || 0) }}</p>
        <p class="text-xs text-slate-400 mt-1">{{ summary.motor_expenses_count || 0 }} transaksi</p>
      </div>

      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-slate-600">receipt_long</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Bagian Mitra (Periode)</span>
        </div>
        <p class="text-2xl font-black text-slate-600 font-headline">{{ formatRp(summary.owner_gets_net ?? summary.owner_gets) }}</p>
        <p class="text-xs text-slate-400 mt-1">Sudah dipotong pengeluaran motor: {{ formatRp(summary.owner_motor_expenses || 0) }}</p>
      </div>
    </div>

    <!-- Summary Cards - Baris 2: Profit & Bagian Perusahaan -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Bagian Perusahaan</span>
        </div>
        <p class="text-2xl font-black text-primary font-headline">{{ formatRp(summary.wavy_gets) }}</p>
      </div>

      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-amber-600">savings</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Profit Bersih</span>
        </div>
        <p class="text-2xl font-black font-headline" :class="summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(summary.profit) }}</p>
      </div>
    </div>

    <!-- Kas Section -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-slate-600">account_balance</span>
          </div>
          <h3 class="text-lg font-black text-slate-700 uppercase tracking-wide">Kas</h3>
        </div>
        <div class="text-right">
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Saldo per {{ periodLabel }}</p>
          <p class="text-2xl font-black text-slate-700 font-headline">{{ formatRp(totalCash) }}</p>
        </div>
      </div>
      <p class="mb-4 text-xs text-slate-400">Saldo kas ditampilkan sebagai posisi akun operasional sampai tanggal akhir filter yang dipilih.</p>

      <div class="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <div v-for="acc in groupedCashAccounts" :key="acc.type"
          :class="cashCardClass(acc.type)"
          class="rounded-xl p-6 shadow-sm">
          <div class="flex items-center gap-2 mb-2">
            <span :class="cashIconClass(acc.type)" class="material-symbols-outlined">
              {{ cashIcon(acc.type) }}
            </span>
            <span :class="cashLabelClass(acc.type)" class="text-xs font-bold uppercase tracking-wider">{{ paymentMethodLabel(acc.type) }}</span>
          </div>
          <p :class="cashBalanceClass(acc.type)" class="text-3xl font-black font-headline">{{ formatRp(acc.balance) }}</p>
        </div>
      </div>
      <div class="mt-5 grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-amber-600">savings</span>
            <span class="text-xs font-bold uppercase tracking-wider text-amber-700">Modal</span>
          </div>
          <p class="text-3xl font-black font-headline text-amber-700">{{ formatRp(modalTanamBalance) }}</p>
          <p class="mt-1 text-[11px] font-semibold text-amber-600">Terpisah dari saldo kas operasional</p>
        </div>
      </div>
    </div>

    <!-- Charts Row 1: Income & Expenses Trend -->
    <div class="grid grid-cols-2 gap-5 mb-6">
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Pemasukan Harian</h3>
        <div class="h-64">
          <Bar v-if="incomeChartData" :data="incomeChartData" :options="barOptions" />
        </div>
      </div>
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Pemasukan vs Pengeluaran Operasional</h3>
        <div class="h-64">
          <Bar v-if="compareChartData" :data="compareChartData" :options="compareBarOptions" />
        </div>
      </div>
    </div>

    <!-- Charts Row 2: Simple Breakdown -->
    <div class="grid grid-cols-3 gap-5 mb-6">
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Cara Bayar</h3>
        <div class="space-y-4">
          <div v-for="item in paymentBreakdownRows" :key="item.label" class="space-y-1.5">
            <div class="flex items-center justify-between gap-3 text-sm">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
                <span class="font-semibold text-slate-700 truncate">{{ item.label }}</span>
              </div>
              <div class="text-right shrink-0">
                <p class="font-bold text-slate-800">{{ formatRp(item.value) }}</p>
                <p class="text-[11px] text-slate-400">{{ item.percent }}%</p>
              </div>
            </div>
            <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: `${item.percent}%`, backgroundColor: item.color }"></div>
            </div>
          </div>
          <div v-if="!paymentBreakdownRows.length" class="h-56 flex items-center justify-center text-sm text-slate-400">
            Belum ada data
          </div>
        </div>
      </div>
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Operasional Terbesar</h3>
        <div class="space-y-4">
          <div v-for="item in expenseCategoryRows" :key="item.label" class="space-y-1.5">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-semibold text-slate-700 truncate">{{ item.label }}</span>
              <div class="text-right shrink-0">
                <p class="font-bold text-slate-800">{{ formatRp(item.value) }}</p>
                <p class="text-[11px] text-slate-400">{{ item.percent }}%</p>
              </div>
            </div>
            <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: `${item.percent}%`, backgroundColor: item.color }"></div>
            </div>
          </div>
          <div v-if="!expenseCategoryRows.length" class="h-56 flex items-center justify-center text-sm text-slate-400">
            Belum ada data
          </div>
        </div>
      </div>
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Pembagian Hasil</h3>
        <div class="space-y-5">
          <div v-for="item in commissionRows" :key="item.label" class="space-y-1.5">
            <div class="flex items-center justify-between gap-3 text-sm">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
                <span class="font-semibold text-slate-700 truncate">{{ item.label }}</span>
              </div>
              <div class="text-right shrink-0">
                <p class="font-bold text-slate-800">{{ formatRp(item.value) }}</p>
                <p class="text-[11px] text-slate-400">{{ item.percent }}%</p>
              </div>
            </div>
            <div class="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: `${item.percent}%`, backgroundColor: item.color }"></div>
            </div>
          </div>
          <div v-if="!commissionRows.length" class="h-56 flex items-center justify-center text-sm text-slate-400">
            Belum ada data
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row 3: Top Motors -->
    <div class="card mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-sm font-extrabold text-primary font-headline">Motor Teratas</h3>
        <div class="flex bg-slate-100/50 rounded-lg p-1 border border-slate-100">
          <button @click="setMotorSort('income')" :class="topMotorsSortBy === 'income' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all">Paling Menghasilkan</button>
          <button @click="setMotorSort('count')" :class="topMotorsSortBy === 'count' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all">Paling Sering</button>
        </div>
      </div>
      <div class="h-72">
        <Bar v-if="motorChartData" :data="motorChartData" :options="dynamicMotorOptions" />
      </div>
    </div>

    <!-- Recent Rentals Table -->
    <div class="card overflow-hidden p-0">
      <div class="p-6 border-b border-slate-100">
        <h3 class="text-sm font-extrabold text-primary font-headline">Rental Terbaru</h3>
      </div>
      <table class="w-full text-left">
        <thead>
          <tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
            <th class="px-6 pb-3 pt-4">Pelanggan</th>
            <th class="px-6 pb-3 pt-4">Motor</th>
            <th class="px-6 pb-3 pt-4">Periode</th>
            <th class="px-6 pb-3 pt-4">Bayar</th>
            <th class="px-6 pb-3 pt-4 text-right">Total</th>
            <th class="px-6 pb-3 pt-4 text-right">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="r in recentRentals" :key="r.id" class="text-sm">
            <td class="px-6 py-3 font-medium">{{ r.customer_name }}</td>
            <td class="px-6 py-3 text-slate-500">{{ r.model }} · {{ r.plate_number }}</td>
            <td class="px-6 py-3 text-slate-500">{{ r.period_days }} hari</td>
            <td class="px-6 py-3">
              <span :class="paymentMethodBadge(r.payment_method)">{{ paymentMethodLabel(r.payment_method) }}</span>
            </td>
            <td class="px-6 py-3 text-right font-bold">{{ formatRp(r.total_price) }}</td>
            <td class="px-6 py-3 text-right">
              <span :class="statusBadge(r.status)">{{ r.status }}</span>
            </td>
          </tr>
          <tr v-if="!recentRentals.length">
            <td colspan="6" class="px-6 py-8 text-center text-slate-400 text-sm">Belum ada data rental</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatRp } from '../utils/format'
import { getRecentRestorePeriod } from '../utils/periodFilter'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
)

const period = ref('month')
const selectedMonth = ref('')
const selectedYear = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')

const summary = ref({
  income: 0,
  expenses: 0,
  motor_expenses: 0,
  motor_expenses_count: 0,
  wavy_gets: 0,
  owner_gets: 0,
  owner_gets_net: 0,
  owner_motor_expenses: 0,
  owner_reserved_funds: 0,
  available_operational_funds: 0,
  profit: 0,
  rental_count: 0,
  refund_count: 0
})
const cashAccounts = ref([])
const cashTotal = ref(0)
const recentRentals = ref([])
const filteredCashAccounts = computed(() => {
  return cashAccounts.value.filter((acc) =>
    ['tunai', 'transfer', 'qris', 'debit_card'].includes(String(acc.type || '')) &&
    String(acc.bucket || 'pendapatan') === 'pendapatan'
  )
})
const groupedCashAccounts = computed(() => {
  const order = ['tunai', 'transfer', 'qris', 'debit_card']
  const map = new Map(order.map((type) => [type, { type, balance: 0 }]))
  filteredCashAccounts.value.forEach((account) => {
    const type = String(account.type || '')
    if (!map.has(type)) return
    map.get(type).balance += Number(account.balance || 0)
  })
  return order.map((type) => map.get(type))
})
const modalTanamBalance = computed(() => {
  return cashAccounts.value
    .filter((acc) => String(acc.bucket || 'pendapatan') === 'modal' && String(acc.type || '') === 'tunai')
    .reduce((sum, acc) => sum + Number(acc.balance || 0), 0)
})

// Computed: Total Kas
const totalCash = computed(() => {
  return filteredCashAccounts.value.reduce((sum, acc) => sum + (acc.balance || 0), 0)
})

// Charts
const incomeChartData = ref(null)
const compareChartData = ref(null)
const motorChartData = ref(null)
const topMotorsData = ref([])
const topMotorsSortBy = ref('income') // income, count
const paymentBreakdownRows = ref([])
const expenseCategoryRows = ref([])
const commissionRows = ref([])

const primaryColor = '#1e3a5f'
const chartColors = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function compactCurrency(value) {
  const amount = Number(value || 0)
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1).replace('.0', '')} jt`
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)} rb`
  return formatRp(amount)
}

function buildBreakdownRows(items, colorSource = chartColors) {
  const safeItems = Array.isArray(items) ? items.filter(item => Number(item.value || 0) > 0) : []
  const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0)
  return safeItems.map((item, index) => ({
    ...item,
    color: item.color || colorSource[index % colorSource.length],
    percent: total > 0 ? Math.round((Number(item.value || 0) / total) * 100) : 0
  }))
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${formatRp(context.raw)}`
      }
    }
  },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (v) => compactCurrency(v) }, grid: { color: '#f1f5f9' } },
    x: { grid: { display: false } }
  }
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${formatRp(context.raw)}`
      }
    }
  },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (v) => compactCurrency(v) }, grid: { color: '#f1f5f9' } },
    x: { grid: { display: false } }
  }
}

const compareBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'rectRounded', padding: 20, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (context) => `${context.dataset.label}: ${formatRp(context.raw)}`
      }
    }
  },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (v) => compactCurrency(v) }, grid: { color: '#f1f5f9' } },
    x: { grid: { display: false } }
  }
}

const dynamicMotorOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: { legend: { display: false } },
  scales: {
    x: { 
      beginAtZero: true, 
      ticks: { 
        callback: (v) => topMotorsSortBy.value === 'income' ? compactCurrency(v) : `${v} kali`
      }, 
      grid: { color: '#f1f5f9' } 
    },
    y: { grid: { display: false } }
  }
}))

function toLocalYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function today() { return toLocalYmd(new Date()) }

function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function getLastDayOfMonth(monthValue) {
  const [year, month] = String(monthValue || '').split('-')
  if (!year || !month) return today()
  return toLocalYmd(new Date(Number(year), Number(month), 0))
}

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear; year >= currentYear - 10; year -= 1) {
    years.push(String(year))
  }
  return years
})

function applyPeriodPreset() {
  if (period.value === 'month') {
    const fallbackMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    selectedMonth.value = selectedMonth.value || fallbackMonth
    filterStartDate.value = `${selectedMonth.value}-01`
    filterEndDate.value = getLastDayOfMonth(selectedMonth.value)
    return
  }
  if (period.value === 'year') {
    selectedYear.value = selectedYear.value || String(new Date().getFullYear())
    filterStartDate.value = `${selectedYear.value}-01-01`
    filterEndDate.value = `${selectedYear.value}-12-31`
    return
  }
  normalizeRange()
}

function normalizeRange() {
  if (!filterStartDate.value) filterStartDate.value = monthStart(new Date())
  if (!filterEndDate.value) filterEndDate.value = today()
  if (filterStartDate.value > filterEndDate.value) {
    const tmp = filterStartDate.value
    filterStartDate.value = filterEndDate.value
    filterEndDate.value = tmp
  }
}

const periodLabel = computed(() => {
  if (period.value === 'month' && selectedMonth.value) {
    const [year, month] = selectedMonth.value.split('-')
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }
  if (period.value === 'year' && selectedYear.value) {
    return `Tahun ${selectedYear.value}`
  }
  if (!filterStartDate.value || !filterEndDate.value) return 'Periode belum dipilih'
  const startLabel = new Date(filterStartDate.value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const endLabel = new Date(filterEndDate.value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} - ${endLabel}`
})

function onPeriodChange() {
  applyPeriodPreset()
  loadAll()
}

function onMonthChange() {
  if (period.value !== 'month') return
  applyPeriodPreset()
  loadAll()
}

function onYearChange() {
  if (period.value !== 'year') return
  applyPeriodPreset()
  loadAll()
}

function onCustomRangeChange() {
  if (period.value !== 'custom') return
  loadAll()
}

function resetDateRange() {
  period.value = 'month'
  selectedMonth.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  selectedYear.value = String(new Date().getFullYear())
  applyPeriodPreset()
  loadAll()
}

function applyRestoredBackupPeriod() {
  const restored = getRecentRestorePeriod()
  if (!restored) return false

  period.value = 'custom'
  selectedMonth.value = restored.month
  selectedYear.value = restored.year
  filterStartDate.value = restored.startDate
  filterEndDate.value = restored.endDate
  return true
}

function statusBadge(status) {
  return { active: 'badge-success', completed: 'badge-neutral', refunded: 'badge-error' }[status] || 'badge-neutral'
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function paymentMethodLabel(method) {
  return {
    tunai: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit_card: 'Debit Card'
  }[method] || method || '-'
}

function paymentMethodBadge(method) {
  return method === 'tunai' ? 'badge-neutral' : 'badge-success'
}

function cashCardClass(type) {
  if (type === 'transfer') return 'bg-primary text-white'
  if (type === 'qris') return 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
  if (type === 'debit_card') return 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'
  return 'bg-white border border-slate-100'
}

function cashIconClass(type) {
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  if (type === 'debit_card') return 'text-slate-300'
  return 'text-slate-400'
}

function cashLabelClass(type) {
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  if (type === 'debit_card') return 'text-slate-300'
  return 'text-slate-500'
}

function cashBalanceClass(type) {
  return type === 'tunai' ? 'text-primary' : 'text-white'
}

function cashIcon(type) {
  if (type === 'tunai') return 'payments'
  if (type === 'transfer') return 'account_balance'
  if (type === 'debit_card') return 'credit_card'
  return 'qr_code_2'
}

function setMotorSort(type) {
  topMotorsSortBy.value = type
  updateMotorChart()
}

function updateMotorChart() {
  const sorted = [...topMotorsData.value].sort((a, b) => {
    return topMotorsSortBy.value === 'income' 
      ? b.total_income - a.total_income 
      : b.rental_count - a.rental_count
  }).slice(0, 10)

  motorChartData.value = {
    labels: sorted.map(m => `${m.model} (${m.plate_number})`),
    datasets: [{
      label: topMotorsSortBy.value === 'income' ? 'Pendapatan' : 'Dipesan',
      data: sorted.map(m => topMotorsSortBy.value === 'income' ? m.total_income : m.rental_count),
      backgroundColor: chartColors.slice(0, sorted.length),
      borderWidth: 0,
      borderRadius: 4
    }]
  }
}

async function loadAll() {
  normalizeRange()
  const s = filterStartDate.value + 'T00:00:00'
  const e = filterEndDate.value + 'T23:59:59'
  const dateRange = { startDate: s, endDate: e }
  const dateRangeShort = { startDate: filterStartDate.value, endDate: filterEndDate.value }

  // Summary
  summary.value = await window.api.getDashboardSummary(dateRange)

  // Cash
  const cash = await window.api.getCashSummary({ endDate: filterEndDate.value })
  cashAccounts.value = cash.accounts
  cashTotal.value = cash.total

  // Recent rentals
  const rentals = await window.api.getRentals(dateRange)
  recentRentals.value = rentals.slice(0, 5)

  // Daily income chart
  const dailyIncome = await window.api.getDailyIncome(dateRange)
  incomeChartData.value = {
    labels: dailyIncome.map(d => formatShortDate(d.date)),
    datasets: [{
      label: 'Pemasukan',
      data: dailyIncome.map(d => d.income),
      backgroundColor: primaryColor + '20',
      borderColor: primaryColor,
      borderWidth: 2,
      borderRadius: 6
    }]
  }

  // Daily expenses
  const dailyExpenses = await window.api.getDailyExpenses(dateRangeShort)
  // Merge income & expenses per date for comparison chart
  const allDates = [...new Set([...dailyIncome.map(d => d.date), ...dailyExpenses.map(d => d.date)])].sort()
  const incomeMap = Object.fromEntries(dailyIncome.map(d => [d.date, d.income]))
  const expenseMap = Object.fromEntries(dailyExpenses.map(d => [d.date, d.total]))
  compareChartData.value = {
    labels: allDates.map(formatShortDate),
    datasets: [
      {
        label: 'Uang Masuk',
        data: allDates.map(d => incomeMap[d] || 0),
        borderColor: '#10b981',
        backgroundColor: '#10b981',
        borderRadius: 6
      },
      {
        label: 'Operasional',
        data: allDates.map(d => expenseMap[d] || 0),
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderRadius: 6
      }
    ]
  }

  // Payment breakdown
  const paymentData = await window.api.getPaymentBreakdown(dateRange)
  paymentBreakdownRows.value = buildBreakdownRows(paymentData.map((p) => ({
    label: paymentMethodLabel(p.payment_method),
    value: p.total
  })), ['#1e3a5f', '#3b82f6', '#10b981'])

  // Commission split
  commissionRows.value = buildBreakdownRows([
    { label: 'Hak Perusahaan', value: summary.value.wavy_gets, color: '#1e3a5f' },
    { label: 'Hak Mitra', value: summary.value.owner_gets_net ?? summary.value.owner_gets, color: '#f59e0b' }
  ])

  // Top motors
  topMotorsData.value = await window.api.getTopMotors(dateRange)
  updateMotorChart()

  // Expense categories
  const expCats = await window.api.getExpenseCategories(dateRangeShort)
  expenseCategoryRows.value = buildBreakdownRows(expCats.map(c => ({
    label: c.category,
    value: c.total
  }))).slice(0, 6)
}

onMounted(() => {
  selectedMonth.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  selectedYear.value = String(new Date().getFullYear())
  if (!applyRestoredBackupPeriod()) {
    applyPeriodPreset()
  }
  loadAll()
})
</script>

