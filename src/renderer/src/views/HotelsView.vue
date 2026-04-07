<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Hotel / Vendor Hotel</h2>
        <p class="text-slate-500 text-sm mt-1">Kelola data hotel dan rekanan penyalur reservasi</p>
      </div>
      <div class="flex gap-3">
        <button @click="openAdd" class="btn-primary">
          <span class="material-symbols-outlined">add</span>
          Tambah Hotel
        </button>
      </div>
    </div>

    <div class="mb-4 flex items-center justify-between gap-4 flex-wrap">
      <div class="relative">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama hotel atau kontak..."
          class="w-80 max-w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
        />
      </div>
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
            <th class="px-6 py-4">Nama Hotel / Vendor Hotel</th>
            <th class="px-6 py-4">Kontak / Telepon</th>
            <th class="px-6 py-4">Info Rekening</th>
            <th class="px-6 py-4 text-right">Komisi Belum Dibayar</th>
            <th class="px-6 py-4 text-right">Status</th>
            <th class="px-6 py-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td colspan="6" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="h in pagedHotels" :key="h.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="font-bold cursor-pointer hover:text-primary transition-colors" @click="goToDetail(h.id)">
                {{ h.name }}
              </div>
            </td>
            <td class="px-6 py-4 text-slate-500 text-sm">{{ h.phone || '-' }}</td>
            <td class="px-6 py-4">
              <div v-if="h.bank_account || h.bank_name">
                <span class="font-medium text-sm block">{{ h.bank_account }}</span>
                <span class="text-xs text-slate-400">{{ h.bank_name }}</span>
              </div>
              <span v-else class="text-slate-400">-</span>
            </td>
            <td class="px-6 py-4 text-right">
              <span v-if="h.unpaid_commission > 0" class="font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full text-sm">
                {{ formatRp(h.unpaid_commission) }}
              </span>
              <span v-else class="text-slate-400">-</span>
            </td>
            <td class="px-6 py-4 text-right">
              <span :class="h.is_active ? 'badge-success' : 'badge-error'">
                {{ h.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex justify-end gap-2">
                <button @click="goToDetail(h.id)" class="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-colors" title="Detail Komisi Hotel">
                  <span class="material-symbols-outlined text-base">monetization_on</span>
                </button>
                <button @click="openEdit(h)" class="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 transition-colors">
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button v-if="h.is_active" @click="confirmDelete(h.id)" class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !filteredHotels.length">
            <td colspan="6" class="px-6 py-12 text-center text-slate-400">Belum ada data hotel / vendor hotel</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="!loading && filteredHotels.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ filteredHotels.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="isEdit ? 'Edit Hotel / Vendor Hotel' : 'Tambah Hotel / Vendor Hotel'" style="max-width: 500px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Nama Hotel / Vendor Hotel</label>
          <input v-model="form.name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">No. Telepon / WhatsApp</label>
          <input v-model="form.phone" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Nama Bank</label>
            <input v-model="form.bank_name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="BCA / Mandiri" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">No. Rekening</label>
            <input v-model="form.bank_account" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div v-if="isEdit" class="flex items-center gap-2 mt-4">
          <input type="checkbox" v-model="form.is_active" :true-value="1" :false-value="0" id="is_active" class="accent-primary" />
          <label for="is_active" class="text-sm font-medium cursor-pointer">Hotel / Vendor Hotel Aktif</label>
        </div>
        <div class="flex justify-end gap-3 pt-4">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary">Simpan</button>
        </div>
        <p v-if="formError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ formError }}</p>
      </form>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatRp } from '../utils/format'

const router = useRouter()
const hotels = ref([])
const loading = ref(false)
const searchQuery = ref('')

const showModal = ref(false)
const isEdit = ref(false)
const form = ref({ id: null, name: '', phone: '', bank_account: '', bank_name: '', is_active: 1 })
const formError = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const filteredHotels = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return hotels.value
  return hotels.value.filter(hotel => {
    const haystack = `${hotel.name || ''} ${hotel.phone || ''} ${hotel.bank_name || ''} ${hotel.bank_account || ''}`.toLowerCase()
    return haystack.includes(query)
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredHotels.value.length / pageSize.value)))
const pagedHotels = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredHotels.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => filteredHotels.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredHotels.value.length))

watch([searchQuery, pageSize], () => {
  currentPage.value = 1
})

async function loadData() {
  loading.value = true
  try {
    hotels.value = await window.api.getHotels()
    currentPage.value = 1
  } finally {
    loading.value = false
  }
}

function goToDetail(id) {
  router.push(`/hotels/${id}`)
}

function openAdd() {
  isEdit.value = false
  form.value = { id: null, name: '', phone: '', bank_account: '', bank_name: '', is_active: 1 }
  formError.value = ''
  showModal.value = true
}

function openEdit(item) {
  isEdit.value = true
  form.value = { ...item }
  formError.value = ''
  showModal.value = true
}

async function submitForm() {
  formError.value = ''
  try {
    if (isEdit.value) {
      await window.api.updateHotel({ ...form.value })
    } else {
      await window.api.createHotel({ ...form.value })
    }
    showModal.value = false
    await loadData()
  } catch (err) {
    formError.value = err.message
      .replace("Error invoking remote method 'hotel:create': Error: ", '')
      .replace("Error invoking remote method 'hotel:update': Error: ", '')
  }
}

async function confirmDelete(id) {
  if (confirm('Yakin ingin menonaktifkan hotel / vendor hotel ini?')) {
    await window.api.deleteHotel(id)
    await loadData()
  }
}

onMounted(() => {
  loadData()
})
</script>
