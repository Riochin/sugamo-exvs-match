<template>
  <div
    v-if="visible"
    data-testid="help-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
  >
    <div class="w-full max-w-sm bg-[#1a0a2e] border border-yellow-500/60 rounded-2xl p-8 text-center shadow-2xl">
      <h2 class="text-xl font-bold text-yellow-400 mb-5 tracking-wide">
        {{ title }}
      </h2>

      <slot />

      <button
        type="button"
        class="mt-6 w-full py-3 rounded-xl text-black bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 transition-colors font-bold"
        @click="$emit('close')"
      >
        とじる
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; title: string }>()
defineEmits<{ close: [] }>()
</script>
