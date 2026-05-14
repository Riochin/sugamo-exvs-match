<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md bg-dark border-t border-main rounded-t-2xl max-h-[85vh] overflow-y-auto">
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 bg-gray-600 rounded-full"></div>
      </div>

      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <slot name="header">
          <span class="text-white font-bold">{{ title }}</span>
        </slot>
        <button
          type="button"
          class="text-gray-400 text-xl font-bold leading-none"
          data-testid="bottom-sheet-close-btn"
          @click="emit('close')"
        >×</button>
      </div>

      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
