<template>
  <div v-if="isOpen" class="fixed bottom-20 right-2 z-50 w-52 rounded-lg border border-yellow-400 bg-[#12002b] p-3 text-xs shadow-lg">
    <div class="mb-2 flex items-center justify-between">
      <span class="font-bold text-yellow-400">DEV: なりすまし</span>
      <button class="text-gray-400 hover:text-white" @click="isOpen = false">✕</button>
    </div>
    <div v-if="currentPlayer" class="mb-2 truncate text-gray-400">
      現在: <span class="text-white">{{ currentPlayer.name }}</span>
    </div>
    <div v-if="loading" class="text-gray-400">読み込み中...</div>
    <ul v-else class="max-h-48 overflow-y-auto space-y-1">
      <li v-for="p in players" :key="p.id">
        <button
          class="w-full rounded px-2 py-1 text-left hover:bg-main disabled:opacity-40"
          :class="p.id === currentPlayer?.playerId ? 'text-yellow-400' : 'text-white'"
          :disabled="p.id === currentPlayer?.playerId"
          @click="impersonate(p.id)"
        >
          {{ p.name }}
        </button>
      </li>
    </ul>
    <div v-if="error" class="mt-1 text-red-400">{{ error }}</div>
  </div>
  <button
    v-else
    class="fixed bottom-20 right-2 z-50 rounded-full border border-yellow-400 bg-[#12002b] px-2 py-1 text-xs font-bold text-yellow-400 shadow-lg"
    @click="isOpen = true"
  >
    DEV
  </button>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

interface PlayerItem {
  id: string
  name: string
}

const { currentPlayer, restoreSession } = useAuth()
const isOpen = ref(false)

watch(currentPlayer, () => { isOpen.value = false })
const loading = ref(false)
const players = ref<PlayerItem[]>([])
const error = ref('')

async function fetchPlayers() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${BASE}/api/players`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as PlayerItem[]
      players.value = data.map((p) => ({ id: p.id, name: p.name }))
    }
  } catch {
    error.value = '取得失敗'
  } finally {
    loading.value = false
  }
}

async function impersonate(playerId: string) {
  error.value = ''
  try {
    const res = await fetch(`${BASE}/api/dev/impersonate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ playerId }),
    })
    if (!res.ok) {
      error.value = 'なりすまし失敗'
      return
    }
    await restoreSession()
  } catch {
    error.value = 'ネットワークエラー'
  }
}

onMounted(fetchPlayers)
</script>
