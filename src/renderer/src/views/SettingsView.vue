<template>
  <div>
    <div class="mb-8">
      <h2 class="page-title">Pengaturan</h2>
      <p class="text-slate-500 text-sm mt-1">Konfigurasi akun dan sistem</p>
    </div>

    <div class="max-w-md space-y-6">
      <!-- Ganti Password -->
      <div class="card">
        <h3 class="font-extrabold text-primary font-headline mb-4">Ganti Password</h3>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Password Lama</label>
            <input v-model="pwForm.oldPassword" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Password Baru</label>
            <input v-model="pwForm.newPassword" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Konfirmasi Password Baru</label>
            <input v-model="pwForm.confirmPassword" type="password" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <p v-if="pwMessage" :class="pwSuccess ? 'text-emerald-600' : 'text-red-500'" class="text-xs">{{ pwMessage }}</p>
          <button type="submit" class="btn-primary">Simpan Password</button>
        </form>
      </div>

      <!-- Info Aplikasi -->
      <div class="card">
        <h3 class="font-extrabold text-primary font-headline mb-4">Informasi Aplikasi</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-500">Versi</span><span class="font-semibold">1.1.0</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Platform</span><span class="font-semibold">Desktop (Offline)</span></div>
          <div class="flex justify-between"><span class="text-slate-500">Database</span><span class="font-semibold">SQLite (Lokal)</span></div>
        </div>
      </div>
      <!-- Developer/Danger Zone -->
      <div v-if="isDev" class="card border-red-200 bg-red-50/50">
        <h3 class="font-extrabold text-red-600 font-headline mb-2 flex items-center gap-2">
          <span class="material-symbols-outlined">warning</span> Reset Database
        </h3>
        <p class="text-xs text-red-500/80 mb-4">
          Tombol ini HANYA MUNCUL SAAT DEVELOPMENT. Akan menghapus semua data transaksi dan master, tanpa sisa!
        </p>
        <button @click="handleReset" :disabled="isResetting" class="btn-primary !bg-red-600 hover:!bg-red-700 w-full flex justify-center mt-2">
          <span class="material-symbols-outlined">{{ isResetting ? 'hourglass_empty' : 'delete_forever' }}</span>
          {{ isResetting ? 'Sedang Mereset...' : 'HAPUS SEMUA DATA' }}
        </button>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <n-modal v-model:show="showResetModal" preset="card" title="Konfirmasi Reset" class="max-w-sm" :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div class="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-200">
          BAHAYA! Tindakan ini akan menghapus semua data transaksi dan master secara permanen. Data tidak dapat dikembalikan!
        </div>
        <p class="text-sm text-slate-600">
          Untuk melanjutkan, ketik kata <strong>RESET</strong> di bawah ini:
        </p>
        <input v-model="resetConfirmText" type="text" placeholder="Ketik RESET" 
          class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500" />
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showResetModal = false" class="btn-secondary">Batal</button>
          <button @click="executeReset" :disabled="isResetting || resetConfirmText !== 'RESET'" 
            class="btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
            <span class="material-symbols-outlined">{{ isResetting ? 'hourglass_empty' : 'delete_forever' }}</span>
            Hapus Data
          </button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const isDev = import.meta.env.DEV

// Password Form
const pwForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwMessage = ref('')
const pwSuccess = ref(false)

// Reset DB
const isResetting = ref(false)

async function changePassword() {
  pwMessage.value = ''
  if (pwForm.value.newPassword !== pwForm.value.confirmPassword) {
    pwMessage.value = 'Password baru tidak cocok'
    pwSuccess.value = false
    return
  }
  const result = await window.api.changePassword({
    userId: auth.user.id,
    oldPassword: pwForm.value.oldPassword,
    newPassword: pwForm.value.newPassword
  })
  pwSuccess.value = result.success
  pwMessage.value = result.success ? 'Password berhasil diubah' : result.message
  if (result.success) pwForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
}

const showResetModal = ref(false)
const resetConfirmText = ref('')

function handleReset() {
  resetConfirmText.value = ''
  showResetModal.value = true
}

async function executeReset() {
  if (resetConfirmText.value === 'RESET') {
    try {
      isResetting.value = true
      await window.api.resetAllData()
      alert('Database telah di-reset! Sistem akan di-reload otomatis.')
      window.location.reload()
    } catch (err) {
      alert('Gagal mereset: ' + err.message)
    } finally {
      isResetting.value = false
      showResetModal.value = false
    }
  }
}
</script>
