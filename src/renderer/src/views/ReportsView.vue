<template>
  <div>
    <div class="mb-8">
      <h2 class="page-title">Laporan & Analitik</h2>
      <p class="text-slate-500 text-sm mt-1">Rekap keuangan dan performa motor</p>
    </div>

    <!-- Filter -->
    <div class="card mb-6 flex gap-4 items-center">
      <select v-model="period" @change="onPeriodChange" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="today">Hari Ini</option>
        <option value="week">Minggu Ini</option>
        <option value="month">Bulan Ini</option>
        <option value="custom">Kustom</option>
      </select>
      <template v-if="period === 'custom'">
        <input v-model="startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <span class="text-slate-400">—</span>
        <input v-model="endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </template>
      <button @click="loadReport" class="btn-primary">
        <span class="material-symbols-outlined">bar_chart</span>
        Tampilkan
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-6 mb-8" v-if="summary">
      <div class="card">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pemasukan</p>
        <p class="text-2xl font-black text-primary font-headline">{{ formatRp(summary.income) }}</p>
      </div>
      <div class="card">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pengeluaran</p>
        <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(summary.expenses) }}</p>
      </div>
      <div class="card">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wavy Gets</p>
        <p class="text-2xl font-black text-primary font-headline">{{ formatRp(summary.wavy_gets) }}</p>
      </div>
      <div class="card">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Profit Bersih</p>
        <p class="text-2xl font-black font-headline" :class="summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(summary.profit) }}</p>
      </div>
    </div>

    <!-- Motor Ranking -->
    <div class="card">
      <h3 class="text-lg font-extrabold text-primary font-headline mb-4">Ranking Motor</h3>
      <table class="w-full text-left">
        <thead>
          <tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
            <th class="pb-3">#</th>
            <th class="pb-3">Motor</th>
            <th class="pb-3">Tipe</th>
            <th class="pb-3 text-right">Total Rental</th>
            <th class="pb-3 text-right">Total Hari</th>
            <th class="pb-3 text-right">Wavy Gets</th>
            <th class="pb-3 text-right">Owner Gets</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="(m, i) in motorRanking" :key="m.id" class="text-sm">
            <td class="py-3 font-black text-slate-400">{{ i + 1 }}</td>
            <td class="py-3 font-medium">{{ m.model }} <span class="text-slate-400">· {{ m.plate_number }}</span></td>
            <td class="py-3"><span :class="m.type === 'pribadi' ? 'badge-neutral' : 'badge-warning'">{{ m.type }}</span></td>
            <td class="py-3 text-right">{{ m.total_rentals }}x</td>
            <td class="py-3 text-right">{{ m.total_days }} hari</td>
            <td class="py-3 text-right font-bold text-primary">{{ formatRp(m.total_wavy) }}</td>
            <td class="py-3 text-right text-slate-600">{{ formatRp(m.total_owner) }}</td>
          </tr>
          <tr v-if="!motorRanking.length">
            <td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { formatRp, today } from '../utils/format'

const period = ref('month')
const startDate = ref('')
const endDate = ref('')
const summary = ref(null)
const motorRanking = ref([])

function onPeriodChange() {
  const now = new Date()
  if (period.value === 'today') {
    startDate.value = endDate.value = today()
  } else if (period.value === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    startDate.value = new Date(now.setDate(diff)).toISOString().split('T')[0]
    endDate.value = today()
  } else if (period.value === 'month') {
    startDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    endDate.value = today()
  }
}

async function loadReport() {
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  summary.value = await window.api.getReportSummary({ startDate: s, endDate: e })
  motorRanking.value = await window.api.getMotorRanking({ startDate: s, endDate: e })
}

onMounted(() => {
  onPeriodChange()
  loadReport()
})
</script>
