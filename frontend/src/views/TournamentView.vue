<template>
  <div class="p-4 text-white">
    <div v-if="!activeEvent" data-testid="no-event-message" class="text-center py-8 text-gray-400">
      <p class="text-base">大会が開始されていません</p>
      <p class="text-sm mt-1">しばらくお待ちください</p>
    </div>

    <template v-else>
      <ScoreEntryPanel
        v-if="phase === 'COLLECTING'"
        :event-id="activeEvent.id"
        :progress-update="progressUpdate"
      />
      <div v-else class="text-center py-8 text-gray-400">
        <p class="text-base">現在スコアを受け付けていません</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { client } from '@/api/client'
import { useEventStream } from '@/composables/useEventStream'
import ScoreEntryPanel from '@/components/score/ScoreEntryPanel.vue'

interface ActiveEvent {
  id: string
  phase: 'COLLECTING' | 'REVEALING' | 'DONE'
  heldAt: string
  scores: unknown[]
}

const router = useRouter()
const { progressUpdate, resultReady, currentPhase, connect } = useEventStream()

const activeEvent = ref<ActiveEvent | null>(null)
const initialPhase = ref<'COLLECTING' | 'REVEALING' | 'DONE' | null>(null)

const phase = computed(() => currentPhase.value ?? initialPhase.value)

watch(resultReady, (ready) => {
  if (ready && activeEvent.value) {
    router.replace(`/events/${activeEvent.value.id}/result`)
  }
})

onMounted(async () => {
  try {
    const res = await client.api.events.active.$get()
    if (!res.ok) return
    const data = await res.json()
    const event = (data as { event: ActiveEvent | null }).event
    if (!event) return

    activeEvent.value = event
    initialPhase.value = event.phase
    connect(event.id)
  } catch {
    // activeEvent = null のまま待機メッセージを表示
  }
})
</script>
