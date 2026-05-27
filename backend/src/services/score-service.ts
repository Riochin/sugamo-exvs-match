import { and, count, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { events, scores } from '../db/schema.js'
import { hub } from '../routes/stream.js'
import type { EventPhase } from './event-service.js'

export interface SubmitScoreResult {
  eventId: string
  completedCount: number
  totalCount: number
  allCompleted: boolean
}

export type ScoreError =
  | { code: 'EVENT_NOT_FOUND' }
  | { code: 'PHASE_NOT_COLLECTING'; current: EventPhase }
  | { code: 'PLAYER_ABSENT' }
  | { code: 'SCORE_NOT_FOUND' }

export type AdminUpdateScoreError =
  | { code: 'EVENT_NOT_FOUND' }
  | { code: 'EVENT_NOT_DONE' }
  | { code: 'SCORE_NOT_FOUND' }
  | { code: 'PLAYER_ABSENT' }

export const scoreService = {
  async submitScore(params: {
    eventId: string
    playerId: string
    matches: number
    wins: number
  }): Promise<SubmitScoreResult | ScoreError> {
    const { eventId, playerId, matches, wins } = params

    const [event] = await db.select().from(events).where(eq(events.id, eventId))

    if (!event) {
      return { code: 'EVENT_NOT_FOUND' }
    }

    if (event.phase !== 'COLLECTING') {
      return { code: 'PHASE_NOT_COLLECTING', current: event.phase as EventPhase }
    }

    const [scoreRecord] = await db
      .select()
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))

    if (!scoreRecord) {
      return { code: 'SCORE_NOT_FOUND' }
    }

    if (scoreRecord.absent) {
      return { code: 'PLAYER_ABSENT' }
    }

    const losses = matches - wins
    await db
      .update(scores)
      .set({ wins, losses, submitted: true })
      .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))

    const [completedResult] = await db
      .select({ count: count() })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false), eq(scores.submitted, true)))

    const [totalResult] = await db
      .select({ count: count() })
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.absent, false)))

    const completedCount = completedResult?.count ?? 0
    const totalCount = totalResult?.count ?? 0
    const allCompleted = totalCount > 0 && completedCount === totalCount

    await hub.broadcast(eventId, 'progress_update', { completedCount, totalCount })

    return { eventId, completedCount, totalCount, allCompleted }
  },

  async adminUpdateScore(params: {
    eventId: string
    playerId: string
    wins: number
    losses: number
  }): Promise<{ ok: true } | AdminUpdateScoreError> {
    const { eventId, playerId, wins, losses } = params

    const [event] = await db.select().from(events).where(eq(events.id, eventId))
    if (!event) return { code: 'EVENT_NOT_FOUND' }
    if (event.phase !== 'DONE') return { code: 'EVENT_NOT_DONE' }

    const [scoreRecord] = await db
      .select()
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))
    if (!scoreRecord) return { code: 'SCORE_NOT_FOUND' }
    if (scoreRecord.absent) return { code: 'PLAYER_ABSENT' }

    await db
      .update(scores)
      .set({ wins, losses })
      .where(and(eq(scores.eventId, eventId), eq(scores.playerId, playerId)))

    return { ok: true }
  },
}
