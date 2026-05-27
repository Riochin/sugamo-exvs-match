import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import type { EventWithScores } from '@/composables/useAdminEvent'

export type ScoreEntryView = 'form' | 'confirming' | 'submitted'

export interface UseScoreEntryReturn {
  matches: Ref<number | null>
  wins: Ref<number | null>
  view: Readonly<Ref<ScoreEntryView>>
  isValid: Readonly<Ref<boolean>>
  isSubmitting: Readonly<Ref<boolean>>
  isAbsent: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  confirmScore(): void
  cancelConfirm(): void
  submitScore(): Promise<void>
  editScore(): void
}

export function useScoreEntry(event: EventWithScores): UseScoreEntryReturn {
  const { currentPlayer } = useAuth()

  const myScore = event.scores.find((s) => s.playerId === currentPlayer.value?.playerId)

  const matches = ref<number | null>(
    myScore?.submitted ? myScore.wins + myScore.losses : null,
  )
  const wins = ref<number | null>(myScore?.submitted ? myScore.wins : null)
  const view = ref<ScoreEntryView>(myScore?.submitted ? 'submitted' : 'form')
  const isSubmitting = ref(false)
  const isAbsent = ref(myScore?.absent ?? false)
  const error = ref<string | null>(null)

  const isValid = computed(() =>
    matches.value !== null &&
    wins.value !== null &&
    matches.value >= 0 &&
    wins.value >= 0 &&
    wins.value <= matches.value,
  )

  function confirmScore(): void {
    if (!isValid.value) return
    error.value = null
    view.value = 'confirming'
  }

  function cancelConfirm(): void {
    view.value = 'form'
  }

  async function submitScore(): Promise<void> {
    if (!isValid.value || isSubmitting.value) return
    isSubmitting.value = true
    error.value = null
    try {
      const res = await client.api.scores.$post({
        json: {
          eventId: event.id,
          matches: matches.value!,
          wins: wins.value!,
        } as unknown as { matches: number; wins: number },
      })
      if (res.ok) {
        view.value = 'submitted'
      } else {
        const data = await res.json()
        error.value = (data as { error?: string }).error ?? 'スコアの送信に失敗しました'
        view.value = 'form'
      }
    } catch {
      error.value = 'ネットワークエラーが発生しました'
      view.value = 'form'
    } finally {
      isSubmitting.value = false
    }
  }

  function editScore(): void {
    view.value = 'form'
  }

  return {
    matches,
    wins,
    view: readonly(view),
    isValid: readonly(isValid),
    isSubmitting: readonly(isSubmitting),
    isAbsent: readonly(isAbsent),
    error: readonly(error),
    confirmScore,
    cancelConfirm,
    submitScore,
    editScore,
  }
}
