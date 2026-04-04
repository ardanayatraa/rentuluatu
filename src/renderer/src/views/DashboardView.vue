<template>
  <div>
    <div class="mb-6 flex justify-between items-end">
      <div>
        <h2 class="page-title">Dashboard</h2>
        <p class="text-slate-500 text-sm mt-1">Ringkasan operasional & analitik</p>
      </div>
    </div>

    <!-- Period Filter -->
    <div class="card mb-6 flex gap-4 items-center flex-wrap">
      <select v-model="period" @change="onPeriodChange" class="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium">
        <option value="today">Hari Ini</option>
        <option value="week">Minggu Ini</option>
        <option value="month">Bulan Ini</option>
        <option value="year">Tahun Ini</option>
        <option value="custom">Kustom</option>
      </select>
      <template v-if="period === 'custom'">
        <input v-model="startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <span class="text-slate-400">—</span>
        <input v-model="endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </template>
      <button @click="loadAll" class="btn-primary">
        <span class="material-symbols-outlined">refresh</span>
        Tampilkan
      </button>
      <span class="ml-auto text-xs text-slate-400">{{ startDate }} s/d {{ endDate }}</span>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-5 mb-6">
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
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Pengeluaran</span>
        </div>
        <p class="text-2xl font-black text-red-500 font-headline">{{ formatRp(summary.expenses) }}</p>
      </div>

      <div class="card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
          </div>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Wavy Gets</span>
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

    <!-- Kas Cards -->
    <div class="grid grid-cols-3 gap-5 mb-6">
      <div v-for="acc in cashAccounts" :key="acc.id"
        :class="acc.type === 'transfer' ? 'bg-primary text-white' : 'bg-white border border-slate-100'"
        class="rounded-xl p-6 shadow-sm">
        <div class="flex items-center gap-2 mb-2">
          <span :class="acc.type === 'transfer' ? 'text-blue-200' : 'text-slate-400'" class="material-symbols-outlined">
            {{ acc.type === 'tunai' ? 'payments' : 'account_balance' }}
          </span>
          <span :class="acc.type === 'transfer' ? 'text-blue-200' : 'text-slate-500'" class="text-xs font-bold uppercase tracking-wider">{{ acc.name }}</span>
        </div>
        <p :class="acc.type === 'transfer' ? 'text-white' : 'text-primary'" class="text-3xl font-black font-headline">{{ formatRp(acc.balance) }}</p>
      </div>
      <div class="card flex items-center justify-between">
        <span class="text-slate-500 font-semibold">Total Saldo</span>
        <span class="text-2xl font-black text-primary font-headline">{{ formatRp(cashTotal) }}</span>
      </div>
    </div>

    <!-- Charts Row 1: Income & Expenses Trend -->
    <div class="grid grid-cols-2 gap-5 mb-6">
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Tren Pemasukan</h3>
        <div class="h-64">
          <Bar v-if="incomeChartData" :data="incomeChartData" :options="barOptions" />
        </div>
      </div>
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Pemasukan vs Pengeluaran</h3>
        <div class="h-64">
          <Line v-if="compareChartData" :data="compareChartData" :options="lineOptions" />
        </div>
      </div>
    </div>

    <!-- Charts Row 2: Payment Breakdown & Motor Ranking -->
    <div class="grid grid-cols-3 gap-5 mb-6">
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Metode Pembayaran</h3>
        <div class="h-64 flex items-center justify-center">
          <Doughnut v-if="paymentChartData" :data="paymentChartData" :options="doughnutOptions" />
        </div>
      </div>
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Kategori Pengeluaran</h3>
        <div class="h-64 flex items-center justify-center">
          <Doughnut v-if="expenseCatData" :data="expenseCatData" :options="doughnutOptions" />
        </div>
      </div>
      <div class="card">
        <h3 class="text-sm font-extrabold text-primary font-headline mb-4">Kommission Split</h3>
        <div class="h-64 flex items-center justify-center">
          <Doughnut v-if="commissionChartData" :data="commissionChartData" :options="doughnutOptions" />
        </div>
      </div>
    </div>

    <!-- Charts Row 3: Top Motors -->
    <div class="card mb-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-sm font-extrabold text-primary font-headline">Performa Motor</h3>
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
              <span :class="r.payment_method === 'tunai' ? 'badge-neutral' : 'badge-success'">{{ r.payment_method }}</span>
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
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'vue-chartjs'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler
)

