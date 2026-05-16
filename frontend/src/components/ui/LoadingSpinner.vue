<template>
  <div class="flex flex-col items-center gap-2">
    <svg
      :width="size"
      :height="size * 0.55"
      :viewBox="viewBox"
      class="text-main"
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
      <!-- tail (dim, long) -->
      <path
        class="comet-tail"
        :d="PATH"
        fill="none"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        pathLength="100"
      />
      <!-- body (medium) -->
      <path
        class="comet-body"
        :d="PATH"
        fill="none"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        pathLength="100"
      />
      <!-- head (bright, short, with glow) -->
      <path
        class="comet-head"
        :d="PATH"
        fill="none"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        pathLength="100"
      />
    </svg>
    <p v-if="label" class="text-gray-400 text-sm">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: number
  label?: string
  strokeWidth?: number
}>(), {
  size: 52,
  label: '読み込み中...',
  strokeWidth: 22,
})

const PATH = 'M 0,0 C 0,-30 30,-50 50,-50 C 75,-50 90,-30 90,0 C 90,30 75,50 50,50 C 30,50 0,30 0,0 C 0,-30 -30,-50 -50,-50 C -75,-50 -90,-30 -90,0 C -90,30 -75,50 -50,50 C -30,50 0,30 0,0'

const viewBox = computed(() => {
  const pad = Math.ceil(props.strokeWidth / 2) + 2
  const x = 90 + pad
  const y = 50 + pad
  return `-${x} -${y} ${x * 2} ${y * 2}`
})
</script>

<style scoped>
.comet-tail {
  stroke-dasharray: 22 78;
  opacity: 0.3;
  animation: comet 1.5s linear infinite;
}

.comet-body {
  stroke-dasharray: 12 88;
  opacity: 0.65;
  animation: comet 1.5s linear infinite;
  animation-delay: -0.15s;
}

.comet-head {
  stroke-dasharray: 4 96;
  opacity: 1;
  filter: drop-shadow(0 0 4px currentColor);
  animation: comet 1.5s linear infinite;
  animation-delay: -0.3s;
}

@keyframes comet {
  to { stroke-dashoffset: -100; }
}
</style>
