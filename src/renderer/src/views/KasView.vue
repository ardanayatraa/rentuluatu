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
    <div class="card overflow-hidden p-0">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 class="text-lg font-extrabold text-primary font-headline">Riwayat Mutasi</h3>
        <div class="flex gap-3">
          <select v-model="filterAccount" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Akun</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <input v-model="filterDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <button @click="loadTransactions" class="btn-secondary text-xs py-2">Filter</button>
        </div>
      </div>
      <table class="w-full text-left">
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
          <tr v-for="t in transactions" :key="t.id" class="text-sm hover:bg-slate-50 transition-colors">
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
          <tr v-if="!transactions.length">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">Belum ada mutasi</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tambah Pemasukan Modal -->
    <n-modal v-model:show="showIncomeModal" preset="card" title="Tambah Pemasukan" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitIncome" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Deskripsi</label>
          <input v-model="incomeForm.description" type="text" placeholder="Misal: Jual SIM Card, Jual Helm..."
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
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal</label>
          <input v-model="incomeForm.date" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showIncomeModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary">Simpan</button>
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
import { ref, onMounted } from 'vue'
import { formatRp, formatDate } from '../utils/format'

const accounts = ref([])
const total = ref(0)
const transactions = ref([])
const showOpeningModal = ref(false)
const showIncomeModal = ref(false)
const openingBalances = ref({})
const filterAccount = ref('')
const filterDate = ref('')

const incomeForm = ref({
  description: '',
  amount: 0,
  payment_method: 'tunai',
  date: new Date().toISOString().split('T')[0]
})

function kasCardClass(type) {
  if (type === 'transfer') return 'bg-primary text-white'
  if (type === 'qris') return 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
  return 'bg-white border border-slate-100'
}
function kasIconClass(type) {
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  return 'text-slate-400'
}
function kasLabelClass(type) {
  if (type === 'transfer') return 'text-blue-200'
  if (type === 'qris') return 'text-purple-200'
  return 'text-slate-500'
}
function kasBalanceClass(type) {
  if (type === 'transfer' || type === 'qris') return 'text-white'
  return 'text-primary'
}
function kasIcon(type) {
  if (type === 'tunai') return 'payments'
  if (type === 'transfer') return 'account_balance'
  return 'qr_code_2'
}

function openIncome() {
  incomeForm.value = {
    description: '',
    amount: 0,
    payment_method: 'tunai',
    date: new Date().toISOString().split('T')[0]
  }
  showIncomeModal.value = true
}

async function submitIncome() {
  await window.api.addCashIncome({ ...incomeForm.value })
  showIncomeModal.value = false
  await reloadCash()
  await loadTransactions()
}

async function loadTransactions() {
  const filters = {}
  if (filterAccount.value) filters.accountId = filterAccount.value
  if (filterDate.value) { filters.startDate = filterDate.value; filters.endDate = filterDate.value }
  transactions.value = await window.api.getCashTransactions(filters)
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

onMounted(async () => {
  await reloadCash()
  accounts.value.forEach(a => { openingBalances.value[a.id] = a.balance })
  await loadTransactions()
})
</script>
