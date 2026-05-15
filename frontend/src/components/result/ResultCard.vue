<template>
  <div class="relative p-4 bg-dark border border-main rounded-lg text-white overflow-hidden">
    <span
      v-if="player.borderDirection === 'PROMOTION'"
      data-testid="indicator-promotion"
      class="gekokujo-stamp"
      aria-hidden="true"
    >下剋上！</span>
    <span
      v-else-if="player.borderDirection === 'RELEGATION'"
      data-testid="indicator-relegation"
      class="youchien-stamp"
      aria-hidden="true"
    >幼稚園行き</span>
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

.gekokujo-stamp {
  font-family: 'Yuji Syuku', serif;
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%) rotate(8deg);
  font-size: 1.6rem;
  color: #ff2222;
  text-shadow:
    0 0 8px rgba(255, 60, 0, 0.9),
    1px 1px 0 #7a0000,
    -1px -1px 0 #7a0000;
  pointer-events: none;
  white-space: nowrap;
  line-height: 1;
  opacity: 0.92;
  animation: stamp-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes stamp-in {
  from {
    transform: translateY(-50%) rotate(8deg) scale(2.5);
    opacity: 0;
  }
  to {
    transform: translateY(-50%) rotate(8deg) scale(1);
    opacity: 0.92;
  }
}

.youchien-stamp {
  font-family: 'Hachi Maru Pop', cursive;
  position: absolute;
  top: 50%;
  right: 40px;
  transform: translateY(-50%) rotate(-6deg);
  font-size: 1rem;
  color: #ff88cc;
  text-shadow:
    0 0 6px rgba(255, 150, 200, 0.8),
    1px 1px 0 #aa3366,
    -1px -1px 0 #aa3366;
  pointer-events: none;
  white-space: nowrap;
  line-height: 1;
  opacity: 0.95;
  animation: youchien-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes youchien-in {
  from {
    transform: translateY(-50%) rotate(-6deg) scale(0);
    opacity: 0;
  }
  to {
    transform: translateY(-50%) rotate(-6deg) scale(1);
    opacity: 0.95;
  }
}
</style>
