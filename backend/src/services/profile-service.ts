import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { events, players, scores } from '../db/schema.js'

type WinRateEntry =
  | {
      eventId: string
      heldAt: string
      winRate: number
      wins: number
      losses: number
      absent: false
    }
  | {
      eventId: string
      heldAt: string
      absent: true
    }

export type PlayerProfileResponse = {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  iconUrl: string | null
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
        wins: scores.wins,
        losses: scores.losses,
        absent: scores.absent,
      })
      .from(scores)
      .innerJoin(events, eq(scores.eventId, events.id))
      .where(and(eq(scores.playerId, playerId), eq(scores.submitted, true)))
      .orderBy(desc(events.heldAt))
      .limit(5)

    const winRateHistory: WinRateEntry[] = scoreRows.map((row) => {
      if (row.absent) {
        return {
          eventId: row.eventId,
          heldAt: row.heldAt.toISOString(),
          absent: true,
        }
      }
      const total = row.wins + row.losses
      const winRate = total > 0 ? Math.round((row.wins / total) * 1000) / 10 : 0.0
      return {
        eventId: row.eventId,
        heldAt: row.heldAt.toISOString(),
        winRate,
        wins: row.wins,
        losses: row.losses,
        absent: false,
      }
    })

    return {
      id: player.id,
      name: player.name,
      team: player.team,
      title: player.title ?? null,
      mainUnit: player.mainUnit ?? null,
      iconUrl: player.iconUrl ?? null,
      winRateHistory,
    }
  },
}
