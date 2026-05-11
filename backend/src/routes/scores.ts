import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'

export const scoresRoute = new Hono()
  .use('/*', authMiddleware)
