<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Manajemen Kas</h2>
        <p class="text-slate-500 text-sm mt-1">Monitor arus kas real-time per kantong</p>
      </div>
      <div class="flex gap-3">
        <button @click="openIncome" class="btn-primary">
          <span class="material-symbols-outlined">add</span>
          Tambah Pemasukan
        </button>
        <button @click="showOpeningModal = true" class="btn-secondary">
          <span class="material-symbols-outlined">tune</span>
          Set Saldo Awal
        </button>
      </div>
    </div>

    <!-- Kas Cards -->
    <div class="grid grid-cols-3 gap-6 mb-8">
      <div v-for="acc in accounts" :key="acc.id"
        :class="kasCardClass(acc.type)"
        class="rounded-xl p-8 shadow-sm">
        <div class="flex items-center gap-2 mb-3">
          <span :class="kasIconClass(acc.type)" class="material-symbols-outlined">
            {{ kasIcon(acc.type) }}
          </span>
          <span :class="kasLabelClass(acc.type)" class="text-xs font-bold uppercase tracking-wider">{{ acc.name }}</span>
        </div>
        <p :class="kasBalanceClass(acc.type)" class="text-3xl font-black font-headline">{{ formatRp(acc.balance) }}</p>
      </div>
    </div>

    <!-- Total -->
    <div class="card mb-8 flex items-center justify-between">
      <span class="text-slate-500 font-semibold">Total Saldo Gabungan</span>
      <span class="text-2xl font-black text-primary font-headline">{{ formatRp(total) }}</span>
    </div>

    <!-- Riwayat Mutasi -->
    <div class="card table-card">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 class="text-lg font-extrabold text-primary font-headline">Riwayat Mutasi</h3>
        <div class="flex gap-3">
          <button @click="exportPdf" :disabled="exporting" class="btn-secondary text-xs py-2 disabled:opacity-60">
            <span class="material-symbols-outlined text-sm">visibility</span>
            Lihat Laporan
          </button>
          <button @click="exportExcel" :disabled="exporting" class="btn-secondary text-xs py-2 disabled:opacity-60">
            <span class="material-symbols-outlined text-sm">table_view</span>
            Simpan Excel
          </button>
          <select v-model="filterAccount" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Akun</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <select v-model="filterType" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Tipe</option>
            <option value="in">Pemasukan</option>
            <option value="out">Pengeluaran</option>
          </select>
          <input v-model="filterDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <select v-model.number="pageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option :value="10">10 / halaman</option>
            <option :value="25">25 / halaman</option>
            <option :value="50">50 / halaman</option>
          </select>
          <button @click="loadTransactions" class="btn-secondary text-xs py-2">Filter</button>
        </div>
      </div>
      <div class="table-scroll">
      <table class="table-base text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Tanggal</th>
            <th class="px-6 py-4">Deskripsi</th>
            <th class="px-6 py-4">Akun</th>
            <th class="px-6 py-4">Tipe</th>
            <th class="px-6 py-4 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td colspan="5" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="t in pagedTransactions" :key="t.id" class="text-sm hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-slate-500">{{ formatDate(t.date) }}</td>
            <td class="px-6 py-4">{{ t.description || '-' }}</td>
            <td class="px-6 py-4 text-slate-500">{{ t.account_name }}</td>
            <td class="px-6 py-4">
              <span :class="t.type === 'in' ? 'badge-success' : 'badge-error'">{{ t.type === 'in' ? 'Masuk' : 'Keluar' }}</span>
            </td>
            <td class="px-6 py-4 text-right font-bold" :class="t.type === 'in' ? 'text-emerald-600' : 'text-red-600'">
              {{ t.type === 'in' ? '+' : '-' }}{{ formatRp(t.amount) }}
            </td>
          </tr>
          <tr v-if="!loading && !transactions.length">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">Belum ada mutasi</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="!loading && transactions.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ transactions.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <!-- Tambah Pemasukan Modal -->
    <n-modal v-model:show="showIncomeModal" preset="card" title="Tambah Pemasukan" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitIncome" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Catatan Transaksi</label>
          <input v-model="incomeForm.description" type="text" placeholder="Contoh: Penjualan aksesoris"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Jumlah (Rp)</label>
          <input v-model.number="incomeForm.amount" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar</label>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="incomeForm.payment_method" value="tunai" class="accent-primary" />
              <span class="text-sm font-medium">Tunai</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="incomeForm.payment_method" value="transfer" class="accent-primary" />
              <span class="text-sm font-medium">Transfer</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="incomeForm.payment_method" value="qris" class="accent-primary" />
              <span class="text-sm font-medium">QRIS</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="incomeForm.payment_method" value="debit_card" class="accent-primary" />
              <span class="text-sm font-medium">Debit Card</span>
            </label>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal</label>
          <input v-model="incomeForm.date" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div v-if="incomeError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          {{ incomeError }}
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showIncomeModal = false" :disabled="incomeSubmitting" class="btn-secondary disabled:opacity-60">Batal</button>
          <button type="submit" :disabled="incomeSubmitting" class="btn-primary disabled:opacity-60">
            {{ incomeSubmitting ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </form>
    </n-modal>

    <!-- Opening Balance Modal -->
    <n-modal v-model:show="showOpeningModal" preset="card" title="Set Saldo Awal" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div v-for="acc in accounts" :key="acc.id">
          <label class="block text-xs font-bold text-slate-500 mb-1">{{ acc.name }}</label>
          <input v-model.number="openingBalances[acc.id]" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" :placeholder="formatRp(acc.balance)" />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showOpeningModal = false" class="btn-secondary">Batal</button>
          <button @click="saveOpeningBalance" class="btn-primary">Simpan</button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatRp, formatDate } from '../utils/format'
import { buildSimpleTableHtml, previewReport } from '../utils/pdf'

const accounts = ref([])
const total = ref(0)
const transactions = ref([])
const loading = ref(false)
const showOpeningModal = ref(false)
const showIncomeModal = ref(false)
const openingBalances = ref({})
const filterAccount = ref('')
const filterType = ref('')
const filterDate = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const exporting = ref(false)
const incomeError = ref('')
const incomeSubmitting = ref(false)

const incomeForm = ref({
  description: '',
  amount: 0,
  payment_method: 'tunai',
  date: new Date().toISOString().split('T')[0]
})
const totalPages = computed(() => Math.max(1, Math.ceil(transactions.value.length / pageSize.value)))
const pagedTransactions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return transactions.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => transactions.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, transactions.value.length))
const totalIncome = computed(() => transactions.value.filter(t => t.type === 'in').reduce((sum, t) => sum + Number(t.amount || 0), 0))
const totalExpense = computed(() => transactions.value.filter(t => t.type === 'out').reduce((sum, t) => sum + Number(t.amount || 0), 0))
const netFlow = computed(() => totalIncome.value - totalExpense.value)
const selectedAccountName = computed(() => {
  if (!filterAccount.value) return 'Semua Akun'
  return accounts.value.find(a => Number(a.id) === Number(filterAccount.value))?.name || 'Semua Akun'
})
const selectedTypeLabel = computed(() => {
  if (filterType.value === 'in') return 'Pemasukan'
  if (filterType.value === 'out') return 'Pengeluaran'
  return 'Semua Tipe'
})
const periodLabel = computed(() => filterDate.value ? formatDate(filterDate.value) : 'Semua Tanggal')

