<template>
  <div class="p-4 text-white">
    <!-- 残りスター数ヘッダー -->
    <div class="text-center mb-6">
      <p class="text-sm text-gray-400 mb-1">配れる残りスター</p>
      <p data-testid="remaining-count" class="flex justify-center gap-2">
        <StarIcon v-for="i in remaining" :key="i" :size="36" class="text-yellow-400" />
        <StarIcon v-for="i in (3 - remaining)" :key="'e' + i" :size="36" class="text-gray-700" />
      </p>
    </div>

    <!-- プレイヤー一覧 -->
    <div class="space-y-2 mb-6">
      <PlayerStarCard
        v-for="player in players"
        :key="player.playerId"
        :player-id="player.playerId"
        :player-name="player.playerName"
        :allocated="player.allocated"
        :remaining="remaining"
        @increment="$emit('increment', $event)"
        @decrement="$emit('decrement', $event)"
      />
    </div>

    <!-- 投票完了人数 -->
    <p data-testid="vote-progress" class="text-center text-sm text-gray-400 mb-4">
      {{ completedCount }} / {{ totalCount }} 名完了
    </p>

    <!-- 投票するボタン -->
    <button
      type="button"
      data-testid="vote-button"
      :disabled="!isReadyToSubmit"
      class="w-full py-3 rounded-lg font-bold text-white transition-colors"
      :class="isReadyToSubmit ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-gray-700 cursor-not-allowed opacity-50'"
      @click="$emit('openConfirm')"
    >
      投票する
    </button>
  </div>
</template>

<script setup lang="ts">
import PlayerStarCard from './PlayerStarCard.vue'
import StarIcon from './StarIcon.vue'
import type { PlayerEntry } from '@/composables/useStarVoting'

defineProps<{
  players: PlayerEntry[]
  remaining: number
  isReadyToSubmit: boolean
  completedCount: number
  totalCount: number
}>()

defineEmits<{
  increment: [playerId: string]
  decrement: [playerId: string]
  openConfirm: []
}>()
</script>
