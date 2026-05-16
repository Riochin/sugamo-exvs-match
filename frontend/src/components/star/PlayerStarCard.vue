<template>
  <div
    class="flex items-center justify-between p-4 bg-dark border border-main rounded-lg transition-all select-none"
    :class="remaining > 0 ? 'cursor-pointer hover:border-yellow-500/60 active:opacity-70' : 'cursor-default'"
    @click="onCardClick"
  >
    <span class="font-bold text-white flex-1 text-base">{{ playerName }}</span>
    <div class="flex items-center gap-1 ml-3 min-h-[28px]">
      <button
        v-for="i in allocated"
        :key="i"
        type="button"
        data-testid="star-icon"
        class="text-yellow-400 hover:text-red-400 active:scale-90 transition-all"
        @click.stop="emit('decrement', playerId)"
      >
        <StarIcon :size="24" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import StarIcon from './StarIcon.vue'

const props = defineProps<{
  playerId: string
  playerName: string
  allocated: number
  remaining: number
}>()

const emit = defineEmits<{
  increment: [playerId: string]
  decrement: [playerId: string]
}>()

function onCardClick(): void {
  if (props.remaining > 0) {
    emit('increment', props.playerId)
  }
}
</script>
