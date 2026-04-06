<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Hotel / Vendor</h2>
        <p class="text-slate-500 text-sm mt-1">Kelola data hotel dan rekanan agen penyalur</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-symbols-outlined">add</span>
        Tambah Vendor
      </button>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden p-0">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Nama Vendor</th>
            <th class="px-6 py-4">Kontak / Telepon</th>
            <th class="px-6 py-4">Info Rekening</th>
            <th class="px-6 py-4 text-right">Komisi Belum Dibayar</th>
            <th class="px-6 py-4 text-right">Status</th>
            <th class="px-6 py-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="h in hotels" :key="h.id" class="hover:bg-slate-50 transition-colors">
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
                <button @click="openEdit(h)" class="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 transition-colors">
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button v-if="h.is_active" @click="confirmDelete(h.id)" class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!hotels.length">
            <td colspan="6" class="px-6 py-12 text-center text-slate-400">Belum ada data vendor</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="isEdit ? 'Edit Vendor' : 'Tambah Vendor'" style="max-width: 500px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitForm" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Nama Vendor / Hotel</label>
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
          <label for="is_active" class="text-sm font-medium cursor-pointer">Vendor Aktif</label>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatRp } from '../utils/format'

const router = useRouter()
const hotels = ref([])

const showModal = ref(false)
const isEdit = ref(false)
const form = ref({ id: null, name: '', phone: '', bank_account: '', bank_name: '', is_active: 1 })
const formError = ref('')

async function loadData() {
  hotels.value = await window.api.getHotels()
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
  if (confirm('Yakin ingin menonaktifkan vendor ini?')) {
    await window.api.deleteHotel(id)
    await loadData()
  }
}

onMounted(() => {
  loadData()
})
</script>
