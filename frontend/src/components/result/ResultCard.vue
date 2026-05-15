<template>
  <div class="relative p-4 bg-dark border border-main rounded-lg text-white">
    <div class="flex items-center gap-3">
      <!-- 順位: 左側に大きく -->
      <div class="w-14 flex-shrink-0 text-center">
        <span
          v-if="rank !== null"
          data-testid="rank"
          class="font-bold leading-none"
          :class="[rankClass, rank <= 6 ? 'text-2xl' : 'text-base']"
        >{{ rank }}位</span>
        <span v-else class="text-2xl font-bold leading-none text-gray-500">--</span>
      </div>
      <!-- プレイヤー情報 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-base truncate">{{ player.playerName }}</span>
          <div class="flex items-center gap-1 ml-2">
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
        <div class="text-sm text-gray-300">
          {{ totalGames }}戦{{ player.wins }}勝（{{ winRateDisplay }}）
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerResult } from '@/composables/useResultReveal'

const props = defineProps<{
  player: PlayerResult
  rank: number | null
}>()

const totalGames = computed(() => props.player.wins + props.player.losses)

const winRateDisplay = computed(() => {
  if (totalGames.value === 0) return '--%'
  return `${Math.round((props.player.wins / totalGames.value) * 100)}%`
})

const rankClass = computed(() => {
  if (props.rank === 1) return 'rank-rainbow'
  if (props.rank === 2) return 'rank-gold'
  if (props.rank === 3) return 'rank-silver'
  if (props.rank !== null && props.rank <= 6) return 'rank-bronze'
  return 'rank-lower'
})
</script>

<style scoped>
.rank-rainbow {
  background: linear-gradient(135deg, #ff0000, #ff8800, #ffee00, #00cc44, #0088ff, #8844ff, #ff0088);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 6px rgba(180, 100, 255, 0.7));
}

.rank-gold {
  background: linear-gradient(180deg, #FFE566, #D4A000, #FFE566);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 1px 3px rgba(212, 160, 0, 0.7));
}

.rank-silver {
  background: linear-gradient(180deg, #F0F0F0, #909090, #F0F0F0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 1px 3px rgba(144, 144, 144, 0.6));
}

.rank-bronze {
  background: linear-gradient(180deg, #E8A060, #8B5E3C, #E8A060);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 1px 3px rgba(139, 94, 60, 0.6));
}

.rank-lower {
  color: rgba(255, 255, 255, 0.55);
  font-size: 1rem;
}
</style>
