<template>
  <div class="min-h-screen bg-[#090014] px-4 py-6 text-white">
    <h1 class="mb-6 text-xl font-bold text-main">管理者ダッシュボード</h1>

    <template v-if="currentPlayer?.isAdmin">
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
            class="mb-4 w-full rounded border border-main bg-[#090014] px-3 py-2 text-white focus:border-accent focus:outline-none"
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

        <!-- COLLECTING フェーズ: 参加者一覧 + REVEALING ボタン -->
        <template v-else-if="activeEvent.phase === 'COLLECTING'">
          <div class="mb-4 rounded border border-main bg-dark p-4">
            <h2 class="mb-2 text-lg font-semibold">
              大会中 — <span class="text-main">{{ activeEvent.phase }}</span>
            </h2>
            <p class="mb-4 text-sm text-gray-400">開催日時: {{ formatDate(activeEvent.heldAt) }}</p>

            <ul data-testid="scores-list" class="mb-4 space-y-2">
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

            <button
              data-testid="advance-phase-btn"
              :disabled="isLoading"
              class="w-full rounded bg-main px-4 py-2 font-bold text-white disabled:opacity-50"
              @click="advancePhase"
            >
              {{ isLoading ? '処理中...' : 'REVEALING へ' }}
            </button>
          </div>
        </template>

        <!-- REVEALING フェーズ: 情報表示のみ（フェーズ進行は結果発表ページで管理） -->
        <template v-else-if="activeEvent.phase === 'REVEALING'">
          <div class="rounded border border-main bg-dark p-4">
            <h2 class="mb-2 text-lg font-semibold">
              大会中 — <span class="text-main">{{ activeEvent.phase }}</span>
            </h2>
            <p class="text-sm text-gray-400">開催日時: {{ formatDate(activeEvent.heldAt) }}</p>
          </div>
        </template>

        <!-- DONE フェーズ: 読み取り専用 -->
        <template v-else-if="activeEvent.phase === 'DONE'">
          <div class="rounded border border-main bg-dark p-4">
            <h2 class="mb-2 text-lg font-semibold">大会終了</h2>
            <p class="text-sm text-gray-400">開催日時: {{ formatDate(activeEvent.heldAt) }}</p>
          </div>
        </template>
      </div>
    </template>

    <template v-else>
      <p class="text-gray-400">管理者権限が必要です。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAdminEvent } from '@/composables/useAdminEvent'
import { useAuth } from '@/composables/useAuth'
import { useEventStream } from '@/composables/useEventStream'

const { activeEvent, isLoading, error, createEvent, setAbsent, advancePhase, refresh } = useAdminEvent()
const { currentPlayer } = useAuth()
const { connect, latestPhaseUpdate } = useEventStream()

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
