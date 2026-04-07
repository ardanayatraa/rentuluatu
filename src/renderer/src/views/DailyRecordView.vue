<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Daily Record</h2>
        <p class="text-slate-500 text-sm mt-1">Pencatatan transaksi penyewaan</p>
      </div>
        <div v-if="activeRecordTab === 'rental'" class="flex gap-3">
          <button @click="openAdd" class="btn-primary">
            <span class="material-symbols-outlined">add</span>
            Tambah Rental
          </button>
        </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 border-b border-slate-200">
      <button
        @click="activeRecordTab = 'rental'"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeRecordTab === 'rental'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">receipt_long</span>
        Transaksi Rental
      </button>
      <button
        @click="activeRecordTab = 'extend'"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeRecordTab === 'extend'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">autorenew</span>
        Extend
      </button>
    </div>
    <div class="card mb-6 flex gap-4 items-center flex-wrap">
      <input v-model="filters.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <span class="text-slate-400">—</span>
      <input v-model="filters.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <input v-model="filters.keyword" type="text" placeholder="Cari nama atau plat..." class="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[220px]" />
      <select v-model="filters.status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Semua Status</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
      </select>
      <button @click="loadRentals" class="btn-secondary">
        <span class="material-symbols-outlined">filter_list</span>
        Filter
      </button>
      <select v-model.number="pageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option :value="10">10 / halaman</option>
        <option :value="25">25 / halaman</option>
        <option :value="50">50 / halaman</option>
      </select>
    </div>

    <!-- Table -->
    <div class="card table-card">
      <div class="table-scroll">
      <table class="table-base text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Tanggal</th>
            <th class="px-6 py-4">Pelanggan</th>
            <th class="px-6 py-4">Hotel / Vendor Hotel</th>
            <th class="px-6 py-4">Motor</th>
            <th class="px-6 py-4">Periode</th>
            <th class="px-6 py-4">Bayar</th>
            <th class="px-6 py-4 text-right">Harga Kotor</th>
            <th class="px-6 py-4 text-right">Komisi Hotel</th>
            <th class="px-6 py-4 text-right">Wavy Gets</th>
            <th class="px-6 py-4 text-right">Bagian Mitra</th>
            <th class="px-6 py-4 text-right">Status</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td colspan="12" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="r in pagedRentals" :key="r.id" class="hover:bg-slate-50 transition-colors text-sm">
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
              <span :class="paymentMethodBadge(r.payment_method)">{{ paymentMethodLabel(r.payment_method) }}</span>
            </td>
            <td class="px-6 py-4 text-right font-semibold">{{ formatRp(r.total_price) }}</td>
            <td class="px-6 py-4 text-right text-amber-600">{{ r.vendor_fee > 0 ? formatRp(r.vendor_fee) : '-' }}</td>
            <td class="px-6 py-4 text-right font-bold text-primary">{{ formatRp(r.wavy_gets) }}</td>
            <td class="px-6 py-4 text-right text-slate-600">{{ formatRp(r.owner_gets) }}</td>
            <td class="px-6 py-4 text-right">
              <span :class="statusBadge(r.status)">{{ r.status }}</span>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex gap-1 justify-end">
                <button v-if="r.status === 'completed' && !r.payout_id && !r.hotel_payout_id"
                  @click="openExtend(r)"
                  class="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-colors" :title="extendActionLabel">
                  <span class="material-symbols-outlined text-base">autorenew</span>
                </button>
                <button v-if="r.status === 'completed' && !r.payout_id && !r.hotel_payout_id"
                  @click="openEdit(r)"
                  class="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-500 transition-colors" title="Edit">
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button v-if="r.status === 'completed'" @click="openRefund(r)"
                  class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Refund">
                  <span class="material-symbols-outlined text-base">undo</span>
                </button>
                <button v-if="!r.payout_id && !r.hotel_payout_id"
                  @click="deleteRental(r)"
                  class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Hapus">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !filteredRentals.length">
            <td colspan="12" class="px-6 py-12 text-center text-slate-400">Belum ada data rental</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="!loading && filteredRentals.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ filteredRentals.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Rental Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="editId ? 'Edit Rental' : 'Tambah Rental'" style="max-width: 560px" :auto-focus="false" :trap-focus="false">
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
            <!-- Selected motor info -->
            <div v-if="selectedMotor" class="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex justify-between">
              <span class="font-semibold text-primary">{{ selectedMotor.model }} · {{ selectedMotor.plate_number }}</span>
              <span class="text-slate-500 text-xs">{{ selectedMotor.type === 'pribadi' ? '20/80' : '30/70' }}{{ selectedMotor.owner_name ? ' · ' + selectedMotor.owner_name : '' }}</span>
            </div>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Hotel / Vendor Hotel</label>
            <div class="relative">
              <input
                v-model="form.hotel"
                type="text"
                placeholder="Ketik untuk mengisi teks biasa atau mencari nama hotel..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
                @input="form.hotel_id = null; form.vendor_fee = 0"
                @focus="showVendorDropdown = true"
                @blur="onVendorBlur"
              />
              <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">domain</span>
            </div>
            <!-- Dropdown hotel / vendor hotel -->
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
              Terhubung ke data hotel yang terdaftar
            </div>
            <div v-else-if="form.hotel && form.vendor_fee > 0" class="mt-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 px-3 py-2 text-xs flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">warning</span>
              Nama ini belum ada di master data hotel. Komisi hotel tidak akan masuk ke pencairan mana pun.
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Periode (hari)</label>
            <input v-model.number="form.period_days" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Harga Kotor</label>
            <input v-model.number="form.total_price" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div v-if="form.hotel_id">
            <label class="block text-xs font-bold text-slate-500 mb-1">Komisi Hotel</label>
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
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="debit_card" class="accent-primary" />
                <span class="text-sm font-medium">Debit Card</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Preview komisi -->
        <div v-if="selectedMotor && form.total_price"
          class="bg-slate-50 rounded-lg p-4 text-sm space-y-1.5 border border-slate-200">
          <div class="flex justify-between">
            <span class="text-slate-500">Harga Kotor</span>
            <span class="font-bold">{{ formatRp(form.total_price) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Komisi Hotel</span>
            <span class="text-red-500">- {{ formatRp(form.vendor_fee || 0) }}</span>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5">
            <span class="text-slate-500 font-bold">Nilai Bersih</span>
            <span class="font-bold">{{ formatRp(form.total_price - (form.vendor_fee || 0)) }}</span>
          </div>
          <div class="flex justify-between text-primary">
            <span>Wavy Gets ({{ selectedMotor.type === 'pribadi' ? '20%' : '30%' }})</span>
            <span class="font-bold">{{ formatRp(calcWavy()) }}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Bagian Mitra ({{ selectedMotor.type === 'pribadi' ? '80%' : '70%' }})</span>
            <span class="font-bold">{{ formatRp(calcOwner()) }}</span>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" :disabled="!form.motor_id" class="btn-primary disabled:opacity-50">Simpan</button>
        </div>
      </form>
    </n-modal>

    <!-- Extend Rental Modal -->
    <n-modal v-model:show="showExtendModal" preset="card" :title="extendModalTitle" style="max-width: 520px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitExtend" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tgl</label>
            <input v-model="extendForm.date_time" type="datetime-local" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">DK Motor</label>
            <select v-model="extendForm.motor_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
              <option value="" disabled>Pilih DK Motor</option>
              <option v-for="m in allMotors" :key="m.id" :value="m.id">{{ m.plate_number }} — {{ m.model }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Periode (hari)</label>
            <input v-model.number="extendForm.period_days" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Total Price</label>
            <input v-model.number="extendForm.total_price" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Metode Pembayaran</label>
            <div class="flex gap-3 flex-wrap">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="tunai" class="accent-primary" />
                <span class="text-sm font-medium">Tunai</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="transfer" class="accent-primary" />
                <span class="text-sm font-medium">Transfer</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="qris" class="accent-primary" />
                <span class="text-sm font-medium">QRIS</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="debit_card" class="accent-primary" />
                <span class="text-sm font-medium">Debit Card</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showExtendModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary" :disabled="!extendForm.motor_id">{{ extendSubmitLabel }}</button>
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
import { ref, computed, onMounted, watch } from 'vue'
import { formatRp, formatDate, nowDateTime } from '../utils/format'

function formatTime(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const rentals = ref([])
const loading = ref(false)
const allMotors = ref([])
const allVendors = ref([])
const showModal = ref(false)
const showRefundModal = ref(false)
const showExtendModal = ref(false)
const activeRecordTab = ref('rental')
const extendActionLabel = computed(() => activeRecordTab.value === 'extend' ? 'Extend Lagi' : 'Extend')
const extendModalTitle = computed(() => activeRecordTab.value === 'extend' ? 'Extend Lagi' : 'Extend Rental')
const extendSubmitLabel = computed(() => activeRecordTab.value === 'extend' ? 'Simpan Extend Lagi' : 'Simpan Extend')
const editId = ref(null)
const selectedRental = ref(null)
const selectedMotor = ref(null)
const motorSearch = ref('')
const showMotorDropdown = ref(false)
const showVendorDropdown = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)

const filters = ref({ startDate: '', endDate: '', status: '', keyword: '' })
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
const extendForm = ref({
  parent_rental_id: null,
  date_time: nowDateTime(),
  motor_id: '',
  period_days: 1,
  total_price: 0,
  payment_method: 'tunai'
})
const refundError = ref('')
const filteredRentals = computed(() => {
  const byTab = rentals.value.filter(r => {
    const isExtend = Number(r.is_extension || 0) === 1
    return activeRecordTab.value === 'extend' ? isExtend : !isExtend
  })

  const keyword = String(filters.value.keyword || '').toLowerCase().trim()
  if (!keyword) return byTab
  return byTab.filter(r => {
    const customer = String(r.customer_name || '').toLowerCase()
    const plate = String(r.plate_number || '').toLowerCase()
    const model = String(r.model || '').toLowerCase()
    return customer.includes(keyword) || plate.includes(keyword) || model.includes(keyword)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRentals.value.length / pageSize.value)))
const pagedRentals = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRentals.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => filteredRentals.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredRentals.value.length))

watch(() => filters.value.keyword, () => {
  currentPage.value = 1
})

watch(activeRecordTab, () => {
  currentPage.value = 1
})

watch(pageSize, () => {
  currentPage.value = 1
})

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value
})

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
  editId.value = null
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

