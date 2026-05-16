<template>
  <div
    v-if="isOpen"
    class="fixed bottom-28 right-2 z-50 w-52 rounded-lg border border-cyan-400 bg-[#12002b] p-3 text-xs shadow-lg"
  >
    <div class="mb-2 flex items-center justify-between">
      <span class="font-bold text-cyan-400">DEV: UI呼び出し</span>
      <button class="text-gray-400 hover:text-white" @click="isOpen = false">✕</button>
    </div>

    <div class="space-y-1">
      <div>
        <button
          class="w-full rounded px-2 py-1 text-left text-white hover:bg-cyan-900/40"
          @click="showSpinner = !showSpinner"
        >
          {{ showSpinner ? '▼' : '▶' }} LoadingSpinner
        </button>
        <div v-if="showSpinner" class="mt-2 flex flex-col items-center gap-3 rounded bg-black/30 py-3">
          <LoadingSpinner :size="52" />
          <div class="text-gray-500">default (strokeWidth=22)</div>
          <LoadingSpinner :size="52" :stroke-width="14" label="" />
          <div class="text-gray-500">strokeWidth=14</div>
          <LoadingSpinner :size="32" label="" />
          <div class="text-gray-500">size=32, label=なし</div>
        </div>
      </div>
    </div>
  </div>

  <button
    v-else
    class="fixed bottom-28 right-2 z-50 rounded-full border border-cyan-400 bg-[#12002b] px-2 py-1 text-xs font-bold text-cyan-400 shadow-lg"
    @click="isOpen = true"
  >
    UI
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const isOpen = ref(false)
const showSpinner = ref(false)
</script>
