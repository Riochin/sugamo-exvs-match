import { randomUUID } from 'crypto'
import { and, count, desc, eq, ne, sum } from 'drizzle-orm'
import { db } from '../db/client.js'
import { events, players, scores, stars } from '../db/schema.js'
import { hub } from '../routes/stream.js'
import type { EventPhase } from './event-service.js'

export interface StarAllocation {
  toPlayerId: string
  count: number
}

export interface SubmitVoteResult {
  completedCount: number
  totalCount: number
}

export type StarVoteError =
  | { code: 'NO_ACTIVE_VOTING_EVENT' }
  | { code: 'PHASE_NOT_STAR_VOTING'; current: EventPhase }
  | { code: 'ALREADY_VOTED' }
  | { code: 'SELF_VOTE_FORBIDDEN' }
  | { code: 'INVALID_TOTAL'; actual: number }

export interface VotingStatus {
  completedCount: number
  totalCount: number
  hasVoted: boolean
  players: { playerId: string; playerName: string }[]
}

export interface StarRanking {
  rank: number
  playerId: string
  playerName: string
  starCount: number
}

export const starService = {
  async submitVote(params: {
    playerId: string
    allocations: StarAllocation[]
  }): Promise<SubmitVoteResult | StarVoteError> {
    const { playerId, allocations } = params

    const [activeEvent] = await db
      .select()
      .from(events)
      .where(eq(events.phase, 'STAR_VOTING'))

    if (!activeEvent) {
      return { code: 'NO_ACTIVE_VOTING_EVENT' }
    }

    if (activeEvent.phase !== 'STAR_VOTING') {
      return { code: 'PHASE_NOT_STAR_VOTING', current: activeEvent.phase as EventPhase }
    }

    const hasSelfVote = allocations.some((a) => a.toPlayerId === playerId)
    if (hasSelfVote) {
      return { code: 'SELF_VOTE_FORBIDDEN' }
    }

    const total = allocations.reduce((sum, a) => sum + a.count, 0)
    if (total !== 3) {
      return { code: 'INVALID_TOTAL', actual: total }
    }

    const eventId = activeEvent.id

    const [scoreRecord] = await db
      .select({ starVotingSubmitted: scores.starVotingSubmitted })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))

    if (scoreRecord?.starVotingSubmitted) {
      return { code: 'ALREADY_VOTED' }
    }

    await db.transaction(async (tx) => {
      await tx.insert(stars).values(
        allocations.map((a) => ({
          id: randomUUID(),
          eventId,
          fromPlayerId: playerId,
          toPlayerId: a.toPlayerId,
          count: a.count,
        })),
      )
      await tx
        .update(scores)
        .set({ starVotingSubmitted: true })
        .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))
    })

    const [completedResult] = await db
      .select({ count: count() })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false), eq(scores.starVotingSubmitted, true)))

    const [totalResult] = await db
      .select({ count: count() })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false)))

    const completedCount = completedResult?.count ?? 0
    const totalCount = totalResult?.count ?? 0

    await hub.broadcast(eventId, 'star_vote_update', { completedCount, totalCount })

    if (totalCount > 0 && completedCount === totalCount) {
      await db.update(events).set({ phase: 'REVEALING' }).where(eq(events.id, eventId))
      await hub.broadcast(eventId, 'phase_update', { eventId, phase: 'REVEALING' })
    }

    return { completedCount, totalCount }
  },

  async getVotingStatus(params: {
    playerId: string
    eventId: string
  }): Promise<VotingStatus | { code: 'NO_ACTIVE_VOTING_EVENT' }> {
    const { playerId } = params

    const [activeEvent] = await db
      .select()
      .from(events)
      .where(eq(events.phase, 'STAR_VOTING'))

    if (!activeEvent) {
      return { code: 'NO_ACTIVE_VOTING_EVENT' }
    }

    const eventId = activeEvent.id

    const eventPlayers = await db
      .select({ playerId: scores.playerId, playerName: players.name })
      .from(scores)
      .innerJoin(players, eq(scores.playerId, players.id))
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false), ne(scores.playerId, playerId)))
      .orderBy(desc(players.createdAt))

    const [completedResult] = await db
      .select({ count: count() })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false), eq(scores.starVotingSubmitted, true)))

    const [totalResult] = await db
      .select({ count: count() })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false)))

    const [myScore] = await db
      .select({ starVotingSubmitted: scores.starVotingSubmitted })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))

    return {
      completedCount: completedResult?.count ?? 0,
      totalCount: totalResult?.count ?? 0,
      hasVoted: myScore?.starVotingSubmitted ?? false,
      players: eventPlayers,
    }
  },

  async getResults(params: {
    eventId: string
  }): Promise<StarRanking[] | { code: 'EVENT_NOT_FOUND' }> {
    const { eventId } = params

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))

    if (!event) {
      return { code: 'EVENT_NOT_FOUND' }
    }

    const rows = await db
      .select({
        playerId: stars.toPlayerId,
        playerName: players.name,
        starCount: sum(stars.count).as('starCount'),
      })
      .from(stars)
      .innerJoin(players, eq(stars.toPlayerId, players.id))
      .where(eq(stars.eventId, eventId))
      .groupBy(stars.toPlayerId)
      .orderBy(desc(sum(stars.count)))

    let rank = 0
    let prevStarCount: number | null = null
    return rows.map((row) => {
      const starCount = Number(row.starCount ?? 0)
      if (starCount !== prevStarCount) {
        rank++
        prevStarCount = starCount
      }
      return { rank, playerId: row.playerId, playerName: row.playerName, starCount }
    })
  },
}
