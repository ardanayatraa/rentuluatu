<template>
  <div class="min-h-screen bg-primary flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center">
      <div class="flex flex-col items-center mb-8">
        <img src="../assets/logo.png" alt="Wavy Logo" class="w-16 h-16 rounded-xl object-cover mb-4 shadow-md" />
        <h1 class="text-xl font-black text-primary font-headline">Wavy Rental</h1>
        <p class="text-xs text-slate-400 mt-1">PT. Artha Bali Wisata</p>
      </div>

      <!-- Status expired -->
      <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
        <span class="material-symbols-outlined text-red-500 text-3xl block mb-2">lock</span>
        <p class="font-bold text-red-700 text-sm">
          {{ license.status === 'trial_expired' ? 'Masa Trial Telah Berakhir' : 'Lisensi Telah Kadaluarsa' }}
        </p>
        <p class="text-xs text-red-500 mt-1">Masukkan kode aktivasi untuk melanjutkan</p>
      </div>

      <!-- Machine ID -->
      <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
        <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ID Perangkat Anda</p>
        <p class="font-mono text-sm font-bold text-primary tracking-widest">{{ license.machineId }}</p>
        <p class="text-xs text-slate-400 mt-1">Berikan ID ini ke admin untuk mendapatkan kode aktivasi</p>
      </div>

      <!-- Form aktivasi -->
      <form @submit.prevent="handleActivate" class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kode Aktivasi</label>
          <textarea v-model="activationCode" rows="3"
            class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            placeholder="WAVY-XXXX-XXXX-XXXX-XXXX|YYYY-MM-DD" required />
          <p class="text-xs text-slate-400 mt-1">Format: SERIAL|TANGGAL_EXPIRED (contoh: WAVY-A1B2-C3D4-E5F6-G7H8|2027-01-01)</p>
        </div>

        <p v-if="error" class="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ error }}</p>
        <p v-if="successMsg" class="text-emerald-600 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{{ successMsg }}</p>

        <button type="submit" :disabled="loading"
          class="w-full bg-primary text-white py-3 rounded-lg font-bold text-sm hover:bg-primary-hover transition-all disabled:opacity-50">
          {{ loading ? 'Memverifikasi...' : 'Aktifkan Lisensi' }}
        </button>
      </form>

      <button @click="handleLogout" class="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors">
        Keluar
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'

const router = useRouter()
const auth = useAuthStore()
const license = useLicenseStore()

const activationCode = ref('')
const error = ref('')
const successMsg = ref('')
const loading = ref(false)

async function handleActivate() {
  error.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    const result = await window.api.activateLicense({ activationCode: activationCode.value })
    if (!result.success) {
      error.value = result.message
      return
    }
    await license.load()
    successMsg.value = `Lisensi aktif! ${result.licensedUntil === 'LIFETIME' ? 'Selamanya' : 'Berlaku hingga ' + result.licensedUntil}`
    setTimeout(() => router.push('/dashboard'), 1500)
  } catch (e) {
    error.value = e.message || 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
