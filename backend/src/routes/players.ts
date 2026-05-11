import { Hono } from 'hono'
import { db } from '../db/client.js'
import { players } from '../db/schema.js'

export const playersRoute = new Hono()
  .get('/', async (c) => {
    const rows = await db.select({
      id: players.id,
      name: players.name,
      team: players.team,
      title: players.title,
      mainUnit: players.mainUnit,
      createdAt: players.createdAt,
    }).from(players)
    return c.json(rows)
  })
