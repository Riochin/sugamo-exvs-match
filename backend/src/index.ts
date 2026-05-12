import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { authRoute } from './routes/auth.js'
import { playersRoute } from './routes/players.js'
import { eventsRoute } from './routes/events.js'
import { scoresRoute } from './routes/scores.js'
import { starsRoute } from './routes/stars.js'
import { streamRoute } from './routes/stream.js'
import { resultRoute } from './routes/result.js'

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173']

const app = new Hono()

app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

app
  .route('/api/auth', authRoute)
  .route('/api/players', playersRoute)
  .route('/api/events', eventsRoute)
  .route('/api/events', resultRoute)
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
