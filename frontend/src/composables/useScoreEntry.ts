import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'
import { useAuth } from '@/composables/useAuth'

export interface UseScoreEntryReturn {
  matches: Ref<number | null>
  wins: Ref<number | null>
  isValid: Readonly<Ref<boolean>>
  isSubmitting: Readonly<Ref<boolean>>
  submitted: Readonly<Ref<boolean>>
  isAbsent: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  submitScore(): Promise<void>
}

export function useScoreEntry(): UseScoreEntryReturn {
  const { currentPlayer } = useAuth()

  const matches = ref<number | null>(null)
  const wins = ref<number | null>(null)
  const isSubmitting = ref(false)
  const submitted = ref(false)
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
        submitted.value = true
      }
    } catch {
      // isAbsent のデフォルトは false のまま
    }
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
        submitted.value = true
      } else {
        const data = await res.json()
        error.value = (data as { error?: string }).error ?? 'スコアの送信に失敗しました'
      }
    } catch {
      error.value = 'ネットワークエラーが発生しました'
    } finally {
      isSubmitting.value = false
    }
  }

  initAbsent()

  return {
    matches,
    wins,
    isValid: readonly(isValid),
    isSubmitting: readonly(isSubmitting),
    submitted: readonly(submitted),
    isAbsent: readonly(isAbsent),
    error: readonly(error),
    submitScore,
  }
}
