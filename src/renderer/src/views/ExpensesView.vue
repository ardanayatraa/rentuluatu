<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Pengeluaran</h2>
        <p class="text-slate-500 text-sm mt-1">Pengeluaran per motor & operasional umum</p>
      </div>
      <div class="flex gap-3">
        <button @click="openAdd" class="btn-primary">
          <span class="material-symbols-outlined">add</span>
          Tambah Pengeluaran
        </button>
      </div>
    </div>

    <div class="flex gap-2 mb-6 border-b border-slate-200">
      <button
        @click="switchExpenseTab('umum')"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeExpenseTab === 'umum'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">business_center</span>
        Operasional Kantor
      </button>
      <button
        @click="switchExpenseTab('motor')"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeExpenseTab === 'motor'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">two_wheeler</span>
        Motor
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-6 flex gap-4 items-center flex-wrap">
      <input v-model="filters.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <span class="text-slate-400">—</span>
      <input v-model="filters.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
        {{ activeExpenseTab === 'motor' ? 'Pengeluaran Motor' : 'Operasional Kantor' }}
      </div>
      <div v-if="activeExpenseTab === 'motor'" class="relative min-w-[260px]">
        <input
          v-model="filterMotorSearch"
          type="text"
          placeholder="Cari model atau plat..."
          class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
          @focus="showFilterMotorDropdown = true"
          @blur="onFilterMotorBlur"
        />
        <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">search</span>
        <div
          v-if="showFilterMotorDropdown && filteredFilterMotors.length"
          class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div
            v-for="m in filteredFilterMotors"
            :key="m.id"
            @mousedown.prevent="selectFilterMotor(m)"
            class="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <span class="font-medium">{{ m.model }}</span>
            <span class="text-xs font-mono text-slate-400">{{ m.plate_number }}</span>
          </div>
        </div>
        <div
          v-if="showFilterMotorDropdown && filterMotorSearch && !filteredFilterMotors.length"
          class="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg"
        >
          Motor tidak ditemukan
        </div>
      </div>
      <button @click="loadExpenses" class="btn-secondary">
        <span class="material-symbols-outlined">filter_list</span>
        Filter
      </button>
      <select v-model.number="pageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option :value="10">10 / halaman</option>
        <option :value="25">25 / halaman</option>
        <option :value="50">50 / halaman</option>
      </select>
      <span class="ml-auto text-sm font-bold text-primary">Total: {{ formatRp(totalExpenses) }}</span>
    </div>

    <!-- Table -->
    <div class="card table-card">
      <div class="table-scroll">
      <table class="table-base text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Tanggal</th>
            <th class="px-6 py-4">Sumber</th>
            <th class="px-6 py-4">Kategori</th>
            <th class="px-6 py-4">Deskripsi</th>
            <th class="px-6 py-4">Bayar</th>
            <th class="px-6 py-4 text-right">Jumlah</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td colspan="7" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="e in pagedExpenses" :key="e.id" class="text-sm hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-slate-500">{{ formatDate(e.date) }}</td>
            <td class="px-6 py-4">
              <template v-if="e.type === 'motor' && e.motor_model">
                <p class="font-medium text-slate-700">{{ e.motor_model }}</p>
                <p class="text-xs font-mono text-slate-400">{{ e.plate_number }}</p>
              </template>
              <span v-else class="badge-neutral text-xs">Operasional Umum</span>
            </td>
            <td class="px-6 py-4 font-medium capitalize">{{ e.category }}</td>
            <td class="px-6 py-4 text-slate-500">{{ e.description || '-' }}</td>
            <td class="px-6 py-4">
              <span :class="paymentMethodBadge(e.payment_method)">
                {{ cashBucketLabel(e.cash_bucket) }} · {{ paymentMethodLabel(e.payment_method) }}
              </span>
            </td>
            <td class="px-6 py-4 text-right font-bold text-red-600">{{ formatRp(e.amount) }}</td>
            <td class="px-6 py-4 text-right">
              <button @click="deleteExpense(e.id)" class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined text-base">delete</span>
              </button>
            </td>
          </tr>
          <tr v-if="!loading && !expenses.length">
            <td colspan="7" class="px-6 py-12 text-center text-slate-400">Belum ada data pengeluaran</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div v-if="!loading && expenses.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">
          Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ expenses.length }} data
        </p>
        <div class="flex items-center gap-2">
          <button
            @click="currentPage = Math.max(1, currentPage - 1)"
            :disabled="currentPage === 1"
            class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Prev
          </button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Tambah -->
    <n-modal v-model:show="showModal" preset="card" title="Tambah Pengeluaran" class="max-w-md" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitExpense" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Tipe</label>
          <select v-model="form.type" @change="onTypeChange" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
            <option value="motor">Per Motor</option>
            <option value="umum">Umum</option>
          </select>
        </div>

        <!-- Motor search (same pattern as DailyRecord) -->
        <div v-if="form.type === 'motor'">
          <label class="block text-xs font-bold text-slate-500 mb-1">Motor</label>
          <div class="relative">
            <input
              v-model="motorSearch"
              type="text"
              placeholder="Cari model atau plat..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
              @focus="showMotorDropdown = true"
              @blur="onMotorBlur"
            />
            <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">search</span>
          </div>
          <div v-if="showMotorDropdown && filteredMotors.length"
            class="border border-slate-200 rounded-lg mt-1 max-h-48 overflow-y-auto bg-white shadow-lg z-50 relative">
            <div
              v-for="m in filteredMotors" :key="m.id"
              @mousedown.prevent="selectMotor(m)"
              class="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm flex justify-between items-center"
            >
              <span class="font-medium">{{ m.model }}</span>
              <div class="text-right">
                <span class="text-slate-400 text-xs font-mono block">{{ m.plate_number }}</span>
                <span v-if="m.owner_name" class="text-slate-400 text-xs block">{{ m.owner_name }}</span>
              </div>
            </div>
          </div>
          <div v-if="showMotorDropdown && motorSearch && !filteredMotors.length"
            class="border border-slate-200 rounded-lg mt-1 px-3 py-2 text-sm text-slate-400 bg-white">
            Motor tidak ditemukan
          </div>
          <div v-if="selectedMotor" class="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex justify-between">
            <span class="font-semibold text-primary">{{ selectedMotor.model }} · {{ selectedMotor.plate_number }}</span>
            <span class="text-slate-500 text-xs">{{ selectedMotor.type }}{{ selectedMotor.owner_name ? ' · ' + selectedMotor.owner_name : '' }}</span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Kategori</label>
          <select v-model="form.category" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
            <template v-if="form.type === 'motor'">
              <option value="gps">GPS</option>
              <option value="samsat">SAMSAT</option>
              <option value="service">Service</option>
              <option value="__lainnya">Lainnya</option>
            </template>
            <template v-else>
              <option value="air">Air</option>
              <option value="listrik">Listrik</option>
              <option value="bensin">Bensin</option>
              <option value="aksesori">Aksesori</option>
              <option value="__lainnya">Lainnya</option>
            </template>
          </select>
        </div>
        <!-- Input custom kategori jika pilih Lainnya -->
        <div v-if="form.category === '__lainnya'">
          <label class="block text-xs font-bold text-slate-500 mb-1">Nama Kategori</label>
          <input v-model="customCategory" type="text" placeholder="Ketik nama kategori..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Sumber Kas</label>
            <select v-model="form.cash_bucket" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="pendapatan">Kas Pendapatan</option>
              <option value="modal">Kas Modal</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Jumlah (Rp)</label>
            <input v-model.number="form.amount" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar</label>
            <select v-model="form.payment_method" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="" disabled v-if="!availablePaymentMethods.length">Saldo tidak cukup</option>
              <option value="tunai" :disabled="isPaymentMethodDisabled('tunai')">{{ paymentMethodOptionLabel('tunai') }}</option>
              <option value="transfer" :disabled="isPaymentMethodDisabled('transfer')">{{ paymentMethodOptionLabel('transfer') }}</option>
              <option value="qris" :disabled="isPaymentMethodDisabled('qris')">{{ paymentMethodOptionLabel('qris') }}</option>
              <option value="debit_card" :disabled="isPaymentMethodDisabled('debit_card')">{{ paymentMethodOptionLabel('debit_card') }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal</label>
          <input v-model="form.date" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Deskripsi</label>
          <input v-model="form.description" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <p v-if="formError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ formError }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary">Simpan</button>
        </div>
      </form>
    </n-modal>

    <!-- Modal Konfirmasi Hapus -->
    <n-modal v-model:show="showDeleteConfirm" preset="card" title="Hapus Pengeluaran" style="max-width: 460px" :auto-focus="false" :trap-focus="false">
      <p class="text-sm text-slate-600">Yakin ingin menghapus pengeluaran ini? Saldo kas akan dikembalikan.</p>
      <div class="flex justify-end gap-3 pt-5">
        <button type="button" class="btn-secondary" @click="showDeleteConfirm = false">Batal</button>
        <button type="button" class="btn-primary bg-red-600 hover:bg-red-700 border-red-600" @click="confirmDeleteExpense">Hapus</button>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { formatRp, formatDate, today } from '../utils/format'

const expenses = ref([])
const loading = ref(false)
const allMotors = ref([])
const showModal = ref(false)
const activeExpenseTab = ref('umum')
const filters = ref({ startDate: '', endDate: '', type: 'umum', motorId: '' })
const form = ref({ type: 'umum', motor_id: '', category: 'air', amount: 0, payment_method: 'tunai', cash_bucket: 'pendapatan', date: today(), description: '' })
const customCategory = ref('')
const formError = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const cashAccounts = ref([])
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref(null)

// Motor search
const motorSearch = ref('')
const showMotorDropdown = ref(false)
const selectedMotor = ref(null)
const filterMotorSearch = ref('')
const showFilterMotorDropdown = ref(false)
const selectedFilterMotor = ref(null)

const filteredMotors = computed(() => {
  if (!motorSearch.value) return allMotors.value.slice(0, 20)
  const q = motorSearch.value.toLowerCase().replace(/\s+/g, '')
  return allMotors.value.filter(m => {
    const model = m.model.toLowerCase().replace(/\s+/g, '')
    const plate = m.plate_number.toLowerCase().replace(/\s+/g, '')
    return model.includes(q) || plate.includes(q)
  }).slice(0, 20)
})

const filteredFilterMotors = computed(() => {
  if (!filterMotorSearch.value) return allMotors.value.slice(0, 20)
  const q = filterMotorSearch.value.toLowerCase().replace(/\s+/g, '')
  return allMotors.value.filter(m => {
    const model = m.model.toLowerCase().replace(/\s+/g, '')
    const plate = m.plate_number.toLowerCase().replace(/\s+/g, '')
    return model.includes(q) || plate.includes(q)
  }).slice(0, 20)
})

function selectMotor(m) {
  selectedMotor.value = m
  form.value.motor_id = m.id
  motorSearch.value = `${m.model} - ${m.plate_number}`
  showMotorDropdown.value = false
}

function onMotorBlur() {
  setTimeout(() => { showMotorDropdown.value = false }, 150)
}

function selectFilterMotor(m) {
  selectedFilterMotor.value = m
  filters.value.motorId = m.id
  filterMotorSearch.value = `${m.model} - ${m.plate_number}`
  showFilterMotorDropdown.value = false
}

function onFilterMotorBlur() {
  setTimeout(() => { showFilterMotorDropdown.value = false }, 150)
}

function onFilterTypeChange() {
  if (filters.value.type !== 'motor') {
    filters.value.motorId = ''
    selectedFilterMotor.value = null
    filterMotorSearch.value = ''
    showFilterMotorDropdown.value = false
  }
}

function switchExpenseTab(tab) {
  activeExpenseTab.value = tab
  filters.value.type = tab
  onFilterTypeChange()
  loadExpenses()
}

function onTypeChange() {
  form.value.motor_id = ''
  selectedMotor.value = null
  motorSearch.value = ''
  form.value.category = form.value.type === 'motor' ? 'gps' : 'air'
  customCategory.value = ''
}

const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + e.amount, 0))
const totalPages = computed(() => Math.max(1, Math.ceil(expenses.value.length / pageSize.value)))
const pagedExpenses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return expenses.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => expenses.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, expenses.value.length))
const cashBalanceByType = computed(() => {
  const map = {}
  for (const account of cashAccounts.value) {
    const bucket = String(account.bucket || 'pendapatan')
    map[`${bucket}:${String(account.type)}`] = Number(account.balance || 0)
  }
  return map
})
const currentCashBucket = computed(() => String(form.value.cash_bucket || 'pendapatan'))
const cashBucketLabel = (bucket) => String(bucket || 'pendapatan') === 'modal' ? 'Modal' : 'Pendapatan'
const balanceByBucketAndMethod = (bucket, method) => Number(cashBalanceByType.value[`${bucket}:${method}`] || 0)
const availablePaymentMethods = computed(() => {
  const amount = Number(form.value.amount || 0)
  const methods = ['tunai', 'transfer', 'qris', 'debit_card']
  if (!(amount > 0)) return methods
  return methods.filter(method => balanceByBucketAndMethod(currentCashBucket.value, method) >= amount)
})

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

