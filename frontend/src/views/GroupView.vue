<template>
  <div class="p-4 text-white">
    <div
      v-if="isLoading"
      data-testid="loading-spinner"
      class="flex justify-center py-16"
    >
      <LoadingSpinner />
    </div>

    <div
      v-else-if="error"
      data-testid="error-message"
      class="text-red-400 text-center py-4"
    >
      {{ error }}
    </div>

    <template v-else>
      <div
        data-testid="first-team-section"
        class="bg-dark rounded-lg p-4 mb-4"
      >
        <h2 class="text-sm font-semibold text-yellow-400 mb-3">1軍 FIRST TEAM</h2>
        <div class="space-y-2">
          <PlayerCard
            v-for="player in firstTeam"
            :key="player.id"
            :player="player"
          />
        </div>
      </div>

      <div
        data-testid="second-team-section"
        class="bg-dark rounded-lg p-4"
      >
        <h2 class="text-sm font-semibold text-white mb-3">2軍 SECOND TEAM</h2>
        <div class="space-y-2">
          <PlayerCard
            v-for="player in secondTeam"
            :key="player.id"
            :player="player"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useGroupProfile } from '@/composables/useGroupProfile'
import PlayerCard from '@/components/group/PlayerCard.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const { firstTeam, secondTeam, isLoading, error } = useGroupProfile()
</script>
