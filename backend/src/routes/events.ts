import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/admin.js'
import { eventService } from '../services/event-service.js'

const createEventSchema = z.object({
  heldAt: z.string().datetime(),
})

const setAbsentSchema = z.object({
  absent: z.boolean(),
})

function errorToStatus(code: string): 400 | 404 | 409 {
  if (code === 'EVENT_NOT_FOUND' || code === 'PLAYER_NOT_FOUND') return 404
  return 409
}

export const eventsRoute = new Hono()
  .use('/*', authMiddleware)
  .post('/', adminMiddleware, zValidator('json', createEventSchema), async (c) => {
    const { heldAt } = c.req.valid('json')
    const result = await eventService.createEvent({ heldAt: new Date(heldAt) })
    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }
    return c.json(result)
  })
  .get('/active', async (c) => {
    const event = await eventService.getActiveEvent()
    return c.json({ event })
  })
  .get('/', async (c) => {
    const events = await eventService.listDoneEvents()
    return c.json(events)
  })
  .patch('/:id/absent/:playerId', adminMiddleware, zValidator('json', setAbsentSchema), async (c) => {
    const { id, playerId } = c.req.param()
    const { absent } = c.req.valid('json')
    const result = await eventService.setAbsent({ eventId: id, playerId, absent })
    if (result && 'code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }
    return c.json({ ok: true })
  })
  .patch('/:id/phase', adminMiddleware, async (c) => {
    const { id } = c.req.param()
    const result = await eventService.advancePhase({ eventId: id })
    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }
    return c.json({ id, phase: result.phase })
  })
