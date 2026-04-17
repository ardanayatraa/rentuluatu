<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Mitra / Pemilik Motor</h2>
        <p class="text-slate-500 text-sm mt-1">Data mitra pemilik motor titipan</p>
      </div>
      <div class="flex gap-3">
        <button @click="openAdd" class="btn-primary">
          <span class="material-symbols-outlined">add</span>
          Tambah Mitra
        </button>
      </div>
    </div>

    <div class="mb-4 flex items-center justify-between gap-4 flex-wrap">
      <div class="relative">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama atau WhatsApp..."
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
            <th class="px-6 py-4">Nama</th>
            <th class="px-6 py-4">WhatsApp</th>
            <th class="px-6 py-4">Status</th>
            <th class="px-6 py-4 text-right">Hak Mitra Mengendap</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td colspan="5" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="o in pagedOwners" :key="o.id" class="hover:bg-slate-50 transition-colors text-sm">
            <td class="px-6 py-4 font-semibold text-primary">{{ o.name }}</td>
            <td class="px-6 py-4 text-slate-500">{{ o.phone || '-' }}</td>
            <td class="px-6 py-4">
              <span :class="o.is_active ? 'badge-success' : 'badge-neutral'">{{ o.is_active ? 'Aktif' : 'Nonaktif' }}</span>
            </td>
            <td class="px-6 py-4 text-right font-bold" :class="o.unpaid_commission > 0 ? 'text-orange-500' : 'text-slate-400'">
              {{ formatRp(o.unpaid_commission) }}
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click="openDetail(o.id)" class="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors" title="Lihat Detail Profil & Riwayat">
                  <span class="material-symbols-outlined text-base">visibility</span>
                </button>
                <button @click="openEdit(o)" class="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button @click="deleteOwner(o.id)" class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Hapus">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !filteredOwners.length">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">Belum ada data mitra</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="!loading && filteredOwners.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ filteredOwners.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <n-modal v-model:show="showModal" preset="card" :title="editId ? 'Edit Mitra' : 'Tambah Mitra'" class="max-w-md" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitOwner" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Nama</label>
          <input v-model="form.name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">WhatsApp</label>
          <input v-model="form.phone" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div v-if="editId" class="flex items-center gap-2">
          <input v-model="form.is_active" type="checkbox" id="is_active" class="rounded" />
          <label for="is_active" class="text-sm text-slate-600">Aktif</label>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary">Simpan</button>
        </div>
      </form>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatRp } from '../utils/format'

const router = useRouter()
const owners = ref([])
const loading = ref(false)
const showModal = ref(false)
const searchQuery = ref('')

const editId = ref(null)

const form = ref({ name: '', phone: '', is_active: 1 })
const currentPage = ref(1)
const pageSize = ref(10)
const filteredOwners = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return owners.value
  return owners.value.filter(owner => {
    const haystack = `${owner.name || ''} ${owner.phone || ''}`.toLowerCase()
    return haystack.includes(query)
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredOwners.value.length / pageSize.value)))
const pagedOwners = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredOwners.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => filteredOwners.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredOwners.value.length))

watch([searchQuery, pageSize], () => {
  currentPage.value = 1
})

function openAdd() {
  editId.value = null
  form.value = { name: '', phone: '', is_active: 1 }
  showModal.value = true
}

function openEdit(o) {
  editId.value = o.id
  form.value = { name: o.name, phone: o.phone, is_active: o.is_active }
  showModal.value = true
}

async function submitOwner() {
  if (editId.value) {
    await window.api.updateOwner({ id: editId.value, ...form.value })
  } else {
    await window.api.createOwner({ ...form.value })
  }
  showModal.value = false
  owners.value = await window.api.getOwners()
  currentPage.value = 1
}

function openDetail(id) {
  router.push('/owners/' + id)
}

async function deleteOwner(id) {
  if (!confirm('Yakin ingin menghapus mitra ini?\n\nJika mitra memiliki motor atau riwayat transaksi, data akan dinonaktifkan (tidak dihapus permanen).')) return
  const result = await window.api.deleteOwner(id)
  if (result.softDeleted) {
    alert('Mitra dinonaktifkan karena memiliki data terkait (motor/transaksi).')
  }
  owners.value = await window.api.getOwners()
  currentPage.value = 1
}

onMounted(async () => {
  loading.value = true
  try {
    owners.value = await window.api.getOwners()
    currentPage.value = 1
  } finally {
    loading.value = false
  }
})
</script>
