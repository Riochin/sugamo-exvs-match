<template>
  <div
    data-testid="result-reveal-view"
    class="min-h-screen bg-[#090014] text-white overflow-y-auto"
  >
    <div class="max-w-md mx-auto px-4 pt-8 pb-24">
      <!-- ヘッダー -->
      <h1 class="text-center text-2xl font-bold mb-8 tracking-widest text-yellow-400">
        結果発表
      </h1>

      <!-- ローディング -->
      <div v-if="isLoading && !result" class="flex items-center justify-center py-16">
        <p class="text-gray-400">読み込み中...</p>
      </div>

      <!-- エラー -->
      <div v-else-if="error && !result" class="py-8">
        <p class="text-red-400 text-center">{{ error }}</p>
      </div>

      <!-- 1軍残留グループ（phase >= 1） -->
      <section v-if="revealPhase >= 1" data-testid="first-stay-group" class="mb-8">
        <h2
          class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-main text-white"
        >
          1軍残留
        </h2>
        <ResultCard
          v-for="(player, index) in firstStayPlayers"
          :key="player.playerId"
          :player="player"
          :rank="player.rank"
          :style="{ transitionDelay: `${index * 100}ms` }"
          class="mb-2 transition-all duration-700"
        />
      </section>

      <!-- 2軍残留グループ（phase >= 2） -->
      <section v-if="revealPhase >= 2" data-testid="second-stay-group" class="mb-8">
        <h2
          class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-main text-gray-300"
        >
          2軍残留
        </h2>
        <ResultCard
          v-for="(player, index) in secondStayPlayers"
          :key="player.playerId"
          :player="player"
          :rank="player.rank"
          :style="{ transitionDelay: `${index * 100}ms` }"
          class="mb-2 transition-all duration-700"
        />
      </section>

      <!-- ボーダーグループ（phase >= 3） -->
      <section v-if="revealPhase >= 3" data-testid="border-group" class="mb-8">
        <h2
          class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-yellow-400 text-yellow-400"
        >
          ボーダー
        </h2>
        <ResultCard
          v-for="(player, index) in borderPlayers"
          :key="player.playerId"
          :player="player"
          :rank="player.rank"
          :style="{ transitionDelay: `${index * 100}ms` }"
          class="mb-2 transition-all duration-700"
        />
      </section>

      <!-- Star ランキング（REVEALING または DONE） -->
      <StarResultsSection
        v-if="eventPhase === 'REVEALING' || eventPhase === 'DONE'"
        :event-id="(route.params.id as string)"
      />

      <!-- DONE後 Star投票CTA（全ユーザー向け） -->
      <div v-if="eventPhase === 'DONE'" class="mt-8 flex justify-center">
        <router-link
          data-testid="star-vote-cta"
          to="/star-vote"
          class="block w-full max-w-xs py-3 rounded-lg font-bold text-center bg-yellow-400 text-black"
        >
          Star投票へ
        </router-link>
      </div>
    </div>

    <!-- 管理者フェーズ進行ボタン（固定フッター） -->
    <div
      v-if="currentPlayer?.isAdmin"
      class="fixed bottom-0 left-0 right-0 p-4 bg-[#090014] border-t border-main"
    >
      <button
        data-testid="advance-button"
        :disabled="revealPhase >= 3 || eventPhase === 'DONE' || isLoading"
        class="w-full py-3 rounded-lg font-bold text-white bg-main disabled:opacity-40 disabled:cursor-not-allowed"
        @click="advancePhase"
      >
        次のフェーズへ
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useResultReveal } from '@/composables/useResultReveal'
import { useAuth } from '@/composables/useAuth'
import ResultCard from '@/components/result/ResultCard.vue'
import StarResultsSection from '@/components/star/StarResultsSection.vue'

const route = useRoute()
const router = useRouter()
const { currentPlayer } = useAuth()

const { result, revealPhase, eventPhase, isLoading, error, initialize, advancePhase } =
  useResultReveal()

const firstStayPlayers = computed(
  () => result.value?.players.filter((p) => p.group === 'FIRST_STAY') ?? [],
)
const secondStayPlayers = computed(
  () => result.value?.players.filter((p) => p.group === 'SECOND_STAY') ?? [],
)
const borderPlayers = computed(
  () => result.value?.players.filter((p) => p.group === 'BORDER') ?? [],
)

watch(eventPhase, (phase) => {
  if (phase === 'COLLECTING') {
    router.replace('/')
  }
})

onMounted(async () => {
  const eventId = route.params.id as string
  await initialize(eventId)
  if (eventPhase.value === 'COLLECTING') {
    router.replace('/')
  }
})
</script>
