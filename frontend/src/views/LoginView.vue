<template>
  <div class="flex min-h-screen flex-col bg-[#090014] px-4 py-8">
    <h1 class="mb-6 text-center text-2xl font-bold text-white">ログイン</h1>

    <PlayerSelectStep
      v-if="step === 'player-select'"
      :players="players"
      :is-loading="playersLoading"
      :error="playersError"
      @select="onPlayerSelect"
      @retry="fetchPlayers"
    />

    <PinInputStep
      v-else-if="step === 'pin-input' && selectedPlayerName !== null"
      :player-name="selectedPlayerName"
      :is-submitting="isSubmitting"
      :error="loginError"
      @submit="onPinSubmit"
      @back="onBack"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PlayerSelectStep from '@/components/auth/PlayerSelectStep.vue'
import PinInputStep from '@/components/auth/PinInputStep.vue'
import { useAuth } from '@/composables/useAuth'
import { client } from '@/api/client'

interface PlayerListItem {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  createdAt: string
}

const router = useRouter()
const route = useRoute()
const { login } = useAuth()

const step = ref<'player-select' | 'pin-input'>('player-select')
const players = ref<PlayerListItem[]>([])
const playersLoading = ref(false)
const playersError = ref<string | null>(null)
const selectedPlayerName = ref<string | null>(null)
const loginError = ref<string | null>(null)
const isSubmitting = ref(false)

async function fetchPlayers() {
  playersLoading.value = true
  playersError.value = null
  try {
    const res = await client.api.players.$get()
    if (res.ok) {
      players.value = (await res.json()) as PlayerListItem[]
    } else {
      playersError.value = 'プレイヤー一覧の取得に失敗しました'
    }
  } catch {
    playersError.value = 'ネットワークエラーが発生しました'
  } finally {
    playersLoading.value = false
  }
}

function onPlayerSelect(playerName: string) {
  selectedPlayerName.value = playerName
  loginError.value = null
  step.value = 'pin-input'
}

function onBack() {
  step.value = 'player-select'
  selectedPlayerName.value = null
  loginError.value = null
}

async function onPinSubmit(pin: string) {
  if (!selectedPlayerName.value) return
  isSubmitting.value = true
  loginError.value = null
  try {
    const result = await login(selectedPlayerName.value, pin)
    if (result.ok) {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      await router.replace(redirect)
    } else {
      loginError.value = result.message
    }
  } finally {
    isSubmitting.value = false
  }
}

onMounted(fetchPlayers)
</script>
