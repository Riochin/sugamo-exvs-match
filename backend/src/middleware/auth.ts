import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify, type JwtPayload } from '../lib/jwt.js'

export type Variables = {
  jwtPayload: JwtPayload
}

export const authMiddleware: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const token = getCookie(c, 'token')
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const payload = await verify(token)
    c.set('jwtPayload', payload)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
