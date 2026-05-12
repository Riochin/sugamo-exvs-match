<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
    data-testid="confirm-dialog-overlay"
    @click.self="$emit('cancel')"
  >
    <div class="w-full max-w-md bg-dark border-t border-main rounded-t-2xl p-6">
      <h2 class="text-center text-lg font-bold text-white mb-4">配分内容を確認</h2>

      <ul class="space-y-2 mb-6">
        <li
          v-for="item in allocations"
          :key="item.playerId"
          data-testid="allocation-item"
          class="flex justify-between items-center py-2 border-b border-gray-700"
        >
          <span class="text-white">{{ item.playerName }}</span>
          <span class="text-yellow-400 font-bold">
            <span v-for="i in item.count" :key="i">★</span>
          </span>
        </li>
      </ul>

      <div class="flex gap-3">
        <button
          type="button"
          data-testid="cancel-btn"
          class="flex-1 py-3 rounded-lg font-bold text-white bg-gray-700 hover:opacity-90"
          @click="$emit('cancel')"
        >
          戻る
        </button>
        <button
          type="button"
          data-testid="confirm-btn"
          :disabled="isSubmitting"
          class="flex-1 py-3 rounded-lg font-bold text-black transition-colors"
          :class="isSubmitting ? 'bg-yellow-300 cursor-not-allowed opacity-60' : 'bg-yellow-400 hover:bg-yellow-300'"
          @click="$emit('confirm')"
        >
          {{ isSubmitting ? '送信中...' : '確定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  allocations: { playerId: string; playerName: string; count: number }[]
  isSubmitting: boolean
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>