function openEdit(rental) {
  editId.value = rental.id
  // Cari motor yang sesuai
  const motor = allMotors.value.find(m => m.id === rental.motor_id)
  selectedMotor.value = motor || null
  motorSearch.value = motor ? `${motor.model} - ${motor.plate_number}` : ''
  form.value = {
    date_time: rental.date_time,
    customer_name: rental.customer_name,
    hotel: rental.hotel || '',
    hotel_id: rental.hotel_id || null,
    motor_id: rental.motor_id,
    period_days: rental.period_days,
    total_price: rental.total_price,
    vendor_fee: rental.vendor_fee || 0,
    payment_method: rental.payment_method
  }
  showModal.value = true
}

function openExtend(rental) {
  showExtendModal.value = true
  extendForm.value = {
    parent_rental_id: rental.id,
    date_time: nowDateTime(),
    motor_id: rental.motor_id,
    period_days: 1,
    total_price: 0,
    payment_method: rental.payment_method || 'tunai'
  }
}

function statusBadge(s) {
  return { completed: 'badge-neutral', refunded: 'badge-error' }[s] || 'badge-neutral'
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
  loading.value = true
  try {
    rentals.value = await window.api.getRentals({ ...filters.value })
    currentPage.value = 1
  } finally {
    loading.value = false
  }
}

