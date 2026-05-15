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
      <section v-if="revealPhase >= 1" ref="firstStaySection" data-testid="first-stay-group" class="mb-8">
        <h2
          class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-main text-white"
        >
          1軍残留
        </h2>
        <TransitionGroup name="slide-in" tag="div">
          <ResultCard
            v-for="player in firstStayPlayers.slice(0, revealedFirstStayCount)"
            :key="player.playerId"
            :player="player"
            :rank="player.rank"
            class="mb-2"
          />
        </TransitionGroup>
      </section>

      <!-- 2軍残留グループ（phase >= 2） -->
      <section v-if="revealPhase >= 2" ref="secondStaySection" data-testid="second-stay-group" class="mb-8">
        <h2
          class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-main text-gray-300"
        >
          2軍残留
        </h2>
        <TransitionGroup name="slide-in" tag="div">
          <ResultCard
            v-for="player in secondStayPlayers.slice(0, revealedSecondStayCount)"
            :key="player.playerId"
            :player="player"
            :rank="player.rank"
            class="mb-2"
          />
        </TransitionGroup>
      </section>

      <!-- ボーダーグループ（phase >= 3、1人ずつ手動表示） -->
      <section v-if="revealPhase >= 3" ref="borderSection" data-testid="border-group" class="mb-8">
        <h2
          class="text-center text-lg font-bold tracking-wide mb-4 py-2 border-b border-yellow-400 text-yellow-400"
        >
          ボーダー
        </h2>
        <TransitionGroup name="slide-in" tag="div">
          <ResultCard
            v-for="player in borderPlayers.slice(0, revealedBorderCount)"
            :key="player.playerId"
            :player="player"
            :rank="player.rank"
            class="mb-2"
          />
        </TransitionGroup>
      </section>

      <!-- Star ランキング（REVEALING または DONE） -->
      <StarResultsSection
        v-if="eventPhase === 'REVEALING' || eventPhase === 'DONE'"
        :event-id="(route.params.id as string)"
      />

    </div>

    <!-- 管理者フェーズ進行ボタン（固定フッター） -->
    <div
      v-if="currentPlayer?.isAdmin"
      class="fixed bottom-0 left-0 right-0 p-4 bg-[#090014] border-t border-main"
    >
      <button
        data-testid="advance-button"
        :disabled="isLoading"
        class="w-full py-3 rounded-lg font-bold text-white bg-main disabled:opacity-40 disabled:cursor-not-allowed"
        @click="handleButtonClick"
      >
        {{ buttonLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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

const firstStaySection = ref<HTMLElement | null>(null)
const secondStaySection = ref<HTMLElement | null>(null)
const borderSection = ref<HTMLElement | null>(null)

const revealedFirstStayCount = ref(0)
const revealedSecondStayCount = ref(0)
const revealedBorderCount = ref(0)

const allBorderRevealed = computed(
  () => borderPlayers.value.length === 0 || revealedBorderCount.value >= borderPlayers.value.length,
)

const buttonLabel = computed(() => {
  if (revealPhase.value < 3) return '次のフェーズへ'
  if (!allBorderRevealed.value) return '次の人を表示'
  return '終了'
})

async function handleButtonClick() {
  if (revealPhase.value < 3) {
    await advancePhase()
  } else if (!allBorderRevealed.value) {
    revealedBorderCount.value++
  } else {
    router.replace('/admin')
  }
}

let firstStayTimer: ReturnType<typeof setInterval> | null = null
let secondStayTimer: ReturnType<typeof setInterval> | null = null
let borderAutoRevealTimer: ReturnType<typeof setInterval> | null = null

function startFirstStayReveal() {
  if (firstStayTimer) return
  firstStayTimer = setInterval(() => {
    if (revealedFirstStayCount.value < firstStayPlayers.value.length) {
      revealedFirstStayCount.value++
    } else {
      clearInterval(firstStayTimer!)
      firstStayTimer = null
    }
  }, 900)
}

function startSecondStayReveal() {
  if (secondStayTimer) return
  secondStayTimer = setInterval(() => {
    if (revealedSecondStayCount.value < secondStayPlayers.value.length) {
      revealedSecondStayCount.value++
    } else {
      clearInterval(secondStayTimer!)
      secondStayTimer = null
    }
  }, 900)
}

function startBorderAutoReveal() {
  if (borderAutoRevealTimer) return
  if (borderPlayers.value.length === 0) {
    setTimeout(() => router.replace('/'), 1500)
    return
  }
  borderAutoRevealTimer = setInterval(() => {
    if (revealedBorderCount.value < borderPlayers.value.length) {
      revealedBorderCount.value++
    } else {
      clearInterval(borderAutoRevealTimer!)
      borderAutoRevealTimer = null
      setTimeout(() => router.replace('/'), 3000)
    }
  }, 2000)
}

watch(revealPhase, (phase) => {
  if (phase === 1) {
    nextTick(() => firstStaySection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    startFirstStayReveal()
  }
  if (phase === 2) {
    nextTick(() => secondStaySection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    startSecondStayReveal()
  }
  if (phase === 3) {
    nextTick(() => borderSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
})

watch(eventPhase, (phase) => {
  if (phase === 'COLLECTING') {
    router.replace('/')
  }
  if (phase === 'DONE' && !currentPlayer.value?.isAdmin) {
    startBorderAutoReveal()
  }
})

onMounted(async () => {
  const eventId = route.params.id as string
  await initialize(eventId)
  if (eventPhase.value === 'COLLECTING') {
    router.replace('/')
    return
  }
  // リフレッシュ時: すでに進んでいるフェーズは全員即表示
  if (revealPhase.value >= 1) revealedFirstStayCount.value = firstStayPlayers.value.length
  if (revealPhase.value >= 2) revealedSecondStayCount.value = secondStayPlayers.value.length
  if (revealPhase.value >= 3) revealedBorderCount.value = borderPlayers.value.length
  if (eventPhase.value === 'DONE' && !currentPlayer.value?.isAdmin) {
    router.replace('/')
  }
})

onUnmounted(() => {
  if (firstStayTimer) { clearInterval(firstStayTimer); firstStayTimer = null }
  if (secondStayTimer) { clearInterval(secondStayTimer); secondStayTimer = null }
  if (borderAutoRevealTimer) { clearInterval(borderAutoRevealTimer); borderAutoRevealTimer = null }
})
</script>

<style scoped>
.slide-in-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}

.slide-in-enter-active {
  transition: transform 0.7s ease-out, opacity 0.6s ease-out;
}

.slide-in-enter-to {
  transform: translateX(0);
  opacity: 1;
}
</style>
