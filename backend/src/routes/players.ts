import { Hono } from 'hono'
import { db } from '../db/client.js'
import { players } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'
import { profileService } from '../services/profile-service.js'

export const playersRoute = new Hono()
  .use('/*', authMiddleware)
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
  .get('/:id/profile', async (c) => {
    const { id } = c.req.param()
    const profile = await profileService.getProfile(id)
    if (!profile) {
      return c.json({ error: 'Not Found' }, 404)
    }
    return c.json(profile)
  })
