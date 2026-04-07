<template>
  <div class="min-h-screen bg-primary flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
      <div class="flex flex-col items-center mb-8">
        <img src="../assets/logo.png" alt="Wavy Logo" class="w-16 h-16 rounded-xl object-cover mb-4 shadow-md" />
        <h1 class="text-xl font-black text-primary font-headline leading-tight">Selamat Datang!</h1>
        <p class="text-xs text-slate-400 mt-1">Buat password untuk melindungi akun Anda</p>
        <div class="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700 font-medium">
          Trial gratis 7 hari akan dimulai setelah ini
        </div>
      </div>

      <form @submit.prevent="handleSetup" class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password Baru</label>
          <input v-model="form.newPassword" type="password"
            class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="Minimal 4 karakter" required autofocus />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Konfirmasi Password</label>
          <input v-model="form.confirmPassword" type="password"
            class="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="Ulangi password" required />
        </div>

        <p v-if="error" class="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ error }}</p>

        <button type="submit" :disabled="loading"
          class="w-full bg-primary text-white py-3 rounded-lg font-bold text-sm hover:bg-primary-hover transition-all disabled:opacity-50 mt-2">
          {{ loading ? 'Menyimpan...' : 'Mulai Trial 7 Hari' }}
        </button>
      </form>
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

const form = ref({ newPassword: '', confirmPassword: '' })
const error = ref('')
const loading = ref(false)

async function handleSetup() {
  error.value = ''
  if (form.value.newPassword.length < 4) {
    error.value = 'Password minimal 4 karakter'
    return
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    error.value = 'Password tidak cocok'
    return
  }
  loading.value = true
  try {
    // Set password baru — pakai endpoint khusus yang tidak butuh password lama
    const result = await window.api.setInitialPassword({
      userId: auth.user.id,
      newPassword: form.value.newPassword
    })
    if (!result.success) {
      error.value = result.message
      return
    }
    // Mulai trial
    await license.startTrial()
    // Redirect ke dashboard
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message || 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}
</script>
