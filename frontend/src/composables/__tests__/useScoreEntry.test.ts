import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'

const mockGetActiveFn = vi.fn()
const mockScoresPostFn = vi.fn()
const mockCurrentPlayer = ref<{ playerId: string; name: string; isAdmin: boolean } | null>(null)

describe('useScoreEntry', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          events: {
            active: { $get: mockGetActiveFn },
          },
          scores: {
            $post: mockScoresPostFn,
          },
        },
      },
    }))
    vi.doMock('@/composables/useAuth', () => ({
      useAuth: () => ({
        currentPlayer: mockCurrentPlayer,
      }),
    }))

    mockGetActiveFn.mockReset()
    mockScoresPostFn.mockReset()
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Player1', isAdmin: false }

    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: null }),
    })
  })

  describe('isValid', () => {
    it('wins > matches のとき isValid = false', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, isValid } = useScoreEntry()

      matches.value = 3
      wins.value = 5

      expect(isValid.value).toBe(false)
    })

    it('wins <= matches のとき isValid = true', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, isValid } = useScoreEntry()

      matches.value = 5
      wins.value = 3

      expect(isValid.value).toBe(true)
    })

    it('wins === matches のとき isValid = true', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, isValid } = useScoreEntry()

      matches.value = 3
      wins.value = 3

      expect(isValid.value).toBe(true)
    })

    it('matches が null のとき isValid = false', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { wins, isValid } = useScoreEntry()

      wins.value = 3

      expect(isValid.value).toBe(false)
    })

    it('wins が null のとき isValid = false', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, isValid } = useScoreEntry()

      matches.value = 5

      expect(isValid.value).toBe(false)
    })

    it('matches が負数のとき isValid = false', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, isValid } = useScoreEntry()

      matches.value = -1
      wins.value = 0

      expect(isValid.value).toBe(false)
    })
  })

  describe('submitScore', () => {
    it('送信成功後に submitted = true となりフォームがロックされる', async () => {
      mockScoresPostFn.mockResolvedValue({
        ok: true,
        json: async () => ({ completedCount: 1, totalCount: 3 }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, submitted, submitScore } = useScoreEntry()

      matches.value = 5
      wins.value = 3

      await submitScore()

      expect(submitted.value).toBe(true)
      expect(mockScoresPostFn).toHaveBeenCalledWith({ json: { matches: 5, wins: 3 } })
    })

    it('API エラー時に error ref にメッセージがセットされ submitted = false のまま', async () => {
      mockScoresPostFn.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'PHASE_NOT_COLLECTING' }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, submitted, error, submitScore } = useScoreEntry()

      matches.value = 5
      wins.value = 3

      await submitScore()

      expect(submitted.value).toBe(false)
      expect(error.value).not.toBeNull()
    })

    it('ネットワークエラー時に error ref にメッセージがセットされる', async () => {
      mockScoresPostFn.mockRejectedValue(new Error('network error'))

      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, error, submitScore } = useScoreEntry()

      matches.value = 5
      wins.value = 3

      await submitScore()

      expect(error.value).not.toBeNull()
    })

    it('isValid = false のとき submitScore() は API を呼ばない', async () => {
      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, submitScore } = useScoreEntry()

      matches.value = 3
      wins.value = 5

      await submitScore()

      expect(mockScoresPostFn).not.toHaveBeenCalled()
    })

    it('送信中は isSubmitting = true になり完了後 false に戻る', async () => {
      let resolvePost!: (v: unknown) => void
      mockScoresPostFn.mockReturnValue(new Promise((r) => { resolvePost = r }))

      const { useScoreEntry } = await import('../useScoreEntry')
      const { matches, wins, isSubmitting, submitScore } = useScoreEntry()

      matches.value = 5
      wins.value = 3

      const promise = submitScore()
      expect(isSubmitting.value).toBe(true)

      resolvePost({ ok: true, json: async () => ({ completedCount: 1, totalCount: 3 }) })
      await promise

      expect(isSubmitting.value).toBe(false)
    })
  })

  describe('isAbsent', () => {
    it('absent=true プレイヤーのとき isAbsent = true に初期化される', async () => {
      mockGetActiveFn.mockResolvedValue({
        ok: true,
        json: async () => ({
          event: {
            id: 'event-1',
            phase: 'COLLECTING',
            heldAt: '2026-05-12T00:00:00.000Z',
            scores: [
              { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: true, submitted: false },
            ],
          },
        }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { isAbsent } = useScoreEntry()

      await flushPromises()

      expect(isAbsent.value).toBe(true)
    })

    it('absent=false プレイヤーのとき isAbsent = false のまま', async () => {
      mockGetActiveFn.mockResolvedValue({
        ok: true,
        json: async () => ({
          event: {
            id: 'event-1',
            phase: 'COLLECTING',
            heldAt: '2026-05-12T00:00:00.000Z',
            scores: [
              { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: false, submitted: false },
            ],
          },
        }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { isAbsent } = useScoreEntry()

      await flushPromises()

      expect(isAbsent.value).toBe(false)
    })

    it('currentPlayer が null のとき isAbsent = false のまま', async () => {
      mockCurrentPlayer.value = null

      const { useScoreEntry } = await import('../useScoreEntry')
      const { isAbsent } = useScoreEntry()

      await flushPromises()

      expect(isAbsent.value).toBe(false)
    })
  })

  describe('submitted の初期化（画面更新後の復元）', () => {
    it('submitted=true のスコアレコードがあるとき submitted = true に初期化される', async () => {
      mockGetActiveFn.mockResolvedValue({
        ok: true,
        json: async () => ({
          event: {
            id: 'event-1',
            phase: 'COLLECTING',
            heldAt: '2026-05-12T00:00:00.000Z',
            scores: [
              { playerId: 'p1', playerName: 'Player1', wins: 3, losses: 2, absent: false, submitted: true },
            ],
          },
        }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { submitted } = useScoreEntry()

      await flushPromises()

      expect(submitted.value).toBe(true)
    })

    it('submitted=false のスコアレコードがあるとき submitted = false のまま', async () => {
      mockGetActiveFn.mockResolvedValue({
        ok: true,
        json: async () => ({
          event: {
            id: 'event-1',
            phase: 'COLLECTING',
            heldAt: '2026-05-12T00:00:00.000Z',
            scores: [
              { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: false, submitted: false },
            ],
          },
        }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { submitted } = useScoreEntry()

      await flushPromises()

      expect(submitted.value).toBe(false)
    })

    it('スコアレコードが自プレイヤー以外のみのとき submitted = false のまま', async () => {
      mockGetActiveFn.mockResolvedValue({
        ok: true,
        json: async () => ({
          event: {
            id: 'event-1',
            phase: 'COLLECTING',
            heldAt: '2026-05-12T00:00:00.000Z',
            scores: [
              { playerId: 'p2', playerName: 'Other', wins: 5, losses: 1, absent: false, submitted: true },
            ],
          },
        }),
      })

      const { useScoreEntry } = await import('../useScoreEntry')
      const { submitted } = useScoreEntry()

      await flushPromises()

      expect(submitted.value).toBe(false)
    })
  })
})
