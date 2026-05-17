import { describe, it, expect, vi, beforeEach } from 'vitest'
import { profileService } from '../services/profile-service.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

const basePlayer = {
  id: 'p1',
  name: 'Alice',
  team: 'FIRST' as const,
  title: '称号A',
  mainUnit: '機体X',
}

function makeScoreRow(overrides: Partial<{
  eventId: string
  heldAt: Date
  name: string
  venue: string | null
  description: string | null
  hasPromotionRelegation: boolean
  wins: number
  losses: number
  absent: boolean
}> = {}) {
  return {
    eventId: 'e1',
    heldAt: new Date('2026-01-01T00:00:00.000Z'),
    name: '大会1',
    venue: null,
    description: null,
    hasPromotionRelegation: false,
    wins: 3,
    losses: 2,
    absent: false,
    ...overrides,
  }
}

function mockPlayerQuery(playerResult: typeof basePlayer | null) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(playerResult ? [playerResult] : []),
    }),
  }
}

function mockScoresQuery(scoreRows: ReturnType<typeof makeScoreRow>[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(scoreRows),
          }),
        }),
      }),
    }),
  }
}

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProfile', () => {
    it('存在するIDで submitted=true のスコア5件があるとき winRateHistory が5件返る', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select)
        .mockReturnValueOnce(mockPlayerQuery(basePlayer) as any)
        .mockReturnValueOnce(
          mockScoresQuery(
            Array.from({ length: 5 }, (_, i) =>
              makeScoreRow({ eventId: `e${i + 1}`, wins: 3, losses: 2 })
            )
          ) as any
        )

      const result = await profileService.getProfile('p1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('p1')
      expect(result!.name).toBe('Alice')
      expect(result!.winRateHistory).toHaveLength(5)
      expect(result!.winRateHistory[0]).toMatchObject({
        absent: false,
        winRate: 60.0,
        wins: 3,
        losses: 2,
      })
    })

    it('absent=true のエントリが混在するとき該当エントリが { absent: true } で返る', async () => {
      const { db } = await import('../db/client.js')
      const heldAt = new Date('2026-02-01T00:00:00.000Z')
      vi.mocked(db.select)
        .mockReturnValueOnce(mockPlayerQuery(basePlayer) as any)
        .mockReturnValueOnce(
          mockScoresQuery([
            makeScoreRow({ eventId: 'e1', wins: 3, losses: 2, absent: false }),
            makeScoreRow({ eventId: 'e2', heldAt, wins: 0, losses: 0, absent: true }),
          ]) as any
        )

      const result = await profileService.getProfile('p1')

      expect(result!.winRateHistory).toHaveLength(2)
      const absentEntry = result!.winRateHistory[1]
      expect(absentEntry).toEqual({
        eventId: 'e2',
        heldAt: heldAt.toISOString(),
        name: '大会1',
        venue: null,
        description: null,
        hasPromotionRelegation: false,
        absent: true,
      })
      expect(absentEntry).not.toHaveProperty('winRate')
      expect(absentEntry).not.toHaveProperty('wins')
      expect(absentEntry).not.toHaveProperty('losses')
    })

    it('スコアが5件未満の場合に実際の件数のみ返る', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select)
        .mockReturnValueOnce(mockPlayerQuery(basePlayer) as any)
        .mockReturnValueOnce(
          mockScoresQuery([
            makeScoreRow({ eventId: 'e1' }),
            makeScoreRow({ eventId: 'e2' }),
          ]) as any
        )

      const result = await profileService.getProfile('p1')

      expect(result!.winRateHistory).toHaveLength(2)
    })

    it('存在しない playerId で null を返す', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select).mockReturnValueOnce(mockPlayerQuery(null) as any)

      const result = await profileService.getProfile('nonexistent')

      expect(result).toBeNull()
    })

    it('wins + losses = 0 の場合に winRate = 0.0 が返る', async () => {
      const { db } = await import('../db/client.js')
      vi.mocked(db.select)
        .mockReturnValueOnce(mockPlayerQuery(basePlayer) as any)
        .mockReturnValueOnce(
          mockScoresQuery([
            makeScoreRow({ eventId: 'e1', wins: 0, losses: 0, absent: false }),
          ]) as any
        )

      const result = await profileService.getProfile('p1')

      expect(result!.winRateHistory[0]).toMatchObject({
        absent: false,
        winRate: 0.0,
        wins: 0,
        losses: 0,
      })
    })
  })
})
