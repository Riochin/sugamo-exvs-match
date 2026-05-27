<template>
  <div class="pb-4 text-white">
    <PageHeader title="大会" @help="showHelp = true" />

    <HelpModal :visible="showHelp" title="大会の使い方" @close="showHelp = false">
      <div class="text-sm text-white/70 text-left space-y-2">
        <p>① 試合後に<span class="text-star font-semibold">スコア入力ボタン</span>で結果を登録します</p>
        <p>② <span class="text-star font-semibold">全員が入力を完了</span>したら管理者が次のフェーズへ進めます</p>
        <p>③ 下のリストから<span class="text-star font-semibold">過去の大会結果</span>をいつでも確認できます</p>
      </div>
    </HelpModal>

    <div class="px-4">
    <div v-if="isLoading" class="flex justify-center py-16">
      <LoadingSpinner label="大会情報を取得中..." />
    </div>

    <template v-else>
      <div v-if="collectingEvents.length === 0 && !ceremonyEvent" data-testid="no-event-message" class="text-center py-8 text-dark">
        <p class="text-base font-semibold">大会が開始されていません</p>
        <p class="text-sm mt-1">しばらくお待ちください</p>
      </div>

      <div class="space-y-4">
        <ActiveEventCard
          v-for="event in collectingEvents"
          :key="event.id"
          :event="event"
          @open-score-modal="openScoreModal(event)"
        />
      </div>

      <section v-if="pastEvents.length > 0" class="mt-6">
        <h2 class="text-sm font-bold mb-3 text-dark border-b border-dark pb-2">
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
        v-if="selectedEventForScore"
        :event="selectedEventForScore"
        :visible="true"
        :progress-update="progressUpdate"
        @close="closeScoreModal"
      />
    </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { client } from '@/api/client'
import { useEventStream } from '@/composables/useEventStream'
import type { EventWithScores } from '@/composables/useAdminEvent'
import ActiveEventCard from '@/components/event/ActiveEventCard.vue'
import PastEventModal from '@/components/event/PastEventModal.vue'
import ScoreEntryModal from '@/components/score/ScoreEntryModal.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import HelpModal from '@/components/ui/HelpModal.vue'

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
const showHelp = ref(false)
const { progressUpdate, resultReady, currentPhase, connect, disconnect } = useEventStream()

const isLoading = ref(true)
const activeEvents = ref<EventWithScores[]>([])
const pastEvents = ref<EventSummary[]>([])
const selectedEvent = ref<EventSummary | null>(null)
const selectedEventForScore = ref<EventWithScores | null>(null)

const collectingEvents = computed(() =>
  activeEvents.value.filter((e) => e.phase === 'COLLECTING'),
)

const ceremonyEvent = computed(() =>
  activeEvents.value.find((e) => e.phase === 'STAR_VOTING' || e.phase === 'REVEALING') ?? null,
)

function openScoreModal(event: EventWithScores): void {
  selectedEventForScore.value = event
  connect(event.id)
}

function closeScoreModal(): void {
  selectedEventForScore.value = null
  if (ceremonyEvent.value) {
    connect(ceremonyEvent.value.id)
  } else {
    disconnect()
  }
}

watch(resultReady, (ready) => {
  if (ready && ceremonyEvent.value) {
    router.replace(`/events/${ceremonyEvent.value.id}/result`)
  }
})

watch(currentPhase, (newPhase) => {
  const eventId = selectedEventForScore.value?.id ?? ceremonyEvent.value?.id
  if (newPhase !== 'COLLECTING') {
    selectedEventForScore.value = null
  }
  if (newPhase === 'STAR_VOTING' && eventId) {
    router.replace(`/events/${eventId}/star-voting`)
  }
  if (newPhase === 'REVEALING' && eventId) {
    router.replace(`/events/${eventId}/result`)
  }
})

onMounted(async () => {
  try {
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
      const events = (data as unknown as { events: EventWithScores[] }).events
      activeEvents.value = events

      const ceremony = events.find((e) => e.phase === 'STAR_VOTING' || e.phase === 'REVEALING')

      if (ceremony?.phase === 'STAR_VOTING') {
        router.replace(`/events/${ceremony.id}/star-voting`)
        return
      }

      if (ceremony?.phase === 'REVEALING') {
        router.replace(`/events/${ceremony.id}/result`)
        return
      }

      if (ceremony) {
        connect(ceremony.id)
      }
    }
  } finally {
    isLoading.value = false
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
