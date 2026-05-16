import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'
import { useAuth } from '@/composables/useAuth'

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

export function useScoreEntry(): UseScoreEntryReturn {
  const { currentPlayer } = useAuth()

  const matches = ref<number | null>(null)
  const wins = ref<number | null>(null)
  const view = ref<ScoreEntryView>('form')
  const isSubmitting = ref(false)
  const isAbsent = ref(false)
  const error = ref<string | null>(null)

  const isValid = computed(() =>
    matches.value !== null &&
    wins.value !== null &&
    matches.value >= 0 &&
    wins.value >= 0 &&
    wins.value <= matches.value,
  )

  async function initAbsent(): Promise<void> {
    try {
      const res = await client.api.events.active.$get()
      if (!res.ok) return
      const data = await res.json()
      const event = (data as { event: { scores: { playerId: string; absent: boolean; submitted: boolean }[] } | null }).event
      if (!event || !currentPlayer.value) return
      const scoreRecord = event.scores.find((s) => s.playerId === currentPlayer.value!.playerId)
      isAbsent.value = scoreRecord?.absent ?? false
      if (scoreRecord?.submitted) {
        view.value = 'submitted'
        const rec = scoreRecord as { wins: number; losses: number; submitted: boolean; absent: boolean; playerId: string }
        wins.value = rec.wins
        matches.value = rec.wins + rec.losses
      }
    } catch {
      // isAbsent のデフォルトは false のまま
    }
  }

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
          matches: matches.value!,
          wins: wins.value!,
        },
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

  initAbsent()

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
