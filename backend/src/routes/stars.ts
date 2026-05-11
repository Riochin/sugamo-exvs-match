import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'

export const starsRoute = new Hono()
  .use('/*', authMiddleware)
