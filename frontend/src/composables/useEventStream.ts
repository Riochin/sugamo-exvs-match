import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export interface ProgressUpdatePayload {
  completedCount: number
  totalCount: number
}

export interface PhaseUpdatePayload {
  eventId: string
  phase: 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'
  revealPhase?: number
}

export interface StarVoteUpdatePayload {
  completedCount: number
  totalCount: number
}

export interface UseEventStreamReturn {
  progressUpdate: Readonly<Ref<ProgressUpdatePayload | null>>
  resultReady: Readonly<Ref<boolean>>
  currentPhase: Readonly<Ref<PhaseUpdatePayload['phase'] | null>>
  latestPhaseUpdate: Readonly<Ref<PhaseUpdatePayload | null>>
  starVoteUpdate: Readonly<Ref<StarVoteUpdatePayload | null>>
  isConnected: Readonly<Ref<boolean>>
  connect(eventId: string): void
  disconnect(): void
}

export function useEventStream(): UseEventStreamReturn {
  const progressUpdate = ref<ProgressUpdatePayload | null>(null)
  const resultReady = ref(false)
  const currentPhase = ref<PhaseUpdatePayload['phase'] | null>(null)
  const latestPhaseUpdate = ref<PhaseUpdatePayload | null>(null)
  const starVoteUpdate = ref<StarVoteUpdatePayload | null>(null)
  const isConnected = ref(false)

  let source: EventSource | null = null

  function connect(eventId: string): void {
    disconnect()

    source = new EventSource(`/api/stream/events/${eventId}`)
    isConnected.value = true

    source.addEventListener('progress_update', (e: MessageEvent) => {
      progressUpdate.value = JSON.parse(e.data) as ProgressUpdatePayload
    })

    source.addEventListener('result_ready', () => {
      resultReady.value = true
    })

    source.addEventListener('phase_update', (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as PhaseUpdatePayload
      currentPhase.value = payload.phase
      latestPhaseUpdate.value = payload
    })

    source.addEventListener('star_vote_update', (e: MessageEvent) => {
      starVoteUpdate.value = JSON.parse(e.data) as StarVoteUpdatePayload
    })
  }

  function disconnect(): void {
    if (source) {
      source.close()
      source = null
      isConnected.value = false
    }
  }

  onUnmounted(disconnect)

  return {
    progressUpdate,
    resultReady,
    currentPhase,
    latestPhaseUpdate,
    starVoteUpdate,
    isConnected,
    connect,
    disconnect,
  }
}
