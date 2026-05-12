<template>
  <section class="mt-8">
    <h2 class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-yellow-400 text-yellow-400">
      Star ランキング
    </h2>

    <div v-if="isLoading" class="text-center py-8 text-gray-400">
      読み込み中...
    </div>

    <div v-else-if="error" data-testid="ranking-error" class="py-4 text-center text-red-400 text-sm">
      {{ error }}
    </div>

    <div v-else-if="rankings.length === 0" data-testid="ranking-empty" class="py-4 text-center text-gray-400 text-sm">
      Star 投票データがありません
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="entry in rankings"
        :key="entry.playerId"
        data-testid="ranking-row"
        class="flex items-center justify-between p-3 bg-dark border border-main rounded-lg"
      >
        <div class="flex items-center gap-3">
          <span data-testid="rank-value" class="w-8 text-center font-bold text-yellow-400 text-lg">
            {{ entry.rank }}
          </span>
          <span class="text-white font-bold">{{ entry.playerName }}</span>
        </div>
        <span data-testid="star-count" class="text-yellow-400 font-bold">
          ★ {{ entry.starCount }}
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { client } from '@/api/client'

interface StarRanking {
  rank: number
  playerId: string
  playerName: string
  starCount: number
}

const props = defineProps<{ eventId: string }>()

const rankings = ref<StarRanking[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    const res = await client.api.stars.results[':eventId'].$get({ param: { eventId: props.eventId } })
    if (!res.ok) {
      error.value = 'ランキングの取得に失敗しました'
      return
    }
    const data = await res.json()
    rankings.value = data.rankings
  } catch {
    error.value = 'ネットワークエラーが発生しました'
  } finally {
    isLoading.value = false
  }
})
</script>
