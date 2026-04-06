<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Mitra</h2>
        <p class="text-slate-500 text-sm mt-1">Data mitra / pemilik motor titipan</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-symbols-outlined">add</span>
        Tambah Pemilik
      </button>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden p-0">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Nama</th>
            <th class="px-6 py-4">WhatsApp</th>
            <th class="px-6 py-4">Bank</th>
            <th class="px-6 py-4">No. Rekening</th>
            <th class="px-6 py-4">Status</th>
            <th class="px-6 py-4 text-right">Komisi Mengendap</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="o in owners" :key="o.id" class="hover:bg-slate-50 transition-colors text-sm">
            <td class="px-6 py-4 font-semibold text-primary">{{ o.name }}</td>
            <td class="px-6 py-4 text-slate-500">{{ o.phone || '-' }}</td>
            <td class="px-6 py-4 text-slate-500">{{ o.bank_name || '-' }}</td>
            <td class="px-6 py-4 text-slate-500 font-mono">{{ o.bank_account || '-' }}</td>
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
          <tr v-if="!owners.length">
            <td colspan="7" class="px-6 py-12 text-center text-slate-400">Belum ada data pemilik</td>
          </tr>
        </tbody>
      </table>
    </div>

    <n-modal v-model:show="showModal" preset="card" :title="editId ? 'Edit Pemilik' : 'Tambah Pemilik'" class="max-w-md" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitOwner" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Nama</label>
          <input v-model="form.name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">WhatsApp</label>
          <input v-model="form.phone" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Nama Bank</label>
            <input v-model="form.bank_name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">No. Rekening</label>
            <input v-model="form.bank_account" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { formatRp } from '../utils/format'

const router = useRouter()
const owners = ref([])
const showModal = ref(false)

const editId = ref(null)

const form = ref({ name: '', phone: '', bank_name: '', bank_account: '', is_active: 1 })

function openAdd() {
  editId.value = null
  form.value = { name: '', phone: '', bank_name: '', bank_account: '', is_active: 1 }
  showModal.value = true
}

function openEdit(o) {
  editId.value = o.id
  form.value = { name: o.name, phone: o.phone, bank_name: o.bank_name, bank_account: o.bank_account, is_active: o.is_active }
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
}

function openDetail(id) {
  router.push('/owners/' + id)
}

async function deleteOwner(id) {
  if (!confirm('Yakin ingin menghapus pemilik ini?\n\nJika pemilik memiliki motor atau riwayat transaksi, data akan dinonaktifkan (tidak dihapus permanen).')) return
  const result = await window.api.deleteOwner(id)
  if (result.softDeleted) {
    alert('Pemilik dinonaktifkan karena memiliki data terkait (motor/transaksi).')
  }
  owners.value = await window.api.getOwners()
}

onMounted(async () => {
  owners.value = await window.api.getOwners()
})
</script>
