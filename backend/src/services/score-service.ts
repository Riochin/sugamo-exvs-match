import { and, count, eq, or } from 'drizzle-orm'
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
  | { code: 'NO_ACTIVE_EVENT' }
  | { code: 'PHASE_NOT_COLLECTING'; current: EventPhase }
  | { code: 'PLAYER_ABSENT' }
  | { code: 'SCORE_NOT_FOUND' }

export const scoreService = {
  async submitScore(params: {
    playerId: string
    matches: number
    wins: number
  }): Promise<SubmitScoreResult | ScoreError> {
    const { playerId, matches, wins } = params

    const [activeEvent] = await db
      .select()
      .from(events)
      .where(or(eq(events.phase, 'COLLECTING'), eq(events.phase, 'REVEALING')))

    if (!activeEvent) {
      return { code: 'NO_ACTIVE_EVENT' }
    }

    if (activeEvent.phase !== 'COLLECTING') {
      return { code: 'PHASE_NOT_COLLECTING', current: activeEvent.phase as EventPhase }
    }

    const eventId = activeEvent.id

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

    if (allCompleted) {
      await db.update(events).set({ phase: 'STAR_VOTING' }).where(eq(events.id, eventId))
      await hub.broadcast(eventId, 'phase_update', { eventId, phase: 'STAR_VOTING' })
    }

    return { eventId, completedCount, totalCount, allCompleted }
  },
}
