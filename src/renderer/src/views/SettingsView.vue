<template>
  <div>
    <div class="mb-8">
      <h2 class="page-title">Pengaturan</h2>
      <p class="text-slate-500 text-sm mt-1">Konfigurasi akun dan sistem</p>
    </div>

    <div class="grid grid-cols-3 gap-6 items-start">

      <!-- ── Kolom Kiri ── -->
      <div class="col-span-1 space-y-4">

        <!-- Info Aplikasi -->
        <div class="card">
          <div class="flex items-center gap-3 mb-4">
            <img src="../assets/logo.png" class="w-10 h-10 rounded-lg object-cover" />
            <div>
              <p class="font-bold text-slate-800 text-sm leading-tight">The Wavy Rental Uluwatu</p>
              <p class="text-xs text-slate-400">PT. Artha Bali Wisata</p>
            </div>
          </div>
          <div class="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div class="flex justify-between"><span class="text-slate-400">Versi Aplikasi</span><span class="font-semibold text-slate-700">{{ appVersion }}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Sistem</span><span class="font-semibold text-slate-700">Wavy Desktop</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Status Data</span><span class="font-semibold text-slate-700">Tersimpan Aman</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Operator</span><span class="font-semibold text-slate-700">{{ auth.user?.username }}</span></div>
          </div>
        </div>

        <!-- Ganti Password -->
        <div class="card">
          <h3 class="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-base text-slate-400">lock</span>
            Ganti Password
          </h3>
          <form @submit.prevent="changePassword" class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Password Lama</label>
              <input v-model="pwForm.oldPassword" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Password Baru</label>
              <input v-model="pwForm.newPassword" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Konfirmasi</label>
              <input v-model="pwForm.confirmPassword" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <p v-if="pwMessage" :class="pwSuccess ? 'text-emerald-600' : 'text-red-500'" class="text-xs">{{ pwMessage }}</p>
            <button type="submit" class="btn-primary w-full justify-center text-sm">Simpan Password</button>
          </form>
        </div>

        <!-- Danger Zone (dev only) -->
        <div v-if="isDev" class="card border border-red-200 bg-red-50/30">
          <h3 class="font-bold text-red-600 text-sm mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-base">warning</span> Reset Database
          </h3>
          <p class="text-xs text-red-400 mb-3">Hanya muncul saat development. Hapus semua data permanen.</p>
          <button @click="handleReset" :disabled="isResetting" class="btn-primary !bg-red-600 hover:!bg-red-700 w-full justify-center text-sm">
            <span class="material-symbols-outlined text-sm">{{ isResetting ? 'hourglass_empty' : 'delete_forever' }}</span>
            {{ isResetting ? 'Mereset...' : 'Hapus Semua Data' }}
          </button>
        </div>

      </div>

      <!-- ── Kolom Kanan (Backup) ── -->
      <div class="col-span-2 card">
        <h3 class="font-bold text-slate-700 text-sm mb-1 flex items-center gap-2">
          <span class="material-symbols-outlined text-base text-slate-400">backup</span>
          Backup & Restore
        </h3>
        <p class="text-xs text-slate-400 mb-5">Simpan checkpoint data ke lokal atau Google Drive</p>

        <div v-if="backupMessage" :class="backupSuccess ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'"
          class="text-xs px-3 py-2 rounded-lg border mb-4">{{ backupMessage }}</div>

        <div class="grid grid-cols-2 gap-4 mb-5">
          <!-- Enkripsi -->
          <div class="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-slate-500 text-sm">lock</span>
                <span class="text-xs font-bold text-slate-700">Enkripsi</span>
                <span class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">AES-256</span>
              </div>
              <button @click="showPassphraseForm = !showPassphraseForm" class="text-[10px] text-primary font-semibold hover:underline">Ubah</button>
            </div>
            <p class="text-[10px] text-slate-400 leading-relaxed">Semua backup dienkripsi otomatis. Jaga passphrase dengan baik.</p>
            <div v-if="showPassphraseForm" class="mt-3 flex gap-2">
              <input v-model="newPassphrase" type="password" placeholder="Passphrase baru..."
                class="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
              <button @click="savePassphrase" :disabled="newPassphrase.length < 6" class="btn-primary text-xs px-2 py-1">OK</button>
            </div>
          </div>

          <!-- Google Drive -->
          <div class="rounded-xl border border-slate-200 p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-slate-500 text-sm">cloud</span>
                <span class="text-xs font-bold text-slate-700">Google Drive</span>
              </div>
              <span v-if="gdriveConnected" class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span class="material-symbols-outlined text-[10px]">check_circle</span> Terhubung
              </span>
              <span v-else class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Belum</span>
            </div>
            <div v-if="!gdriveConfigured" class="text-[10px] text-amber-600 mb-2">Credentials belum dikonfigurasi.</div>
            <div v-if="!gdriveConnected">
              <button @click="connectGdrive" :disabled="backupLoading || !gdriveConfigured" class="btn-secondary w-full justify-center text-xs py-1.5">
                {{ backupLoading ? 'Menunggu...' : 'Hubungkan' }}
              </button>
            </div>
            <div v-else class="flex gap-2">
              <button @click="uploadToGdrive" :disabled="backupLoading" class="btn-primary flex-1 justify-center text-xs py-1.5">
                <span class="material-symbols-outlined text-sm">cloud_upload</span>
                {{ backupLoading ? 'Upload...' : 'Upload' }}
              </button>
              <button @click="disconnectGdrive" class="btn-secondary text-xs px-2 py-1.5" title="Putuskan">
                <span class="material-symbols-outlined text-sm">logout</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mb-4">
          <button @click="createLocalBackup" :disabled="backupLoading" class="btn-secondary flex-1 justify-center text-xs">
            <span class="material-symbols-outlined text-sm">save</span>
            {{ backupLoading ? 'Menyimpan...' : 'Buat Checkpoint Lokal' }}
          </button>
          <button @click="loadBackupList" class="btn-secondary text-xs px-3" title="Refresh">
            <span class="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>

        <div class="flex gap-1 mb-3 bg-slate-100 rounded-lg p-1">
          <button @click="backupTab = 'local'" :class="['flex-1 text-xs py-1.5 rounded-md font-semibold transition-colors', backupTab==='local' ? 'bg-white text-primary shadow-sm' : 'text-slate-500']">
            Lokal ({{ localBackups.length }})
          </button>
          <button @click="backupTab = 'drive'; loadDriveBackups()" :class="['flex-1 text-xs py-1.5 rounded-md font-semibold transition-colors', backupTab==='drive' ? 'bg-white text-primary shadow-sm' : 'text-slate-500']" :disabled="!gdriveConnected">
            Google Drive ({{ driveBackups.length }})
          </button>
        </div>

        <div v-if="backupTab === 'local'" class="space-y-1.5 max-h-56 overflow-y-auto">
          <div v-if="!localBackups.length" class="text-center py-8 text-slate-400 text-xs">Belum ada checkpoint lokal</div>
          <div v-for="b in localBackups" :key="b.name"
            class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            <div>
              <p class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                {{ b.name }}
                <span v-if="b.encrypted" class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[10px]">lock</span> Enkripsi
                </span>
              </p>
              <p class="text-[10px] text-slate-400">{{ formatFileDate(b.modifiedTime) }} · {{ formatSize(b.size) }}</p>
            </div>
            <button @click="restoreLocal(b)" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">restore</span> Restore
            </button>
          </div>
        </div>

        <div v-if="backupTab === 'drive'" class="space-y-1.5 max-h-56 overflow-y-auto">
          <div v-if="driveLoading" class="text-center py-8 text-slate-400 text-xs">Memuat dari Drive...</div>
          <div v-else-if="!driveBackups.length" class="text-center py-8 text-slate-400 text-xs">Belum ada backup di Google Drive</div>
          <div v-for="b in driveBackups" :key="b.id"
            class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            <div>
              <p class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                {{ b.name }}
                <span v-if="b.name.endsWith('.wavy')" class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[10px]">lock</span> Enkripsi
                </span>
              </p>
              <p class="text-[10px] text-slate-400">{{ formatFileDate(b.modifiedTime) }} · {{ formatSize(b.size) }}</p>
            </div>
            <div class="flex gap-2">
              <button @click="restoreDrive(b)" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">cloud_download</span> Restore
              </button>
              <button @click="deleteDriveBackup(b)" class="text-xs text-red-400 hover:text-red-600">
                <span class="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Reset Modal -->
    <n-modal v-model:show="showResetModal" preset="card" title="Konfirmasi Reset" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div class="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-200">
          BAHAYA! Semua data akan dihapus permanen dan tidak bisa dikembalikan!
        </div>
        <p class="text-sm text-slate-600">Ketik <strong>RESET</strong> untuk konfirmasi:</p>
        <input v-model="resetConfirmText" type="text" placeholder="Ketik RESET"
          class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm" />
        <div class="flex justify-end gap-3">
          <button @click="showResetModal = false" class="btn-secondary">Batal</button>
          <button @click="executeReset" :disabled="isResetting || resetConfirmText !== 'RESET'"
            class="btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
            Hapus Data
          </button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const isDev = import.meta.env.DEV
