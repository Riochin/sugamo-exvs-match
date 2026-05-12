<template>
  <div class="flex items-center justify-between p-3 bg-dark border border-main rounded-lg">
    <span class="font-bold text-white">{{ playerName }}</span>
    <div class="flex items-center gap-3">
      <button
        type="button"
        data-testid="decrement-btn"
        :disabled="allocated === 0"
        class="w-8 h-8 rounded-full font-bold text-white flex items-center justify-center transition-colors"
        :class="allocated === 0 ? 'bg-gray-700 cursor-not-allowed opacity-40' : 'bg-main hover:opacity-90'"
        @click="emit('decrement', playerId)"
      >
        −
      </button>
      <span data-testid="allocated-count" class="w-6 text-center text-yellow-400 font-bold text-lg">
        {{ allocated }}
      </span>
      <button
        type="button"
        data-testid="increment-btn"
        :disabled="remaining === 0 && allocated === 0"
        class="w-8 h-8 rounded-full font-bold text-white flex items-center justify-center transition-colors"
        :class="remaining === 0 && allocated === 0 ? 'bg-gray-700 cursor-not-allowed opacity-40' : 'bg-main hover:opacity-90'"
        @click="emit('increment', playerId)"
      >
        ＋
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  playerId: string
  playerName: string
  allocated: number
  remaining: number
}>()

const emit = defineEmits<{
  increment: [playerId: string]
  decrement: [playerId: string]
}>()
</script>
