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
          Tambah Pemasukan / Modal
        </button>
      </div>
    </div>

    <!-- Kas Cards -->
    <div class="space-y-6 mb-8">
      <div v-for="bucket in cashBuckets" :key="bucket.value">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider">{{ bucket.label }}</h3>
          <div class="text-right">
            <p class="text-sm font-black text-slate-700 font-headline">{{ formatRp(totalByBucket(bucket.value)) }}</p>
            <p class="text-[11px] font-semibold text-slate-500">Total Saldo Rekening: {{ formatRp(totalRekeningByBucket(bucket.value)) }}</p>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-4">
          <div v-for="acc in accountsByBucket(bucket.value)" :key="acc.id"
            :class="kasCardClass(acc.type, bucket.value)"
            class="rounded-xl p-6 shadow-sm">
            <div class="flex items-center gap-2 mb-2">
              <span :class="kasIconClass(acc.type, bucket.value)" class="material-symbols-outlined">
                {{ kasIcon(acc.type, bucket.value) }}
              </span>
              <span :class="kasLabelClass(acc.type, bucket.value)" class="text-xs font-bold uppercase tracking-wider">
                {{ paymentMethodLabel(acc.type, bucket.value) }}
              </span>
            </div>
            <p :class="kasBalanceClass(acc.type, bucket.value)" class="text-2xl font-black font-headline">{{ formatRp(acc.balance) }}</p>
          </div>
        </div>
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
              <span :class="t.type === 'in' ? 'badge-success' : 'badge-error'">{{ transactionTypeLabel(t) }}</span>
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

    <!-- Tambah Pemasukan / Modal -->
    <n-modal v-model:show="showIncomeModal" preset="card" title="Tambah Pemasukan / Modal" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitIncome" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Jenis Transaksi</label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer">
              <input type="radio" v-model="incomeForm.entry_type" value="manual_income" class="accent-primary" />
              <span class="text-sm font-medium">Pemasukan</span>
            </label>
            <label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer">
              <input type="radio" v-model="incomeForm.entry_type" value="capital_injection" class="accent-primary" />
              <span class="text-sm font-medium">Tambah Modal</span>
            </label>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">
            Tambah modal masuk ke saldo kas, tapi tidak dihitung sebagai pendapatan.
          </p>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Catatan Transaksi</label>
          <input v-model="incomeForm.description" type="text" :placeholder="incomeDescriptionPlaceholder"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Jumlah (Rp)</label>
          <input v-model.number="incomeForm.amount" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar</label>
          <div v-if="incomeForm.entry_type === 'capital_injection'" class="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p class="text-sm font-semibold text-emerald-700">Modal (otomatis)</p>
            <p class="text-[11px] text-emerald-600 mt-0.5">Tambah modal selalu masuk ke saldo modal.</p>
          </div>
          <div v-else class="flex gap-3">
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


  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { formatRp, formatDate } from '../utils/format'
import { buildSimpleTableHtml, previewReport } from '../utils/pdf'

const accounts = ref([])
const total = ref(0)
const transactions = ref([])
const loading = ref(false)
const showIncomeModal = ref(false)
const filterAccount = ref('')
const filterType = ref('')
const filterDate = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const exporting = ref(false)
const incomeError = ref('')
const incomeSubmitting = ref(false)
const bucketPaymentMethods = {
  pendapatan: ['tunai', 'transfer', 'qris', 'debit_card'],
  modal: ['tunai']
}
const cashBuckets = [
  { value: 'pendapatan', label: 'Kas Pendapatan' },
  { value: 'modal', label: 'Modal' }
]