const period = ref('month')
const startDate = ref('')
const endDate = ref('')

const summary = ref({ income: 0, expenses: 0, wavy_gets: 0, owner_gets: 0, profit: 0, rental_count: 0, refund_count: 0 })
const cashAccounts = ref([])
const cashTotal = ref(0)
const recentRentals = ref([])

// Charts
const incomeChartData = ref(null)
const compareChartData = ref(null)
const paymentChartData = ref(null)
const expenseCatData = ref(null)
const commissionChartData = ref(null)

const motorChartData = ref(null)
const topMotorsData = ref([])
const topMotorsSortBy = ref('income') // income, count

const primaryColor = '#1e3a5f'
const chartColors = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (v) => 'Rp ' + (v / 1000) + 'k' }, grid: { color: '#f1f5f9' } },
    x: { grid: { display: false } }
  }
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 11 } } } },
  scales: {
    y: { beginAtZero: true, ticks: { callback: (v) => 'Rp ' + (v / 1000) + 'k' }, grid: { color: '#f1f5f9' } },
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
        callback: (v) => topMotorsSortBy.value === 'income' ? 'Rp ' + (v / 1000) + 'k' : v + ' kali' 
      }, 
      grid: { color: '#f1f5f9' } 
    },
    y: { grid: { display: false } }
  }
}))

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } }
  }
}

function today() { return new Date().toISOString().split('T')[0] }

function onPeriodChange() {
  const now = new Date()
  if (period.value === 'today') {
    startDate.value = endDate.value = today()
  } else if (period.value === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    startDate.value = new Date(now.getFullYear(), now.getMonth(), diff).toISOString().split('T')[0]
    endDate.value = today()
  } else if (period.value === 'month') {
    startDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    endDate.value = today()
  } else if (period.value === 'year') {
    startDate.value = `${now.getFullYear()}-01-01`
    endDate.value = today()
  }
}

function statusBadge(status) {
  return { active: 'badge-success', completed: 'badge-neutral', refunded: 'badge-error' }[status] || 'badge-neutral'
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}`
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
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  const dateRange = { startDate: s, endDate: e }
  const dateRangeShort = { startDate: startDate.value, endDate: endDate.value }

  // Summary
  summary.value = await window.api.getDashboardSummary(dateRange)

  // Cash
  const cash = await window.api.getCashSummary()
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
        label: 'Pemasukan',
        data: allDates.map(d => incomeMap[d] || 0),
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      },
      {
        label: 'Pengeluaran',
        data: allDates.map(d => expenseMap[d] || 0),
        borderColor: '#ef4444',
        backgroundColor: '#ef444420',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }
    ]
  }

  // Payment breakdown
  const paymentData = await window.api.getPaymentBreakdown(dateRange)
  paymentChartData.value = {
    labels: paymentData.map(p => p.payment_method === 'tunai' ? 'Tunai' : 'Transfer'),
    datasets: [{
      data: paymentData.map(p => p.total),
      backgroundColor: ['#1e3a5f', '#3b82f6'],
      borderWidth: 0
    }]
  }

  // Commission split
  if (summary.value.wavy_gets > 0 || summary.value.owner_gets > 0) {
    commissionChartData.value = {
      labels: ['Wavy Gets', 'Owner Gets'],
      datasets: [{
        data: [summary.value.wavy_gets, summary.value.owner_gets],
        backgroundColor: ['#1e3a5f', '#f59e0b'],
        borderWidth: 0
      }]
    }
  } else {
    commissionChartData.value = null
  }

  // Top motors
  topMotorsData.value = await window.api.getTopMotors(dateRange)
  updateMotorChart()

  // Expense categories
  const expCats = await window.api.getExpenseCategories(dateRangeShort)
  if (expCats.length) {
    expenseCatData.value = {
      labels: expCats.map(c => c.category),
      datasets: [{
        data: expCats.map(c => c.total),
        backgroundColor: chartColors.slice(0, expCats.length),
        borderWidth: 0
      }]
    }
  } else {
    expenseCatData.value = null
  }
}

onMounted(() => {
  onPeriodChange()
  loadAll()
})
</script>
