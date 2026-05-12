import { ref, readonly, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'

type PlayerGroup = 'FIRST_STAY' | 'SECOND_STAY' | 'BORDER'
type BorderDirection = 'PROMOTION' | 'RELEGATION'

export interface PlayerResult {
  playerId: string
  playerName: string
  team: 'FIRST' | 'SECOND'
  wins: number
  losses: number
  absent: boolean
  rank: number | null
  group: PlayerGroup | null
  borderDirection: BorderDirection | null
}

export interface RevealResult {
  eventId: string
  revealPhase: number
  eventPhase: 'COLLECTING' | 'REVEALING' | 'DONE'
  players: PlayerResult[]
}

export interface UseResultRevealReturn {
  result: Readonly<Ref<RevealResult | null>>
  revealPhase: Readonly<Ref<number>>
  eventPhase: Readonly<Ref<'COLLECTING' | 'REVEALING' | 'DONE' | null>>
  isConnected: Readonly<Ref<boolean>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  initialize(eventId: string): Promise<void>
  advancePhase(): Promise<void>
  cleanup(): void
}

const MAX_RETRIES = 3

export function useResultReveal(): UseResultRevealReturn {
  const result = ref<RevealResult | null>(null)
  const revealPhase = ref(0)
  const eventPhase = ref<'COLLECTING' | 'REVEALING' | 'DONE' | null>(null)
  const isConnected = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let source: EventSource | null = null
  let currentEventId: string | null = null
  let retryCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchResult(eventId: string): Promise<void> {
    const res = await client.api.events[':id'].result.$get({ param: { id: eventId } })
    if (!res.ok) throw new Error('結果の取得に失敗しました')
    const data = (await res.json()) as RevealResult
    result.value = data
    if (data.eventPhase === 'DONE') {
      revealPhase.value = 3
    } else {
      revealPhase.value = data.revealPhase
    }
    eventPhase.value = data.eventPhase
  }

  function connectSSE(eventId: string): void {
    const es = new EventSource(`/api/stream/events/${eventId}`)
    source = es
    isConnected.value = true

    es.addEventListener('phase_update', (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as {
        eventId: string
        phase: 'COLLECTING' | 'REVEALING' | 'DONE'
        revealPhase?: number
      }
      eventPhase.value = payload.phase
      if (payload.phase === 'DONE') {
        revealPhase.value = 3
      } else if (payload.revealPhase !== undefined) {
        revealPhase.value = payload.revealPhase
      }
    })

    es.onerror = () => {
      if (source === es) source = null
      es.close()
      isConnected.value = false
      retryCount++

      if (retryCount > MAX_RETRIES) {
        error.value = 'ページをリロードしてください'
        return
      }

      const delay = Math.pow(2, retryCount - 1) * 1000
      retryTimer = setTimeout(async () => {
        retryTimer = null
        if (!currentEventId) return
        connectSSE(currentEventId)
        try {
          await fetchResult(currentEventId)
        } catch {
          // 再接続後のフェーズ同期失敗は無視する
        }
      }, delay)
    }
  }

  async function initialize(eventId: string): Promise<void> {
    currentEventId = eventId
    retryCount = 0
    error.value = null
    isLoading.value = true
    try {
      await fetchResult(eventId)
      connectSSE(eventId)
    } catch {
      error.value = '結果の取得に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  async function advancePhase(): Promise<void> {
    if (isLoading.value || !currentEventId) return
    isLoading.value = true
    error.value = null
    try {
      const res = await client.api.events[':id']['reveal-phase'].$patch({
        param: { id: currentEventId },
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        error.value = data.error ?? 'フェーズの進行に失敗しました'
      }
    } catch {
      error.value = 'フェーズの進行に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  function cleanup(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (source) {
      source.close()
      source = null
    }
    isConnected.value = false
  }

  onUnmounted(cleanup)

  return {
    result: readonly(result),
    revealPhase: readonly(revealPhase),
    eventPhase: readonly(eventPhase),
    isConnected: readonly(isConnected),
    isLoading: readonly(isLoading),
    error: readonly(error),
    initialize,
    advancePhase,
    cleanup,
  }
}
