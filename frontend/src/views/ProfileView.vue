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
      <div
        data-testid="player-info"
        class="bg-dark rounded-lg p-4 mb-4"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <img
              :src="profile.iconUrl ?? '/icons/default.png'"
              class="w-16 h-16 rounded-full object-cover flex-shrink-0"
              :alt="profile.name"
            />
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold">{{ profile.name }}</h2>
              <span
                v-if="isOwnProfile && currentPlayer?.isAdmin"
                class="text-xs font-semibold text-red-400 border border-red-500 rounded px-2 py-0.5"
              >管理者</span>
            </div>
          </div>
          <span
            v-if="profile.team === 'FIRST'"
            class="text-xs font-semibold text-yellow-400 border border-yellow-400 rounded px-2 py-0.5"
          >1軍</span>
          <span
            v-else
            class="text-xs font-semibold text-white bg-main rounded px-2 py-0.5"
          >2軍</span>
        </div>
        <div class="text-sm space-y-2">
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

      <div
        data-testid="win-rate-section"
        class="bg-dark rounded-lg p-4"
      >
        <h3 class="text-sm font-semibold text-gray-400 mb-3">直近5回の勝率推移</h3>
        <WinRateHistory :history="profile.winRateHistory" />
      </div>

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
import { computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { usePlayerProfile } from '@/composables/usePlayerProfile'
import { useAuth } from '@/composables/useAuth'
import WinRateHistory from '@/components/group/WinRateHistory.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const playerId = computed(() => String(route.params.id))
const { profile, isLoading, error, notFound } = usePlayerProfile(playerId)

const { currentPlayer, logout } = useAuth()
const isOwnProfile = computed(() => currentPlayer.value?.playerId === playerId.value)

async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>
