import type { MiddlewareHandler } from 'hono'
import type { Variables } from './auth.js'

export const adminMiddleware: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  if (!c.var.jwtPayload.isAdmin) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}
