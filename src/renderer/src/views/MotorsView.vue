<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Manajemen Motor</h2>
        <p class="text-slate-500 text-sm mt-1">Data armada motor rental</p>
      </div>
      <div class="flex gap-3">
        <button @click="exportPdf" :disabled="exporting !== ''" class="btn-secondary disabled:opacity-60">
          <span class="material-symbols-outlined">print</span>
          {{ exporting === 'pdf' ? 'Memuat...' : 'Cetak' }}
        </button>
        <button @click="exportExcel" :disabled="exporting !== ''" class="btn-secondary disabled:opacity-60">
          <span class="material-symbols-outlined">table_view</span>
          {{ exporting === 'excel' ? 'Menyimpan...' : 'Simpan Excel' }}
        </button>
        <button @click="openAdd" class="btn-primary">
          <span class="material-symbols-outlined">add</span>
          Tambah Motor
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="card mb-6 flex gap-4 items-center">
      <input v-model="search" type="text" placeholder="Cari model atau plat..."
        class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64" />
      <select v-model="filterType" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Semua Tipe</option>
        <option value="aset_pt">Aset PT</option>
        <option value="milik_pemilik">Milik Mitra</option>
      </select>
      <select v-model.number="pageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option :value="10">10 / halaman</option>
        <option :value="25">25 / halaman</option>
        <option :value="50">50 / halaman</option>
      </select>
      <span class="ml-auto text-sm text-slate-500">{{ filteredMotors.length }} motor</span>
    </div>

    <!-- Table -->
    <div class="card table-card">
      <div class="table-scroll">
      <table class="table-base text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Model</th>
            <th class="px-6 py-4">Plat Nomor</th>
            <th class="px-6 py-4">Tipe</th>
            <th class="px-6 py-4">Porsi Wavy</th>
            <th class="px-6 py-4">Pemilik</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td colspan="6" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="m in pagedMotors" :key="m.id" class="hover:bg-slate-50 transition-colors text-sm">
            <td class="px-6 py-4 font-semibold text-primary">{{ m.model }}</td>
            <td class="px-6 py-4 text-slate-500 font-mono">{{ m.plate_number }}</td>
            <td class="px-6 py-4">
              <span :class="isAsetPt(m.type) ? 'badge-neutral' : 'badge-warning'">{{ getMotorTypeLabel(m.type) }}</span>
            </td>
            <td class="px-6 py-4 font-medium">{{ getWavyPctLabel(m.type) }}</td>
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
          <tr v-if="!loading && !filteredMotors.length">
            <td colspan="6" class="px-6 py-12 text-center text-slate-400">Belum ada data motor</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="!loading && filteredMotors.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ filteredMotors.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
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
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Tipe</label>
            <select v-model="form.type" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
              <option value="aset_pt">Aset PT (Wavy 20% / Mitra 80%)</option>
              <option value="milik_pemilik">Milik Mitra (Wavy 30% / Mitra 70%)</option>
            </select>
          </div>
          <div class="col-span-2">
            <div class="flex justify-between items-end mb-1">
              <label class="block text-xs font-bold text-slate-500">Mitra / Pemilik</label>
              <button type="button" @click="isCreatingOwner = !isCreatingOwner"
                class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">{{ isCreatingOwner ? 'person_search' : 'person_add' }}</span>
                {{ isCreatingOwner ? 'Pilih Mitra Ada' : '+ Mitra Baru' }}
              </button>
            </div>

            <!-- Pilih mitra dengan search -->
            <div v-if="!isCreatingOwner">
              <div v-if="ownersLoading" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 bg-slate-50">
                Loading data mitra...
              </div>
              <SearchSelect
                v-else
                v-model="form.owner_id"
                :options="ownerOptions"
                placeholder="Pilih Mitra / Pemilik..."
              />
              <p v-if="form.owner_id" class="text-xs text-slate-400 mt-1">
                {{ owners.find(o => o.id == form.owner_id)?.phone || '' }}
              </p>
            </div>

            <!-- Form mitra baru -->
            <div v-else class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1">
              <div class="col-span-2">
                <input v-model="ownerForm.name" type="text" placeholder="Nama Mitra *"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <input v-model="ownerForm.phone" type="text" placeholder="No. HP / WA"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <p v-if="motorError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ motorError }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" :disabled="ownersLoading || isSubmitting" class="btn-primary disabled:opacity-50">
            {{ isSubmitting ? 'Loading...' : 'Simpan' }}
          </button>
        </div>
      </form>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import SearchSelect from '../components/SearchSelect.vue'
import { getMotorTypeLabel, getWavyPctLabel, isAsetPt, normalizeMotorType } from '../utils/motorType'
import { buildSimpleTableHtml, previewReport } from '../utils/pdf'
import { saveMotorsExcel } from '../utils/excel'

const motors = ref([])
const loading = ref(false)
const ownersLoading = ref(false)
const isSubmitting = ref(false)
const owners = ref([])
const showModal = ref(false)
const editId = ref(null)
const search = ref('')
const filterType = ref('')
const form = ref({ model: '', plate_number: '', type: 'aset_pt', owner_id: '' })
const currentPage = ref(1)
const pageSize = ref(10)
const exporting = ref('')

const isCreatingOwner = ref(false)
const ownerForm = ref({ name: '', phone: '' })

const ownerOptions = computed(() => owners.value.map(o => ({ value: o.id, label: o.name, sub: o.phone || '' })))

const motorError = ref('')

const filteredMotors = computed(() => motors.value.filter(m => {
  if (filterType.value && normalizeMotorType(m.type) !== normalizeMotorType(filterType.value)) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    return m.model.toLowerCase().includes(q) || m.plate_number.toLowerCase().includes(q)
  }
  return true
}))
const totalPages = computed(() => Math.max(1, Math.ceil(filteredMotors.value.length / pageSize.value)))
const pagedMotors = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredMotors.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => filteredMotors.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredMotors.value.length))

function toFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
}

function todayValue() {
  return new Date().toISOString().split('T')[0]
}

function getExportFileLabel() {
  const typeLabel = filterType.value ? toFileNamePart(getMotorTypeLabel(filterType.value)) : 'Semua_Tipe'
  return `${todayValue()}_${typeLabel}`
}

async function withExporting(kind, work) {
  exporting.value = kind

  // Fail-safe: jika preview PDF hang (IPC/printing), jangan sampai tombol terkunci selamanya.
  let warned = false
  const timer = setTimeout(() => {
    if (exporting.value !== '') {
      exporting.value = ''
      warned = true
      alert('Proses cetak lebih lama dari biasanya. Jika jendela preview tidak muncul, silakan klik Cetak lagi.')
    }
  }, 15000)

  try {
    return await work()
  } finally {
    clearTimeout(timer)
    if (!warned) exporting.value = ''
  }
}

async function exportPdf() {
  return withExporting('pdf', async () => {
    const rows = filteredMotors.value.map((m) => ({
      model: m.model,
      plate: m.plate_number,
      type: getMotorTypeLabel(m.type),
      wavy: getWavyPctLabel(m.type),
      owner: m.owner_name || '-'
    }))
    const html = buildSimpleTableHtml({
      title: 'Daftar Motor',
      subtitle: `Filter: ${filterType.value ? getMotorTypeLabel(filterType.value) : 'Semua Tipe'}`,
      period: `Per ${todayValue()}`,
      summary: [
        { label: 'Total Motor', value: `${filteredMotors.value.length} unit` }
      ],
      columns: [
        { key: 'model', label: 'Model' },
        { key: 'plate', label: 'Plat Nomor' },
        { key: 'type', label: 'Tipe' },
        { key: 'wavy', label: 'Porsi Wavy' },
        { key: 'owner', label: 'Pemilik' }
      ],
      rows,
      emptyMessage: 'Belum ada data motor pada filter ini'
    })
    await previewReport(html, `Daftar_Motor_${getExportFileLabel()}.pdf`)
  })
}

async function exportExcel() {
  return withExporting('excel', async () => {
    await saveMotorsExcel({
      motors: filteredMotors.value.map((m) => ({
        model: m.model,
        plate_number: m.plate_number,
        type: m.type,
        type_label: getMotorTypeLabel(m.type),
        wavy_share: getWavyPctLabel(m.type),
        owner_name: m.owner_name || '-'
      })),
      fileLabel: getExportFileLabel()
    })
  })
}

function openAdd() {
  editId.value = null
  form.value = { model: '', plate_number: '', type: 'aset_pt', owner_id: '' }
  isCreatingOwner.value = false
  ownerForm.value = { name: '', phone: '' }
  motorError.value = ''
  showModal.value = true
}

function openEdit(m) {
  editId.value = m.id
  form.value = { model: m.model, plate_number: m.plate_number, type: normalizeMotorType(m.type), owner_id: m.owner_id || '' }
  isCreatingOwner.value = false
  ownerForm.value = { name: '', phone: '' }
  motorError.value = ''
  showModal.value = true
}

async function submitMotor() {
  motorError.value = ''
  if (ownersLoading.value) {
    motorError.value = 'Data mitra masih loading, tunggu sebentar.'
    return
  }
  isSubmitting.value = true

  // Validasi: jika mode buat mitra baru, nama wajib diisi
  if (isCreatingOwner.value && !ownerForm.value.name.trim()) {
    motorError.value = 'Nama mitra tidak boleh kosong'
    isSubmitting.value = false
    return
  }

  if (!isCreatingOwner.value && !form.value.owner_id) {
    motorError.value = 'Pemilik motor wajib dipilih'
    isSubmitting.value = false
    return
  }

  let finalOwnerId = form.value.owner_id || null

  // Buat owner baru dulu, lalu assign ID-nya ke motor
  if (isCreatingOwner.value && ownerForm.value.name.trim()) {
    try {
      const newOwner = await window.api.createOwner({ ...ownerForm.value })
      finalOwnerId = Number(newOwner.id)
      owners.value = await window.api.getOwners({ activeOnly: true })
    } catch (err) {
      motorError.value = 'Gagal membuat mitra: ' + err.message
      isSubmitting.value = false
      return
    }
  }

  const payload = {
    ...form.value,
    type: normalizeMotorType(form.value.type),
    owner_id: finalOwnerId ? Number(finalOwnerId) : null
  }

  try {
    if (editId.value) {
      await window.api.updateMotor({ id: editId.value, ...payload })
    } else {
      await window.api.createMotor(payload)
    }
    showModal.value = false
    motors.value = await window.api.getMotors()
    currentPage.value = 1
  } catch (err) {
    motorError.value = err.message.replace("Error invoking remote method 'motor:create': Error: ", '')
      .replace("Error invoking remote method 'motor:update': Error: ", '')
  } finally {
    isSubmitting.value = false
  }
}

async function deleteMotor(id) {
  if (!confirm('Yakin ingin menghapus motor ini?')) return
  try {
    await window.api.deleteMotor(id)
    motors.value = await window.api.getMotors()
    currentPage.value = 1
  } catch (err) {
    alert(err.message.replace("Error invoking remote method 'motor:delete': Error: ", ''))
  }
}

onMounted(async () => {
  loading.value = true
  ownersLoading.value = true
  try {
    motors.value = await window.api.getMotors()
    owners.value = await window.api.getOwners({ activeOnly: true })
    currentPage.value = 1
  } finally {
    loading.value = false
    ownersLoading.value = false
  }
})
</script>
