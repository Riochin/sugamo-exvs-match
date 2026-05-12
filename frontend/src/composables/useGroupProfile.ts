import { ref, readonly } from 'vue'
import type { Ref } from 'vue'
import { client } from '@/api/client'

type PlayerListItem = {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  createdAt: string
}

export interface UseGroupProfileReturn {
  firstTeam: Readonly<Ref<PlayerListItem[]>>
  secondTeam: Readonly<Ref<PlayerListItem[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  refresh(): Promise<void>
}

export function useGroupProfile(): UseGroupProfileReturn {
  const firstTeam = ref<PlayerListItem[]>([])
  const secondTeam = ref<PlayerListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function refresh(): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const res = await client.api.players.$get()
      if (!res.ok) {
        error.value = 'データの取得に失敗しました'
        return
      }
      const data = (await res.json()) as PlayerListItem[]
      firstTeam.value = data.filter((p) => p.team === 'FIRST')
      secondTeam.value = data.filter((p) => p.team === 'SECOND')
    } catch {
      error.value = 'ネットワークエラーが発生しました'
    } finally {
      isLoading.value = false
    }
  }

  refresh()

  return {
    firstTeam: readonly(firstTeam),
    secondTeam: readonly(secondTeam),
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
  }
}
