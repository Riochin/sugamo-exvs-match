<template>
  <div>
    <button
      type="button"
      data-testid="participant-list-toggle"
      class="w-full flex items-center justify-between py-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      @click="isOpen = !isOpen"
    >
      <span>参加者一覧 ({{ activeCount }}人)</span>
      <span class="text-xs">{{ isOpen ? '▲' : '▼' }}</span>
    </button>

    <div v-if="isOpen" data-testid="participant-list-content" class="mt-2 pb-1">
      <div class="text-xs text-gray-400 space-y-0.5 pb-2 mb-2 border-b border-gray-700">
        <div>日時: {{ formattedDate }}</div>
        <div>会場: {{ event.venue ?? '未定' }}</div>
      </div>
      <ul class="space-y-1.5">
        <li
          v-for="score in event.scores"
          :key="score.playerId"
          class="flex items-center justify-between text-sm"
          :class="score.absent ? 'text-gray-500' : 'text-white'"
        >
          <span>{{ score.playerName }}</span>
          <span v-if="score.absent" class="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">欠席</span>
          <span v-else-if="score.submitted" class="text-xs text-green-400">✓</span>
          <span v-else class="text-xs text-gray-400">未提出</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { EventWithScores } from '@/composables/useAdminEvent'

const props = defineProps<{
  event: EventWithScores
}>()

const isOpen = ref(false)

const activeCount = computed(() => props.event.scores.filter((s) => !s.absent).length)

const formattedDate = computed(() => {
  const d = new Date(props.event.heldAt)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd}(${days[d.getDay()]})`
})
</script>
