import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { players } from '../db/schema.js'
import { sign } from '../lib/jwt.js'

const impersonateSchema = z.object({
  playerId: z.string().min(1),
})

function devOnly(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export const devRoute = new Hono()
  .post('/impersonate', zValidator('json', impersonateSchema), async (c) => {
    if (!devOnly()) {
      return c.json({ error: 'Not available in production' }, 403)
    }

    const { playerId } = c.req.valid('json')
    const rows = await db.select().from(players).where(eq(players.id, playerId))
    const player = rows[0]

    if (!player) {
      return c.json({ error: 'Player not found' }, 404)
    }

    const token = await sign({ sub: player.id, name: player.name, isAdmin: player.isAdmin })
    setCookie(c, 'token', token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return c.json({ playerId: player.id, name: player.name, isAdmin: player.isAdmin })
  })
