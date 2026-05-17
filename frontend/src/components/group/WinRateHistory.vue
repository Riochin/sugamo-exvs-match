<template>
  <svg
    v-if="history.length > 0"
    :viewBox="`0 0 ${W} ${H}`"
    class="w-full"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- X軸 -->
    <line :x1="pad" :y1="bottom" :x2="W - pad" :y2="bottom" stroke="#4B5563" stroke-width="1" />

    <!-- 折れ線 -->
    <line
      v-for="(seg, i) in lineSegments"
      :key="i"
      :x1="seg.x1"
      :y1="seg.y1"
      :x2="seg.x2"
      :y2="seg.y2"
      stroke="#2b008e"
      stroke-width="2"
      stroke-linecap="round"
    />

    <!-- 各エントリのポイント・ラベル -->
    <g
      v-for="(entry, i) in history"
      :key="entry.eventId"
      data-testid="history-entry"
      class="cursor-pointer"
      @click="emit('eventClick', entry)"
    >
      <template v-if="!entry.absent">
        <text
          :x="xAt(i)"
          :y="yAt(entry.winRate) - 7"
          text-anchor="middle"
          font-size="9"
          fill="#D1D5DB"
        >{{ entry.winRate }}%</text>
        <circle
          data-testid="win-rate-point"
          :cx="xAt(i)"
          :cy="yAt(entry.winRate)"
          r="4"
          :class="entry.winRate === 100 ? 'fill-accent' : 'fill-main'"
          stroke="white"
          stroke-width="1.5"
        />
      </template>
      <template v-else>
        <text
          :x="xAt(i)"
          :y="bottom - 4"
          text-anchor="middle"
          font-size="9"
          fill="#6B7280"
        >欠席</text>
        <circle
          :cx="xAt(i)"
          :cy="bottom"
          r="3"
          fill="none"
          stroke="#6B7280"
          stroke-width="1.5"
        />
      </template>
      <!-- 日付ラベル -->
      <text
        :x="xAt(i)"
        :y="bottom + 13"
        text-anchor="middle"
        font-size="8"
        fill="#6B7280"
      >{{ formatDate(entry.heldAt) }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type EventMeta = {
  eventId: string
  heldAt: string
  name: string
  venue: string | null
  description: string | null
  hasPromotionRelegation: boolean
}
type WinRateEntry =
  | (EventMeta & { winRate: number; wins: number; losses: number; absent: false })
  | (EventMeta & { absent: true })

const props = defineProps<{ history: readonly WinRateEntry[] }>()

const emit = defineEmits<{
  eventClick: [event: EventMeta]
}>()

const W = 280
const H = 104
const pad = 24
const top = 16
const bottom = 68

function xAt(i: number): number {
  const n = props.history.length
  if (n <= 1) return W / 2
  return pad + (i / (n - 1)) * (W - pad * 2)
}

function yAt(winRate: number): number {
  return bottom - (winRate / 100) * (bottom - top)
}

function formatDate(heldAt: string): string {
  const d = new Date(heldAt)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const lineSegments = computed(() => {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 1; i < props.history.length; i++) {
    const prev = props.history[i - 1]
    const curr = props.history[i]
    if (!prev.absent && !curr.absent) {
      segs.push({ x1: xAt(i - 1), y1: yAt(prev.winRate), x2: xAt(i), y2: yAt(curr.winRate) })
    }
  }
  return segs
})
</script>
