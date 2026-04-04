<template>
  <div v-if="owner">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-start">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div>
          <h2 class="page-title flex items-center gap-2">
            Profil Pemilik Motor
            <span :class="owner.is_active ? 'badge-success' : 'badge-neutral'" class="text-[10px] ml-2">{{ owner.is_active ? 'Aktif' : 'Nonaktif' }}</span>
          </h2>
          <p class="text-slate-500 text-sm mt-1">Detail pemasok armada & riwayat pembagian hasil</p>
        </div>
      </div>
    </div>

    <!-- Info & Summary Cards -->
    <div class="grid grid-cols-3 gap-6 mb-8">
      <!-- Owner Info -->
      <div class="card col-span-2">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-full">
            <span class="material-symbols-outlined text-2xl">person</span>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800">{{ owner.name }}</h3>
            <p class="text-sm text-slate-500 flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">call</span> {{ owner.phone || 'Belum diatur' }}
            </p>
          </div>
        </div>
        <div class="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Rekening Bank</p>
            <p class="font-semibold text-slate-700">{{ owner.bank_name || '-' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Nomor Rekening</p>
            <p class="font-mono text-slate-700">{{ owner.bank_account || '-' }}</p>
          </div>
        </div>
      </div>

      <!-- Financial Summary -->
      <div class="card flex flex-col justify-center border-l-4 border-orange-400">
        <p class="text-xs text-orange-500 font-bold uppercase tracking-wider mb-2">Komisi Mengendap</p>
        <p class="text-3xl font-black text-slate-800 font-headline mb-4">{{ formatRp(unpaidTotal) }}</p>
        <button v-if="unpaidTotal > 0" @click="openPayout" class="btn-primary flex items-center justify-center gap-2 w-full !bg-orange-500 hover:!bg-orange-600 border-none shadow-orange-500/30">
          <span class="material-symbols-outlined text-sm">payments</span> Bayar Sekarang
        </button>
      </div>
    </div>

    <!-- Motors and History Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Motors List -->
      <div class="lg:col-span-1 border border-slate-200 bg-white rounded-xl overflow-hidden self-start">
        <div class="p-4 border-b border-slate-100 bg-slate-50">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined">two_wheeler</span>
            Armada Titipan ({{ motors.length }})
          </h3>
        </div>
        <div class="divide-y divide-slate-100">
          <div v-for="m in motors" :key="m.id" class="p-4 flex flex-col gap-1">
            <p class="font-bold text-primary">{{ m.model }}</p>
            <div class="flex justify-between items-center text-sm">
              <span class="font-mono bg-slate-100 px-2 rounded font-bold text-slate-600">{{ m.plate_number }}</span>
              <span class="text-slate-500 capitalize">{{ m.type }}</span>
            </div>
          </div>
          <div v-if="!motors.length" class="p-6 text-center text-slate-400 text-sm">
            Tidak ada motor yang dititipkan
          </div>
        </div>
      </div>

      <!-- Rental History -->
      <div class="lg:col-span-2 card p-0 overflow-hidden flex flex-col">
        <div class="p-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined">history</span>
            Buku Riwayat Sewa
          </h3>
          <div class="flex gap-2">
            <input v-model="historyFilter.startDate" type="date" class="border border-slate-200 rounded-lg px-2 py-1 text-xs" />
            <span class="text-slate-400 self-center">—</span>
            <input v-model="historyFilter.endDate" type="date" class="border border-slate-200 rounded-lg px-2 py-1 text-xs" />
            <button @click="loadHistory" class="btn-primary py-1 px-3 text-xs h-auto cursor-pointer">Filter</button>
            <button @click="resetFilter" title="Reset Data" class="btn-secondary py-1 px-2 text-xs h-auto cursor-pointer"><span class="material-symbols-outlined text-sm m-0">refresh</span></button>
          </div>
        </div>

        <div class="overflow-x-auto min-h-[300px]">
          <table class="w-full text-left">
            <thead class="bg-slate-50 text-slate-400 text-[11px] uppercase font-bold">
              <tr>
                <th class="px-4 py-3">Transaksi</th>
                <th class="px-4 py-3">Motor</th>
                <th class="px-4 py-3 text-right">Hak Owner</th>
                <th class="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 text-sm">
              <tr v-for="h in paginatedHistory" :key="h.id" class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3">
                  <div class="font-bold text-slate-700">{{ formatShortDate(h.date_time) }}</div>
                  <div class="text-xs text-slate-500">{{ h.period_days }} hari</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-semibold text-primary">{{ h.model }}</div>
                  <div class="text-xs font-mono text-slate-500">{{ h.plate_number }}</div>
                </td>
                <td class="px-4 py-3 text-right font-bold text-emerald-600">{{ formatRp(h.owner_gets) }}</td>
                <td class="px-4 py-3 text-center">
                  <span :class="h.is_paid ? 'badge-success' : 'badge-error'" class="!text-[10px]">
                    {{ h.is_paid ? 'LUNAS' : 'NGUTANG' }}
                  </span>
                </td>
              </tr>
              <tr v-if="!paginatedHistory.length">
                <td colspan="4" class="px-4 py-12 text-center text-slate-400">Tidak ada data di periode ini</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50">
          <span class="text-slate-500">
            Menampilkan {{ (currentPage - 1) * itemsPerPage + 1 }} - 
            {{ Math.min(currentPage * itemsPerPage, historyData.length) }} dari {{ historyData.length }} data
          </span>
          <div class="flex gap-1">
            <button @click="currentPage--" :disabled="currentPage === 1" class="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-100 transition-colors font-bold text-slate-600">Prev</button>
            <span class="px-3 py-1 font-semibold text-slate-700">Hal {{ currentPage }} / {{ totalPages || 1 }}</span>
            <button @click="currentPage++" :disabled="currentPage >= totalPages" class="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-100 transition-colors font-bold text-slate-600">Next</button>
          </div>
        </div>
      </div>

    </div>

    <!-- Modal Payout -->
    <n-modal v-model:show="showPayoutModal" preset="card" title="Bayar Komisi Vendor" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitPayout" class="space-y-4">
        <div class="bg-orange-50 text-orange-600 p-4 rounded-xl border border-orange-100 mb-4 text-center">
          <p class="text-xs uppercase font-bold tracking-wider mb-1">Total Hutang Komisi</p>
          <p class="text-2xl font-black font-headline">{{ formatRp(unpaidTotal) }}</p>
        </div>
        
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Nominal yg Dibayar</label>
          <input type="number" :value="unpaidTotal" readonly class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 font-bold text-slate-500" />
          <p class="text-[10px] text-slate-400 mt-1">Pembayaran harus melunasi seluruh total mengendap.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Pilih Sumber Dana (Kas)</label>
          <select v-model="payoutForm.cash_account_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
            <option value="">— Pilih Kas —</option>
            <option v-for="c in cashAccounts" :key="c.id" :value="c.id">
              {{ c.name }} (Saldo: {{ formatRp(c.balance) }})
            </option>
          </select>
        </div>
        
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showPayoutModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary flex items-center gap-2 px-5 font-bold">
            <span class="material-symbols-outlined">payments</span> Bayar Lunas
          </button>
        </div>
      </form>
    </n-modal>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatRp, today } from '../utils/format'

const route = useRoute()
const router = useRouter()

const ownerId = Number(route.params.id)
const owner = ref(null)
const motors = ref([])
const historyData = ref([])
const cashAccounts = ref([])

const historyFilter = ref({ startDate: '', endDate: '' })
const showPayoutModal = ref(false)
const payoutForm = ref({ cash_account_id: '' })

// Paginasi
const currentPage = ref(1)
const itemsPerPage = 10

const totalPages = computed(() => Math.ceil(historyData.value.length / itemsPerPage))

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return historyData.value.slice(start, start + itemsPerPage)
})

