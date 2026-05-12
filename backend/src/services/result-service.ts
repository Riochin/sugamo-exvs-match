import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { events, players, scores } from '../db/schema.js'

export type PlayerGroup = 'FIRST_STAY' | 'SECOND_STAY' | 'BORDER'
export type BorderDirection = 'PROMOTION' | 'RELEGATION'

export interface PlayerResult {
  playerId: string
  playerName: string
  team: 'FIRST' | 'SECOND'
  wins: number
  losses: number
  absent: boolean
  rank: number | null
  group: PlayerGroup | null
  borderDirection: BorderDirection | null
}

export interface RevealResult {
  eventId: string
  revealPhase: number
  eventPhase: 'COLLECTING' | 'REVEALING' | 'DONE'
  players: PlayerResult[]
}

export type ResultError =
  | { code: 'EVENT_NOT_FOUND' }
  | { code: 'PHASE_NOT_REVEALING'; current: string }
  | { code: 'REVEAL_PHASE_MAXED' }

type ScoreRow = {
  playerId: string
  playerName: string
  team: 'FIRST' | 'SECOND'
  wins: number
  losses: number
  absent: boolean
}

const BORDER_LIMIT = 2

export function computePlayerResults(rows: ScoreRow[]): PlayerResult[] {
  const present = rows.filter((p) => !p.absent)
  const absent = rows.filter((p) => p.absent)

  const F = present.filter((p) => p.team === 'FIRST').length
  const S = present.filter((p) => p.team === 'SECOND').length

  const sorted = [...present].sort((a, b) => {
    const rateA = a.wins + a.losses === 0 ? 0 : a.wins / (a.wins + a.losses)
    const rateB = b.wins + b.losses === 0 ? 0 : b.wins / (b.wins + b.losses)
    if (rateB !== rateA) return rateB - rateA
    return b.wins - a.wins
  })

  // SECOND players who entered first slots — cap at top BORDER_LIMIT (best rank)
  const promotionIds = new Set(
    sorted
      .map((p, i) => ({ ...p, rank: i + 1 }))
      .filter((p) => p.team === 'SECOND' && p.rank <= F)
      .slice(0, BORDER_LIMIT)
      .map((p) => p.playerId),
  )

  // FIRST players who fell to second slots — cap at bottom BORDER_LIMIT (worst rank)
  const firstInSecondSlots = sorted
    .map((p, i) => ({ ...p, rank: i + 1 }))
    .filter((p) => p.team === 'FIRST' && p.rank > F)
  const relegationIds = new Set(
    firstInSecondSlots.slice(-BORDER_LIMIT).map((p) => p.playerId),
  )

  const presentResults: PlayerResult[] = sorted.map((p, index) => {
    const rank = index + 1

    let group: PlayerGroup | null = null
    let borderDirection: BorderDirection | null = null

    if (F > 0 && S > 0) {
      if (promotionIds.has(p.playerId)) {
        group = 'BORDER'
        borderDirection = 'PROMOTION'
      } else if (relegationIds.has(p.playerId)) {
        group = 'BORDER'
        borderDirection = 'RELEGATION'
      } else if (p.team === 'FIRST') {
        group = 'FIRST_STAY'
      } else {
        group = 'SECOND_STAY'
      }
    }

    return { ...p, rank, group, borderDirection }
  })

  const absentResults: PlayerResult[] = absent.map((p) => ({
    ...p,
    rank: null,
    group: null,
    borderDirection: null,
  }))

  return [...presentResults, ...absentResults]
}

export const resultService = {
  async getRevealResult(eventId: string): Promise<RevealResult | { code: 'EVENT_NOT_FOUND' }> {
    const [event] = await db.select().from(events).where(eq(events.id, eventId))

    if (!event) return { code: 'EVENT_NOT_FOUND' }

    const scoreRows = await db
      .select({
        playerId: players.id,
        playerName: players.name,
        team: players.team,
        wins: scores.wins,
        losses: scores.losses,
        absent: scores.absent,
      })
      .from(scores)
      .innerJoin(players, eq(scores.playerId, players.id))
      .where(eq(scores.eventId, eventId))

    const playerResults = computePlayerResults(scoreRows as ScoreRow[])

    return {
      eventId,
      revealPhase: event.revealPhase,
      eventPhase: event.phase as 'COLLECTING' | 'REVEALING' | 'DONE',
      players: playerResults,
    }
  },

  async advanceRevealPhase(
    eventId: string,
  ): Promise<{ revealPhase: number; eventPhase: string } | ResultError> {
    const [event] = await db.select().from(events).where(eq(events.id, eventId))

    if (!event) return { code: 'EVENT_NOT_FOUND' }

    if (event.phase !== 'REVEALING') {
      return { code: 'PHASE_NOT_REVEALING', current: event.phase }
    }

    if (event.revealPhase >= 3) {
      return { code: 'REVEAL_PHASE_MAXED' }
    }

    const newRevealPhase = event.revealPhase + 1
    const newPhase = newRevealPhase === 3 ? 'DONE' : ('REVEALING' as const)

    await db
      .update(events)
      .set({ revealPhase: newRevealPhase, phase: newPhase })
      .where(eq(events.id, eventId))

    return { revealPhase: newRevealPhase, eventPhase: newPhase }
  },
}
