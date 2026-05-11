import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/', (c) => c.text('sugamo-exvs-match API'))

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port }, () => {
  console.info(`Backend listening on http://localhost:${port}`)
})

export type AppType = typeof app
export default app
