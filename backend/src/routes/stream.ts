import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

export type SSEEventType = 'progress_update' | 'result_ready' | 'phase_update'

type SSEStream = {
  writeSSE: (event: { event: string; data: string }) => Promise<void>
}

const streams = new Map<string, Set<SSEStream>>()

export const hub = {
  add(eventId: string, stream: SSEStream): void {
    if (!streams.has(eventId)) {
      streams.set(eventId, new Set())
    }
    streams.get(eventId)!.add(stream)
  },

  remove(eventId: string, stream: SSEStream): void {
    streams.get(eventId)?.delete(stream)
  },

  async broadcast(eventId: string, type: SSEEventType, payload: unknown): Promise<void> {
    const clients = streams.get(eventId)
    if (!clients) return
    const data = JSON.stringify(payload)
    await Promise.all(
      [...clients].map((stream) => stream.writeSSE({ event: type, data })),
    )
  },

  size(eventId: string): number {
    return streams.get(eventId)?.size ?? 0
  },

  clear(): void {
    streams.clear()
  },
}

export const streamRoute = new Hono()
  .get('/events/:eventId', (c) => {
    const { eventId } = c.req.param()

    return streamSSE(c, async (stream) => {
      hub.add(eventId, stream)

      const cleanup = () => hub.remove(eventId, stream)
      c.req.raw.signal.addEventListener('abort', cleanup)

      const pingInterval = setInterval(() => {
        stream.writeSSE({ event: 'ping', data: '' }).catch(() => {
          clearInterval(pingInterval)
          cleanup()
        })
      }, 30_000)

      await new Promise<void>((resolve) => {
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(pingInterval)
          resolve()
        })
      })
    })
  })
