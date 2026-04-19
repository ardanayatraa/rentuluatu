import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { resetLicenseCache } from '../router'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(sessionStorage.getItem('wavy_user') || 'null'))

  const isLoggedIn = computed(() => !!user.value)

  async function login(username, password) {
    try {
      const result = await window.api.login({ username, password })
      if (result.success) {
        user.value = result.user
        sessionStorage.setItem('wavy_user', JSON.stringify(result.user))
        await window.api.setActiveUser(result.user)
      }
      return result
    } catch (e) {
      console.error('[login error]', e)
      return { success: false, message: e.message || 'Terjadi kesalahan' }
    }
  }

  function logout() {
    try { window.api.clearActiveUser() } catch (_) {}
    user.value = null
    sessionStorage.removeItem('wavy_user')
    resetLicenseCache()
  }

  return { user, isLoggedIn, login, logout }
})