const incomeForm = ref({
  entry_type: 'manual_income',
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
const totalOpeningBalance = computed(() =>
  transactions.value
    .filter(t => t.reference_type === 'opening_balance')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
)
const totalCapitalInjection = computed(() =>
  transactions.value
    .filter(t => t.reference_type === 'capital_injection')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
)
const totalIncome = computed(() =>
  transactions.value
    .filter(t => t.type === 'in' && !['opening_balance', 'capital_injection'].includes(t.reference_type))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
)
const totalExpense = computed(() => transactions.value.filter(t => t.type === 'out').reduce((sum, t) => sum + Number(t.amount || 0), 0))
const netFlow = computed(() => totalIncome.value - totalExpense.value)
const incomeDescriptionPlaceholder = computed(() =>
  incomeForm.value.entry_type === 'capital_injection'
    ? 'Contoh: Tambahan modal pemilik'
    : 'Contoh: Penjualan aksesoris'
)
const selectedAccountName = computed(() => {
  if (!filterAccount.value) return 'Semua Akun'
  return accounts.value.find(a => Number(a.id) === Number(filterAccount.value))?.name || 'Semua Akun'
})
const accountsByBucket = (bucket) => accounts.value.filter((acc) =>
  String(acc.bucket || 'pendapatan') === bucket &&
  (bucketPaymentMethods[bucket] || []).includes(String(acc.type || ''))
)
const totalByBucket = (bucket) => {
  return accountsByBucket(bucket).reduce((sum, acc) => sum + Number(acc.balance || 0), 0)
}
const totalRekeningByBucket = (bucket) => {
  const rekeningMethods = ['transfer', 'qris', 'debit_card'].filter((method) =>
    (bucketPaymentMethods[bucket] || []).includes(method)
  )
  return accountsByBucket(bucket)
    .filter((acc) => rekeningMethods.includes(String(acc.type || '')))
    .reduce((sum, acc) => sum + Number(acc.balance || 0), 0)
}
const paymentMethodLabel = (method, bucket = 'pendapatan') => {
  if (bucket === 'modal' && String(method) === 'tunai') return 'Modal'
  return ({
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  debit_card: 'Debit Card'
}[method] || method || '-')
}
const selectedTypeLabel = computed(() => {
  if (filterType.value === 'in') return 'Pemasukan'
  if (filterType.value === 'out') return 'Pengeluaran'
  return 'Semua Tipe'
})
const periodLabel = computed(() => filterDate.value ? formatDate(filterDate.value) : 'Semua Tanggal')

function kasCardClass(type, bucket = 'pendapatan') {
  if (bucket === 'modal') return 'bg-amber-50 border border-amber-200'
  if (type === 'transfer') return 'bg-primary text-white'
  if (type === 'qris') return 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
  if (type === 'debit_card') return 'bg-gradient-to-br from-slate-700 to-slate-900 text-white'
  return 'bg-white border border-slate-100'
}
function kasIconClass(type, bucket = 'pendapatan') {
  if (bucket === 'modal') return 'text-amber-600'
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  if (type === 'debit_card') return 'text-slate-300'
  return 'text-slate-400'
}
function kasLabelClass(type, bucket = 'pendapatan') {
  if (bucket === 'modal') return 'text-amber-700'
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  if (type === 'debit_card') return 'text-slate-300'
  return 'text-slate-500'
}
function kasBalanceClass(type, bucket = 'pendapatan') {
  if (bucket === 'modal') return 'text-amber-700'
  if (type === 'transfer' || type === 'qris' || type === 'debit_card') return 'text-white'
  return 'text-primary'
}
function kasIcon(type, bucket = 'pendapatan') {
  if (bucket === 'modal') return 'savings'
  if (type === 'tunai') return 'payments'
  if (type === 'transfer') return 'account_balance'
  if (type === 'debit_card') return 'credit_card'
  return 'qr_code_2'
}

function openIncome() {
  incomeForm.value = {
    entry_type: 'manual_income',
    description: '',
    amount: 0,
    payment_method: 'tunai',
    date: new Date().toISOString().split('T')[0]
  }
  incomeError.value = ''
  incomeSubmitting.value = false
  showIncomeModal.value = true
}

watch(() => incomeForm.value.entry_type, (entryType) => {
  if (entryType === 'capital_injection') {
    incomeForm.value.payment_method = 'tunai'
  }
})

async function submitIncome() {
  incomeError.value = ''
  const description = String(incomeForm.value.description || '').trim()
  const isCapitalInjection = incomeForm.value.entry_type === 'capital_injection'
  if (!description) {
    incomeError.value = 'Catatan transaksi wajib diisi'
    return
  }
  if (!(Number(incomeForm.value.amount) > 0)) {
    incomeError.value = 'Jumlah harus lebih dari 0'
    return
  }
  if (!isCapitalInjection && !incomeForm.value.payment_method) {
    incomeError.value = 'Metode bayar wajib dipilih'
    return
  }
  incomeSubmitting.value = true
  try {
    await window.api.addCashIncome({
      ...incomeForm.value,
      description,
      payment_method: isCapitalInjection ? 'tunai' : incomeForm.value.payment_method
    })
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

function getExportFileLabel() {
  const account = selectedAccountName.value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')
  const type = selectedTypeLabel.value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')
  const date = filterDate.value ? filterDate.value : 'Semua_Tanggal'
  return `${account}_${type}_${date}`
}

function transactionTypeLabel(item) {
  if (item.reference_type === 'opening_balance') return 'Modal Awal'
  if (item.reference_type === 'capital_injection') return 'Tambah Modal'
  return item.type === 'in' ? 'Pemasukan' : 'Pengeluaran'
}

async function exportPdf() {
  exporting.value = true
  try {
    const html = buildSimpleTableHtml({
      title: 'Laporan Mutasi Kas & Keuangan',
      subtitle: `Akun: ${selectedAccountName.value} · Tipe: ${selectedTypeLabel.value}`,
      period: periodLabel.value,
      summary: [
        { label: 'Total Modal Awal', value: formatRp(totalOpeningBalance.value) },
        { label: 'Total Tambah Modal', value: formatRp(totalCapitalInjection.value) },
        { label: 'Total Pemasukan', value: formatRp(totalIncome.value) },
        { label: 'Total Pengeluaran', value: formatRp(totalExpense.value) },
        { label: 'Arus Kas Operasional', value: formatRp(netFlow.value) },
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
        type: transactionTypeLabel(item),
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
      type: transactionTypeLabel(item),
      income: item.reference_type === 'capital_injection' || item.reference_type === 'opening_balance'
        ? 0
        : item.type === 'in' ? Number(item.amount || 0) : 0,
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
  await loadTransactions()
})
</script>

