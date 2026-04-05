<template>
  <div class="relative" ref="container">
    <div
      @click="toggle"
      class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer bg-white hover:border-primary transition-colors min-w-[180px]"
      :class="isOpen ? 'border-primary ring-1 ring-primary/20' : ''"
    >
      <span :class="selectedLabel ? 'text-slate-800' : 'text-slate-400'">{{ selectedLabel || placeholder }}</span>
      <span class="material-symbols-outlined text-slate-400 text-base ml-2 transition-transform" :style="isOpen ? 'transform:rotate(180deg)' : ''">expand_more</span>
    </div>

    <div v-if="isOpen"
      class="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
      <!-- Search input -->
      <div class="p-2 border-b border-slate-100">
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          :placeholder="'Cari ' + (placeholder || '') + '...'"
          class="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-primary"
          @click.stop
        />
      </div>
      <!-- Options -->
      <div class="max-h-52 overflow-y-auto">
        <div v-if="clearable"
          @click="select(null)"
          class="px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 cursor-pointer italic">
          {{ placeholder }}
        </div>
        <div v-for="opt in filtered" :key="opt.value"
          @click="select(opt)"
          class="px-3 py-2 text-sm hover:bg-primary/5 cursor-pointer flex justify-between items-center"
          :class="modelValue == opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700'">
          <span>{{ opt.label }}</span>
          <span v-if="opt.sub" class="text-xs text-slate-400 ml-2">{{ opt.sub }}</span>
        </div>
        <div v-if="!filtered.length" class="px-3 py-4 text-sm text-slate-400 text-center">Tidak ditemukan</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label, sub? }]
  placeholder: { type: String, default: 'Pilih...' },
  clearable: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const query = ref('')
const container = ref(null)
const searchInput = ref(null)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value == props.modelValue)
  return opt ? opt.label : ''
})

const filtered = computed(() => {
  if (!query.value) return props.options
  const q = query.value.toLowerCase()
  return props.options.filter(o =>
    o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q))
  )
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    query.value = ''
    nextTick(() => searchInput.value?.focus())
  }
}

function select(opt) {
  emit('update:modelValue', opt ? opt.value : '')
  isOpen.value = false
  query.value = ''
}

function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>
