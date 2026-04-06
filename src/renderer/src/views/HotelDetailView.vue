<template>
  <div>
    <!-- Header -->
    <div class="mb-8 flex justify-between items-end">
      <div>
        <div class="flex items-center gap-3 mb-2">
          <button @click="router.push('/hotels')" class="p-1 hover:bg-slate-100 rounded text-slate-400">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 class="page-title !mb-0">{{ hotel?.name || 'Loading...' }}</h2>
          <span v-if="hotel" :class="hotel.is_active ? 'badge-success' : 'badge-error'">
            {{ hotel.is_active ? 'Aktif' : 'Nonaktif' }}
          </span>
        </div>
        <p class="text-slate-500 text-sm ml-10">
          Telepon: <span class="font-medium mr-4">{{ hotel?.phone || '-' }}</span>
          Info Bank: 
          <span class="font-medium" v-if="hotel?.bank_account">{{ hotel.bank_name }} - {{ hotel.bank_account }}</span>
          <span v-else>-</span>
        </p>
      </div>
      <div>
        <button @click="loadPreviewAndConfirm" class="btn-primary" :disabled="!hotel?.is_active">
          <span class="material-symbols-outlined">payments</span>
          Bayar Komisi Vendor
        </button>
      </div>
    </div>

    <!-- Payout History -->
    <div class="card overflow-hidden p-0 mb-6">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 class="font-bold">Riwayat Pembayaran Komisi</h3>
      </div>
      <table class="w-full text-left">
        <thead>
          <tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
            <th class="px-6 py-4">Tanggal (ID)</th>
            <th class="px-6 py-4">Sewa Terapeutik</th>
            <th class="px-6 py-4 text-right">Ambil Dari Kas</th>
            <th class="px-6 py-4 text-right">Total Komisi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="p in history.payouts" :key="p.id" class="text-sm">
            <td class="px-6 py-4 align-top">
              <span class="font-bold block">{{ formatDate(p.date) }}</span>
              <span class="text-xs text-slate-400 font-mono">ID: {{ p.id }}</span>
            </td>
            <td class="px-6 py-4">
              <ul class="text-xs space-y-1 mt-1 text-slate-500">
                <li v-for="(r, i) in p.rentals" :key="i">
                  Sewa {{ r.model }} - {{ r.customer_name }} ({{ formatRp(r.amount) }})
                </li>
              </ul>
            </td>
            <td class="px-6 py-4 text-right align-top text-slate-500">{{ p.cash_account_name }}</td>
            <td class="px-6 py-4 text-right align-top font-bold text-primary">{{ formatRp(p.amount) }}</td>
          </tr>
          <tr v-if="!history.payouts?.length">
            <td colspan="4" class="px-6 py-8 text-center text-slate-400">Belum ada riwayat pembayaran</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Payout Modal -->
    <n-modal v-model:show="showPayoutModal" preset="card" title="Proses Pembayaran Komisi Vendor" style="max-width: 600px" :auto-focus="false" :trap-focus="false">
      <div v-if="previewData" class="space-y-4">
        <div class="bg-primary/5 rounded-lg border border-primary/20 p-4">
          <p class="text-xs text-slate-500 font-bold mb-2">KOMISI KOTOR (DARI PENYEWAAN YANG BELUM DIBAYAR)</p>
          <div class="max-h-48 overflow-y-auto mb-2 space-y-2">
            <div v-for="r in previewData.rentals" :key="r.id" class="flex justify-between text-sm bg-white p-2 rounded">
              <div>
                <span class="font-medium">{{ r.model }} - {{ r.customer_name }}</span>
                <span class="text-slate-400 text-xs ml-2">{{ formatDate(r.date_time) }}</span>
              </div>
              <span class="text-green-600 font-medium">+ {{ formatRp(r.vendor_fee) }}</span>
            </div>
            <div v-if="!previewData.rentals.length" class="text-sm text-slate-400 text-center py-2">
              Tidak ada rental baru.
            </div>
          </div>
          <div class="flex justify-between border-t border-primary/20 pt-2 font-bold">
            <span>Total Komisi Kotor</span>
            <span>{{ formatRp(previewData.grossCommission) }}</span>
          </div>
        </div>

        <div class="bg-slate-50 rounded-lg border border-slate-200 p-4">
           <div class="flex justify-between text-lg font-black text-primary">
            <span>TOTAL BERSIH DIBAYARKAN</span>
            <span>{{ formatRp(previewData.netAmount) }}</span>
          </div>
        </div>

        <div v-if="previewData.netAmount > 0">
          <label class="block text-xs font-bold text-slate-500 mb-1">Ambil Dari Kas</label>
          <select v-model="payoutForm.cash_account_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
            <option value="">-- Pilih Akun Kas --</option>
            <option v-for="c in cashAccounts" :key="c.id" :value="c.id">
              {{ c.name }} (Saldo: {{ formatRp(c.balance) }})
            </option>
          </select>
        </div>

        <p v-if="payoutError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ payoutError }}</p>

        <div class="flex justify-end gap-3 pt-4">
          <button @click="showPayoutModal = false" class="btn-secondary">Batal</button>
          <button @click="submitPayout" :disabled="!payoutForm.cash_account_id || previewData.netAmount <= 0" class="btn-primary disabled:opacity-50">
            Bayar Sekarang
          </button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatRp, formatDate, nowDateTime } from '../utils/format'

const route = useRoute()
const router = useRouter()
const hotelId = route.params.id

const hotel = ref(null)
const history = ref({ payouts: [] })
const cashAccounts = ref([])

const showPayoutModal = ref(false)
const previewData = ref(null)
const payoutError = ref('')
const payoutForm = ref({ cash_account_id: '' })

async function loadData() {
  hotel.value = await window.api.getHotel(hotelId)
  history.value = await window.api.getHotelPayoutHistory({ hotelId })
  cashAccounts.value = await window.api.getCashAccounts()
}

async function loadPreviewAndConfirm() {
  previewData.value = await window.api.getHotelPayoutPreview({ hotelId })
  payoutForm.value.cash_account_id = ''
  payoutError.value = ''
  showPayoutModal.value = true
}

async function submitPayout() {
  payoutError.value = ''
  try {
    await window.api.payoutHotel({
      hotel_id: hotelId,
      hotel_name: hotel.value.name,
      // FIX #1 & #2: Kirim rental_ids dari preview agar server bisa validasi
      rental_ids: previewData.value.rentals.map(r => r.id),
      net_amount: previewData.value.netAmount,
      cash_account_id: payoutForm.value.cash_account_id,
      date: nowDateTime().split('T')[0]
    })
    showPayoutModal.value = false
    await loadData()
  } catch (err) {
    payoutError.value = err.message.replace("Error invoking remote method 'hotel:payout': Error: ", '')
  }
}

onMounted(() => {
  loadData()
})
</script>
