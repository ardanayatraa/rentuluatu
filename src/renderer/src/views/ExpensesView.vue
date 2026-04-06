<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Pengeluaran</h2>
        <p class="text-slate-500 text-sm mt-1">Pengeluaran per motor & operasional umum</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-symbols-outlined">add</span>
        Tambah Pengeluaran
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-6 flex gap-4 items-center flex-wrap">
      <input v-model="filters.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <span class="text-slate-400">—</span>
      <input v-model="filters.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <select v-model="filters.type" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Semua Tipe</option>
        <option value="motor">Per Motor</option>
        <option value="umum">Umum</option>
      </select>
      <button @click="loadExpenses" class="btn-secondary">
        <span class="material-symbols-outlined">filter_list</span>
        Filter
      </button>
      <span class="ml-auto text-sm font-bold text-primary">Total: {{ formatRp(totalExpenses) }}</span>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden p-0">
      <table class="w-full text-left">
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
          <tr v-for="e in expenses" :key="e.id" class="text-sm hover:bg-slate-50 transition-colors">
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
              <span :class="e.payment_method === 'tunai' ? 'badge-neutral' : 'badge-success'">{{ e.payment_method }}</span>
            </td>
            <td class="px-6 py-4 text-right font-bold text-red-600">{{ formatRp(e.amount) }}</td>
            <td class="px-6 py-4 text-right">
              <button @click="deleteExpense(e.id)" class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined text-base">delete</span>
              </button>
            </td>
          </tr>
          <tr v-if="!expenses.length">
            <td colspan="7" class="px-6 py-12 text-center text-slate-400">Belum ada data pengeluaran</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
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
              <span class="text-slate-400 text-xs font-mono">{{ m.plate_number }}</span>
            </div>
          </div>
          <div v-if="showMotorDropdown && motorSearch && !filteredMotors.length"
            class="border border-slate-200 rounded-lg mt-1 px-3 py-2 text-sm text-slate-400 bg-white">
            Motor tidak ditemukan
          </div>
          <div v-if="selectedMotor" class="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex justify-between">
            <span class="font-semibold text-primary">{{ selectedMotor.model }} · {{ selectedMotor.plate_number }}</span>
            <span class="text-slate-500 capitalize">{{ selectedMotor.type }}</span>
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
            <label class="block text-xs font-bold text-slate-500 mb-1">Jumlah (Rp)</label>
            <input v-model.number="form.amount" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar</label>
            <select v-model="form.payment_method" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatRp, formatDate, today } from '../utils/format'

const expenses = ref([])
const allMotors = ref([])
const showModal = ref(false)
const filters = ref({ startDate: '', endDate: '', type: '' })
const form = ref({ type: 'umum', motor_id: '', category: 'air', amount: 0, payment_method: 'tunai', date: today(), description: '' })
const customCategory = ref('')
const formError = ref('')

// Motor search
const motorSearch = ref('')
const showMotorDropdown = ref(false)
const selectedMotor = ref(null)

const filteredMotors = computed(() => {
  if (!motorSearch.value) return allMotors.value.slice(0, 20)
  const q = motorSearch.value.toLowerCase().replace(/\s+/g, '')
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

function onTypeChange() {
  form.value.motor_id = ''
  selectedMotor.value = null
  motorSearch.value = ''
  form.value.category = form.value.type === 'motor' ? 'gps' : 'air'
  customCategory.value = ''
}

const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + e.amount, 0))

function openAdd() {
  form.value = { type: 'umum', motor_id: '', category: 'air', amount: 0, payment_method: 'tunai', date: today(), description: '' }
  customCategory.value = ''
  formError.value = ''
  selectedMotor.value = null
  motorSearch.value = ''
  showModal.value = true
}

async function loadExpenses() {
  expenses.value = await window.api.getExpenses({ ...filters.value })
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
  // Kirim motor_id null jika tipe umum
  if (data.type === 'umum') data.motor_id = null
  formError.value = ''
  try {
    await window.api.createExpense(data)
    showModal.value = false
    await loadExpenses()
  } catch (err) {
    formError.value = err.message.replace("Error invoking remote method 'expense:create': Error: ", '')
  }
}

async function deleteExpense(id) {
  await window.api.deleteExpense(id)
  await loadExpenses()
}

onMounted(async () => {
  await loadExpenses()
  allMotors.value = await window.api.getMotors()
})
</script>
