<template>
  <div class="relative p-4 bg-dark border border-main rounded-lg text-white">
    <div class="flex items-center justify-between mb-2">
      <span class="font-bold text-base">{{ player.playerName }}</span>
      <div class="flex items-center gap-2">
        <span
          v-if="player.borderDirection === 'PROMOTION'"
          data-testid="indicator-promotion"
          class="text-yellow-400 text-xl font-bold leading-none"
        >↑</span>
        <span
          v-else-if="player.borderDirection === 'RELEGATION'"
          data-testid="indicator-relegation"
          class="text-accent text-xl font-bold leading-none"
        >↓</span>
      </div>
    </div>
    <div class="text-sm text-gray-300 flex gap-4">
      <span>{{ player.wins }}勝{{ player.losses }}敗</span>
      <span
        v-if="rank !== null"
        data-testid="rank"
        class="text-yellow-400"
      >{{ rank }}位</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayerResult } from '@/composables/useResultReveal'

defineProps<{
  player: PlayerResult
  rank: number | null
}>()
</script>
