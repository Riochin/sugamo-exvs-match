<template>
  <div class="p-4 text-white">
    <div v-if="!activeEvent" data-testid="no-event-message" class="text-center py-8 text-gray-400">
      <p class="text-base">大会が開始されていません</p>
      <p class="text-sm mt-1">しばらくお待ちください</p>
    </div>

    <template v-else>
      <ActiveEventCard :event="activeEvent" @open-score-modal="isScoreModalOpen = true" />
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
          <div class="flex flex-col gap-0.5">
            <span class="text-white font-medium text-sm">{{ event.name }}</span>
            <span class="text-gray-400 text-xs">{{ formatDate(event.heldAt) }}</span>
          </div>
          <span class="text-gray-400 text-sm">›</span>
        </li>
      </ul>
    </section>

    <PastEventModal
      v-if="selectedEvent"
      :event-id="selectedEvent.id"
      :held-at="selectedEvent.heldAt"
      :name="selectedEvent.name"
      :venue="selectedEvent.venue"
      :description="selectedEvent.description"
      :has-promotion-relegation="selectedEvent.hasPromotionRelegation"
      :visible="true"
      @close="selectedEvent = null"
    />

    <ScoreEntryModal
      v-if="activeEvent && phase === 'COLLECTING'"
      :event-id="activeEvent.id"
      :visible="isScoreModalOpen"
      :progress-update="progressUpdate"
      @close="isScoreModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { client } from '@/api/client'
import { useEventStream } from '@/composables/useEventStream'
import ActiveEventCard from '@/components/event/ActiveEventCard.vue'
import PastEventModal from '@/components/event/PastEventModal.vue'
import ScoreEntryModal from '@/components/score/ScoreEntryModal.vue'

interface ActiveEvent {
  id: string
  phase: 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'
  heldAt: string
  name: string
  hasPromotionRelegation: boolean
  venue: string | null
  description: string | null
  scores: unknown[]
}

interface EventSummary {
  id: string
  phase: 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'
  heldAt: string
  name: string
  hasPromotionRelegation: boolean
  venue: string | null
  description: string | null
}

const router = useRouter()
const { progressUpdate, resultReady, currentPhase, connect } = useEventStream()

const activeEvent = ref<ActiveEvent | null>(null)
const initialPhase = ref<'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE' | null>(null)
const pastEvents = ref<EventSummary[]>([])
const selectedEvent = ref<EventSummary | null>(null)
const isScoreModalOpen = ref(false)

const phase = computed(() => currentPhase.value ?? initialPhase.value)

watch(resultReady, (ready) => {
  if (ready && activeEvent.value) {
    router.replace(`/events/${activeEvent.value.id}/result`)
  }
})

watch(currentPhase, (newPhase) => {
  if (newPhase !== 'COLLECTING') {
    isScoreModalOpen.value = false
  }
  if (newPhase === 'STAR_VOTING' && activeEvent.value) {
    router.replace(`/events/${activeEvent.value.id}/star-voting`)
  }
  if (newPhase === 'REVEALING' && activeEvent.value) {
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
