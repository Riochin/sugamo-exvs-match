import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { authRoute } from './routes/auth.js'
import { playersRoute } from './routes/players.js'
import { eventsRoute } from './routes/events.js'
import { scoresRoute } from './routes/scores.js'
import { starsRoute } from './routes/stars.js'
import { streamRoute } from './routes/stream.js'

const app = new Hono()
  .route('/api/auth', authRoute)
  .route('/api/players', playersRoute)
  .route('/api/events', eventsRoute)
  .route('/api/scores', scoresRoute)
  .route('/api/stars', starsRoute)
  .route('/api/stream', streamRoute)

app.get('/', (c) => c.text('sugamo-exvs-match API'))

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})

export type AppType = typeof app
export default app
