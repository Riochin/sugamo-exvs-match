<template>
  <div class="pb-4 text-white">
    <PageHeader title="グループ" @help="showHelp = true" />

    <HelpModal :visible="showHelp" title="グループの見方" @close="showHelp = false">
      <div class="bg-white/5 rounded-lg p-3 text-xs text-gray-400 text-left space-y-2">
        <p class="flex items-start gap-2">
          <span class="shrink-0 text-yellow-400">①</span>
          現在の1軍・2軍メンバーを確認できます
        </p>
        <p class="flex items-start gap-2">
          <span class="shrink-0 text-yellow-400">②</span>
          大会の結果によって昇格・降格が決まります
        </p>
        <p class="flex items-start gap-2">
          <span class="shrink-0 text-yellow-400">③</span>
          プレイヤー名をタップするとプロフィールが見られます
        </p>
      </div>
    </HelpModal>

    <div class="px-4">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGroupProfile } from '@/composables/useGroupProfile'
import PlayerCard from '@/components/group/PlayerCard.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import HelpModal from '@/components/ui/HelpModal.vue'

const { firstTeam, secondTeam, isLoading, error } = useGroupProfile()
const showHelp = ref(false)
</script>
