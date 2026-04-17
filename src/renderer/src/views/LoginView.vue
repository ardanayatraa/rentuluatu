<template>
  <div class="min-h-screen bg-primary flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">

      <!-- Logo + Nama PT -->
      <div class="flex flex-col items-center mb-8">
        <img src="../assets/logo.png" alt="Wavy Logo" class="w-16 h-16 rounded-xl object-cover mb-4 shadow-md" />
        <h1 class="text-2xl font-black text-primary italic font-headline leading-tight">The Wavy Rental</h1>
        <p class="text-xs text-slate-400 font-medium mt-1">PT. Artha Bali Wisata</p>
        <div class="w-8 h-0.5 bg-primary/20 rounded mt-3"></div>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 text-left">Kode Akses</label>
          <input
            v-model="code"
            type="password"
            class="w-full border border-slate-200 rounded-lg px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="••••••••"
            autofocus
            required
          />
        </div>

        <p v-if="error" class="text-red-500 text-xs">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-primary text-white py-3 rounded-lg font-bold text-sm hover:bg-primary-hover transition-all disabled:opacity-50"
        >
          {{ loading ? 'Memverifikasi...' : 'Masuk' }}
        </button>
      </form>
    </div>

    <div class="absolute bottom-6 w-full text-center">
      <p class="text-[10px] text-blue-200/50 uppercase tracking-widest font-bold">
        Developed by <span class="text-white">Madarya Studio</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const code = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    // Login dengan username 'admin' dan kode akses sebagai password
    const result = await auth.login('admin', code.value)
    if (result.success) {
      router.push('/dashboard')
    } else {
      error.value = result.message || 'Kode akses salah'
      code.value = ''
    }
  } catch {
    error.value = 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}
</script>
