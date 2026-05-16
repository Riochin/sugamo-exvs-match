import { ref, readonly } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'

export interface ScoreEntry {
  playerId: string
  playerName: string
  wins: number
  losses: number
  absent: boolean
}

export type EventPhase = 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'

export interface EventWithScores {
  id: string
  name: string
  hasPromotionRelegation: boolean
  venue: string | null
  description: string | null
  phase: EventPhase
  heldAt: string
  scores: readonly ScoreEntry[]
}

export interface CreateEventParams {
  heldAt: Date
  name: string
  hasPromotionRelegation: boolean
  venue?: string
  description?: string
}

export interface UseAdminEventReturn {
  activeEvent: Readonly<Ref<EventWithScores | null>>
  isLoading: Readonly<Ref<boolean>>
  isInitialLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  createEvent(params: CreateEventParams): Promise<void>
  setAbsent(playerId: string, absent: boolean): Promise<void>
  advancePhase(): Promise<void>
  setPhase(phase: EventPhase): Promise<void>
  refresh(): Promise<void>
}

export function useAdminEvent(): UseAdminEventReturn {
  const activeEvent = ref<EventWithScores | null>(null)
  const isLoading = ref(false)
  const isInitialLoading = ref(true)
  const error = ref<string | null>(null)

  async function refresh(): Promise<void> {
    try {
      const res = await client.api.events.active.$get()
      if (res.ok) {
        const data = await res.json()
        activeEvent.value = data.event as EventWithScores | null
      }
    } catch {
      error.value = 'データの取得に失敗しました'
    } finally {
      isInitialLoading.value = false
    }
  }

  async function createEvent(params: CreateEventParams): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const res = await client.api.events.$post({
        json: {
          heldAt: params.heldAt.toISOString(),
          name: params.name,
          hasPromotionRelegation: params.hasPromotionRelegation,
          ...(params.venue ? { venue: params.venue } : {}),
          ...(params.description ? { description: params.description } : {}),
        },
      })
      if (!res.ok) {
        const data = await res.json()
        error.value = (data as { error: string }).error
        return
      }
      await refresh()
    } catch {
      error.value = '大会の作成に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  async function setAbsent(playerId: string, absent: boolean): Promise<void> {
    if (isLoading.value) return
    if (!activeEvent.value) return
    isLoading.value = true
    error.value = null
    try {
      const res = await client.api.events[':id'].absent[':playerId'].$patch({
        param: { id: activeEvent.value.id, playerId },
        json: { absent },
      })
      if (!res.ok) {
        const data = await res.json()
        error.value = (data as { error: string }).error
        return
      }
      await refresh()
    } catch {
      error.value = '欠席状態の更新に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  async function advancePhase(): Promise<void> {
    if (isLoading.value) return
    if (!activeEvent.value) return
    isLoading.value = true
    error.value = null
    try {
      const res = await client.api.events[':id'].phase.$patch({
        param: { id: activeEvent.value.id },
      })
      if (!res.ok) {
        const data = await res.json()
        error.value = (data as { error: string }).error
        return
      }
      await refresh()
    } catch {
      error.value = 'フェーズの更新に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  async function setPhase(phase: EventPhase): Promise<void> {
    if (isLoading.value) return
    if (!activeEvent.value) return
    isLoading.value = true
    error.value = null
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? ''
      const res = await fetch(`${base}/api/events/${activeEvent.value.id}/force-phase`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phase }),
      })
      if (!res.ok) {
        const data = await res.json()
        error.value = (data as { error: string }).error
        return
      }
      await refresh()
    } catch {
      error.value = 'フェーズの更新に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  refresh()

  return {
    activeEvent: readonly(activeEvent),
    isLoading: readonly(isLoading),
    isInitialLoading: readonly(isInitialLoading),
    error: readonly(error),
    createEvent,
    setAbsent,
    advancePhase,
    setPhase,
    refresh,
  }
}
