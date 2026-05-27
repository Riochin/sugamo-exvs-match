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

        <!-- 大会作成フォーム（セレモニー中でなければ作成可） -->
        <form
          v-if="ceremonyEvent === null"
          data-testid="create-event-form"
          class="rounded border border-main bg-dark p-4 mb-4"
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

        <!-- COLLECTING 中の大会一覧 -->
        <div
          v-for="event in collectingEvents"
          :key="event.id"
          class="rounded border border-main bg-dark p-4 mb-4"
        >
          <div class="mb-4">
            <div class="mb-1 flex items-center gap-2">
              <h2 class="text-lg font-semibold">{{ event.name }}</h2>
              <span class="rounded bg-main px-2 py-0.5 text-xs font-bold text-white">{{ event.phase }}</span>
            </div>
            <p class="text-sm text-gray-400">開催日時: {{ formatDate(event.heldAt) }}</p>
            <p v-if="event.venue" class="text-sm text-gray-400">会場: {{ event.venue }}</p>
            <p v-if="event.hasPromotionRelegation" class="mt-1 text-xs text-accent">昇格・降格あり</p>
            <p v-if="event.description" class="mt-2 text-sm text-gray-300">{{ event.description }}</p>
          </div>

          <!-- 参加者一覧 -->
          <div class="mb-4">
            <ul data-testid="scores-list" class="space-y-2">
              <li
                v-for="score in event.scores"
                :key="score.playerId"
                :class="[
                  'flex items-center justify-between rounded border px-3 py-2',
                  getPendingAbsent(event.id).has(score.playerId)
                    ? 'border-amber-500 bg-[#090014]'
                    : 'border-main bg-[#090014]',
                ]"
              >
                <span>{{ score.playerName }}</span>
                <label class="flex items-center gap-2 text-sm">
                  <input
                    :data-testid="`absent-checkbox-${score.playerId}`"
                    type="checkbox"
                    :checked="effectiveAbsent(event.id, score.playerId, score.absent)"
                    @change="onAbsentChange(event.id, score.playerId, score.absent)"
                    class="accent-accent"
                  />
                  欠席
                </label>
              </li>
            </ul>

            <div v-if="getPendingCount(event.id) > 0" class="mt-3 flex gap-2">
              <button
                data-testid="submit-absent-btn"
                :disabled="isLoading"
                class="flex-1 rounded bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                @click="onSubmitAbsent(event.id)"
              >
                <span v-if="absentSubmitting" class="flex items-center justify-center gap-2">
                  <LoadingSpinner :size="18" :stroke-width="22" />
                  更新中...
                </span>
                <span v-else>出欠を更新する ({{ getPendingCount(event.id) }}件)</span>
              </button>
              <button
                data-testid="reset-absent-btn"
                :disabled="isLoading"
                class="rounded border border-main px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                @click="resetPendingAbsent(event.id)"
              >
                リセット
              </button>
            </div>
          </div>

          <!-- 全員揃ったらSTAR_VOTINGへ進めるボタン -->
          <div
            v-if="allSubmitted(event)"
            class="mb-4 rounded border border-green-600 bg-green-900/20 p-3"
          >
            <p class="text-sm text-green-400 mb-2">全員の結果が出揃いました</p>
            <button
              data-testid="advance-to-star-voting-btn"
              :disabled="isLoading"
              class="w-full rounded bg-main px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              @click="advancePhase(event.id)"
            >
              {{ isLoading ? '処理中...' : '結果を表示する' }}
            </button>
          </div>

          <!-- フェーズ強制変更 -->
          <div class="border-t border-main pt-4">
            <p class="mb-2 text-xs text-gray-400">フェーズを強制変更</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="phase in allPhases"
                :key="phase"
                :disabled="isLoading || phase === event.phase"
                :class="[
                  'w-full rounded px-2 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed',
                  phase === event.phase
                    ? 'bg-main text-white opacity-60'
                    : 'border border-main text-main hover:bg-main hover:text-white disabled:opacity-30',
                ]"
                @click="setPendingPhase(event.id, phase)"
              >
                {{ phase }}
              </button>
            </div>

            <div v-if="pendingPhaseMap.get(event.id)" class="mt-3 rounded border border-accent bg-[#090014] p-3">
              <p class="mb-3 text-sm">
                フェーズを <span class="font-bold text-accent">{{ pendingPhaseMap.get(event.id) }}</span> に変更しますか？
              </p>
              <div class="flex gap-2">
                <button
                  :disabled="isLoading"
                  class="flex-1 rounded bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  @click="confirmSetPhase(event.id)"
                >
                  {{ isLoading ? '処理中...' : '変更する' }}
                </button>
                <button
                  :disabled="isLoading"
                  class="flex-1 rounded border border-main px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  @click="clearPendingPhase(event.id)"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- セレモニーイベント（STAR_VOTING / REVEALING） -->
        <div v-if="ceremonyEvent" class="rounded border border-main bg-dark p-4 mb-4">
          <div class="mb-4">
            <div class="mb-1 flex items-center gap-2">
              <h2 class="text-lg font-semibold">{{ ceremonyEvent.name }}</h2>
              <span class="rounded bg-main px-2 py-0.5 text-xs font-bold text-white">{{ ceremonyEvent.phase }}</span>
            </div>
            <p class="text-sm text-gray-400">開催日時: {{ formatDate(ceremonyEvent.heldAt) }}</p>
            <p v-if="ceremonyEvent.venue" class="text-sm text-gray-400">会場: {{ ceremonyEvent.venue }}</p>
            <p v-if="ceremonyEvent.hasPromotionRelegation" class="mt-1 text-xs text-accent">昇格・降格あり</p>
            <p v-if="ceremonyEvent.description" class="mt-2 text-sm text-gray-300">{{ ceremonyEvent.description }}</p>
          </div>

          <!-- フェーズ強制変更 -->
          <div class="border-t border-main pt-4">
            <p class="mb-2 text-xs text-gray-400">フェーズを強制変更</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="phase in allPhases"
                :key="phase"
                :disabled="isLoading || phase === ceremonyEvent.phase"
                :class="[
                  'w-full rounded px-2 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed',
                  phase === ceremonyEvent.phase
                    ? 'bg-main text-white opacity-60'
                    : 'border border-main text-main hover:bg-main hover:text-white disabled:opacity-30',
                ]"
                @click="setPendingPhase(ceremonyEvent!.id, phase)"
              >
                {{ phase }}
              </button>
            </div>

            <div v-if="pendingPhaseMap.get(ceremonyEvent.id)" class="mt-3 rounded border border-accent bg-[#090014] p-3">
              <p class="mb-3 text-sm">
                フェーズを <span class="font-bold text-accent">{{ pendingPhaseMap.get(ceremonyEvent.id) }}</span> に変更しますか？
              </p>
              <div class="flex gap-2">
                <button
                  :disabled="isLoading"
                  class="flex-1 rounded bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  @click="confirmSetPhase(ceremonyEvent!.id)"
                >
                  {{ isLoading ? '処理中...' : '変更する' }}
                </button>
                <button
                  :disabled="isLoading"
                  class="flex-1 rounded border border-main px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  @click="clearPendingPhase(ceremonyEvent!.id)"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
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
import type { EventPhase } from '@/composables/useAdminEvent'
import { useAuth } from '@/composables/useAuth'
import { useEventStream } from '@/composables/useEventStream'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import HelpModal from '@/components/ui/HelpModal.vue'

