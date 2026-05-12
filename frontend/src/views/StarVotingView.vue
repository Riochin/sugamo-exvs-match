<template>
  <div class="min-h-screen bg-[#090014] text-white overflow-y-auto">
    <div class="max-w-md mx-auto px-4 pt-8 pb-24">
      <h1 class="text-center text-2xl font-bold mb-6 tracking-widest text-yellow-400">
        Star 投票
      </h1>

      <!-- フェーズが STAR_VOTING でない場合 -->
      <div
        v-if="phaseNotVoting"
        data-testid="phase-not-voting"
        class="text-center py-16 text-gray-400"
      >
        <p class="text-base">現在は投票を受け付けていません</p>
      </div>

      <!-- 投票完了後 -->
      <div
        v-else-if="submitted"
        data-testid="vote-completed-message"
        class="text-center py-16"
      >
        <p class="text-2xl font-bold text-yellow-400 mb-4">投票完了！</p>
        <p class="text-gray-400 text-sm">他のプレイヤーの投票を待っています...</p>
        <p v-if="voteProgress" class="mt-4 text-gray-300 text-sm">
          {{ voteProgress.completedCount }} / {{ voteProgress.totalCount }} 名完了
        </p>
      </div>

      <!-- 通常の投票 UI -->
      <template v-else>
        <div v-if="error" data-testid="error-message" class="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
          {{ error }}
        </div>

        <StarVotingPanel
          :players="players"
          :remaining="remaining"
          :is-ready-to-submit="isReadyToSubmit"
          :completed-count="voteProgress?.completedCount ?? 0"
          :total-count="voteProgress?.totalCount ?? 0"
          @increment="increment"
          @decrement="decrement"
          @open-confirm="showConfirm = true"
        />
      </template>
    </div>

    <!-- 確認ダイアログ -->
    <StarConfirmDialog
      :visible="showConfirm"
      :allocations="confirmAllocations"
      :is-submitting="isSubmitting"
      @confirm="handleConfirm"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStarVoting } from '@/composables/useStarVoting'
import { useEventStream } from '@/composables/useEventStream'
import StarVotingPanel from '@/components/star/StarVotingPanel.vue'
import StarConfirmDialog from '@/components/star/StarConfirmDialog.vue'

const route = useRoute()
const router = useRouter()

const {
  players,
  remaining,
  isReadyToSubmit,
  isSubmitting,
  submitted,
  error,
  phaseNotVoting,
  increment,
  decrement,
  submitVote,
  loadPlayers,
} = useStarVoting()

const { currentPhase, starVoteUpdate, connect } = useEventStream()

const showConfirm = ref(false)

const voteProgress = computed(() => starVoteUpdate.value)

const confirmAllocations = computed(() =>
  players.value
    .filter((p) => p.allocated > 0)
    .map((p) => ({ playerId: p.playerId, playerName: p.playerName, count: p.allocated })),
)

watch(currentPhase, (phase) => {
  if (phase === 'REVEALING') {
    const eventId = route.params.id as string
    router.replace(`/events/${eventId}/result`)
  }
})

async function handleConfirm(): Promise<void> {
  await submitVote()
  if (!error.value) {
    showConfirm.value = false
  }
}

onMounted(async () => {
  const eventId = route.params.id as string
  connect(eventId)
  await loadPlayers(eventId)
})
</script>