function kasCardClass(type) {
  if (type === 'transfer') return 'bg-primary text-white'
  if (type === 'qris') return 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
  if (type === 'debit_card') return 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'
  return 'bg-white border border-slate-100'
}
function kasIconClass(type) {
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  if (type === 'debit_card') return 'text-slate-300'
  return 'text-slate-400'
}
function kasLabelClass(type) {
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  if (type === 'debit_card') return 'text-slate-300'
  return 'text-slate-500'
}
function kasBalanceClass(type) {
  if (type === 'transfer' || type === 'qris' || type === 'debit_card') return 'text-white'
  return 'text-primary'
}
function kasIcon(type) {
  if (type === 'tunai') return 'payments'
  if (type === 'transfer') return 'account_balance'
  if (type === 'debit_card') return 'credit_card'
  return 'qr_code_2'
}

function openIncome() {
  incomeForm.value = {
    description: '',
    amount: 0,
    payment_method: 'tunai',
    date: new Date().toISOString().split('T')[0]
  }
  incomeError.value = ''
  incomeSubmitting.value = false
  showIncomeModal.value = true
}

async function submitIncome() {
  incomeError.value = ''
  const description = String(incomeForm.value.description || '').trim()
  if (!description) {
    incomeError.value = 'Catatan transaksi wajib diisi'
    return
  }
  if (!(Number(incomeForm.value.amount) > 0)) {
    incomeError.value = 'Jumlah harus lebih dari 0'
    return
  }
  if (!incomeForm.value.payment_method) {
    incomeError.value = 'Metode bayar wajib dipilih'
    return
  }
  incomeSubmitting.value = true
  try {
    await window.api.addCashIncome({ ...incomeForm.value, description })
    showIncomeModal.value = false
    await reloadCash()
    await loadTransactions()
  } catch (err) {
    incomeError.value = String(err?.message || err).replace("Error invoking remote method 'cash:add-income': Error: ", '')
  } finally {
    incomeSubmitting.value = false
  }
}

