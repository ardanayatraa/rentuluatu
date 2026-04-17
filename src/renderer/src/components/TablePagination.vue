<template>
  <div
    v-if="total > 0"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4"
  >
    <p class="text-xs text-slate-400">
      Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ total }} data
    </p>

    <div class="flex items-center gap-2">
      <select
        v-if="showPageSize"
        :value="pageSize"
        :disabled="disabled"
        class="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60 bg-white"
        @change="onPageSizeChange"
      >
        <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">{{ opt }} / halaman</option>
      </select>

      <button
        class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
        :disabled="disabled || page <= 1"
        @click="$emit('update:page', Math.max(1, page - 1))"
      >
        Prev
      </button>
      <span class="text-xs font-bold text-slate-500">Hal. {{ page }} / {{ totalPages }}</span>
      <button
        class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
        :disabled="disabled || page >= totalPages"
        @click="$emit('update:page', Math.min(totalPages, page + 1))"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSizeOptions: { type: Array, default: () => [10, 25, 50] },
  disabled: { type: Boolean, default: false },
  showPageSize: { type: Boolean, default: true }
})

const emit = defineEmits(['update:page', 'update:pageSize'])

const totalPages = computed(() => Math.max(1, Math.ceil(Number(props.total || 0) / Number(props.pageSize || 1))))
const pageStart = computed(() => (props.total ? ((props.page - 1) * props.pageSize) + 1 : 0))
const pageEnd = computed(() => Math.min(props.page * props.pageSize, props.total))

watch(totalPages, (value) => {
  if (props.page > value) emit('update:page', value)
})

function onPageSizeChange(e) {
  const next = Number(e?.target?.value || props.pageSize)
  emit('update:pageSize', next)
  emit('update:page', 1)
}
</script>
