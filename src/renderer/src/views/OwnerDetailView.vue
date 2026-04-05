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
            Profil Mitra
            <span :class="owner.is_active ? 'badge-success' : 'badge-neutral'" class="text-[10px] ml-2">{{ owner.is_active ? 'Aktif' : 'Nonaktif' }}</span>
          </h2>
          <p class="text-slate-500 text-sm mt-1">Detail mitra armada & riwayat pembagian hasil</p>
        </div>
      </div>
    </div>

    <!-- Toast sukses -->
    <div v-if="payoutSuccessMsg"
      class="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-emerald-500">check_circle</span>
      {{ payoutSuccessMsg }}
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
            Armada Mitra ({{ motors.length }})
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

    <!-- Riwayat Payout (Tracing) -->
    <div class="mt-6 card p-0 overflow-hidden">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
          <span class="material-symbols-outlined">receipt_long</span>
          Riwayat Pencairan Komisi
        </h3>
        <span class="text-xs text-slate-400">{{ payoutHistory.length }} pencairan</span>
      </div>

      <!-- Biaya belum dipotong -->
      <div v-if="unpaidExpenses.length" class="px-4 py-3 bg-amber-50 border-b border-amber-100">
        <p class="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">warning</span>
          Biaya motor belum masuk ke pencairan manapun (akan dipotong di pencairan berikutnya)
        </p>
        <div class="space-y-1">
          <div v-for="e in unpaidExpenses" :key="e.id"
            class="flex justify-between text-xs bg-white rounded px-3 py-1.5 border border-amber-100">
            <span class="text-slate-600">
              <span class="font-semibold">{{ e.model }}</span>
              <span class="text-slate-400"> {{ e.plate_number }}</span>
              · {{ e.category }}{{ e.description ? ' — ' + e.description : '' }}
              <span class="text-slate-400"> · {{ formatDate(e.date) }}</span>
            </span>
            <span class="font-semibold text-amber-600 ml-3">- {{ formatRp(e.amount) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!payoutHistory.length" class="py-10 text-center text-slate-400 text-sm">Belum ada riwayat pencairan</div>
      <div v-for="(p, idx) in payoutHistory" :key="p.id" class="border-b border-slate-100 last:border-0">

        <!-- Header payout — klik untuk expand -->
        <div class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
          @click="openIdx = openIdx === idx ? -1 : idx">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
            <div>
              <p class="text-sm font-bold text-slate-700">Pencairan {{ formatDate(p.date) }}</p>
              <p class="text-xs text-slate-400">
                via {{ p.cash_account_name }}
                <template v-if="p.rentals.length">
                  · Periode {{ formatShortDate(p.rentals[p.rentals.length-1].date_time) }} – {{ formatShortDate(p.rentals[0].date_time) }}
                </template>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <p class="font-black text-emerald-600 text-base">{{ formatRp(p.amount) }}</p>
              <p v-if="p.deduction_amount > 0" class="text-xs text-slate-400">
                Kotor {{ formatRp(p.gross_amount) }} − Potongan {{ formatRp(p.deduction_amount) }}
              </p>
              <p v-else class="text-xs text-slate-400">Tanpa potongan</p>
            </div>
            <span class="material-symbols-outlined text-slate-400 transition-transform"
              :style="openIdx === idx ? 'transform:rotate(180deg)' : ''">expand_more</span>
          </div>
        </div>

        <!-- Detail expand -->
        <div v-if="openIdx === idx" class="bg-slate-50 border-t border-slate-100 px-6 py-4">

          <!-- Summary bar -->
          <div class="flex gap-3 mb-4 text-xs">
            <template v-if="p.deduction_amount > 0">
              <div class="flex-1 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <p class="text-slate-400 font-bold uppercase tracking-wider mb-0.5">Komisi Kotor</p>
                <p class="font-black text-slate-700">{{ formatRp(p.grossAmount || p.amount) }}</p>
              </div>
              <div class="flex-1 bg-white rounded-lg border border-red-100 px-3 py-2">
                <p class="text-red-400 font-bold uppercase tracking-wider mb-0.5">Total Potongan</p>
                <p class="font-black text-red-600">- {{ formatRp(p.deduction_amount) }}</p>
              </div>
            </template>
            <div class="flex-1 bg-emerald-50 rounded-lg border border-emerald-200 px-3 py-2">
              <p class="text-emerald-600 font-bold uppercase tracking-wider mb-0.5">Dibayarkan</p>
              <p class="font-black text-emerald-700">{{ formatRp(p.amount) }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 text-xs">
            <!-- Asal komisi — hanya tampil kalau ada data -->
            <div v-if="p.rentals.length">
              <p class="font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">two_wheeler</span>
                Asal Komisi ({{ p.rentals.length }} sewa)
              </p>
              <div class="space-y-1">
                <div v-for="r in p.rentals" :key="r.date_time + r.model"
                  class="flex justify-between py-1.5 px-2 rounded bg-white border border-slate-100">
                  <span class="text-slate-600">{{ r.model }} <span class="text-slate-400">{{ r.plate_number }}</span><br>
                    <span class="text-slate-400">{{ formatShortDate(r.date_time) }} · {{ r.period_days }} hari</span>
                  </span>
                  <span class="font-semibold text-emerald-600 whitespace-nowrap ml-2">{{ formatRp(r.owner_gets) }}</span>
                </div>
              </div>
            </div>

            <!-- Biaya dipotong -->
            <div>
              <p class="font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">remove_circle</span>
                Biaya Dipotong
              </p>
              <div v-if="p.deductions.length" class="space-y-1">
                <div v-for="d in p.deductions" :key="d.category + d.amount"
                  class="flex justify-between py-1.5 px-2 rounded bg-white border border-red-50">
                  <span class="text-slate-600">
                    {{ d.model }} <span class="text-slate-400">{{ d.plate_number }}</span><br>
                    <span class="text-slate-400">{{ d.category }}{{ d.description ? ' — ' + d.description : '' }} · {{ formatShortDate(d.date) }}</span>
                  </span>
                  <span class="font-semibold text-red-500 whitespace-nowrap ml-2">- {{ formatRp(d.amount) }}</span>
                </div>
              </div>
              <div v-else-if="p.deduction_amount > 0" class="py-3 px-2 bg-white rounded border border-slate-100">
                <p class="text-xs text-slate-500">Total potongan biaya: <span class="font-semibold text-red-500">- {{ formatRp(p.deduction_amount) }}</span></p>
                <p v-if="p.tx_description" class="text-[10px] text-slate-400 mt-1 italic">{{ p.tx_description }}</p>
                <p v-else class="text-[10px] text-slate-400 mt-0.5">Detail tidak tersedia (pencairan lama)</p>
              </div>
              <div v-else class="py-3 px-2 text-slate-400 italic bg-white rounded border border-slate-100 text-xs">
                Tidak ada biaya yang dipotong
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Modal Payout -->
    <n-modal v-model:show="showPayoutModal" preset="card" title="Bayar Komisi Mitra" class="max-w-lg" :auto-focus="false" :trap-focus="false">
      <div v-if="payoutPreview" class="space-y-4">

        <!-- Breakdown -->
        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Rincian Perhitungan</div>
          <div class="divide-y divide-slate-100">
            <div class="flex justify-between px-4 py-3">
              <span class="text-sm text-slate-600">Komisi Kotor ({{ payoutPreview.rentals.length }} rental)</span>
              <span class="font-bold text-slate-800">{{ formatRp(payoutPreview.grossCommission) }}</span>
            </div>
            <div v-if="payoutPreview.expenses.length" class="px-4 py-3">
              <div class="flex justify-between mb-2">
                <span class="text-sm text-red-600">Potongan Pengeluaran Motor</span>
                <span class="font-bold text-red-600">- {{ formatRp(payoutPreview.totalDeductions) }}</span>
              </div>
              <div class="space-y-1 pl-3 border-l-2 border-red-100">
                <div v-for="e in payoutPreview.expenses" :key="e.id" class="flex justify-between text-xs text-slate-500">
                  <span>{{ e.model }} · {{ e.category }}{{ e.description ? ' — ' + e.description : '' }}</span>
                  <span class="text-red-500 font-semibold">- {{ formatRp(e.amount) }}</span>
                </div>
              </div>
            </div>
            <div class="flex justify-between px-4 py-3 bg-emerald-50">
              <span class="text-sm font-bold text-emerald-700">Yang Dibayarkan (Bersih)</span>
              <span class="text-lg font-black text-emerald-700">{{ formatRp(payoutPreview.netAmount) }}</span>
            </div>
          </div>
        </div>

        <div v-if="payoutPreview.netAmount === 0" class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Komisi habis dipotong pengeluaran. Tidak ada yang perlu dibayarkan.
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Sumber Dana (Kas)</label>
          <select v-model="payoutForm.cash_account_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" :required="payoutPreview.netAmount > 0">
            <option value="">— Pilih Kas —</option>
            <option v-for="c in cashAccounts" :key="c.id" :value="c.id">
              {{ c.name }} (Saldo: {{ formatRp(c.balance) }})
            </option>
          </select>
        </div>

        <p v-if="payoutError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ payoutError }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showPayoutModal = false" class="btn-secondary">Batal</button>
          <button @click="submitPayout"
            :disabled="payoutPreview.netAmount > 0 && !payoutForm.cash_account_id"
            :class="['btn-primary flex items-center gap-2 px-5 font-bold', (payoutPreview.netAmount > 0 && !payoutForm.cash_account_id) ? 'opacity-50 cursor-not-allowed' : '']">
            <span class="material-symbols-outlined">payments</span>
            {{ payoutPreview.netAmount > 0 ? 'Bayar ' + formatRp(payoutPreview.netAmount) : 'Tandai Lunas (Rp 0)' }}
          </button>
        </div>
      </div>
      <div v-else class="py-8 text-center text-slate-400">Memuat preview...</div>
    </n-modal>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatRp, formatDate, today } from '../utils/format'

const route = useRoute()
const router = useRouter()

const ownerId = Number(route.params.id)
const owner = ref(null)
const motors = ref([])
const historyData = ref([])
const cashAccounts = ref([])
const payoutHistory = ref([])
const unpaidExpenses = ref([])
const payoutPreview = ref(null)
const openIdx = ref(-1)
const payoutError = ref('')
const payoutSuccessMsg = ref('')

const historyFilter = ref({ startDate: '', endDate: '' })
const showPayoutModal = ref(false)
const payoutForm = ref({ cash_account_id: '' })

const currentPage = ref(1)
const itemsPerPage = 10
const totalPages = computed(() => Math.ceil(historyData.value.length / itemsPerPage))
const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return historyData.value.slice(start, start + itemsPerPage)
})

