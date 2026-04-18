<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 class="page-title">Unduhan Laporan</h2>
        <p class="text-slate-500 text-sm mt-1">Buka kembali file laporan yang sudah pernah disimpan</p>
      </div>
      <div class="flex gap-3">
        <button @click="loadDownloads" class="btn-secondary" :disabled="loading">
          <span class="material-symbols-outlined">refresh</span>
          {{ loading ? 'Memuat...' : 'Muat Ulang' }}
        </button>
      </div>
    </div>

    <div class="card mb-6 px-5 py-4">
      <div class="flex items-center justify-between gap-4 flex-wrap text-sm">
        <div class="flex items-center gap-5 flex-wrap">
          <div>
            <span class="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-bold">Total</span>
            <p class="text-lg font-black text-slate-800">{{ downloads.length }}</p>
          </div>
          <div>
            <span class="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-bold">Tersedia</span>
            <p class="text-lg font-black text-emerald-600">{{ availableCount }}</p>
          </div>
          <div>
            <span class="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-bold">Hilang</span>
            <p class="text-lg font-black text-amber-600">{{ missingCount }}</p>
          </div>
          <div>
            <span class="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-bold">Ukuran</span>
            <p class="text-lg font-black text-slate-700">{{ formatBytes(totalSize) }}</p>
          </div>
        </div>
        <p class="text-xs text-slate-500">Riwayat file laporan yang pernah disimpan</p>
      </div>
    </div>

    <div v-if="notice" :class="['card mb-4 border', notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700']">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined">{{ notice.type === 'error' ? 'error' : 'check_circle' }}</span>
        <p class="text-sm font-medium">{{ notice.message }}</p>
      </div>
    </div>

    <div v-if="loading" class="card py-12 text-center text-slate-400">
      <span class="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
    </div>

    <div v-else-if="!downloads.length" class="card py-12 text-center text-slate-400">
      <span class="material-symbols-outlined text-5xl mb-3 block">folder_open</span>
      Belum ada file laporan yang pernah diunduh
    </div>

    <div v-else class="space-y-4">
      <div class="card p-0 overflow-hidden border border-slate-200">
        <div class="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined">folder_managed</span>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black text-slate-800">Folder Unduhan Laporan</p>
                <p class="text-xs text-slate-500 truncate">{{ folderHint }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Cari nama file atau jenis laporan"
                  class="w-72 max-w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm bg-white"
                />
              </div>
              <select v-model="typeFilter" class="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">Semua Jenis</option>
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel</option>
              </select>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[minmax(0,1.8fr)_120px_120px_180px_110px] gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 border-b border-slate-200 bg-white">
          <div>Nama File</div>
          <div>Jenis</div>
          <div>Ukuran</div>
          <div>Diunduh</div>
          <div>Status</div>
        </div>

        <div v-if="!filteredDownloads.length" class="px-6 py-14 text-center text-slate-400 bg-white">
          <span class="material-symbols-outlined text-4xl mb-2 block">search_off</span>
          Tidak ada file yang cocok dengan pencarian
        </div>

        <div v-else class="bg-white">
          <div
            v-for="item in paginatedDownloads"
            :key="item.id"
            class="px-5 py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
          >
            <div class="grid grid-cols-[minmax(0,1.8fr)_120px_120px_180px_110px] gap-4 items-center">
              <div class="min-w-0">
                <div class="flex items-center gap-3 min-w-0">
                  <div :class="['w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', item.file_type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600']">
                    <span class="material-symbols-outlined">{{ item.file_type === 'pdf' ? 'picture_as_pdf' : 'table_view' }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold text-slate-800 truncate">{{ item.file_name }}</p>
                    <p class="text-xs text-slate-500 truncate">{{ item.report_name || 'Laporan' }}</p>
                    <p class="text-[11px] text-slate-400 truncate mt-0.5">{{ item.file_path }}</p>
                  </div>
                </div>
              </div>

              <div>
                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                  :class="item.file_type === 'pdf' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'">
                  {{ item.file_type.toUpperCase() }}
                </span>
              </div>

              <div class="text-sm font-semibold text-slate-700">{{ formatBytes(item.file_size) }}</div>
              <div class="text-sm text-slate-600">{{ formatDateTime(item.created_at) }}</div>
              <div>
                <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider', item.exists ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700']">
                  {{ item.exists ? 'Tersedia' : 'Hilang' }}
                </span>
              </div>
            </div>

            <div class="mt-3 flex items-center gap-2 flex-wrap">
              <button
                @click="openDownload(item)"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-all hover:scale-[1.03] hover:bg-primary/90 disabled:opacity-50 disabled:hover:scale-100"
                :disabled="actionId === item.id || !item.exists"
                title="Buka"
              >
                <span class="material-symbols-outlined text-[18px]">{{ actionId === item.id && actionName === 'open' ? 'progress_activity' : 'open_in_new' }}</span>
              </button>
              <button
                @click="showInFolder(item)"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all hover:scale-[1.03] hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 disabled:hover:scale-100"
                :disabled="actionId === item.id || !item.exists"
                title="Folder"
              >
                <span class="material-symbols-outlined text-[18px]">folder_open</span>
              </button>
              <button
                @click="deleteFile(item)"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition-all hover:scale-[1.03] hover:bg-red-100 hover:text-red-700 disabled:opacity-50 disabled:hover:scale-100"
                :disabled="actionId === item.id || !item.exists"
                title="Hapus File"
              >
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
              <button
                @click="deleteRecord(item)"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 transition-all hover:scale-[1.03] hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50 disabled:hover:scale-100"
                :disabled="actionId === item.id"
                title="Hapus Riwayat"
              >
                <span class="material-symbols-outlined text-[18px]">history_toggle_off</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="filteredDownloads.length" class="bg-slate-50 border-t border-slate-200">
          <TablePagination
            v-model:page="currentPage"
            v-model:pageSize="itemsPerPage"
            :total="filteredDownloads.length"
            :pageSizeOptions="[10,20,30]"
          />
        </div>
      </div>
    </div>

    <!-- Modal Konfirmasi Hapus -->
    <n-modal v-model:show="showDeleteConfirm" preset="card" title="Konfirmasi Hapus" style="max-width: 460px" :auto-focus="false" :trap-focus="false">
      <p class="text-sm text-slate-600">
        {{ deleteAction === 'file' 
          ? `Hapus file dan riwayat untuk "${pendingDeleteItem?.file_name}"?` 
          : `Hapus riwayat unduhan untuk "${pendingDeleteItem?.file_name}"?` 
        }}
      </p>
      <div class="flex justify-end gap-3 pt-5">
        <button type="button" class="btn-secondary" @click="showDeleteConfirm = false">Batal</button>
        <button type="button" class="btn-primary bg-red-600 hover:bg-red-700 border-red-600" @click="confirmDelete">Hapus</button>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import TablePagination from '../components/TablePagination.vue'

const downloads = ref([])
const loading = ref(false)
const actionId = ref(null)
const actionName = ref('')
const notice = ref(null)
const searchQuery = ref('')
const typeFilter = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)
const showDeleteConfirm = ref(false)
const pendingDeleteItem = ref(null)
const deleteAction = ref('')

