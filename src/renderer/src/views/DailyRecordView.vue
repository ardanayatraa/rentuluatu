<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Daily Record</h2>
        <p class="text-slate-500 text-sm mt-1">Pencatatan transaksi penyewaan</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-symbols-outlined">add</span>
        Tambah Rental
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-6 flex gap-4 items-center flex-wrap">
      <input v-model="filters.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <span class="text-slate-400">—</span>
      <input v-model="filters.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <select v-model="filters.status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Semua Status</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
      </select>
      <button @click="loadRentals" class="btn-secondary">
        <span class="material-symbols-outlined">filter_list</span>
        Filter
      </button>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden p-0">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">No. Invoice</th>
            <th class="px-6 py-4">Tanggal</th>
            <th class="px-6 py-4">Pelanggan</th>
            <th class="px-6 py-4">Hotel</th>
            <th class="px-6 py-4">Motor</th>
            <th class="px-6 py-4">Periode</th>
            <th class="px-6 py-4">Bayar</th>
            <th class="px-6 py-4 text-right">Price</th>
            <th class="px-6 py-4 text-right">Vendor Fee</th>
            <th class="px-6 py-4 text-right">Wavy Gets</th>
            <th class="px-6 py-4 text-right">Owner Gets</th>
            <th class="px-6 py-4 text-right">Status</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="r in rentals" :key="r.id" class="hover:bg-slate-50 transition-colors text-sm">
            <td class="px-6 py-4 font-mono text-xs text-slate-500">{{ r.invoice_number || '-' }}</td>
            <td class="px-6 py-4 text-slate-500">
              <span class="block text-xs font-medium text-slate-700">{{ formatTime(r.date_time) }}</span>
              <span class="text-xs">{{ formatDate(r.date_time) }}</span>
            </td>
            <td class="px-6 py-4 font-medium">{{ r.customer_name }}</td>
            <td class="px-6 py-4 text-slate-500">{{ r.hotel || '-' }}</td>
            <td class="px-6 py-4">
              <span class="font-medium">{{ r.model }}</span>
              <span class="text-slate-400 text-xs ml-1">{{ r.plate_number }}</span>
            </td>
            <td class="px-6 py-4">{{ r.period_days }} hari</td>
            <td class="px-6 py-4">
              <span :class="r.payment_method === 'tunai' ? 'badge-neutral' : 'badge-success'">{{ r.payment_method }}</span>
            </td>
            <td class="px-6 py-4 text-right font-semibold">{{ formatRp(r.total_price) }}</td>
            <td class="px-6 py-4 text-right text-amber-600">{{ r.vendor_fee > 0 ? formatRp(r.vendor_fee) : '-' }}</td>
            <td class="px-6 py-4 text-right font-bold text-primary">{{ formatRp(r.wavy_gets) }}</td>
            <td class="px-6 py-4 text-right text-slate-600">{{ formatRp(r.owner_gets) }}</td>
            <td class="px-6 py-4 text-right">
              <span :class="statusBadge(r.status)">{{ r.status }}</span>
            </td>
            <td class="px-6 py-4 text-right">
              <button v-if="r.status === 'completed'" @click="openRefund(r)"
                class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Refund">
                <span class="material-symbols-outlined text-base">undo</span>
              </button>
            </td>
          </tr>
          <tr v-if="!rentals.length">
            <td colspan="12" class="px-6 py-12 text-center text-slate-400">Belum ada data rental</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Rental Modal -->
    <n-modal v-model:show="showModal" preset="card" title="Tambah Rental" style="max-width: 560px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitRental" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal & Waktu</label>
            <input v-model="form.date_time" type="datetime-local" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Nama Pelanggan</label>
            <input v-model="form.customer_name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Motor</label>
            <!-- Search box -->
            <div class="relative">
              <input
                v-model="motorSearch"
                type="text"
                placeholder="Cari model atau plat (contoh: DK 1234 AB)..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
                @focus="showMotorDropdown = true"
                @blur="onMotorBlur"
              />
              <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">search</span>
            </div>
            <!-- Dropdown hasil search -->
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
            <!-- Selected motor info -->
            <div v-if="selectedMotor" class="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex justify-between">
              <span class="font-semibold text-primary">{{ selectedMotor.model }} · {{ selectedMotor.plate_number }}</span>
              <span class="text-slate-500 capitalize">{{ selectedMotor.type }} · {{ selectedMotor.type === 'pribadi' ? '20/80' : '30/70' }}</span>
            </div>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Hotel / Vendor</label>
            <div class="relative">
              <input
                v-model="form.hotel"
                type="text"
                placeholder="Ketik untuk mengisi teks biasa atau mencari nama vendor..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
                @input="form.hotel_id = null; form.vendor_fee = 0"
                @focus="showVendorDropdown = true"
                @blur="onVendorBlur"
              />
              <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">domain</span>
            </div>
            <!-- Dropdown vendor -->
            <div v-if="showVendorDropdown && filteredVendors.length"
              class="border border-slate-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-lg z-50 relative">
              <div
                v-for="h in filteredVendors" :key="h.id"
                @mousedown.prevent="selectVendor(h)"
                class="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm font-medium"
              >
                {{ h.name }}
              </div>
            </div>
            <!-- Selected Vendor Info -->
            <div v-if="form.hotel_id" class="mt-2 text-xs font-bold text-primary flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">check_circle</span>
              Terhubung ke relasi Vendor yang terdaftar
            </div>
            <div v-else-if="form.hotel && form.vendor_fee > 0" class="mt-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 px-3 py-2 text-xs flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">warning</span>
              Nama ini belum ada di master data Vendor. Komisi tidak akan masuk ke rekening Payout manapun.
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Periode (hari)</label>
            <input v-model.number="form.period_days" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Price (Harga Kotor)</label>
            <input v-model.number="form.total_price" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div v-if="form.hotel_id">
            <label class="block text-xs font-bold text-slate-500 mb-1">Vendor Fee</label>
            <input v-model.number="form.vendor_fee" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="tunai" class="accent-primary" />
                <span class="text-sm font-medium">Tunai</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="transfer" class="accent-primary" />
                <span class="text-sm font-medium">Transfer</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="qris" class="accent-primary" />
                <span class="text-sm font-medium">QRIS</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Preview komisi -->
        <div v-if="selectedMotor && form.total_price"
          class="bg-slate-50 rounded-lg p-4 text-sm space-y-1.5 border border-slate-200">
          <div class="flex justify-between">
            <span class="text-slate-500">Price (Kotor)</span>
            <span class="font-bold">{{ formatRp(form.total_price) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Vendor Fee</span>
            <span class="text-red-500">- {{ formatRp(form.vendor_fee || 0) }}</span>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5">
            <span class="text-slate-500 font-bold">Final Price</span>
            <span class="font-bold">{{ formatRp(form.total_price - (form.vendor_fee || 0)) }}</span>
          </div>
          <div class="flex justify-between text-primary">
            <span>Wavy Gets ({{ selectedMotor.type === 'pribadi' ? '20%' : '30%' }})</span>
            <span class="font-bold">{{ formatRp(calcWavy()) }}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Owner Gets ({{ selectedMotor.type === 'pribadi' ? '80%' : '70%' }})</span>
            <span class="font-bold">{{ formatRp(calcOwner()) }}</span>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" :disabled="!form.motor_id" class="btn-primary disabled:opacity-50">Simpan</button>
        </div>
      </form>
    </n-modal>

    <!-- Refund Modal -->
    <n-modal v-model:show="showRefundModal" preset="card" title="Proses Refund" style="max-width: 420px" :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div class="bg-slate-50 rounded-lg p-4 text-sm">
          <p class="font-bold">{{ selectedRental?.customer_name }}</p>
          <p class="text-slate-500">{{ selectedRental?.model }} · {{ selectedRental?.plate_number }} · {{ selectedRental?.period_days }} hari</p>
          <p class="text-slate-500">Total: {{ formatRp(selectedRental?.total_price) }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Sisa Hari yang Direfund</label>
          <input v-model.number="refundForm.remaining_days" type="number" min="1"
            :max="selectedRental?.period_days"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Skema Refund</label>
          <select v-model="refundForm.percentage" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option :value="100">100% dari sisa hari</option>
            <option :value="50">50% dari sisa hari</option>
            <option :value="0">Custom (input manual)</option>
          </select>
        </div>
        <div v-if="refundForm.percentage === 0">
          <label class="block text-xs font-bold text-slate-500 mb-1">Jumlah Refund (Rp)</label>
          <input v-model.number="refundForm.custom_amount" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Alasan</label>
          <input v-model="refundForm.reason" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Opsional" />
        </div>
        <div class="bg-red-50 border border-red-100 rounded-lg p-3 text-sm flex justify-between">
          <span class="text-slate-500">Jumlah Refund</span>
          <span class="font-black text-red-600">{{ formatRp(calcRefundAmount()) }}</span>
        </div>
        <p v-if="refundError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ refundError }}</p>
        <div class="flex justify-end gap-3">
          <button @click="showRefundModal = false" class="btn-secondary">Batal</button>
          <button @click="submitRefund" class="btn-primary !bg-red-600 hover:!bg-red-700">Proses Refund</button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatRp, formatDate, nowDateTime } from '../utils/format'

function formatTime(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const rentals = ref([])
const allMotors = ref([])
const allVendors = ref([])
const showModal = ref(false)
const showRefundModal = ref(false)
const selectedRental = ref(null)
const selectedMotor = ref(null)
const motorSearch = ref('')
const showMotorDropdown = ref(false)
const showVendorDropdown = ref(false)

const filters = ref({ startDate: '', endDate: '', status: '' })
const form = ref({
  date_time: nowDateTime(),
  customer_name: '',
  hotel: '',
  hotel_id: null,
  motor_id: '',
  period_days: 1,
  total_price: 0,
  vendor_fee: 0,
  payment_method: 'tunai'
})
const refundForm = ref({ remaining_days: 1, percentage: 100, custom_amount: 0, reason: '' })
const refundError = ref('')

// Filter motor by search (model atau plat)
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

const filteredVendors = computed(() => {
  if (!form.value.hotel || form.value.hotel_id) return allVendors.value.slice(0, 10)
  const q = form.value.hotel.toLowerCase()
  return allVendors.value.filter(v => v.name.toLowerCase().includes(q)).slice(0, 10)
})

function selectVendor(v) {
  form.value.hotel_id = v.id
  form.value.hotel = v.name
  showVendorDropdown.value = false
}

function onVendorBlur() {
  // Jika search tidak kosong tapi belum ngeklik, abaikan atau reset ID
  setTimeout(() => { showVendorDropdown.value = false }, 150)
}

function openAdd() {
  selectedMotor.value = null
  motorSearch.value = ''
  form.value = {
    date_time: nowDateTime(),
    customer_name: '',
    hotel: '',
    hotel_id: null,
    motor_id: '',
    period_days: 1,
    total_price: 0,
    vendor_fee: 0,
    payment_method: 'tunai'
  }
  showModal.value = true
}

function statusBadge(s) {
  return { completed: 'badge-neutral', refunded: 'badge-error' }[s] || 'badge-neutral'
}

function calcWavy() {
  if (!selectedMotor.value) return 0
  const sisa = form.value.total_price - (form.value.vendor_fee || 0)
  return sisa * (selectedMotor.value.type === 'pribadi' ? 0.20 : 0.30)
}

function calcOwner() {
  if (!selectedMotor.value) return 0
  const sisa = form.value.total_price - (form.value.vendor_fee || 0)
  return sisa * (selectedMotor.value.type === 'pribadi' ? 0.80 : 0.70)
}

function calcRefundAmount() {
  if (!selectedRental.value) return 0
  // Harga per hari = total / periode, lalu kalikan sisa hari
  const pricePerDay = selectedRental.value.total_price / selectedRental.value.period_days
  const base = refundForm.value.remaining_days * pricePerDay
  if (refundForm.value.percentage === 0) return refundForm.value.custom_amount
  return base * (refundForm.value.percentage / 100)
}

async function loadRentals() {
  rentals.value = await window.api.getRentals({ ...filters.value })
}

async function submitRental() {
  const vendorFee = form.value.vendor_fee || 0
  if (vendorFee < 0) return alert('Vendor fee tidak boleh negatif')
  if (vendorFee > form.value.total_price) return alert('Vendor fee tidak boleh melebihi total harga sewa')
  await window.api.createRental({ ...form.value, status: 'completed' })
  showModal.value = false
  await loadRentals()
}

function openRefund(rental) {
  selectedRental.value = rental
  refundForm.value = { remaining_days: 1, percentage: 100, custom_amount: 0, reason: '' }
  refundError.value = ''
  showRefundModal.value = true
}

async function submitRefund() {
  refundError.value = ''
  try {
    await window.api.createRefund({
      rental_id: selectedRental.value.id,
      refund_percentage: refundForm.value.percentage || null,
      refund_amount: calcRefundAmount(),
      remaining_days: refundForm.value.remaining_days,
      reason: refundForm.value.reason
    })
    showRefundModal.value = false
    await loadRentals()
  } catch (err) {
    refundError.value = err.message.replace("Error invoking remote method 'refund:create': Error: ", '')
  }
}

onMounted(async () => {
  await loadRentals()
  allMotors.value = await window.api.getMotors()
  allVendors.value = await window.api.getHotels()
})
</script>
