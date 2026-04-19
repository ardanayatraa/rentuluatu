<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(async () => {
  try {
    const raw = sessionStorage.getItem('wavy_user')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed?.username) {
      await window.api.setActiveUser({ id: parsed.id, username: parsed.username })
    }
  } catch (_) {}
})
</script>