function paymentMethodOptionLabel(method) {
  const label = paymentMethodLabel(method)
  const balance = balanceByBucketAndMethod(currentCashBucket.value, method)
  return `${label} (Saldo ${formatRp(balance)})`
}

function isPaymentMethodDisabled(method) {
  const amount = Number(form.value.amount || 0)
  if (!(amount > 0)) return false
  return balanceByBucketAndMethod(currentCashBucket.value, method) < amount
}

function openAdd() {
  const nextType = activeExpenseTab.value === 'motor' ? 'motor' : 'umum'
  form.value = {
    type: nextType,
    motor_id: '',
    category: nextType === 'motor' ? 'gps' : 'air',
    amount: 0,
    payment_method: 'tunai',
    cash_bucket: 'pendapatan',
    date: today(),
    description: ''
  }
  customCategory.value = ''
  formError.value = ''
  selectedMotor.value = null
  motorSearch.value = ''
  showModal.value = true
}

async function loadExpenses() {
  loading.value = true
  try {
    expenses.value = await window.api.getExpenses({ ...filters.value })
    currentPage.value = 1
  } finally {
    loading.value = false
  }
}

async function submitExpense() {
  const data = { ...form.value }
  if (data.type === 'motor' && !data.motor_id) {
    formError.value = 'Pilih motor terlebih dahulu'
    return
  }
  if (data.category === '__lainnya') {
    if (!customCategory.value.trim()) { formError.value = 'Nama kategori tidak boleh kosong'; return }
    data.category = customCategory.value.trim()
  }
  if (!data.payment_method) {
    formError.value = 'Saldo kas tidak cukup. Pilih metode bayar lain.'
    return
  }
  // Kirim motor_id null jika tipe umum
  if (data.type === 'umum') data.motor_id = null
  formError.value = ''
  try {
    await window.api.createExpense(data)
    showModal.value = false
    await loadCashAccounts()
    await loadExpenses()
  } catch (err) {
    formError.value = err.message.replace("Error invoking remote method 'expense:create': Error: ", '')
  }
}

function deleteExpense(id) {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteExpense() {
  if (!pendingDeleteId.value) return
  try {
    await window.api.deleteExpense(pendingDeleteId.value)
    showDeleteConfirm.value = false
    pendingDeleteId.value = null
    await loadCashAccounts()
    await loadExpenses()
  } catch (err) {
    formError.value = err.message
    showDeleteConfirm.value = false
  }
}

async function loadCashAccounts() {
  const summary = await window.api.getCashSummary()
  cashAccounts.value = summary.accounts || []
}

watch(
  () => [form.value.amount, form.value.cash_bucket, cashAccounts.value.length, ...Object.values(cashBalanceByType.value)],
  () => {
    if (!isPaymentMethodDisabled(form.value.payment_method)) return
    const fallback = availablePaymentMethods.value[0]
    if (fallback) {
      form.value.payment_method = fallback
      return
    }
    form.value.payment_method = ''
  }
)

onMounted(async () => {
  await loadCashAccounts()
  await loadExpenses()
  allMotors.value = await window.api.getMotors()
})
</script>
