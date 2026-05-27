import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventService } from '../services/event-service.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('EventService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { hub } = await import('../routes/stream.js')
    vi.mocked(hub.broadcast).mockResolvedValue(undefined)
  })

  describe('createEvent', () => {
    it('進行中大会なし → events + scores レコードが正しく作成される', async () => {
      const { db } = await import('../db/client.js')

      const mockPlayers = [
        { id: 'p1', name: 'プレイヤー1', pinHash: 'h1', team: 'FIRST', title: null, mainUnit: null, createdAt: new Date(), isAdmin: false },
        { id: 'p2', name: 'プレイヤー2', pinHash: 'h2', team: 'SECOND', title: null, mainUnit: null, createdAt: new Date(), isAdmin: false },
      ]
      const heldAt = new Date('2026-06-01T10:00:00.000Z')
      const newEvent = { id: 'event-1', name: 'テスト大会', hasPromotionRelegation: false, venue: null, description: null, heldAt, phase: 'COLLECTING', createdAt: new Date() }

      // 1st select: check active events → []
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)
      // 2nd select: get all players
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue(mockPlayers),
      } as any)
      // 1st insert: events
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newEvent]),
        }),
      } as any)
      // 2nd insert: scores
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockResolvedValue({ rowsAffected: 2 }),
      } as any)

      const result = await eventService.createEvent({ heldAt, name: 'テスト大会', hasPromotionRelegation: false })

      expect('code' in result).toBe(false)
      if (!('code' in result)) {
        expect(result.id).toBe('event-1')
        expect(result.phase).toBe('COLLECTING')
        expect(result.scores).toHaveLength(2)
        expect(result.scores[0].playerId).toBe('p1')
        expect(result.scores[0].wins).toBe(0)
        expect(result.scores[0].absent).toBe(false)
      }
      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(2)
    })

    it('STAR_VOTING 大会あり → ACTIVE_EVENT_EXISTS エラーを返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'existing-event' }]),
        }),
      } as any)

      const result = await eventService.createEvent({ heldAt: new Date(), name: 'テスト大会', hasPromotionRelegation: false })

      expect(result).toEqual({ code: 'ACTIVE_EVENT_EXISTS' })
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled()
    })

    it('COLLECTING 大会のみ存在する → 新規大会を作成できる', async () => {
      const { db } = await import('../db/client.js')

      const heldAt = new Date('2026-06-01T10:00:00.000Z')
      const newEvent = { id: 'event-2', name: '新規大会', hasPromotionRelegation: false, venue: null, description: null, heldAt, phase: 'COLLECTING', createdAt: new Date() }

      // 1st select: check STAR_VOTING/REVEALING → []（COLLECTINGはブロックしない）
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)
      // 2nd select: get all players
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      } as any)
      // insert event
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newEvent]),
        }),
      } as any)

      const result = await eventService.createEvent({ heldAt, name: '新規大会', hasPromotionRelegation: false })

      expect('code' in result).toBe(false)
      if (!('code' in result)) {
        expect(result.id).toBe('event-2')
      }
    })
  })

  describe('advancePhase', () => {
    it('COLLECTING → STAR_VOTING: DB 更新と hub.broadcast が呼ばれる', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')

      const eventId = 'event-1'
      const collectingEvent = { id: eventId, heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }

      // 1st select: get the event
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      // 2nd select: ceremony check → no ceremony in progress
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        }),
      } as any)

      const result = await eventService.advancePhase({ eventId })

      expect(result).toEqual({ phase: 'STAR_VOTING' })
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith(eventId, 'phase_update', { eventId, phase: 'STAR_VOTING' })
    })

    it('COLLECTING → STAR_VOTING: 別の STAR_VOTING 大会が存在するとき CEREMONY_IN_PROGRESS を返す', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')

      const eventId = 'event-1'
      const collectingEvent = { id: eventId, heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }

      // 1st select: get the event
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      // 2nd select: ceremony check → another STAR_VOTING event exists
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'event-2' }]),
        }),
      } as any)

      const result = await eventService.advancePhase({ eventId })

      expect(result).toEqual({ code: 'CEREMONY_IN_PROGRESS' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
      expect(vi.mocked(hub.broadcast)).not.toHaveBeenCalled()
    })

    it('DONE から遷移要求 → INVALID_PHASE_TRANSITION エラーを返す', async () => {
      const { db } = await import('../db/client.js')
      const { hub } = await import('../routes/stream.js')

      const eventId = 'event-1'
      const doneEvent = { id: eventId, heldAt: new Date(), phase: 'DONE', createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([doneEvent]),
        }),
      } as any)

      const result = await eventService.advancePhase({ eventId })

      expect(result).toEqual({ code: 'INVALID_PHASE_TRANSITION', current: 'DONE' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
      expect(vi.mocked(hub.broadcast)).not.toHaveBeenCalled()
    })
  })

  describe('setAbsent', () => {
    it('COLLECTING フェーズ中 → scores.absent が更新される', async () => {
      const { db } = await import('../db/client.js')

      const eventId = 'event-1'
      const playerId = 'p1'
      const collectingEvent = { id: eventId, heldAt: new Date(), phase: 'COLLECTING', createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        }),
      } as any)

      const result = await eventService.setAbsent({ eventId, playerId, absent: true })

      expect(result).toBeUndefined()
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1)
    })

    it('COLLECTING 以外のフェーズ → PHASE_NOT_COLLECTING エラーを返す', async () => {
      const { db } = await import('../db/client.js')

      const eventId = 'event-1'
      const revealingEvent = { id: eventId, heldAt: new Date(), phase: 'REVEALING', createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([revealingEvent]),
        }),
      } as any)

      const result = await eventService.setAbsent({ eventId, playerId: 'p1', absent: true })

      expect(result).toEqual({ code: 'PHASE_NOT_COLLECTING', current: 'REVEALING' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })
  })
})
