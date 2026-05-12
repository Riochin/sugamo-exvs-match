<template>
  <div class="space-y-2">
    <div
      v-for="entry in history"
      :key="entry.eventId"
      data-testid="history-entry"
      class="text-sm"
    >
      <template v-if="entry.absent">
        <span class="text-gray-400">欠席</span>
      </template>
      <template v-else>
        <div class="flex items-center gap-2">
          <span class="text-white w-14 shrink-0">{{ entry.winRate }}%</span>
          <div class="flex-1 bg-dark rounded overflow-hidden h-3">
            <div
              data-testid="win-rate-bar"
              :class="['h-full rounded', entry.winRate === 100 ? 'bg-accent' : 'bg-main']"
              :style="{ width: `${entry.winRate}%` }"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
type WinRateEntry =
  | { eventId: string; heldAt: string; winRate: number; wins: number; losses: number; absent: false }
  | { eventId: string; heldAt: string; absent: true }

defineProps<{
  history: readonly WinRateEntry[]
}>()
</script>
