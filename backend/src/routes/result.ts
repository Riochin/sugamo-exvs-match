import { Hono } from 'hono'
import { authMiddleware, type Variables } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/admin.js'
import { resultService } from '../services/result-service.js'
import { hub } from './stream.js'

function errorToStatus(code: string): 404 | 409 {
  if (code === 'EVENT_NOT_FOUND') return 404
  return 409
}

export const resultRoute = new Hono<{ Variables: Variables }>()
  .use('/*', authMiddleware)
  .get('/:id/result', async (c) => {
    const { id } = c.req.param()
    const result = await resultService.getRevealResult(id)

    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }

    return c.json(result)
  })
  .patch('/:id/reveal-phase', adminMiddleware, async (c) => {
    const { id } = c.req.param()
    const result = await resultService.advanceRevealPhase(id)

    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }

    await hub.broadcast(id, 'phase_update', {
      eventId: id,
      phase: result.eventPhase,
      revealPhase: result.revealPhase,
    })

    return c.json(result)
  })
