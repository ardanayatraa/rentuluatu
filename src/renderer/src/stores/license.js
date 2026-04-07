import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLicenseStore = defineStore('license', () => {
  const status = ref('none')       // 'trial' | 'trial_expired' | 'licensed' | 'expired' | 'none'
  const daysLeft = ref(0)
  const machineId = ref('')
  const isFirstRun = ref(false)
  const licensedUntil = ref(null)

  const isActive = computed(() => status.value === 'trial' || status.value === 'licensed')
  const isExpired = computed(() => status.value === 'trial_expired' || status.value === 'expired')
  const isTrial = computed(() => status.value === 'trial')
  const isLicensed = computed(() => status.value === 'licensed')

  async function load() {
    try {
      const res = await window.api.getLicenseStatus()
      status.value = res.status
      daysLeft.value = res.daysLeft
      machineId.value = res.machineId
      isFirstRun.value = res.isFirstRun
      licensedUntil.value = res.licensedUntil
    } catch (e) {
      console.error('[license:load]', e)
    }
  }

  async function startTrial() {
    await window.api.startTrial()
    await load()
  }

  return { status, daysLeft, machineId, isFirstRun, licensedUntil, isActive, isExpired, isTrial, isLicensed, load, startTrial }
})
