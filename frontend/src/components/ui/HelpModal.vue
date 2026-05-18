<template>
  <div
    v-if="visible"
    data-testid="help-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-dark/80 backdrop-blur-sm px-4"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-sm bg-dark rounded-2xl p-8 text-center shadow-[0_0_100px_30px_rgba(255,255,255,0.45)]">
      <h2 class="text-xl font-bold text-white mb-5 tracking-wide">
        {{ title }}
      </h2>

      <slot />

      <button
        type="button"
        class="mt-6 w-full py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/10 active:bg-white/5 transition-colors font-bold"
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
