import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computePlayerResults, resultService } from '../services/result-service.js'

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

describe('computePlayerResults（純粋関数）', () => {
  describe('ランキング算出とグループ分類', () => {
    it('勝率降順・勝利数降順でランキングが算出され FIRST_STAY / SECOND_STAY / BORDER が正しく分類される', () => {
      // F=2, S=2 の標準ケース
      // rank 1: FIRST → FIRST_STAY
      // rank 2: SECOND → BORDER (PROMOTION)
      // rank 3: FIRST → BORDER (RELEGATION)
      // rank 4: SECOND → SECOND_STAY
      const rows = [
        { playerId: 'p3', playerName: 'C', team: 'FIRST' as const, wins: 1, losses: 3, absent: false },
        { playerId: 'p1', playerName: 'A', team: 'FIRST' as const, wins: 4, losses: 0, absent: false },
        { playerId: 'p4', playerName: 'D', team: 'SECOND' as const, wins: 0, losses: 4, absent: false },
        { playerId: 'p2', playerName: 'B', team: 'SECOND' as const, wins: 3, losses: 1, absent: false },
      ]

      const results = computePlayerResults(rows)
      const byId = Object.fromEntries(results.map((r) => [r.playerId, r]))

      expect(byId['p1'].rank).toBe(1)
      expect(byId['p1'].group).toBe('FIRST_STAY')
      expect(byId['p1'].borderDirection).toBeNull()

      expect(byId['p2'].rank).toBe(2)
      expect(byId['p2'].group).toBe('BORDER')
      expect(byId['p2'].borderDirection).toBe('PROMOTION')

      expect(byId['p3'].rank).toBe(3)
      expect(byId['p3'].group).toBe('BORDER')
      expect(byId['p3'].borderDirection).toBe('RELEGATION')

      expect(byId['p4'].rank).toBe(4)
      expect(byId['p4'].group).toBe('SECOND_STAY')
      expect(byId['p4'].borderDirection).toBeNull()
    })

    it('同勝率の場合は勝利数降順で二次ソートされる', () => {
      const rows = [
        { playerId: 'p1', playerName: 'A', team: 'FIRST' as const, wins: 2, losses: 2, absent: false },
        { playerId: 'p2', playerName: 'B', team: 'SECOND' as const, wins: 3, losses: 3, absent: false },
      ]

      const results = computePlayerResults(rows)
      const byId = Object.fromEntries(results.map((r) => [r.playerId, r]))

      // 同勝率(0.5)のとき wins が多い p2 が先
      expect(byId['p2'].rank).toBe(1)
      expect(byId['p1'].rank).toBe(2)
    })

    it('0勝0敗（試合なし）の場合は勝率 0.0 として扱われる', () => {
      const rows = [
        { playerId: 'p1', playerName: 'A', team: 'FIRST' as const, wins: 1, losses: 0, absent: false },
        { playerId: 'p2', playerName: 'B', team: 'SECOND' as const, wins: 0, losses: 0, absent: false },
      ]

      const results = computePlayerResults(rows)
      const byId = Object.fromEntries(results.map((r) => [r.playerId, r]))

      expect(byId['p1'].rank).toBe(1)
      expect(byId['p2'].rank).toBe(2)
    })

    it('欠席者は rank=null, group=null, borderDirection=null で返される', () => {
      const rows = [
        { playerId: 'p1', playerName: 'A', team: 'FIRST' as const, wins: 3, losses: 1, absent: false },
        { playerId: 'p2', playerName: 'B', team: 'SECOND' as const, wins: 0, losses: 0, absent: true },
      ]

      const results = computePlayerResults(rows)
      const byId = Object.fromEntries(results.map((r) => [r.playerId, r]))

      expect(byId['p1'].rank).toBe(1)
      expect(byId['p2'].rank).toBeNull()
      expect(byId['p2'].group).toBeNull()
      expect(byId['p2'].borderDirection).toBeNull()
    })

    it('F=0（FIRST チーム全員欠席）のとき出席プレイヤーは全員 group=null になる', () => {
      const rows = [
        { playerId: 'p1', playerName: 'A', team: 'FIRST' as const, wins: 0, losses: 0, absent: true },
        { playerId: 'p2', playerName: 'B', team: 'SECOND' as const, wins: 3, losses: 1, absent: false },
        { playerId: 'p3', playerName: 'C', team: 'SECOND' as const, wins: 2, losses: 2, absent: false },
      ]

      const results = computePlayerResults(rows)

      for (const r of results.filter((p) => !p.absent)) {
        expect(r.group).toBeNull()
        expect(r.borderDirection).toBeNull()
      }
    })

    it('S=0（SECOND チーム全員欠席）のとき出席プレイヤーは全員 group=null になる', () => {
      const rows = [
        { playerId: 'p1', playerName: 'A', team: 'FIRST' as const, wins: 3, losses: 1, absent: false },
        { playerId: 'p2', playerName: 'B', team: 'SECOND' as const, wins: 0, losses: 0, absent: true },
      ]

      const results = computePlayerResults(rows)

      for (const r of results.filter((p) => !p.absent)) {
        expect(r.group).toBeNull()
      }
    })
  })
})