const availableCount = computed(() => downloads.value.filter(item => item.exists).length)
const missingCount = computed(() => downloads.value.filter(item => !item.exists).length)
const totalSize = computed(() => downloads.value.reduce((sum, item) => sum + Number(item.file_size || 0), 0))
const folderHint = computed(() => {
  const first = downloads.value[0]?.file_path || ''
  if (!first) return 'Riwayat file yang sudah pernah disimpan'
  return first.replace(/\\[^\\]+$/, '')
})
const filteredDownloads = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return downloads.value.filter(item => {
    const matchesType = !typeFilter.value || item.file_type === typeFilter.value
    const haystack = `${item.file_name || ''} ${item.report_name || ''} ${item.file_path || ''}`.toLowerCase()
    const matchesQuery = !query || haystack.includes(query)
    return matchesType && matchesQuery
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredDownloads.value.length / itemsPerPage.value)))
const paginatedDownloads = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredDownloads.value.slice(start, start + itemsPerPage.value)
})
const pageStart = computed(() => filteredDownloads.value.length ? ((currentPage.value - 1) * itemsPerPage.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * itemsPerPage.value, filteredDownloads.value.length))

function setNotice(type, message) {
  notice.value = { type, message }
}

function clearNotice() {
  notice.value = null
}

function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function loadDownloads({ preserveNotice = false } = {}) {
  loading.value = true
  if (!preserveNotice) clearNotice()
  try {
    downloads.value = await window.api.getDownloads()
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
  } catch (error) {
    console.error('DownloadsView load error:', error)
    setNotice('error', error?.message || 'Riwayat unduhan gagal dimuat.')
  } finally {
    loading.value = false
  }
}

async function runAction(name, id, fn, successMessage) {
  actionId.value = id
  actionName.value = name
  clearNotice()
  try {
    await fn()
    if (successMessage) setNotice('success', successMessage)
    await loadDownloads({ preserveNotice: true })
  } catch (error) {
    console.error(`DownloadsView ${name} error:`, error)
    setNotice('error', error?.message || 'Aksi gagal dijalankan.')
  } finally {
    actionId.value = null
    actionName.value = ''
  }
}

async function openDownload(item) {
  await runAction('open', item.id, () => window.api.openDownload(item.id), `File "${item.file_name}" dibuka.`)
}

async function showInFolder(item) {
  await runAction('show', item.id, () => window.api.showDownloadInFolder(item.id), `Folder file "${item.file_name}" ditampilkan.`)
}

async function deleteRecord(item) {
  pendingDeleteItem.value = item
  deleteAction.value = 'record'
  showDeleteConfirm.value = true
}

async function deleteFile(item) {
  pendingDeleteItem.value = item
  deleteAction.value = 'file'
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!pendingDeleteItem.value) return
  const item = pendingDeleteItem.value
  const action = deleteAction.value
  
  if (action === 'record') {
    await runAction('delete-record', item.id, () => window.api.deleteDownloadRecord(item.id), 'Riwayat unduhan dihapus.')
  } else if (action === 'file') {
    await runAction('delete-file', item.id, () => window.api.deleteDownloadFile(item.id), 'File dan riwayat unduhan dihapus.')
  }
  
  showDeleteConfirm.value = false
  pendingDeleteItem.value = null
  deleteAction.value = ''
}

watch([searchQuery, typeFilter, itemsPerPage], () => {
  currentPage.value = 1
})

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value
})

onMounted(loadDownloads)
</script>
