import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scoreService } from '../services/score-service.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('ScoreService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { hub } = await import('../routes/stream.js')
    vi.mocked(hub.broadcast).mockResolvedValue(undefined)
  })

  describe('submitScore', () => {
    it('イベントが存在しないとき EVENT_NOT_FOUND を返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await scoreService.submitScore({ eventId: 'event-1', playerId: 'p1', matches: 5, wins: 3 })

      expect(result).toEqual({ code: 'EVENT_NOT_FOUND' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('フェーズが COLLECTING 以外のとき PHASE_NOT_COLLECTING を返す', async () => {
      const { db } = await import('../db/client.js')
      const revealingEvent = { id: 'event-1', heldAt: new Date(), phase: 'REVEALING', createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([revealingEvent]),
        }),
      } as any)

      const result = await scoreService.submitScore({ eventId: 'event-1', playerId: 'p1', matches: 5, wins: 3 })

      expect(result).toEqual({ code: 'PHASE_NOT_COLLECTING', current: 'REVEALING' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('absent=true のプレイヤーが PLAYER_ABSENT を返す', async () => {
      const { db } = await import('../db/client.js')
      const collectingEvent = { id: 'event-1', heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }
      const absentScore = { id: 's1', eventId: 'event-1', playerId: 'p1', wins: 0, losses: 0, absent: true, submitted: false }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([absentScore]),
        }),
      } as any)

      const result = await scoreService.submitScore({ eventId: 'event-1', playerId: 'p1', matches: 5, wins: 3 })

      expect(result).toEqual({ code: 'PLAYER_ABSENT' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('losses = matches - wins が正しく計算されて DB に保存される', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')
      const collectingEvent = { id: 'event-1', heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }
      const scoreRecord = { id: 's1', eventId: 'event-1', playerId: 'p1', wins: 0, losses: 0, absent: false, submitted: false }

      // 1st select: event by id
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      // 2nd select: score record
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([scoreRecord]),
        }),
      } as any)
      // update
      const whereMock = vi.fn().mockResolvedValue({ rowsAffected: 1 })
      const setMock = vi.fn().mockReturnValue({ where: whereMock })
      vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as any)
      // 3rd select: completed count
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any)
      // 4th select: total count
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any)

      const result = await scoreService.submitScore({ eventId: 'event-1', playerId: 'p1', matches: 5, wins: 3 })

      expect('code' in result).toBe(false)
      expect(setMock).toHaveBeenCalledWith({ wins: 3, losses: 2, submitted: true })
      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith('event-1', 'progress_update', { completedCount: 1, totalCount: 3 })
    })

    it('全員完了時に allCompleted=true を返し phase_update はブロードキャストしない', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')
      const collectingEvent = { id: 'event-1', heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }
      const scoreRecord = { id: 's3', eventId: 'event-1', playerId: 'p3', wins: 0, losses: 0, absent: false, submitted: false }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([scoreRecord]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({ rowsAffected: 1 }) }),
      } as any)
      // completed = total = 3
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any)

      const result = await scoreService.submitScore({ eventId: 'event-1', playerId: 'p3', matches: 4, wins: 2 })

      expect('code' in result).toBe(false)
      if (!('code' in result)) {
        expect(result.allCompleted).toBe(true)
      }
      // progress_update のみ、phase_update は呼ばれない
      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith('event-1', 'progress_update', { completedCount: 3, totalCount: 3 })
      expect(vi.mocked(hub.broadcast)).not.toHaveBeenCalledWith('event-1', 'phase_update', expect.anything())
      // フェーズ変更の DB 更新も起きない
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1)
    })

    it('一部未完了時は phase_update が呼ばれない', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')
      const collectingEvent = { id: 'event-1', heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }
      const scoreRecord = { id: 's1', eventId: 'event-1', playerId: 'p1', wins: 0, losses: 0, absent: false, submitted: false }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([scoreRecord]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        }),
      } as any)
      // completed = 1, total = 3
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any)

      await scoreService.submitScore({ eventId: 'event-1', playerId: 'p1', matches: 5, wins: 3 })

      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(hub.broadcast)).not.toHaveBeenCalledWith('event-1', 'phase_update', expect.anything())
    })
  })
})
