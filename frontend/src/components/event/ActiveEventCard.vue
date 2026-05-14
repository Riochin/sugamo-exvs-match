<template>
  <article data-testid="active-event-card" class="bg-dark border border-main rounded-2xl p-5 text-white space-y-4">
    <div class="flex items-start justify-between gap-2">
      <h2 class="text-xl font-bold leading-tight">{{ event.name }}</h2>
      <span
        class="shrink-0 text-xs px-2 py-0.5 rounded-full font-bold border"
        :class="phaseClass"
      >{{ phaseLabel }}</span>
    </div>

    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
      <dt class="text-gray-400">日時</dt>
      <dd>{{ formatDate(event.heldAt) }}</dd>
      <template v-if="event.venue">
        <dt class="text-gray-400">会場</dt>
        <dd>{{ event.venue }}</dd>
      </template>
    </dl>

    <span
      v-if="event.hasPromotionRelegation"
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/20 border border-brand text-brand text-xs font-bold"
    >↑↓ 下剋上あり</span>
    <span
      v-else
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 border border-gray-600 text-gray-400 text-xs"
    >下剋上なし</span>

    <p
      v-if="event.description"
      class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
    >{{ event.description }}</p>

    <button
      v-if="event.phase === 'COLLECTING'"
      data-testid="open-score-modal-btn"
      class="w-full py-3 rounded-xl font-bold text-white bg-main hover:opacity-90 transition-opacity"
      @click="emit('openScoreModal')"
    >
      スコアを入力する
    </button>
    <p v-else class="text-center text-sm text-gray-400 py-2">
      現在スコアを受け付けていません
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface EventProps {
  id: string
  phase: 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'
  heldAt: string
  name: string
  hasPromotionRelegation: boolean
  venue: string | null
  description: string | null
}

const props = defineProps<{ event: EventProps }>()

const emit = defineEmits<{
  openScoreModal: []
}>()

const phaseLabel = computed(() => ({
  COLLECTING: '受付中',
  STAR_VOTING: 'スター投票中',
  REVEALING: '結果発表中',
  DONE: '終了',
}[props.event.phase]))

const phaseClass = computed(() => {
  switch (props.event.phase) {
    case 'COLLECTING':
      return 'bg-green-900/50 border-green-600 text-green-400'
    case 'STAR_VOTING':
      return 'bg-yellow-900/50 border-yellow-600 text-yellow-400'
    default:
      return 'bg-gray-700 border-gray-500 text-gray-300'
  }
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd}(${days[d.getDay()]}) ${hh}:${min}`
}
</script>