const unpaidTotal = computed(() =>
  historyData.value.filter(h => !h.is_paid).reduce((sum, h) => sum + h.owner_gets, 0)
)

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
  await loadPayoutHistory()
}

async function loadHistory() {
  historyData.value = await window.api.getOwnerCommission({
    ownerId,
    startDate: historyFilter.value.startDate || null,
    endDate: historyFilter.value.endDate || null
  })
  currentPage.value = 1
}

async function loadPayoutHistory() {
  const raw = await window.api.getPayoutHistory({ ownerId })
  payoutHistory.value = raw.payouts || raw
  unpaidExpenses.value = raw.unpaidExpenses || []
}

async function openPayout() {
  payoutPreview.value = null
  payoutError.value = ''
  showPayoutModal.value = true
  payoutForm.value = { cash_account_id: '' }
  payoutPreview.value = await window.api.getPayoutPreview({ ownerId })
}

async function submitPayout() {
  try {
    const preview = payoutPreview.value
    await window.api.payoutOwner({
      owner_id: ownerId,
      owner_name: owner.value.name,
      net_amount: preview.netAmount,
      gross_amount: preview.grossCommission,
      deduction_amount: preview.totalDeductions,
      expense_ids: preview.expenses.map(e => e.id),
      cash_account_id: payoutForm.value.cash_account_id,
      date: today()
    })
    showPayoutModal.value = false
    payoutSuccessMsg.value = 'Pembayaran komisi berhasil dicatat!'
    setTimeout(() => { payoutSuccessMsg.value = '' }, 4000)
    await loadData()
  } catch (err) {
    payoutError.value = err.message.replace("Error invoking remote method 'owner:payout': Error: ", '')
  }
}

onMounted(() => loadData())
</script>
