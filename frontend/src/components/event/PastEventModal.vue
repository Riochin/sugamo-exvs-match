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
        <h2 class="text-white font-bold">{{ formatDate(heldAt) }}</h2>
        <button
          type="button"
          class="text-gray-400 text-xl font-bold leading-none"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <div v-if="isLoading" class="py-8 text-center text-gray-400">
        読み込み中...
      </div>

      <div v-else-if="error" class="py-4 text-center text-red-400 text-sm px-4">
        {{ error }}
      </div>

      <ul v-else class="px-4 py-3 space-y-1">
        <li
          v-for="p in presentPlayers"
          :key="p.playerId"
          class="flex items-center gap-2 py-2 border-b border-gray-700 text-sm"
        >
          <span class="w-8 text-center text-yellow-400 font-bold shrink-0">{{ p.rank }}位</span>
          <span class="flex-1 text-white">{{ p.playerName }}</span>
          <span class="text-gray-300 shrink-0">{{ p.wins }}勝{{ p.losses }}敗</span>
          <span class="text-gray-300 w-14 text-right shrink-0">{{ winRate(p.wins, p.losses) }}</span>
          <span
            v-if="p.starCount > 0"
            class="text-yellow-400 font-bold w-10 text-right shrink-0"
          >★{{ p.starCount }}</span>
          <span v-else class="w-10 shrink-0"></span>
        </li>
        <li
          v-for="p in absentPlayers"
          :key="p.playerId"
          class="flex items-center gap-2 py-2 border-b border-gray-700 text-sm"
        >
          <span class="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded shrink-0">欠席</span>
          <span class="flex-1 text-gray-400">{{ p.playerName }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { client } from '@/api/client'

interface PlayerResult {
  playerId: string
  playerName: string
  team: 'FIRST' | 'SECOND'
  wins: number
  losses: number
  absent: boolean
  rank: number | null
  group: 'FIRST_STAY' | 'SECOND_STAY' | 'BORDER' | null
  borderDirection: 'PROMOTION' | 'RELEGATION' | null
}

interface PlayerRow extends PlayerResult {
  starCount: number
}

const props = defineProps<{
  eventId: string
  heldAt: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const players = ref<PlayerRow[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const presentPlayers = computed(() =>
  players.value.filter((p) => !p.absent).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
)
const absentPlayers = computed(() => players.value.filter((p) => p.absent))

watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    isLoading.value = true
    error.value = null
    try {
      const [resultRes, starRes] = await Promise.all([
        client.api.events[':id'].result.$get({ param: { id: props.eventId } }),
        client.api.stars.results[':eventId'].$get({ param: { eventId: props.eventId } }),
      ])
      if (!resultRes.ok || !starRes.ok) {
        error.value = 'データの取得に失敗しました'
        return
      }
      const resultData = (await resultRes.json()) as { players: PlayerResult[] }
      const starData = (await starRes.json()) as { rankings: { playerId: string; starCount: number }[] }
      const starMap = new Map(starData.rankings.map((r) => [r.playerId, r.starCount]))
      players.value = resultData.players.map((p) => ({
        ...p,
        starCount: starMap.get(p.playerId) ?? 0,
      }))
    } catch {
      error.value = 'ネットワークエラーが発生しました'
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

function formatDate(iso: string): string {
  const d = new Date(iso)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd}(${days[d.getDay()]})`
}

function winRate(wins: number, losses: number): string {
  const total = wins + losses
  return total === 0 ? '-' : `${((wins / total) * 100).toFixed(1)}%`
}
</script>
