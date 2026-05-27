import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, type Variables } from '../middleware/auth.js'
import { scoreService } from '../services/score-service.js'

const submitScoreSchema = z.object({
  eventId: z.string().min(1),
  matches: z.number().int().min(0),
  wins: z.number().int().min(0),
}).refine((data) => data.wins <= data.matches, {
  message: 'wins must not exceed matches',
  path: ['wins'],
})

function errorToStatus(code: string): 404 | 409 {
  if (code === 'EVENT_NOT_FOUND' || code === 'SCORE_NOT_FOUND') return 404
  return 409
}

export const scoresRoute = new Hono<{ Variables: Variables }>()
  .use('/*', authMiddleware)
  .post('/', zValidator('json', submitScoreSchema), async (c) => {
    const { eventId, matches, wins } = c.req.valid('json')
    const { sub: playerId } = c.get('jwtPayload')

    const result = await scoreService.submitScore({ eventId, playerId, matches, wins })

    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }

    return c.json({ completedCount: result.completedCount, totalCount: result.totalCount })
  })
