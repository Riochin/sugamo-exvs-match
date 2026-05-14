import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/admin.js'
import { eventService } from '../services/event-service.js'
import { scoreService } from '../services/score-service.js'

const createEventSchema = z.object({
  heldAt: z.string().datetime(),
  name: z.string().min(1),
  hasPromotionRelegation: z.boolean(),
  venue: z.string().optional(),
  description: z.string().optional(),
})

const setAbsentSchema = z.object({
  absent: z.boolean(),
})

const updateScoreSchema = z.object({
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
})

function errorToStatus(code: string): 400 | 404 | 409 {
  if (code === 'EVENT_NOT_FOUND' || code === 'PLAYER_NOT_FOUND') return 404
  if (code === 'EVENT_NOT_DONE') return 409
  return 409
}

export const eventsRoute = new Hono()
  .use('/*', authMiddleware)
  .post('/', adminMiddleware, zValidator('json', createEventSchema), async (c) => {
    const { heldAt, name, hasPromotionRelegation, venue, description } = c.req.valid('json')
    const result = await eventService.createEvent({
      heldAt: new Date(heldAt),
      name,
      hasPromotionRelegation,
      venue,
      description,
    })
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
  .patch('/:id/scores/:playerId', adminMiddleware, zValidator('json', updateScoreSchema), async (c) => {
    const { id, playerId } = c.req.param()
    const { wins, losses } = c.req.valid('json')
    const result = await scoreService.adminUpdateScore({ eventId: id, playerId, wins, losses })
    if ('code' in result) {
      return c.json({ error: result.code }, errorToStatus(result.code))
    }
    return c.json({ ok: true })
  })