async function submitRental() {
  const vendorFee = form.value.vendor_fee || 0
  if (vendorFee < 0) return alert('Vendor fee tidak boleh negatif')
  if (vendorFee > form.value.total_price) return alert('Vendor fee tidak boleh melebihi total harga sewa')

  if (editId.value) {
    await window.api.updateRental({ id: editId.value, ...form.value })
  } else {
    await window.api.createRental({ ...form.value, status: 'completed' })
  }
  showModal.value = false
  await loadRentals()
}

async function submitExtend() {
  if (!extendForm.value.parent_rental_id) return alert('Data sumber extend tidak ditemukan')
  if (!extendForm.value.motor_id) return alert('DK motor wajib dipilih')
  if (!extendForm.value.period_days || extendForm.value.period_days < 1) return alert('Periode minimal 1 hari')
  if (!extendForm.value.total_price || extendForm.value.total_price <= 0) return alert('Total price harus lebih dari 0')

  await window.api.extendRental({ ...extendForm.value })
  showExtendModal.value = false
  await loadRentals()
}

async function deleteRental(rental) {
  const label = `${rental.customer_name} - ${rental.model} (${rental.invoice_number || 'no invoice'})`
  if (!confirm(`Hapus rental "${label}"?\n\nSaldo kas akan dikembalikan. Tindakan ini tidak bisa dibatalkan.`)) return
  try {
    await window.api.deleteRental(rental.id)
    await loadRentals()
  } catch (err) {
    alert(err.message.replace("Error invoking remote method 'rental:delete': Error: ", ''))
  }
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
