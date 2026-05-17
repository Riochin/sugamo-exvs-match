<template>
  <RouterLink
    :to="`/profile/${player.id}`"
    class="block p-4 bg-dark border border-main rounded-lg text-white"
  >
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-3">
        <img
          :src="player.iconUrl ?? '/icons/default.png'"
          class="w-10 h-10 rounded-full object-cover flex-shrink-0"
          :alt="player.name"
        />
        <span class="font-bold text-base">{{ player.name }}</span>
      </div>
      <span
        v-if="player.team === 'FIRST'"
        data-testid="badge-first"
        class="text-xs font-semibold text-yellow-400 border border-yellow-400 rounded px-2 py-0.5"
      >1軍</span>
      <span
        v-else
        data-testid="badge-second"
        class="text-xs font-semibold text-white bg-main rounded px-2 py-0.5"
      >2軍</span>
    </div>
    <div class="text-sm text-gray-300 space-y-1 pl-[52px]">
      <div>
        <span class="text-gray-500 mr-1">称号</span>
        <span :class="player.title === null ? 'text-gray-400' : ''">
          {{ player.title ?? '未設定' }}
        </span>
      </div>
      <div>
        <span class="text-gray-500 mr-1">メイン機体</span>
        <span :class="player.mainUnit === null ? 'text-gray-400' : ''">
          {{ player.mainUnit ?? '未設定' }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
defineProps<{
  player: {
    id: string
    name: string
    team: 'FIRST' | 'SECOND'
    title: string | null
    mainUnit: string | null
    iconUrl: string | null
  }
}>()
</script>
