<template>
  <div v-if="hotel" class="space-y-6">
    <div class="card sticky top-4 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="flex items-start gap-4 min-w-0 flex-1">
          <button @click="router.push('/hotels')" class="mt-1 p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <span class="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="page-title !text-[2.2rem]">{{ hotel.name }}</h2>
              <span :class="hotel.is_active ? 'badge-success' : 'badge-neutral'" class="text-[10px]">
                {{ hotel.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </div>
            <p class="text-slate-500 text-sm mt-1">Detail vendor hotel, fee vendor tunai per transaksi, dan riwayat pembayaran lama</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button @click="openSlipModal" class="btn-secondary">
            <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
            Slip Fee Vendor
          </button>
          <button
            v-if="previewData.netAmount > 0"
            @click="loadPreviewAndConfirm"
            class="btn-primary !bg-orange-500 hover:!bg-orange-600"
            :disabled="!hotel.is_active"
          >
            <span class="material-symbols-outlined text-sm">payments</span>
            Bayar Semua ({{ formatRp(previewData.netAmount) }})
          </button>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8 gap-y-4 border-t border-slate-100 pt-5">
        <div class="space-y-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Telepon</p>
          <p class="text-base font-bold text-slate-800">{{ hotel.phone || '-' }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Bank</p>
          <p class="text-base font-bold text-slate-800">{{ hotel.bank_name || '-' }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">No. Rekening</p>
          <p class="text-base font-mono font-bold text-slate-800 break-all">{{ hotel.bank_account || '-' }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Periode Aktif</p>
          <p class="text-base font-bold text-slate-800">{{ activePeriodLabel }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="successMessage"
      class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2"
    >
      <span class="material-symbols-outlined text-emerald-500">check_circle</span>
      {{ successMessage }}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div class="card">
        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Fee Vendor (Periode Ini)</p>
        <p class="mt-2 text-2xl font-black text-orange-500">{{ formatRp(previewData.grossCommission) }}</p>
      </div>
      <div class="card">
        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Jumlah Transaksi Vendor</p>
        <p class="mt-2 text-2xl font-black text-primary">{{ previewData.rentals.length }}</p>
      </div>
      <div class="card">
        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Dibayar (Periode Ini)</p>
        <p class="mt-2 text-2xl font-black text-emerald-600">{{ formatRp(totalPaidHistorical) }}</p>
      </div>
    </div>

    <div class="card">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-base">date_range</span>
            Filter Periode
          </h3>
          <p class="text-xs text-slate-400 mt-1">Dipakai untuk rekap fee vendor tunai, slip fee vendor, dan riwayat pembayaran vendor hotel.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <select v-model="periodFilter.mode" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="month">Per Bulan</option>
            <option value="custom">Rentang Tanggal</option>
            <option value="all">Semua Data</option>
          </select>
          <input
            v-if="periodFilter.mode === 'month'"
            v-model="periodFilter.month"
            type="month"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <template v-if="periodFilter.mode === 'custom'">
            <input v-model="periodFilter.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <span class="text-slate-400 self-center">-</span>
            <input v-model="periodFilter.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </template>
          <button @click="applyPeriodFilter" class="btn-primary text-sm">
            <span class="material-symbols-outlined text-sm">filter_list</span>
            Terapkan
          </button>
          <button @click="resetPeriodFilter" class="btn-secondary text-sm">
            <span class="material-symbols-outlined text-sm">refresh</span>
            Reset
          </button>
        </div>
      </div>
    </div>

    <div class="card table-card">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-3 flex-wrap">
        <div>
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-base">payments</span>
            Rekap Fee Vendor (Tunai Saat Transaksi)
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            {{ pendingRentals.length }} transaksi vendor dengan total fee {{ formatRp(previewData.grossCommission) }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="pendingSearch"
            type="text"
            placeholder="Cari pelanggan atau motor..."
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 max-w-full"
          />
          <select v-model.number="pendingPageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option :value="10">10 / halaman</option>
            <option :value="25">25 / halaman</option>
            <option :value="50">50 / halaman</option>
          </select>
        </div>
      </div>

      <div v-if="!pendingRentals.length" class="py-10 text-center text-slate-400 text-sm">
        Belum ada transaksi vendor hotel pada periode ini
      </div>

      <div v-else class="table-scroll">
      <table class="table-base text-left">
        <thead>
          <tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
            <th class="px-6 py-4">Tanggal</th>
            <th class="px-6 py-4">Pelanggan</th>
            <th class="px-6 py-4">Motor</th>
            <th class="px-6 py-4 text-right">Durasi</th>
            <th class="px-6 py-4 text-right">Total Sewa</th>
            <th class="px-6 py-4 text-right">Fee Vendor</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="r in pagedPendingRentals" :key="r.id" class="text-sm hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-slate-500">{{ formatDateTimeShort(r.date_time) }}</td>
            <td class="px-6 py-4 font-medium text-slate-700">{{ r.customer_name }}</td>
            <td class="px-6 py-4">
              <span class="font-medium">{{ r.model }}</span>
              <span class="ml-1 text-xs text-slate-400">{{ r.plate_number }}</span>
            </td>
            <td class="px-6 py-4 text-right text-slate-500">{{ r.period_days }} hari</td>
            <td class="px-6 py-4 text-right font-semibold text-slate-700">{{ formatRp(r.total_price) }}</td>
            <td class="px-6 py-4 text-right font-bold text-orange-500">{{ formatRp(r.vendor_fee) }}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div v-if="pendingRentals.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pendingPageStart }}-{{ pendingPageEnd }} dari {{ pendingRentals.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="pendingCurrentPage = Math.max(1, pendingCurrentPage - 1)" :disabled="pendingCurrentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ pendingCurrentPage }} / {{ pendingTotalPages }}</span>
          <button @click="pendingCurrentPage = Math.min(pendingTotalPages, pendingCurrentPage + 1)" :disabled="pendingCurrentPage === pendingTotalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <div class="card table-card">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-3 flex-wrap">
        <div>
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-base">receipt_long</span>
            Riwayat Pembayaran Fee Vendor
          </h3>
          <p class="text-xs text-slate-400 mt-1">{{ filteredPayouts.length }} pembayaran tercatat untuk periode aktif</p>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="historySearch"
            type="text"
            placeholder="Cari tanggal, kas, atau pelanggan..."
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-72 max-w-full"
          />
          <select v-model.number="historyPageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option :value="10">10 / halaman</option>
            <option :value="25">25 / halaman</option>
            <option :value="50">50 / halaman</option>
          </select>
        </div>
      </div>

      <div v-if="!filteredPayouts.length" class="py-10 text-center text-slate-400 text-sm">
        Belum ada riwayat pembayaran untuk periode ini
      </div>

      <div v-for="(p, idx) in pagedPayouts" :key="p.id" class="border-b border-slate-100 last:border-0">
        <div
          class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
          @click="openHistoryIndex = openHistoryIndex === historyPageStartIndex + idx ? -1 : historyPageStartIndex + idx"
        >
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
            <div>
              <p class="text-sm font-bold text-slate-700">Pembayaran {{ formatDate(p.date) }}</p>
              <p class="text-xs text-slate-400">Kas {{ p.cash_account_name }} - {{ p.rentals.length }} rental</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-base font-black text-primary">{{ formatRp(p.amount) }}</span>
            <span class="material-symbols-outlined text-slate-400">
              {{ openHistoryIndex === historyPageStartIndex + idx ? 'expand_less' : 'expand_more' }}
            </span>
          </div>
        </div>

        <div v-if="openHistoryIndex === historyPageStartIndex + idx" class="bg-slate-50 px-4 py-4">
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <p class="font-bold text-slate-500 uppercase tracking-wider text-xs mb-2">Rincian Rental</p>
              <div class="space-y-2">
                <div v-for="(r, rentalIdx) in p.rentals" :key="`${p.id}-${rentalIdx}`" class="flex justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 gap-3">
                  <div class="text-sm text-slate-600">
                    <p class="font-semibold text-slate-700">{{ r.model }} <span class="text-slate-400">{{ r.plate_number }}</span></p>
                    <p class="text-xs text-slate-400">{{ r.customer_name }} - {{ formatDate(r.date_time) }} - {{ r.period_days }} hari</p>
                  </div>
                  <span class="ml-3 font-bold text-emerald-600">{{ formatRp(r.amount) }}</span>
                </div>
              </div>
            </div>
            <div class="space-y-3">
              <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Akun Kas</p>
                <p class="mt-1 text-sm font-bold text-slate-700">{{ p.cash_account_name }}</p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Total Dibayarkan</p>
                <p class="mt-1 text-lg font-black text-primary">{{ formatRp(p.amount) }}</p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">ID Pembayaran</p>
                <p class="mt-1 text-sm font-mono text-slate-600">{{ p.id }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredPayouts.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ historyPageStart }}-{{ historyPageEnd }} dari {{ filteredPayouts.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="historyCurrentPage = Math.max(1, historyCurrentPage - 1)" :disabled="historyCurrentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ historyCurrentPage }} / {{ historyTotalPages }}</span>
          <button @click="historyCurrentPage = Math.min(historyTotalPages, historyCurrentPage + 1)" :disabled="historyCurrentPage === historyTotalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <n-modal
      v-model:show="showSlipModal"
      preset="card"
      title="Preview Slip Fee Vendor"
      class="max-w-xl"
      :auto-focus="false"
      :trap-focus="false"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Periode Dokumen</span>
            <span class="font-semibold text-slate-700 text-right">{{ activePeriodLabel }}</span>
          </div>
          <div class="flex justify-between gap-3 mt-2">
            <span class="text-slate-500">Nama File</span>
            <span class="font-mono text-xs text-slate-600 text-right break-all">{{ slipFileName }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="rounded-xl border border-slate-200 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Jumlah Rental</p>
            <p class="mt-2 text-lg font-black text-primary">{{ previewData.rentals.length }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Fee Vendor</p>
            <p class="mt-2 text-lg font-black text-orange-500">{{ formatRp(previewData.grossCommission) }}</p>
          </div>
        </div>

        <p v-if="slipError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ slipError }}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showSlipModal = false" class="btn-secondary">Batal</button>
          <button @click="previewSlip" class="btn-primary flex items-center gap-2 px-5 font-bold">
            <span class="material-symbols-outlined">visibility</span>
            Preview Slip
          </button>
        </div>
      </div>
    </n-modal>

    <n-modal
      v-model:show="showPayoutModal"
      preset="card"
      title="Konfirmasi Pembayaran Fee Vendor Hotel"
      class="max-w-3xl"
      :auto-focus="false"
      :trap-focus="false"
    >
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Periode Pembayaran</span>
            <span class="font-semibold text-slate-700 text-right">{{ activePeriodLabel }}</span>
          </div>
          <div class="flex justify-between gap-3 mt-2">
            <span class="text-slate-500">Dokumen Referensi</span>
            <span class="font-mono text-xs text-slate-600 text-right break-all">{{ slipFileName }}</span>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Ringkasan Pembayaran
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div class="px-4 py-4">
              <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Jumlah Rental</p>
              <p class="mt-2 text-xl font-black text-primary">{{ previewData.rentals.length }}</p>
            </div>
            <div class="px-4 py-4">
              <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Fee Vendor Pending</p>
              <p class="mt-2 text-xl font-black text-orange-500">{{ formatRp(previewData.grossCommission) }}</p>
            </div>
            <div class="px-4 py-4">
              <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Dibayarkan</p>
              <p class="mt-2 text-xl font-black text-emerald-600">{{ formatRp(previewData.netAmount) }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-4 py-3 flex items-center justify-between">
            <h4 class="text-sm font-bold text-slate-700">Rincian Rental Vendor</h4>
            <span class="text-xs text-slate-400">{{ previewData.rentals.length }} transaksi</span>
          </div>
          <div class="max-h-[320px] overflow-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-white text-slate-400 text-[11px] uppercase font-bold sticky top-0">
                <tr>
                  <th class="px-4 py-3">Tanggal</th>
                  <th class="px-4 py-3">Pelanggan</th>
                  <th class="px-4 py-3">Motor</th>
                  <th class="px-4 py-3 text-right">Fee Vendor</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="r in previewData.rentals" :key="r.id">
                  <td class="px-4 py-3 text-slate-500">{{ formatDateTimeShort(r.date_time) }}</td>
                  <td class="px-4 py-3 font-medium text-slate-700">{{ r.customer_name }}</td>
                  <td class="px-4 py-3 text-slate-600">{{ r.model }} <span class="text-slate-400">{{ r.plate_number }}</span></td>
                  <td class="px-4 py-3 text-right font-bold text-emerald-600">{{ formatRp(r.vendor_fee) }}</td>
                </tr>
                <tr v-if="!previewData.rentals.length">
                  <td colspan="4" class="px-4 py-8 text-center text-slate-400">Tidak ada fee vendor yang perlu dibayar</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="previewData.netAmount > 0">
          <label class="block text-xs font-bold text-slate-500 mb-1">Sumber Dana (Kas)</label>
          <select v-model="payoutForm.cash_account_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
            <option value="">- Pilih Kas -</option>
            <option v-for="c in cashAccounts" :key="c.id" :value="c.id">{{ c.name }} (Saldo: {{ formatRp(c.balance) }})</option>
          </select>
        </div>

        <p v-if="payoutError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ payoutError }}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showPayoutModal = false" class="btn-secondary">Batal</button>
          <button @click="previewSlip" type="button" class="btn-secondary flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">visibility</span>
            Preview Slip
          </button>
          <button
            @click="submitPayout"
            :disabled="!payoutForm.cash_account_id || previewData.netAmount <= 0 || !previewData.rentals.length"
            class="btn-primary disabled:opacity-50"
          >
            Bayar Sekarang
          </button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatRp, formatDate, nowDateTime } from '../utils/format'
import { buildHotelCommissionHtml, previewReport } from '../utils/pdf'

const route = useRoute()
const router = useRouter()
const hotelId = Number(route.params.id)

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

function createDefaultPeriodFilter() {
  return {
    mode: 'month',
    month: currentMonthValue(),
    startDate: '',
    endDate: ''
  }
}

const hotel = ref(null)
const history = ref({ payouts: [] })
const cashAccounts = ref([])
const previewData = ref({ rentals: [], grossCommission: 0, netAmount: 0 })

const showPayoutModal = ref(false)
const showSlipModal = ref(false)
const payoutError = ref('')
const slipError = ref('')
const successMessage = ref('')
const payoutForm = ref({ cash_account_id: '' })

const periodFilter = ref(createDefaultPeriodFilter())

const pendingSearch = ref('')
const pendingCurrentPage = ref(1)
const pendingPageSize = ref(10)

const historySearch = ref('')
const historyCurrentPage = ref(1)
const historyPageSize = ref(10)
const openHistoryIndex = ref(-1)

function getMonthRange(monthValue) {
  if (!monthValue) return { startDate: '', endDate: '' }
  const [year, month] = monthValue.split('-').map(Number)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10)
  return { startDate, endDate }
}

function formatLongDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatMonthLabel(value) {
  if (!value) return '-'
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

function toFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'dokumen'
}

function formatDateTimeShort(value) {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const effectivePeriod = computed(() => {
  if (periodFilter.value.mode === 'all') return { startDate: '', endDate: '' }
  if (periodFilter.value.mode === 'month') return getMonthRange(periodFilter.value.month)
  return {
    startDate: periodFilter.value.startDate || '',
    endDate: periodFilter.value.endDate || ''
  }
})

const activePeriodLabel = computed(() => {
  if (periodFilter.value.mode === 'all') return 'Semua Data'
  if (periodFilter.value.mode === 'month') return formatMonthLabel(periodFilter.value.month)
  if (effectivePeriod.value.startDate && effectivePeriod.value.endDate) {
    return `${formatLongDate(effectivePeriod.value.startDate)} s/d ${formatLongDate(effectivePeriod.value.endDate)}`
  }
  return formatLongDate(effectivePeriod.value.startDate || effectivePeriod.value.endDate)
})

const slipFileName = computed(() => {
  let periodLabel = 'Semua_Data'
  if (periodFilter.value.mode === 'month') {
    periodLabel = toFileNamePart(periodFilter.value.month)
  } else if (periodFilter.value.mode === 'custom') {
    const { startDate, endDate } = effectivePeriod.value
    periodLabel = startDate && endDate && startDate !== endDate
      ? `${toFileNamePart(startDate)}_sd_${toFileNamePart(endDate)}`
      : toFileNamePart(endDate || startDate)
  }
  return `Slip_Fee_Vendor_${toFileNamePart(hotel.value?.name || 'Vendor')}_${periodLabel}.pdf`
})

const totalPendingRentalValue = computed(() =>
  (previewData.value.rentals || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0)
)

const totalPaidHistorical = computed(() =>
  (history.value.payouts || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
)

const pendingRentals = computed(() => {
  const query = pendingSearch.value.trim().toLowerCase()
  const rows = previewData.value.rentals || []
  if (!query) return rows
  return rows.filter(item => {
    const haystack = `${item.customer_name || ''} ${item.model || ''} ${item.plate_number || ''}`.toLowerCase()
    return haystack.includes(query)
  })
})

const pendingTotalPages = computed(() => Math.max(1, Math.ceil(pendingRentals.value.length / pendingPageSize.value)))
const pagedPendingRentals = computed(() => {
  const start = (pendingCurrentPage.value - 1) * pendingPageSize.value
  return pendingRentals.value.slice(start, start + pendingPageSize.value)
})
const pendingPageStart = computed(() => pendingRentals.value.length ? ((pendingCurrentPage.value - 1) * pendingPageSize.value) + 1 : 0)
const pendingPageEnd = computed(() => Math.min(pendingCurrentPage.value * pendingPageSize.value, pendingRentals.value.length))

const filteredPayouts = computed(() => {
  const query = historySearch.value.trim().toLowerCase()
  const rows = history.value.payouts || []
  if (!query) return rows
  return rows.filter(item => {
    const rentalText = (item.rentals || [])
      .map(r => `${r.customer_name || ''} ${r.model || ''} ${r.plate_number || ''}`)
      .join(' ')
    const haystack = `${item.date || ''} ${item.cash_account_name || ''} ${rentalText}`.toLowerCase()
    return haystack.includes(query)
  })
})

const historyTotalPages = computed(() => Math.max(1, Math.ceil(filteredPayouts.value.length / historyPageSize.value)))
const pagedPayouts = computed(() => {
  const start = (historyCurrentPage.value - 1) * historyPageSize.value
  return filteredPayouts.value.slice(start, start + historyPageSize.value)
})
const historyPageStart = computed(() => filteredPayouts.value.length ? ((historyCurrentPage.value - 1) * historyPageSize.value) + 1 : 0)
const historyPageEnd = computed(() => Math.min(historyCurrentPage.value * historyPageSize.value, filteredPayouts.value.length))
const historyPageStartIndex = computed(() => (historyCurrentPage.value - 1) * historyPageSize.value)

async function refreshPreviewData() {
  previewData.value = await window.api.getHotelPayoutPreview({
    hotelId,
    ...effectivePeriod.value
  })
}

async function loadData() {
  hotel.value = await window.api.getHotel(hotelId)
  history.value = await window.api.getHotelPayoutHistory({
    hotelId,
    ...effectivePeriod.value
  })
  await refreshPreviewData()
  cashAccounts.value = await window.api.getCashAccounts()
  pendingCurrentPage.value = 1
  historyCurrentPage.value = 1
  openHistoryIndex.value = -1
}

async function applyPeriodFilter() {
  successMessage.value = ''
  await loadData()
}

async function resetPeriodFilter() {
  periodFilter.value = createDefaultPeriodFilter()
  successMessage.value = ''
  await loadData()
}

async function openSlipModal() {
  slipError.value = ''
  await refreshPreviewData()
  showSlipModal.value = true
}

async function previewSlip() {
  try {
    slipError.value = ''
    await refreshPreviewData()
    const html = buildHotelCommissionHtml({
      hotel: hotel.value,
      rentals: previewData.value.rentals,
      period: activePeriodLabel.value
    })
    await previewReport(html, slipFileName.value)
  } catch (err) {
    slipError.value = err.message || 'Gagal membuat preview slip fee vendor.'
  }
}

async function loadPreviewAndConfirm() {
  await refreshPreviewData()
  payoutForm.value.cash_account_id = ''
  payoutError.value = ''
  successMessage.value = ''
  showPayoutModal.value = true
}

async function submitPayout() {
  payoutError.value = ''
  try {
    await window.api.payoutHotel({
      hotel_id: hotelId,
      hotel_name: hotel.value.name,
      rental_ids: previewData.value.rentals.map(r => r.id),
      net_amount: previewData.value.netAmount,
      cash_account_id: payoutForm.value.cash_account_id,
      date: nowDateTime().split('T')[0]
    })
    showPayoutModal.value = false
    successMessage.value = `Pembayaran fee vendor untuk ${hotel.value.name} berhasil diproses.`
    await loadData()
  } catch (err) {
    payoutError.value = err.message.replace("Error invoking remote method 'hotel:payout': Error: ", '')
  }
}

watch([pendingSearch, pendingPageSize], () => {
  pendingCurrentPage.value = 1
})

watch([historySearch, historyPageSize], () => {
  historyCurrentPage.value = 1
  openHistoryIndex.value = -1
})

onMounted(() => {
  loadData()
})
</script>
