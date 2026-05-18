<template>
  <div class="min-h-screen bg-[#090014] text-white">
    <PageHeader title="管理" @help="showHelp = true" />

    <HelpModal :visible="showHelp" title="管理者の操作" @close="showHelp = false">
      <div class="text-sm text-white/70 text-left space-y-2">
        <p>① 大会の<span class="text-star font-semibold">作成・開始</span>ができます</p>
        <p>② フェーズを進めて<span class="text-star font-semibold">スコア集計 → スター投票 → 結果発表</span>の順で進行します</p>
        <p>③ <span class="text-star font-semibold">不在プレイヤーのマーク・スコア修正</span>などの管理操作ができます</p>
      </div>
    </HelpModal>

    <div class="px-4 py-6">

    <div v-if="isInitialLoading" class="flex justify-center py-16">
      <LoadingSpinner label="データを取得中..." variant="accent" />
    </div>

    <template v-else-if="currentPlayer?.isAdmin">
      <div data-testid="admin-content">
        <p v-if="error" data-testid="error-message" class="mb-4 rounded border border-accent bg-dark px-4 py-2 text-sm text-red-400">
          {{ error }}
        </p>

        <!-- 大会作成フォーム -->
        <form
          v-if="activeEvent === null"
          data-testid="create-event-form"
          class="rounded border border-main bg-dark p-4"
          @submit.prevent="onCreateEvent"
        >
          <h2 class="mb-4 text-lg font-semibold">大会を作成する</h2>

          <label class="mb-1 block text-sm">大会名 <span class="text-accent">*</span></label>
          <input
            v-model="nameInput"
            data-testid="name-input"
            type="text"
            placeholder="第1回 すがも大会"
            class="mb-4 w-full rounded border border-main bg-[#090014] px-3 py-2 text-white focus:border-accent focus:outline-none"
            required
          />

          <label class="mb-1 block text-sm">開催日時 <span class="text-accent">*</span></label>
          <input
            v-model="heldAtInput"
            data-testid="held-at-input"
            type="datetime-local"
            min="1000-01-01T00:00"
            max="9999-12-31T23:59"
            class="mb-4 w-full min-w-0 rounded border border-main bg-[#090014] px-3 py-2 text-white focus:border-accent focus:outline-none"
            required
          />

          <label class="mb-3 flex items-center gap-2 text-sm">
            <input
              v-model="hasPromotionRelegationInput"
              data-testid="has-promotion-relegation-input"
              type="checkbox"
              class="accent-accent"
            />
            昇格・降格あり
          </label>

          <label class="mb-1 block text-sm">開催場所</label>
          <input
            v-model="venueInput"
            data-testid="venue-input"
            type="text"
            placeholder="省略可"
            class="mb-4 w-full rounded border border-main bg-[#090014] px-3 py-2 text-white focus:border-accent focus:outline-none"
          />

          <label class="mb-1 block text-sm">説明</label>
          <textarea
            v-model="descriptionInput"
            data-testid="description-input"
            placeholder="省略可"
            rows="3"
            class="mb-4 w-full rounded border border-main bg-[#090014] px-3 py-2 text-white focus:border-accent focus:outline-none"
          />

          <button
            data-testid="create-event-submit"
            type="submit"
            :disabled="isLoading"
            class="w-full rounded bg-main px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {{ isLoading ? '作成中...' : '大会を作成する' }}
          </button>
        </form>

        <!-- アクティブ大会 -->
        <template v-else>
          <div class="rounded border border-main bg-dark p-4">
            <div class="mb-4">
              <div class="mb-1 flex items-center gap-2">
                <h2 class="text-lg font-semibold">{{ activeEvent.name }}</h2>
                <span class="rounded bg-main px-2 py-0.5 text-xs font-bold text-white">{{ activeEvent.phase }}</span>
              </div>
              <p class="text-sm text-gray-400">開催日時: {{ formatDate(activeEvent.heldAt) }}</p>
              <p v-if="activeEvent.venue" class="text-sm text-gray-400">会場: {{ activeEvent.venue }}</p>
              <p v-if="activeEvent.hasPromotionRelegation" class="mt-1 text-xs text-accent">昇格・降格あり</p>
              <p v-if="activeEvent.description" class="mt-2 text-sm text-gray-300">{{ activeEvent.description }}</p>
            </div>

            <!-- COLLECTING フェーズ: 参加者一覧 -->
            <ul v-if="activeEvent.phase === 'COLLECTING'" data-testid="scores-list" class="mb-6 space-y-2">
              <li
                v-for="score in activeEvent.scores"
                :key="score.playerId"
                class="flex items-center justify-between rounded border border-main bg-[#090014] px-3 py-2"
              >
                <span>{{ score.playerName }}</span>
                <label class="flex items-center gap-2 text-sm">
                  <input
                    :data-testid="`absent-checkbox-${score.playerId}`"
                    type="checkbox"
                    :checked="score.absent"
                    @change="onAbsentChange(score.playerId, !score.absent)"
                    class="accent-accent"
                  />
                  欠席
                </label>
              </li>
            </ul>

            <!-- フェーズ強制変更 -->
            <div class="border-t border-main pt-4">
              <p class="mb-2 text-xs text-gray-400">フェーズを強制変更</p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="phase in allPhases"
                  :key="phase"
                  :disabled="isLoading || phase === activeEvent.phase"
                  :class="[
                    'w-full rounded px-2 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed',
                    phase === activeEvent.phase
                      ? 'bg-main text-white opacity-60'
                      : 'border border-main text-main hover:bg-main hover:text-white disabled:opacity-30',
                  ]"
                  @click="pendingPhase = phase"
                >
                  {{ phase }}
                </button>
              </div>

              <!-- 確認UI -->
              <div v-if="pendingPhase" class="mt-3 rounded border border-accent bg-[#090014] p-3">
                <p class="mb-3 text-sm">
                  フェーズを <span class="font-bold text-accent">{{ pendingPhase }}</span> に変更しますか？
                </p>
                <div class="flex gap-2">
                  <button
                    :disabled="isLoading"
                    class="flex-1 rounded bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    @click="confirmSetPhase"
                  >
                    {{ isLoading ? '処理中...' : '変更する' }}
                  </button>
                  <button
                    :disabled="isLoading"
                    class="flex-1 rounded border border-main px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    @click="pendingPhase = null"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <template v-else>
      <p class="text-gray-400">管理者権限が必要です。</p>
    </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminEvent } from '@/composables/useAdminEvent'
