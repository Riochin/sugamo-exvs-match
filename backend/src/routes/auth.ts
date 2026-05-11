import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie, deleteCookie } from 'hono/cookie'
import bcryptjs from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { players } from '../db/schema.js'
import { sign } from '../lib/jwt.js'

const loginSchema = z.object({
  playerName: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
})

export const authRoute = new Hono()
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { playerName, pin } = c.req.valid('json')

    const rows = await db.select().from(players).where(eq(players.name, playerName))
    const player = rows[0]

    if (!player) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const match = await bcryptjs.compare(pin, player.pinHash)
    if (!match) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = await sign({ sub: player.id, name: player.name })
    const isProduction = process.env.NODE_ENV === 'production'

    setCookie(c, 'token', token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isProduction,
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return c.json({ playerId: player.id, name: player.name })
  })
  .post('/logout', (c) => {
    deleteCookie(c, 'token', { path: '/' })
    return c.json({ ok: true })
  })