describe('ResultService', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  describe('getRevealResult', () => {
    it('標準ケース: RevealResult に正しくソートされた PlayerResult[] が含まれる', async () => {
      const { db } = await import('../db/client.js')

      const event = { id: 'event-1', phase: 'REVEALING', revealPhase: 1, heldAt: new Date(), createdAt: new Date() }
      const scoreRows = [
        { playerId: 'p1', playerName: 'A', team: 'FIRST', wins: 4, losses: 0, absent: false },
        { playerId: 'p2', playerName: 'B', team: 'SECOND', wins: 3, losses: 1, absent: false },
        { playerId: 'p3', playerName: 'C', team: 'FIRST', wins: 1, losses: 3, absent: false },
        { playerId: 'p4', playerName: 'D', team: 'SECOND', wins: 0, losses: 4, absent: false },
      ]

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([event]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(scoreRows),
          }),
        }),
      } as any)

      const result = await resultService.getRevealResult('event-1')

      expect('code' in result).toBe(false)
      if (!('code' in result)) {
        expect(result.eventId).toBe('event-1')
        expect(result.revealPhase).toBe(1)
        expect(result.eventPhase).toBe('REVEALING')
        expect(result.players).toHaveLength(4)

        const byId = Object.fromEntries(result.players.map((p) => [p.playerId, p]))
        expect(byId['p1'].rank).toBe(1)
        expect(byId['p1'].group).toBe('FIRST_STAY')
        expect(byId['p2'].rank).toBe(2)
        expect(byId['p2'].group).toBe('BORDER')
        expect(byId['p2'].borderDirection).toBe('PROMOTION')
      }
    })

    it('存在しないイベントIDのとき EVENT_NOT_FOUND を返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await resultService.getRevealResult('nonexistent')

      expect(result).toEqual({ code: 'EVENT_NOT_FOUND' })
    })

    it('phase が DONE のとき正常な RevealResult を返す（6.3を満たす）', async () => {
      const { db } = await import('../db/client.js')

      const doneEvent = { id: 'event-1', phase: 'DONE', revealPhase: 3, heldAt: new Date(), createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([doneEvent]),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await resultService.getRevealResult('event-1')

      expect('code' in result).toBe(false)
      if (!('code' in result)) {
        expect(result.eventPhase).toBe('DONE')
        expect(result.revealPhase).toBe(3)
      }
    })
  })

  describe('advanceRevealPhase', () => {
    it('revealPhase が 0 → 1 にインクリメントされ { revealPhase: 1, eventPhase: "REVEALING" } を返す', async () => {
      const { db } = await import('../db/client.js')

      const event = { id: 'event-1', phase: 'REVEALING', revealPhase: 0, heldAt: new Date(), createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([event]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        }),
      } as any)

      const result = await resultService.advanceRevealPhase('event-1')

      expect(result).toEqual({ revealPhase: 1, eventPhase: 'REVEALING' })
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1)
    })

    it('revealPhase が 2 → 3 になったとき events.phase が DONE に更新され eventPhase: "DONE" を返す', async () => {
      const { db } = await import('../db/client.js')

      const event = { id: 'event-1', phase: 'REVEALING', revealPhase: 2, heldAt: new Date(), createdAt: new Date() }
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
      })

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([event]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValueOnce({ set: setMock } as any)

      const result = await resultService.advanceRevealPhase('event-1')

      expect(result).toEqual({ revealPhase: 3, eventPhase: 'DONE' })
      expect(setMock).toHaveBeenCalledWith({ revealPhase: 3, phase: 'DONE' })
    })

    it('events.phase が REVEALING でないとき PHASE_NOT_REVEALING を返す', async () => {
      const { db } = await import('../db/client.js')

      const collectingEvent = { id: 'event-1', phase: 'COLLECTING', revealPhase: 0, heldAt: new Date(), createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([collectingEvent]),
        }),
      } as any)

      const result = await resultService.advanceRevealPhase('event-1')

      expect(result).toEqual({ code: 'PHASE_NOT_REVEALING', current: 'COLLECTING' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('revealPhase が既に 3 のとき REVEAL_PHASE_MAXED を返す', async () => {
      const { db } = await import('../db/client.js')

      const maxedEvent = { id: 'event-1', phase: 'REVEALING', revealPhase: 3, heldAt: new Date(), createdAt: new Date() }

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([maxedEvent]),
        }),
      } as any)

      const result = await resultService.advanceRevealPhase('event-1')

      expect(result).toEqual({ code: 'REVEAL_PHASE_MAXED' })
      expect(vi.mocked(db.update)).not.toHaveBeenCalled()
    })

    it('存在しないイベントIDのとき EVENT_NOT_FOUND を返す', async () => {
      const { db } = await import('../db/client.js')

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await resultService.advanceRevealPhase('nonexistent')

      expect(result).toEqual({ code: 'EVENT_NOT_FOUND' })
    })
  })
})
