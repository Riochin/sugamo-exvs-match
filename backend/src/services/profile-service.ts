import { and, desc, eq, sum } from 'drizzle-orm'
import { db } from '../db/client.js'
import { events, players, scores, stars } from '../db/schema.js'

type EventMeta = {
  eventId: string
  heldAt: string
  name: string
  venue: string | null
  description: string | null
  hasPromotionRelegation: boolean
}

type WinRateEntry =
  | (EventMeta & { winRate: number; wins: number; losses: number; absent: false })
  | (EventMeta & { absent: true })

export type PlayerProfileResponse = {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  iconUrl: string | null
  totalStarsReceived: number
  winRateHistory: WinRateEntry[]
}

export const profileService = {
  async getProfile(playerId: string): Promise<PlayerProfileResponse | null> {
    const [player] = await db
      .select({
        id: players.id,
        name: players.name,
        team: players.team,
        title: players.title,
        mainUnit: players.mainUnit,
        iconUrl: players.iconUrl,
      })
      .from(players)
      .where(eq(players.id, playerId))

    if (!player) {
      return null
    }

    const scoreRows = await db
      .select({
        eventId: scores.eventId,
        heldAt: events.heldAt,
        name: events.name,
        venue: events.venue,
        description: events.description,
        hasPromotionRelegation: events.hasPromotionRelegation,
        wins: scores.wins,
        losses: scores.losses,
        absent: scores.absent,
      })
      .from(scores)
      .innerJoin(events, eq(scores.eventId, events.id))
      .where(and(eq(scores.playerId, playerId), eq(scores.submitted, true)))
      .orderBy(desc(events.heldAt))
      .limit(5)

    const [starRow] = await db
      .select({ total: sum(stars.count) })
      .from(stars)
      .where(eq(stars.toPlayerId, playerId))

    const totalStarsReceived = Number(starRow?.total ?? 0)

    const winRateHistory: WinRateEntry[] = scoreRows.map((row) => {
      const meta: EventMeta = {
        eventId: row.eventId,
        heldAt: row.heldAt.toISOString(),
        name: row.name,
        venue: row.venue ?? null,
        description: row.description ?? null,
        hasPromotionRelegation: row.hasPromotionRelegation,
      }
      if (row.absent) {
        return { ...meta, absent: true }
      }
      const total = row.wins + row.losses
      const winRate = total > 0 ? Math.round((row.wins / total) * 1000) / 10 : 0.0
      return { ...meta, winRate, wins: row.wins, losses: row.losses, absent: false }
    })

    return {
      id: player.id,
      name: player.name,
      team: player.team,
      title: player.title ?? null,
      mainUnit: player.mainUnit ?? null,
      iconUrl: player.iconUrl ?? null,
      totalStarsReceived,
      winRateHistory,
    }
  },
}