const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'

const pwForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwMessage = ref('')
const pwSuccess = ref(false)

async function changePassword() {
  pwMessage.value = ''
  if (pwForm.value.newPassword !== pwForm.value.confirmPassword) {
    pwMessage.value = 'Password baru tidak cocok'; pwSuccess.value = false; return
  }
  const result = await window.api.changePassword({ userId: auth.user.id, oldPassword: pwForm.value.oldPassword, newPassword: pwForm.value.newPassword })
  pwSuccess.value = result.success
  pwMessage.value = result.success ? 'Password berhasil diubah' : result.message
  if (result.success) pwForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
}

const isResetting = ref(false)
const showResetModal = ref(false)
const resetConfirmText = ref('')

function handleReset() { resetConfirmText.value = ''; showResetModal.value = true }

async function executeReset() {
  if (resetConfirmText.value === 'RESET') {
    try {
      isResetting.value = true
      await window.api.resetAllData()
      window.location.reload()
    } catch (err) {
      alert('Gagal mereset: ' + err.message)
    } finally {
      isResetting.value = false
      showResetModal.value = false
    }
  }
}

const gdriveConnected = ref(false)
const gdriveConfigured = ref(false)
const backupLoading = ref(false)
const driveLoading = ref(false)
const backupMessage = ref('')
const backupSuccess = ref(false)
const backupTab = ref('local')
const localBackups = ref([])
const driveBackups = ref([])
const showPassphraseForm = ref(false)
const newPassphrase = ref('')

