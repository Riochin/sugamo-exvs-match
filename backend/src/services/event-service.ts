import { randomUUID } from 'crypto'
import { and, eq, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import { events, players, scores } from '../db/schema.js'
import { hub } from '../routes/stream.js'

export type EventPhase = 'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'

export interface ScoreEntry {
  playerId: string
  playerName: string
  wins: number
  losses: number
  absent: boolean
  submitted: boolean
}

export interface EventWithScores {
  id: string
  name: string
  hasPromotionRelegation: boolean
  venue: string | null
  description: string | null
  phase: EventPhase
  heldAt: string
  scores: ScoreEntry[]
}

export interface EventSummary {
  id: string
  name: string
  hasPromotionRelegation: boolean
  venue: string | null
  description: string | null
  phase: EventPhase
  heldAt: string
}

export type EventError =
  | { code: 'ACTIVE_EVENT_EXISTS' }
  | { code: 'EVENT_NOT_FOUND' }
  | { code: 'PLAYER_NOT_FOUND' }
  | { code: 'INVALID_PHASE_TRANSITION'; current: EventPhase }
  | { code: 'PHASE_NOT_COLLECTING'; current: EventPhase }

const PHASE_MAP: Partial<Record<EventPhase, EventPhase>> = {
  COLLECTING: 'STAR_VOTING',
  STAR_VOTING: 'REVEALING',
  REVEALING: 'DONE',
}

export const eventService = {
  async createEvent(params: {
    heldAt: Date
    name: string
    hasPromotionRelegation: boolean
    venue?: string
    description?: string
  }): Promise<EventWithScores | EventError> {
    const activeEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(
        or(
          eq(events.phase, 'COLLECTING'),
          eq(events.phase, 'STAR_VOTING'),
          eq(events.phase, 'REVEALING'),
        ),
      )

    if (activeEvents.length > 0) {
      return { code: 'ACTIVE_EVENT_EXISTS' }
    }

    const allPlayers = await db.select().from(players)

    const eventId = randomUUID()
    const now = new Date()

    const [newEvent] = await db
      .insert(events)
      .values({
        id: eventId,
        name: params.name,
        hasPromotionRelegation: params.hasPromotionRelegation,
        venue: params.venue ?? null,
        description: params.description ?? null,
        heldAt: params.heldAt,
        phase: 'COLLECTING',
        createdAt: now,
      })
      .returning()

    if (allPlayers.length > 0) {
      await db.insert(scores).values(
        allPlayers.map((player) => ({
          id: randomUUID(),
          eventId,
          playerId: player.id,
          wins: 0,
          losses: 0,
          absent: false,
        })),
      )
    }

    return {
      id: newEvent.id,
      name: newEvent.name,
      hasPromotionRelegation: newEvent.hasPromotionRelegation,
      venue: newEvent.venue,
      description: newEvent.description,
      phase: newEvent.phase as EventPhase,
      heldAt: newEvent.heldAt.toISOString(),
      scores: allPlayers.map((player) => ({
        playerId: player.id,
        playerName: player.name,
        wins: 0,
        losses: 0,
        absent: false,
        submitted: false,
      })),
    }
  },

  async getActiveEvent(): Promise<EventWithScores | null> {
    const [event] = await db
      .select()
      .from(events)
      .where(
        or(
          eq(events.phase, 'COLLECTING'),
          eq(events.phase, 'STAR_VOTING'),
          eq(events.phase, 'REVEALING'),
        ),
      )

    if (!event) return null

    const eventScores = await db
      .select({
        playerId: scores.playerId,
        playerName: players.name,
        wins: scores.wins,
        losses: scores.losses,
        absent: scores.absent,
        submitted: scores.submitted,
      })
      .from(scores)
      .innerJoin(players, eq(scores.playerId, players.id))
      .where(eq(scores.eventId, event.id))

    return {
      id: event.id,
      name: event.name,
      hasPromotionRelegation: event.hasPromotionRelegation,
      venue: event.venue,
      description: event.description,
      phase: event.phase as EventPhase,
      heldAt: event.heldAt.toISOString(),
      scores: eventScores,
    }
  },

  async listDoneEvents(): Promise<EventSummary[]> {
    const doneEvents = await db
      .select({
        id: events.id,
        name: events.name,
        hasPromotionRelegation: events.hasPromotionRelegation,
        venue: events.venue,
        description: events.description,
        phase: events.phase,
        heldAt: events.heldAt,
      })
      .from(events)
      .where(eq(events.phase, 'DONE'))

    return doneEvents
      .sort((a, b) => b.heldAt.getTime() - a.heldAt.getTime())
      .map((e) => ({
        id: e.id,
        name: e.name,
        hasPromotionRelegation: e.hasPromotionRelegation,
        venue: e.venue,
        description: e.description,
        phase: e.phase as EventPhase,
        heldAt: e.heldAt.toISOString(),
      }))
  },

  async setAbsent(params: {
    eventId: string
    playerId: string
    absent: boolean
  }): Promise<void | EventError> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, params.eventId))

    if (!event) return { code: 'EVENT_NOT_FOUND' }

    if (event.phase !== 'COLLECTING') {
      return { code: 'PHASE_NOT_COLLECTING', current: event.phase as EventPhase }
    }

    await db
      .update(scores)
      .set({ absent: params.absent })
      .where(and(eq(scores.eventId, params.eventId), eq(scores.playerId, params.playerId)))
  },

  async advancePhase(params: { eventId: string }): Promise<{ phase: EventPhase } | EventError> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, params.eventId))

    if (!event) return { code: 'EVENT_NOT_FOUND' }

    const nextPhase = PHASE_MAP[event.phase as EventPhase]
    if (!nextPhase) {
      return { code: 'INVALID_PHASE_TRANSITION', current: event.phase as EventPhase }
    }

    await db.update(events).set({ phase: nextPhase }).where(eq(events.id, params.eventId))

    await hub.broadcast(params.eventId, 'phase_update', { eventId: params.eventId, phase: nextPhase })

    return { phase: nextPhase }
  },

  async setPhase(params: { eventId: string; phase: EventPhase }): Promise<{ phase: EventPhase } | EventError> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, params.eventId))

    if (!event) return { code: 'EVENT_NOT_FOUND' }

    await db.update(events).set({ phase: params.phase }).where(eq(events.id, params.eventId))

    await hub.broadcast(params.eventId, 'phase_update', { eventId: params.eventId, phase: params.phase })

    return { phase: params.phase }
  },
}
