import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'

export const eventsRoute = new Hono()
  .use('/*', authMiddleware)
