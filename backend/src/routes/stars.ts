import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, type Variables } from '../middleware/auth.js'
import { starService } from '../services/star-service.js'

const submitStarVoteSchema = z.object({
  allocations: z
    .array(
      z.object({
        toPlayerId: z.string().min(1),
        count: z.number().int().min(1).max(3),
      }),
    )
    .min(1),
})

function errorToStatus(code: string): 404 | 409 | 422 {
  if (code === 'NO_ACTIVE_VOTING_EVENT' || code === 'EVENT_NOT_FOUND') return 404
  if (code === 'ALREADY_VOTED' || code === 'PHASE_NOT_STAR_VOTING') return 409
  return 422
}

export const starsRoute = new Hono<{ Variables: Variables }>()
  .use('/*', authMiddleware)
  .post('/', zValidator('json', submitStarVoteSchema), async (c) => {
    const { allocations } = c.req.valid('json')
    const { sub: playerId } = c.get('jwtPayload')

    const result = await starService.submitVote({ playerId, allocations })

    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }

    return c.json({ completedCount: result.completedCount, totalCount: result.totalCount })
  })
  .get('/status', async (c) => {
    const { sub: playerId } = c.get('jwtPayload')

    const result = await starService.getVotingStatus({ playerId, eventId: '' })

    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }

    return c.json(result)
  })
  .get('/results/:eventId', async (c) => {
    const { eventId } = c.req.param()

    const result = await starService.getResults({ eventId })

    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }

    return c.json({ rankings: result })
  })
