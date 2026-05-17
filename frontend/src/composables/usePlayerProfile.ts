import { ref, readonly, watchEffect } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'

type WinRateEntry =
  | {
      eventId: string
      heldAt: string
      winRate: number
      wins: number
      losses: number
      absent: false
    }
  | {
      eventId: string
      heldAt: string
      absent: true
    }

type PlayerProfileResponse = {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  iconUrl: string | null
  winRateHistory: readonly WinRateEntry[]
}

export interface UsePlayerProfileReturn {
  profile: Readonly<Ref<PlayerProfileResponse | null>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  notFound: Readonly<Ref<boolean>>
}

export function usePlayerProfile(playerId: Ref<string>): UsePlayerProfileReturn {
  const profile = ref<PlayerProfileResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)

  watchEffect(async () => {
    const id = playerId.value
    if (!id) return

    isLoading.value = true
    error.value = null
    notFound.value = false
    profile.value = null

    try {
      const res = await client.api.players[':id'].profile.$get({ param: { id } })
      if (res.status === 404) {
        notFound.value = true
        return
      }
      if (!res.ok) {
        error.value = 'データの取得に失敗しました'
        return
      }
      profile.value = (await res.json()) as unknown as PlayerProfileResponse
    } catch {
      error.value = 'ネットワークエラーが発生しました'
    } finally {
      isLoading.value = false
    }
  })

  return {
    profile: readonly(profile),
    isLoading: readonly(isLoading),
    error: readonly(error),
    notFound: readonly(notFound),
  }
}