import { useAuth } from '@/composables/useAuth'
import { useEventStream } from '@/composables/useEventStream'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import HelpModal from '@/components/ui/HelpModal.vue'

const router = useRouter()
const { activeEvent, isLoading, isInitialLoading, error, createEvent, setAbsent, setPhase, refresh } = useAdminEvent()
const { currentPlayer } = useAuth()
const showHelp = ref(false)

const allPhases = ['COLLECTING', 'STAR_VOTING', 'REVEALING', 'DONE'] as const
type EventPhase = (typeof allPhases)[number]
const pendingPhase = ref<EventPhase | null>(null)
const { connect, latestPhaseUpdate } = useEventStream()

async function confirmSetPhase() {
  if (!pendingPhase.value) return
  await setPhase(pendingPhase.value)
  pendingPhase.value = null
}

watch(currentPlayer, (player) => {
  if (!player?.isAdmin) router.push('/')
})

const nameInput = ref('')
const heldAtInput = ref('')
const hasPromotionRelegationInput = ref(false)
const venueInput = ref('')
const descriptionInput = ref('')

watch(
  () => activeEvent.value?.id,
  (id) => {
    if (id) connect(id)
  },
  { immediate: true },
)

watch(latestPhaseUpdate, (payload) => {
  if (payload) refresh()
})

async function onCreateEvent() {
  if (!nameInput.value || !heldAtInput.value) return
  await createEvent({
    heldAt: new Date(heldAtInput.value),
    name: nameInput.value,
    hasPromotionRelegation: hasPromotionRelegationInput.value,
    venue: venueInput.value || undefined,
    description: descriptionInput.value || undefined,
  })
}

function onAbsentChange(playerId: string, absent: boolean) {
  setAbsent(playerId, absent)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}
</script>