async function savePassphrase() {
  try {
    await window.api.backupSetPassphrase({ passphrase: newPassphrase.value })
    showPassphraseForm.value = false
    newPassphrase.value = ''
    setMsg('Passphrase berhasil diperbarui.')
  } catch (e) { setMsg(e.message, false) }
}

function setMsg(msg, ok = true) {
  backupMessage.value = msg; backupSuccess.value = ok
  setTimeout(() => { backupMessage.value = '' }, 5000)
}

function formatFileDate(iso) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatSize(bytes) {
  if (!bytes) return '-'
  const kb = Number(bytes) / 1024
  return kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(0) + ' KB'
}

async function checkGdriveStatus() {
  const status = await window.api.backupGdriveStatus()
  gdriveConnected.value = status.connected
  gdriveConfigured.value = status.configured
}

async function loadBackupList() {
  localBackups.value = await window.api.backupListLocal()
}

async function loadDriveBackups() {
  if (!gdriveConnected.value) return
  driveLoading.value = true
  try { driveBackups.value = await window.api.backupGdriveList() }
  catch (e) { setMsg('Gagal memuat dari Drive: ' + e.message, false) }
  finally { driveLoading.value = false }
}

async function connectGdrive() {
  backupLoading.value = true
  try {
    await window.api.backupGdriveConnect()
    gdriveConnected.value = true
    setMsg('Google Drive berhasil terhubung!')
  } catch (e) { setMsg('Gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function disconnectGdrive() {
  await window.api.backupGdriveDisconnect()
  gdriveConnected.value = false
  driveBackups.value = []
  setMsg('Google Drive diputus.')
}

async function createLocalBackup() {
  backupLoading.value = true
  try {
    const res = await window.api.backupCreateLocal()
    await loadBackupList()
    setMsg(`Checkpoint disimpan: ${res.filename}`)
  } catch (e) { setMsg(e.message, false) }
  finally { backupLoading.value = false }
}

async function uploadToGdrive() {
  backupLoading.value = true
  try {
    const res = await window.api.backupGdriveUpload()
    setMsg(`Berhasil upload ke Drive: ${res.filename}`)
    if (backupTab.value === 'drive') await loadDriveBackups()
  } catch (e) { setMsg('Upload gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function restoreLocal(backup) {
  if (!confirm(`Restore dari "${backup.name}"?\n\nData saat ini akan diganti. App akan reload otomatis.`)) return
  backupLoading.value = true
  try {
    await window.api.backupRestoreLocal({ path: backup.path })
    setMsg('Restore berhasil! App akan reload...')
    setTimeout(() => window.location.reload(), 1500)
  } catch (e) { setMsg('Restore gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function restoreDrive(backup) {
  if (!confirm(`Restore dari Drive: "${backup.name}"?\n\nData saat ini akan diganti. App akan reload otomatis.`)) return
  backupLoading.value = true
  try {
    await window.api.backupGdriveRestore({ fileId: backup.id, fileName: backup.name })
    setMsg('Restore dari Drive berhasil! App akan reload...')
    setTimeout(() => window.location.reload(), 1500)
  } catch (e) { setMsg('Restore gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function deleteDriveBackup(backup) {
  if (!confirm(`Hapus backup "${backup.name}" dari Drive?`)) return
  try {
    await window.api.backupGdriveDelete({ fileId: backup.id })
    driveBackups.value = driveBackups.value.filter(b => b.id !== backup.id)
    setMsg('Backup dihapus dari Drive.')
  } catch (e) { setMsg('Gagal hapus: ' + e.message, false) }
}

onMounted(async () => {
  await checkGdriveStatus()
  await loadBackupList()
})
</script>
