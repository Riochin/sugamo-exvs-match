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

    <section v-if="pastEvents.length > 0" class="mt-6">
      <h2 class="text-sm font-bold mb-3 text-gray-400 border-b border-gray-700 pb-2">
        開催済みの大会
      </h2>
      <ul class="space-y-2">
        <li
          v-for="event in pastEvents"
          :key="event.id"
          class="flex items-center justify-between p-3 bg-dark border border-main rounded-lg cursor-pointer active:opacity-60"
          @click="selectedEvent = event"
        >
          <span class="text-white">{{ formatDate(event.heldAt) }}</span>
          <span class="text-gray-400 text-sm">›</span>
        </li>
      </ul>
    </section>

    <PastEventModal
      v-if="selectedEvent"
      :event-id="selectedEvent.id"
      :held-at="selectedEvent.heldAt"
      :visible="true"
      @close="selectedEvent = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { client } from '@/api/client'
import { useEventStream } from '@/composables/useEventStream'
import ScoreEntryPanel from '@/components/score/ScoreEntryPanel.vue'
import PastEventModal from '@/components/event/PastEventModal.vue'

interface ActiveEvent {
  id: string
  phase: 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'
  heldAt: string
  scores: unknown[]
}

interface EventSummary {
  id: string
  phase: 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'
  heldAt: string
}

const router = useRouter()
const { progressUpdate, resultReady, currentPhase, connect } = useEventStream()

const activeEvent = ref<ActiveEvent | null>(null)
const initialPhase = ref<'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE' | null>(null)
const pastEvents = ref<EventSummary[]>([])
const selectedEvent = ref<EventSummary | null>(null)

const phase = computed(() => currentPhase.value ?? initialPhase.value)

watch(resultReady, (ready) => {
  if (ready && activeEvent.value) {
    router.replace(`/events/${activeEvent.value.id}/result`)
  }
})

watch(currentPhase, (phase) => {
  if (phase === 'STAR_VOTING' && activeEvent.value) {
    router.replace(`/events/${activeEvent.value.id}/star-voting`)
  }
  if (phase === 'REVEALING' && activeEvent.value) {
    router.replace(`/events/${activeEvent.value.id}/result`)
  }
})

onMounted(async () => {
  const [activeRes, pastRes] = await Promise.allSettled([
    client.api.events.active.$get(),
    client.api.events.$get(),
  ])

  if (pastRes.status === 'fulfilled' && pastRes.value.ok) {
    const data = await pastRes.value.json()
    pastEvents.value = data as EventSummary[]
  }

  if (activeRes.status === 'fulfilled' && activeRes.value.ok) {
    const data = await activeRes.value.json()
    const event = (data as { event: ActiveEvent | null }).event
    if (!event) return

    activeEvent.value = event
    initialPhase.value = event.phase

    if (event.phase === 'STAR_VOTING') {
      router.replace(`/events/${event.id}/star-voting`)
      return
    }

    if (event.phase === 'REVEALING') {
      router.replace(`/events/${event.id}/result`)
      return
    }

    connect(event.id)
  }
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd}(${days[d.getDay()]})`
}
</script>