async function loadTransactions() {
  const filters = {}
  if (filterAccount.value) filters.accountId = filterAccount.value
  if (filterType.value) filters.type = filterType.value
  if (filterDate.value) { filters.startDate = filterDate.value; filters.endDate = filterDate.value }
  loading.value = true
  try {
    transactions.value = await window.api.getCashTransactions(filters)
    currentPage.value = 1
  } finally {
    loading.value = false
  }
}

async function reloadCash() {
  const summary = await window.api.getCashSummary()
  accounts.value = summary.accounts
  total.value = summary.total
}

async function saveOpeningBalance() {
  for (const [accountId, amount] of Object.entries(openingBalances.value)) {
    if (amount != null && amount >= 0) {
      await window.api.setCashOpeningBalance({ accountId: Number(accountId), amount })
    }
  }
  showOpeningModal.value = false
  await reloadCash()
}

function getExportFileLabel() {
  const account = selectedAccountName.value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')
  const type = selectedTypeLabel.value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')
  const date = filterDate.value ? filterDate.value : 'Semua_Tanggal'
  return `${account}_${type}_${date}`
}

async function exportPdf() {
  exporting.value = true
  try {
    const html = buildSimpleTableHtml({
      title: 'Laporan Mutasi Kas & Keuangan',
      subtitle: `Akun: ${selectedAccountName.value} · Tipe: ${selectedTypeLabel.value}`,
      period: periodLabel.value,
      summary: [
        { label: 'Total Pemasukan', value: formatRp(totalIncome.value) },
        { label: 'Total Pengeluaran', value: formatRp(totalExpense.value) },
        { label: 'Selisih Arus Kas', value: formatRp(netFlow.value) },
        { label: 'Jumlah Mutasi', value: `${transactions.value.length}x` }
      ],
      columns: [
        { key: 'date', label: 'Tanggal' },
        { key: 'description', label: 'Deskripsi' },
        { key: 'account', label: 'Akun Kas' },
        { key: 'type', label: 'Tipe' },
        { key: 'amount', label: 'Jumlah', align: 'right' }
      ],
      rows: transactions.value.map(item => ({
        date: formatDate(item.date),
        description: item.description || '-',
        account: item.account_name || '-',
        type: item.type === 'in' ? 'Pemasukan' : 'Pengeluaran',
        amount: `${item.type === 'in' ? '+' : '-'}${formatRp(item.amount)}`
      })),
      emptyMessage: 'Belum ada mutasi pada filter ini'
    })
    await previewReport(html, `Kas_Keuangan_${getExportFileLabel()}.pdf`)
  } finally {
    exporting.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const columns = [
      { header: 'Tanggal', key: 'date', width: 18 },
      { header: 'Deskripsi', key: 'description', width: 34 },
      { header: 'Akun Kas', key: 'account', width: 18 },
      { header: 'Tipe', key: 'type', width: 14 },
      { header: 'Pemasukan', key: 'income', width: 18 },
      { header: 'Pengeluaran', key: 'expense', width: 18 }
    ]
    const rows = transactions.value.map(item => ({
      date: formatDate(item.date),
      description: item.description || '-',
      account: item.account_name || '-',
      type: item.type === 'in' ? 'Pemasukan' : 'Pengeluaran',
      income: item.type === 'in' ? Number(item.amount || 0) : 0,
      expense: item.type === 'out' ? Number(item.amount || 0) : 0
    }))
    const totals = {
      date: 'TOTAL',
      description: `${transactions.value.length} mutasi`,
      account: '',
      type: '',
      income: Number(totalIncome.value),
      expense: Number(totalExpense.value)
    }
    await window.api.saveExcel({
      defaultName: `Kas_Keuangan_${getExportFileLabel()}.xlsx`,
      sheets: [{
        name: 'Mutasi Kas',
        columns,
        rows,
        totals,
        currencyKeys: ['income', 'expense']
      }]
    })
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await reloadCash()
  accounts.value.forEach(a => { openingBalances.value[a.id] = a.balance })
  await loadTransactions()
})
</script>
