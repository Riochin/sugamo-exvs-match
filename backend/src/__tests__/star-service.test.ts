import { describe, it, expect, vi, beforeEach } from 'vitest'
import { starService } from '../services/star-service.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('StarService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { hub } = await import('../routes/stream.js')
    vi.mocked(hub.broadcast).mockResolvedValue(undefined)
  })

  describe('submitVote', () => {
    const baseAllocations = [
      { toPlayerId: 'p2', count: 2 },
      { toPlayerId: 'p3', count: 1 },
    ]

    it('アクティブな STAR_VOTING イベントがないとき NO_ACTIVE_VOTING_EVENT を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await starService.submitVote({ playerId: 'p1', allocations: baseAllocations })

      expect(result).toEqual({ code: 'NO_ACTIVE_VOTING_EVENT' })
    })

    it('フェーズが STAR_VOTING 以外のとき PHASE_NOT_STAR_VOTING を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'COLLECTING' }]),
        }),
      } as any)

      const result = await starService.submitVote({ playerId: 'p1', allocations: baseAllocations })

      expect(result).toEqual({ code: 'PHASE_NOT_STAR_VOTING', current: 'COLLECTING' })
    })

    it('自己投票が含まれるとき SELF_VOTE_FORBIDDEN を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
        }),
      } as any)

      const selfAllocations = [
        { toPlayerId: 'p1', count: 2 },
        { toPlayerId: 'p2', count: 1 },
      ]
      const result = await starService.submitVote({ playerId: 'p1', allocations: selfAllocations })

      expect(result).toEqual({ code: 'SELF_VOTE_FORBIDDEN' })
    })

    it('合計が 3 以外のとき INVALID_TOTAL を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
        }),
      } as any)

      const invalidAllocations = [
        { toPlayerId: 'p2', count: 1 },
        { toPlayerId: 'p3', count: 1 },
      ]
      const result = await starService.submitVote({ playerId: 'p1', allocations: invalidAllocations })

      expect(result).toEqual({ code: 'INVALID_TOTAL', actual: 2 })
    })

    it('二重投票のとき ALREADY_VOTED を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ starVotingSubmitted: true }]),
        }),
      } as any)

      const result = await starService.submitVote({ playerId: 'p1', allocations: baseAllocations })

      expect(result).toEqual({ code: 'ALREADY_VOTED' })
    })

    it('正常系: stars を INSERT し starVotingSubmitted を true に更新してカウントを返す', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
        }),
      } as any)
      // score record (not yet voted)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ starVotingSubmitted: false }]),
        }),
      } as any)

      let capturedTxFn: ((tx: any) => Promise<any>) | undefined
      vi.mocked(db.transaction).mockImplementationOnce(async (fn: (tx: any) => Promise<any>) => {
        capturedTxFn = fn
        const txMock = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return fn(txMock)
      })

      // completedCount select
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      } as any)
      // totalCount select
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      } as any)

      const result = await starService.submitVote({ playerId: 'p1', allocations: baseAllocations })

      expect(result).toEqual({ completedCount: 2, totalCount: 5 })
      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith(
        'ev1',
        'star_vote_update',
        { completedCount: 2, totalCount: 5 },
      )
      expect(capturedTxFn).toBeDefined()
    })

    it('全員投票完了時に events.phase を REVEALING に更新して phase_update をブロードキャストする', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ starVotingSubmitted: false }]),
        }),
      } as any)

      vi.mocked(db.transaction).mockImplementationOnce(async (fn: (tx: any) => Promise<any>) => {
        const txMock = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return fn(txMock)
      })

      // completed = total = 5 (all voted)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      } as any)

      // phase update mock
      const phaseWhereMock = vi.fn().mockResolvedValue(undefined)
      const phaseSetMock = vi.fn().mockReturnValue({ where: phaseWhereMock })
      vi.mocked(db.update).mockReturnValueOnce({ set: phaseSetMock } as any)

      const result = await starService.submitVote({ playerId: 'p1', allocations: baseAllocations })

      expect(result).toEqual({ completedCount: 5, totalCount: 5 })
      expect(phaseSetMock).toHaveBeenCalledWith({ phase: 'REVEALING' })
      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith(
        'ev1',
        'phase_update',
        { eventId: 'ev1', phase: 'REVEALING' },
      )
    })
  })

  describe('getVotingStatus', () => {
    it('アクティブな STAR_VOTING イベントがないとき NO_ACTIVE_VOTING_EVENT を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await starService.getVotingStatus({ playerId: 'p1', eventId: '' })

      expect(result).toEqual({ code: 'NO_ACTIVE_VOTING_EVENT' })
    })

    it('自己プレイヤーを除外したプレイヤー一覧と投票状態を返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
        }),
      } as any)
      // players excluding self
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { playerId: 'p2', playerName: 'Player2' },
              { playerId: 'p3', playerName: 'Player3' },
            ]),
          }),
        }),
      } as any)
      // completedCount
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any)
      // totalCount
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any)
      // hasVoted
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ starVotingSubmitted: false }]),
        }),
      } as any)

      const result = await starService.getVotingStatus({ playerId: 'p1', eventId: 'ev1' })

      expect(result).toEqual({
        completedCount: 1,
        totalCount: 3,
        hasVoted: false,
        players: [
          { playerId: 'p2', playerName: 'Player2' },
          { playerId: 'p3', playerName: 'Player3' },
        ],
      })
    })
  })

  describe('getResults', () => {
    it('イベントが存在しないとき EVENT_NOT_FOUND を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await starService.getResults({ eventId: 'ev1' })

      expect(result).toEqual({ code: 'EVENT_NOT_FOUND' })
    })

    it('Star 受取数降順のランキングを返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'REVEALING' }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { playerId: 'p2', playerName: 'Player2', starCount: '5' },
                  { playerId: 'p3', playerName: 'Player3', starCount: '3' },
                  { playerId: 'p1', playerName: 'Player1', starCount: '1' },
                ]),
              }),
            }),
          }),
        }),
      } as any)

      const result = await starService.getResults({ eventId: 'ev1' })

      expect(result).toEqual([
        { rank: 1, playerId: 'p2', playerName: 'Player2', starCount: 5 },
        { rank: 2, playerId: 'p3', playerName: 'Player3', starCount: 3 },
        { rank: 3, playerId: 'p1', playerName: 'Player1', starCount: 1 },
      ])
    })

    it('同数 Star のプレイヤーは同一 rank（DENSE_RANK）を返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'REVEALING' }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { playerId: 'p2', playerName: 'Player2', starCount: '5' },
                  { playerId: 'p3', playerName: 'Player3', starCount: '5' },
                  { playerId: 'p1', playerName: 'Player1', starCount: '2' },
                ]),
              }),
            }),
          }),
        }),
      } as any)

      const result = await starService.getResults({ eventId: 'ev1' })

      expect(result).toEqual([
        { rank: 1, playerId: 'p2', playerName: 'Player2', starCount: 5 },
        { rank: 1, playerId: 'p3', playerName: 'Player3', starCount: 5 },
        { rank: 2, playerId: 'p1', playerName: 'Player1', starCount: 2 },
      ])
    })

    it('Stars が集計されていないとき空配列を返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'REVEALING' }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any)

      const result = await starService.getResults({ eventId: 'ev1' })

      expect(result).toEqual([])
    })
  })
})
