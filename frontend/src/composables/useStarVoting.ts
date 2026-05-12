import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'

export interface PlayerEntry {
  playerId: string
  playerName: string
  allocated: number
}

export interface UseStarVotingReturn {
  players: Readonly<Ref<PlayerEntry[]>>
  remaining: Readonly<Ref<number>>
  isReadyToSubmit: Readonly<Ref<boolean>>
  isSubmitting: Readonly<Ref<boolean>>
  submitted: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  phaseNotVoting: Readonly<Ref<boolean>>
  increment(playerId: string): void
  decrement(playerId: string): void
  submitVote(): Promise<void>
  loadPlayers(eventId: string): Promise<void>
}

export function useStarVoting(): UseStarVotingReturn {
  const players = ref<PlayerEntry[]>([])
  const isSubmitting = ref(false)
  const submitted = ref(false)
  const error = ref<string | null>(null)
  const phaseNotVoting = ref(false)

  const remaining = computed(() => {
    const total = players.value.reduce((sum, p) => sum + p.allocated, 0)
    return 3 - total
  })

  const isReadyToSubmit = computed(() => remaining.value === 0)

  async function loadPlayers(eventId: string): Promise<void> {
    error.value = null
    phaseNotVoting.value = false
    try {
      const res = await client.api.stars.status.$get()
      if (!res.ok) {
        if (res.status === 404) {
          phaseNotVoting.value = true
        } else {
          error.value = 'プレイヤー一覧の取得に失敗しました'
        }
        return
      }
      const data = await res.json()
      players.value = data.players.map((p) => ({ ...p, allocated: 0 }))
      if (data.hasVoted) {
        submitted.value = true
      }
    } catch {
      error.value = 'ネットワークエラーが発生しました'
    }
  }

  function increment(playerId: string): void {
    if (remaining.value === 0) return
    const player = players.value.find((p) => p.playerId === playerId)
    if (player) {
      player.allocated++
    }
  }

  function decrement(playerId: string): void {
    const player = players.value.find((p) => p.playerId === playerId)
    if (player && player.allocated > 0) {
      player.allocated--
    }
  }

  async function submitVote(): Promise<void> {
    if (isSubmitting.value) return
    isSubmitting.value = true
    error.value = null
    try {
      const allocations = players.value
        .filter((p) => p.allocated > 0)
        .map((p) => ({ toPlayerId: p.playerId, count: p.allocated }))

      const res = await client.api.stars.$post({ json: { allocations } })
      if (res.ok) {
        submitted.value = true
      } else {
        const data = await res.json()
        error.value = (data as { error?: string }).error ?? '投票の送信に失敗しました'
      }
    } catch {
      error.value = 'ネットワークエラーが発生しました。もう一度お試しください'
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    players: readonly(players) as Readonly<Ref<PlayerEntry[]>>,
    remaining: readonly(remaining),
    isReadyToSubmit: readonly(isReadyToSubmit),
    isSubmitting: readonly(isSubmitting),
    submitted: readonly(submitted),
    error: readonly(error),
    phaseNotVoting: readonly(phaseNotVoting),
    increment,
    decrement,
    submitVote,
    loadPlayers,
  }
}
