<template>
  <div class="flex flex-col gap-3 p-4">
    <h2 class="text-center text-lg font-bold text-white">プレイヤーを選択</h2>

    <div v-if="isLoading" data-testid="loading" class="flex justify-center py-8">
      <LoadingSpinner label="プレイヤー一覧を取得中..." variant="accent" />
    </div>

    <div v-else-if="error !== null">
      <p data-testid="error-message" class="mb-3 text-center text-red-400">{{ error }}</p>
      <button
        data-testid="retry-button"
        class="w-full rounded-lg bg-main py-3 text-white"
        @click="emit('retry')"
      >
        再読み込み
      </button>
    </div>

    <ul v-else data-testid="player-list" class="flex flex-col gap-2">
      <li
        v-for="player in players"
        :key="player.id"
        data-testid="player-card"
        class="flex min-h-[56px] cursor-pointer items-center rounded-lg bg-dark px-4 py-3 text-white active:opacity-70"
        @click="emit('select', player.name)"
      >
        <span class="font-semibold">{{ player.name }}</span>
        <span v-if="player.mainUnit" class="ml-auto text-sm text-gray-400">{{ player.mainUnit }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface PlayerListItem {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  createdAt: string
}

interface Props {
  players: PlayerListItem[]
  isLoading: boolean
  error: string | null
}

import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

defineProps<Props>()

const emit = defineEmits<{
  select: [playerName: string]
  retry: []
}>()
</script>
