import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const mockStarsStatusGetFn = vi.fn()
const mockStarsPostFn = vi.fn()
const mockCurrentPlayer = { value: { playerId: 'p1', name: 'Player1', isAdmin: false } }

describe('useStarVoting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          stars: {
            status: { $get: mockStarsStatusGetFn },
            $post: mockStarsPostFn,
          },
        },
      },
    }))
    vi.doMock('@/composables/useAuth', () => ({
      useAuth: () => ({
        currentPlayer: mockCurrentPlayer,
      }),
    }))

    mockStarsStatusGetFn.mockReset()
    mockStarsPostFn.mockReset()

    mockStarsStatusGetFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        completedCount: 0,
        totalCount: 3,
        hasVoted: false,
        players: [
          { playerId: 'p2', playerName: 'Player2' },
          { playerId: 'p3', playerName: 'Player3' },
        ],
      }),
    })
  })

  describe('loadPlayers', () => {
    it('loadPlayers 後に players が取得される', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { players, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')

      expect(players.value).toHaveLength(2)
      expect(players.value[0]).toMatchObject({ playerId: 'p2', playerName: 'Player2', allocated: 0 })
    })

    it('hasVoted=true のとき submitted が true で初期化される', async () => {
      mockStarsStatusGetFn.mockResolvedValue({
        ok: true,
        json: async () => ({
          completedCount: 1,
          totalCount: 3,
          hasVoted: true,
          players: [{ playerId: 'p2', playerName: 'Player2' }],
        }),
      })

      const { useStarVoting } = await import('../useStarVoting')
      const { submitted, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')

      expect(submitted.value).toBe(true)
    })

    it('API エラー時に error がセットされる', async () => {
      mockStarsStatusGetFn.mockResolvedValue({ ok: false, json: async () => ({ error: 'NO_ACTIVE_VOTING_EVENT' }) })

      const { useStarVoting } = await import('../useStarVoting')
      const { error, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')

      expect(error.value).not.toBeNull()
    })
  })

  describe('increment', () => {
    it('increment で allocated が 1 増える', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { players, increment, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')

      expect(players.value.find((p) => p.playerId === 'p2')?.allocated).toBe(1)
    })

    it('remaining === 0 のとき increment は何もしない（合計 3 Stars を超えない）', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { players, increment, remaining, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      expect(remaining.value).toBe(0)

      increment('p3')

      expect(players.value.find((p) => p.playerId === 'p3')?.allocated).toBe(0)
    })

    it('1 人に 3 Stars 全ツッパが可能', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { players, increment, remaining, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      expect(players.value.find((p) => p.playerId === 'p2')?.allocated).toBe(3)
      expect(remaining.value).toBe(0)
    })
  })

  describe('decrement', () => {
    it('decrement で allocated が 1 減る', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { players, increment, decrement, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      decrement('p2')

      expect(players.value.find((p) => p.playerId === 'p2')?.allocated).toBe(0)
    })

    it('allocated === 0 のとき decrement は何もしない（マイナスにならない）', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { players, decrement, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      decrement('p2')

      expect(players.value.find((p) => p.playerId === 'p2')?.allocated).toBe(0)
    })
  })

  describe('remaining / isReadyToSubmit', () => {
    it('初期状態で remaining === 3', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { remaining, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')

      expect(remaining.value).toBe(3)
    })

    it('Stars を割り当てると remaining がリアルタイムに減る', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { remaining, increment, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p3')

      expect(remaining.value).toBe(1)
    })

    it('remaining > 0 のとき isReadyToSubmit === false', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { isReadyToSubmit, increment, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')

      expect(isReadyToSubmit.value).toBe(false)
    })

    it('remaining === 0 のとき isReadyToSubmit === true', async () => {
      const { useStarVoting } = await import('../useStarVoting')
      const { isReadyToSubmit, increment, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      expect(isReadyToSubmit.value).toBe(true)
    })
  })

  describe('submitVote', () => {
    it('送信成功後に submitted = true になる', async () => {
      mockStarsPostFn.mockResolvedValue({
        ok: true,
        json: async () => ({ completedCount: 1, totalCount: 3 }),
      })

      const { useStarVoting } = await import('../useStarVoting')
      const { submitted, increment, submitVote, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      await submitVote()

      expect(submitted.value).toBe(true)
    })

    it('POST リクエストに allocations が正しく含まれる', async () => {
      mockStarsPostFn.mockResolvedValue({
        ok: true,
        json: async () => ({ completedCount: 1, totalCount: 3 }),
      })

      const { useStarVoting } = await import('../useStarVoting')
      const { increment, submitVote, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p3')

      await submitVote()

      expect(mockStarsPostFn).toHaveBeenCalledWith({
        json: {
          allocations: expect.arrayContaining([
            { toPlayerId: 'p2', count: 2 },
            { toPlayerId: 'p3', count: 1 },
          ]),
        },
      })
    })

    it('API エラー時に error がセットされ submitted は false のまま', async () => {
      mockStarsPostFn.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'ALREADY_VOTED' }),
      })

      const { useStarVoting } = await import('../useStarVoting')
      const { submitted, error, increment, submitVote, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      await submitVote()

      expect(submitted.value).toBe(false)
      expect(error.value).not.toBeNull()
    })

    it('ネットワークエラー時に error がセットされ submitted は false のまま', async () => {
      mockStarsPostFn.mockRejectedValue(new Error('network error'))

      const { useStarVoting } = await import('../useStarVoting')
      const { submitted, error, increment, submitVote, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      await submitVote()

      expect(submitted.value).toBe(false)
      expect(error.value).not.toBeNull()
    })

    it('送信中は isSubmitting = true になり完了後 false に戻る', async () => {
      let resolvePost!: (v: unknown) => void
      mockStarsPostFn.mockReturnValue(new Promise((r) => { resolvePost = r }))

      const { useStarVoting } = await import('../useStarVoting')
      const { isSubmitting, increment, submitVote, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      const promise = submitVote()
      expect(isSubmitting.value).toBe(true)

      resolvePost({ ok: true, json: async () => ({ completedCount: 1, totalCount: 3 }) })
      await promise

      expect(isSubmitting.value).toBe(false)
    })

    it('allocated === 0 のプレイヤーは allocations に含まれない', async () => {
      mockStarsPostFn.mockResolvedValue({
        ok: true,
        json: async () => ({ completedCount: 1, totalCount: 3 }),
      })

      const { useStarVoting } = await import('../useStarVoting')
      const { increment, submitVote, loadPlayers } = useStarVoting()

      await loadPlayers('event-1')
      increment('p2')
      increment('p2')
      increment('p2')

      await submitVote()

      const callArg = mockStarsPostFn.mock.calls[0][0]
      const allocations = callArg.json.allocations
      expect(allocations.every((a: { count: number }) => a.count > 0)).toBe(true)
    })
  })
})