const router = useRouter()
const {
  collectingEvents,
  ceremonyEvent,
  isLoading,
  isInitialLoading,
  error,
  createEvent,
  setAbsentBatch,
  advancePhase,
  setPhase,
  refresh,
} = useAdminEvent()
const { currentPlayer } = useAuth()
const showHelp = ref(false)

// per-event pending absent changes: Map<eventId, Map<playerId, boolean>>
const pendingAbsentChanges = ref(new Map<string, Map<string, boolean>>())

function getPendingAbsent(eventId: string): Map<string, boolean> {
  return pendingAbsentChanges.value.get(eventId) ?? new Map()
}

function getPendingCount(eventId: string): number {
  return getPendingAbsent(eventId).size
}

function effectiveAbsent(eventId: string, playerId: string, serverAbsent: boolean): boolean {
  const map = getPendingAbsent(eventId)
  return map.has(playerId) ? map.get(playerId)! : serverAbsent
}

function onAbsentChange(eventId: string, playerId: string, serverAbsent: boolean) {
  const next = !effectiveAbsent(eventId, playerId, serverAbsent)
  const eventMap = new Map(getPendingAbsent(eventId))
  if (next === serverAbsent) {
    eventMap.delete(playerId)
  } else {
    eventMap.set(playerId, next)
  }
  const newOuter = new Map(pendingAbsentChanges.value)
  newOuter.set(eventId, eventMap)
  pendingAbsentChanges.value = newOuter
}

const absentSubmitting = ref(false)

async function onSubmitAbsent(eventId: string) {
  const changes = Array.from(getPendingAbsent(eventId).entries()).map(([playerId, absent]) => ({
    playerId,
    absent,
  }))
  absentSubmitting.value = true
  try {
    await setAbsentBatch(eventId, changes)
    if (!error.value) {
      const newOuter = new Map(pendingAbsentChanges.value)
      newOuter.delete(eventId)
      pendingAbsentChanges.value = newOuter
    }
  } finally {
    absentSubmitting.value = false
  }
}

function resetPendingAbsent(eventId: string) {
  const newOuter = new Map(pendingAbsentChanges.value)
  newOuter.delete(eventId)
  pendingAbsentChanges.value = newOuter
}

function allSubmitted(event: { scores: ReadonlyArray<{ absent: boolean; submitted: boolean }> }): boolean {
  return event.scores.length > 0 && event.scores.every((s) => s.absent || s.submitted)
}

const allPhases = ['COLLECTING', 'STAR_VOTING', 'REVEALING', 'DONE'] as const

const pendingPhaseMap = ref(new Map<string, EventPhase>())

function setPendingPhase(eventId: string, phase: EventPhase) {
  const newMap = new Map(pendingPhaseMap.value)
  newMap.set(eventId, phase)
  pendingPhaseMap.value = newMap
}

function clearPendingPhase(eventId: string) {
  const newMap = new Map(pendingPhaseMap.value)
  newMap.delete(eventId)
  pendingPhaseMap.value = newMap
}

async function confirmSetPhase(eventId: string) {
  const phase = pendingPhaseMap.value.get(eventId)
  if (!phase) return
  await setPhase(eventId, phase)
  clearPendingPhase(eventId)
}

const { connect, latestPhaseUpdate } = useEventStream()

watch(currentPlayer, (player) => {
  if (!player?.isAdmin) router.push('/')
})

const nameInput = ref('')
const heldAtInput = ref('')
const hasPromotionRelegationInput = ref(false)
const venueInput = ref('')
const descriptionInput = ref('')

watch(
  () => ceremonyEvent.value?.id,
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}
</script>
