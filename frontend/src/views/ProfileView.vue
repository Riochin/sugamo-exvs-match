<template>
  <div class="p-4 text-white">
    <div
      v-if="isLoading"
      data-testid="loading-spinner"
      class="flex justify-center py-8"
    >
      <LoadingSpinner />
    </div>

    <div
      v-else-if="notFound"
      data-testid="not-found-message"
      class="text-center py-8"
    >
      <p class="text-gray-400 mb-4">プレイヤーが見つかりません</p>
      <RouterLink to="/group" class="text-main underline">戻る</RouterLink>
    </div>

    <div
      v-else-if="error"
      data-testid="error-message"
      class="text-red-400 text-center py-4"
    >
      {{ error }}
    </div>

    <template v-else-if="profile">
      <!-- プレイヤー情報カード -->
      <div
        data-testid="player-info"
        class="bg-dark rounded-lg overflow-hidden mb-4"
      >
        <!-- 軍バナー -->
        <div
          :class="profile.team === 'FIRST' ? 'bg-yellow-400' : 'bg-main'"
          class="h-24 flex items-center justify-center"
        >
          <span
            :class="profile.team === 'FIRST' ? 'text-dark' : 'text-white'"
            class="text-6xl font-bold tracking-widest select-none"
          >{{ profile.team === 'FIRST' ? '1軍' : '2軍' }}</span>
        </div>

        <!-- アバター（バナー下端に重なる） -->
        <div class="px-4 -mt-10 mb-2">
          <img
            :src="profile.iconUrl ?? '/icons/default.png'"
            class="w-20 h-20 rounded-full object-cover border-4 border-dark"
            :alt="profile.name"
          />
        </div>

        <!-- プレイヤー名 + 管理者アイコン -->
        <div class="flex items-center gap-2 px-4">
          <h2 class="text-xl font-bold">{{ profile.name }}</h2>
          <span
            v-if="isOwnProfile && currentPlayer?.isAdmin"
            class="text-white"
            title="管理者"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              <path d="M9 13.57l-2.17-2.17-1.42 1.42L9 15.7 17.59 7.11 16.17 5.7 9 12.87z" fill="#12002b"/>
            </svg>
          </span>
        </div>

        <!-- 獲得スター・称号・メイン機体 -->
        <div class="text-sm space-y-2 mt-3 px-4 pb-4">
          <div class="flex items-center gap-1">
            <span class="text-gray-500 mr-2">獲得スター</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span class="text-yellow-400 font-semibold">{{ profile.totalStarsReceived }}</span>
          </div>
          <div v-if="profile.biggestFan" class="flex items-center gap-1">
            <span class="text-gray-500 mr-2">最大のファン</span>
            <span>{{ profile.biggestFan.name }}</span>
            <span class="text-yellow-400 text-xs ml-1">(★{{ profile.biggestFan.totalStars }})</span>
          </div>
          <div>
            <span class="text-gray-500 mr-2">称号</span>
            <span :class="profile.title === null ? 'text-gray-400' : ''">
              {{ profile.title ?? '未設定' }}
            </span>
          </div>
          <div>
            <span class="text-gray-500 mr-2">メイン機体</span>
            <span :class="profile.mainUnit === null ? 'text-gray-400' : ''">
              {{ profile.mainUnit ?? '未設定' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 通算戦績 -->
      <div
        data-testid="all-time-record"
        class="bg-dark rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-gray-400 mb-3">通算戦績</h3>
        <div class="flex items-baseline justify-center gap-4 py-1">
          <div>
            <span class="text-4xl font-bold">{{ profile.allTimeRecord.totalWins + profile.allTimeRecord.totalLosses }}</span>
            <span class="text-lg text-gray-400 ml-0.5">戦</span>
          </div>
          <div>
            <span class="text-4xl font-bold">{{ profile.allTimeRecord.totalWins }}</span>
            <span class="text-lg text-gray-400 ml-0.5">勝</span>
          </div>
          <div class="text-gray-600">|</div>
          <div class="text-4xl font-bold text-yellow-400">{{ profile.allTimeRecord.winRate }}<span class="text-lg font-normal text-gray-400">%</span></div>
        </div>
      </div>

      <!-- 勝率グラフ -->
      <div
        data-testid="win-rate-section"
        class="bg-dark rounded-lg p-4"
      >
        <h3 class="text-sm font-semibold text-gray-400 mb-3">直近5回の勝率推移</h3>
        <WinRateHistory :history="profile.winRateHistory" @event-click="openEventModal" />
      </div>

      <PastEventModal
        v-if="selectedEvent"
        :event-id="selectedEvent.eventId"
        :held-at="selectedEvent.heldAt"
        :name="selectedEvent.name"
        :venue="selectedEvent.venue"
        :description="selectedEvent.description"
        :has-promotion-relegation="selectedEvent.hasPromotionRelegation"
        :visible="true"
        @close="selectedEvent = null"
      />

      <RouterLink
        v-if="isOwnProfile && currentPlayer?.isAdmin"
        to="/admin"
        class="block w-full mt-4 py-3 rounded-lg bg-main text-white text-sm text-center"
      >
        管理画面へ
      </RouterLink>

      <button
        v-if="isOwnProfile"
        data-testid="logout-button"
        @click="handleLogout"
        class="w-full mt-4 py-3 rounded-lg bg-gray-500 text-white text-sm"
      >
        ログアウト
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { usePlayerProfile, type WinRateEntry } from '@/composables/usePlayerProfile'
import { useAuth } from '@/composables/useAuth'
import WinRateHistory from '@/components/group/WinRateHistory.vue'
import PastEventModal from '@/components/event/PastEventModal.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const playerId = computed(() => String(route.params.id))
const { profile, isLoading, error, notFound } = usePlayerProfile(playerId)

const { currentPlayer, logout } = useAuth()
const isOwnProfile = computed(() => currentPlayer.value?.playerId === playerId.value)

type EventMeta = Pick<WinRateEntry, 'eventId' | 'heldAt' | 'name' | 'venue' | 'description' | 'hasPromotionRelegation'>
const selectedEvent = ref<EventMeta | null>(null)

function openEventModal(event: EventMeta) {
  selectedEvent.value = event
}

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>
