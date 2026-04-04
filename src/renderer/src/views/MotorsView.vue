<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Manajemen Motor</h2>
        <p class="text-slate-500 text-sm mt-1">Data armada motor rental</p>
      </div>
      <button @click="openAdd" class="btn-primary">
        <span class="material-symbols-outlined">add</span>
        Tambah Motor
      </button>
    </div>

    <!-- Filter -->
    <div class="card mb-6 flex gap-4 items-center">
      <input v-model="search" type="text" placeholder="Cari model atau plat..."
        class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64" />
      <select v-model="filterType" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Semua Tipe</option>
        <option value="pribadi">Pribadi</option>
        <option value="titipan">Titipan</option>
      </select>
      <span class="ml-auto text-sm text-slate-500">{{ filteredMotors.length }} motor</span>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden p-0">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Model</th>
            <th class="px-6 py-4">Plat Nomor</th>
            <th class="px-6 py-4">Tipe</th>
            <th class="px-6 py-4">Komisi Wavy</th>
            <th class="px-6 py-4">Pemilik</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="m in filteredMotors" :key="m.id" class="hover:bg-slate-50 transition-colors text-sm">
            <td class="px-6 py-4 font-semibold text-primary">{{ m.model }}</td>
            <td class="px-6 py-4 text-slate-500 font-mono">{{ m.plate_number }}</td>
            <td class="px-6 py-4">
              <span :class="m.type === 'pribadi' ? 'badge-neutral' : 'badge-warning'">{{ m.type }}</span>
            </td>
            <td class="px-6 py-4 font-medium">{{ m.type === 'pribadi' ? '20%' : '30%' }}</td>
            <td class="px-6 py-4 text-slate-500">{{ m.owner_name || '-' }}</td>
            <td class="px-6 py-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click="openEdit(m)" class="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button @click="deleteMotor(m.id)" class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Hapus">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredMotors.length">
            <td colspan="6" class="px-6 py-12 text-center text-slate-400">Belum ada data motor</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="editId ? 'Edit Motor' : 'Tambah Motor'" style="max-width: 480px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitMotor" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Model</label>
            <input v-model="form.model" type="text" placeholder="Honda Beat"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Plat Nomor</label>
            <input v-model="form.plate_number" type="text" placeholder="DK 1234 AB"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tipe</label>
            <select v-model="form.type" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
              <option value="pribadi">Pribadi (Wavy 20% / Owner 80%)</option>
              <option value="titipan">Titipan (Wavy 30% / Owner 70%)</option>
            </select>
          </div>
          <div class="col-span-2">
            <div class="flex justify-between items-end mb-1">
              <label class="block text-xs font-bold text-slate-500">Pemilik</label>
              <button type="button" @click="isCreatingOwner = !isCreatingOwner" class="text-xs text-primary font-bold hover:underline">
                {{ isCreatingOwner ? 'Pilih Pemilik Sedia Ada' : '+ Pemilik Baru' }}
              </button>
            </div>
            
            <!-- Jika pilih pemilik lama -->
            <select v-if="!isCreatingOwner" v-model="form.owner_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— Tidak ada —</option>
              <option v-for="o in owners" :key="o.id" :value="o.id">{{ o.name }}</option>
            </select>
            
            <!-- Jika tambah pemilik baru -->
            <div v-else class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div class="col-span-2">
                <input v-model="ownerForm.name" type="text" placeholder="Nama Pemilik Baru" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <input v-model="ownerForm.phone" type="text" placeholder="Nomor HP / WA" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input v-model="ownerForm.bank_name" type="text" placeholder="Bank (misal: BCA)" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <div class="col-span-2">
                <input v-model="ownerForm.bank_account" type="text" placeholder="No. Rekening" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
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
import { ref, computed, onMounted } from 'vue'

const motors = ref([])
const owners = ref([])
const showModal = ref(false)
const editId = ref(null)
const search = ref('')
const filterType = ref('')
const form = ref({ model: '', plate_number: '', type: 'pribadi', owner_id: '' })

// Inline Owner Creation
const isCreatingOwner = ref(false)
const ownerForm = ref({ name: '', phone: '', bank_name: '', bank_account: '' })

const filteredMotors = computed(() => motors.value.filter(m => {
  if (filterType.value && m.type !== filterType.value) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    return m.model.toLowerCase().includes(q) || m.plate_number.toLowerCase().includes(q)
  }
  return true
}))

function openAdd() {
  editId.value = null
  form.value = { model: '', plate_number: '', type: 'pribadi', owner_id: '' }
  isCreatingOwner.value = false
  ownerForm.value = { name: '', phone: '', bank_name: '', bank_account: '' }
  showModal.value = true
}

function openEdit(m) {
  editId.value = m.id
  form.value = { model: m.model, plate_number: m.plate_number, type: m.type, owner_id: m.owner_id || '' }
  isCreatingOwner.value = false
  ownerForm.value = { name: '', phone: '', bank_name: '', bank_account: '' }
  showModal.value = true
}

async function submitMotor() {
  let finalOwnerId = form.value.owner_id

  // Jika bikin owner baru, save owner dulu
  if (isCreatingOwner.value && ownerForm.value.name) {
    const newOwner = await window.api.createOwner({ ...ownerForm.value })
    finalOwnerId = newOwner.id
    // Update data master
    owners.value = await window.api.getOwners()
  }

  const payload = { ...form.value, owner_id: finalOwnerId }

  if (editId.value) {
    await window.api.updateMotor({ id: editId.value, ...payload })
  } else {
    await window.api.createMotor(payload)
  }
  
  showModal.value = false
  motors.value = await window.api.getMotors()
}

async function deleteMotor(id) {
  await window.api.deleteMotor(id)
  motors.value = await window.api.getMotors()
}

onMounted(async () => {
  motors.value = await window.api.getMotors()
  owners.value = await window.api.getOwners()
})
</script>
