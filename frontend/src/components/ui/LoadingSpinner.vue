<template>
  <div class="flex flex-col items-center gap-2">
    <svg
      :width="size"
      :height="size * 0.55"
      :viewBox="viewBox"
      :class="colorClass"
    >
      <!-- track -->
      <path
        :d="PATH"
        fill="none"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        opacity="0.12"
      />
      <!-- animated stroke -->
      <path
        class="infinity-stroke"
        :d="PATH"
        fill="none"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        pathLength="100"
      />
    </svg>
    <p v-if="label" :class="[colorClass, 'text-sm']">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: number
  label?: string
  strokeWidth?: number
  variant?: 'default' | 'accent'
}>(), {
  size: 52,
  label: '読み込み中...',
  strokeWidth: 22,
  variant: 'default',
})

const colorClass = computed(() => props.variant === 'accent' ? 'text-accent' : 'text-main')

const PATH = 'M 0,0 C 0,-30 30,-50 50,-50 C 75,-50 90,-30 90,0 C 90,30 75,50 50,50 C 30,50 0,30 0,0 C 0,-30 -30,-50 -50,-50 C -75,-50 -90,-30 -90,0 C -90,30 -75,50 -50,50 C -30,50 0,30 0,0'

const viewBox = computed(() => {
  const pad = Math.ceil(props.strokeWidth / 2) + 2
  const x = 90 + pad
  const y = 50 + pad
  return `-${x} -${y} ${x * 2} ${y * 2}`
})
</script>

<style scoped>
.infinity-stroke {
  stroke-dasharray: 30 70;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  to { stroke-dashoffset: -100; }
}
</style>