const unpaidTotal = computed(() => {
  return historyData.value.filter(h => !h.is_paid).reduce((sum, h) => sum + h.owner_gets, 0)
})

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function resetFilter() {
  historyFilter.value = { startDate: '', endDate: '' }
  loadHistory()
}

async function loadData() {
  const res = await window.api.getOwner(ownerId)
  owner.value = res
  motors.value = res.motors
  cashAccounts.value = await window.api.getCashAccounts()
  await loadHistory()
}

async function loadHistory() {
  historyData.value = await window.api.getOwnerCommission({
    ownerId: ownerId,
    startDate: historyFilter.value.startDate || null,
    endDate: historyFilter.value.endDate || null
  })
  currentPage.value = 1 // Reset pagination upon fetching new data
}

function openPayout() {
  payoutForm.value = { cash_account_id: '' }
  showPayoutModal.value = true
}

async function submitPayout() {
  try {
    await window.api.payoutOwner({
      owner_id: ownerId,
      amount: unpaidTotal.value,
      cash_account_id: payoutForm.value.cash_account_id,
      date: today()
    })
    showPayoutModal.value = false
    await loadData() // reload balance and history
    alert('Pembayaran komisi berhasil dicatat dan lunas!')
  } catch (err) {
    alert(err.message.replace('Error invoking remote method \'owner:payout\': Error: ', ''))
  }
}

onMounted(() => {
  loadData()
})
</script>
