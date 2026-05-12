import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { resultRoute } from '../routes/result.js'
import { sign } from '../lib/jwt.js'

vi.mock('../services/result-service.js', () => ({
  resultService: {
    getRevealResult: vi.fn(),
    advanceRevealPhase: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

function buildApp() {
  const app = new Hono()
  app.route('/api/events', resultRoute)
  return app
}

async function adminToken() {
  process.env.JWT_SECRET = 'test-secret-key'
  return sign({ sub: 'admin-1', name: '管理者', isAdmin: true })
}

async function playerToken() {
  process.env.JWT_SECRET = 'test-secret-key'
  return sign({ sub: 'player-1', name: 'プレイヤー', isAdmin: false })
}

const mockRevealResult = {
  eventId: 'event-1',
  revealPhase: 1,
  eventPhase: 'REVEALING' as const,
  players: [
    {
      playerId: 'p1',
      playerName: 'Alice',
      team: 'FIRST' as const,
      wins: 4,
      losses: 0,
      absent: false,
      rank: 1,
      group: 'FIRST_STAY' as const,
      borderDirection: null,
    },
  ],
}

describe('GET /api/events/:id/result', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('認証ありで 200 と RevealResult を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.getRevealResult).mockResolvedValue(mockRevealResult)

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/result', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eventId).toBe('event-1')
    expect(body.revealPhase).toBe(1)
    expect(body.eventPhase).toBe('REVEALING')
    expect(body.players).toHaveLength(1)
  })

  it('未認証で 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/events/event-1/result')

    expect(res.status).toBe(401)
  })

  it('存在しない eventId で 404 を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.getRevealResult).mockResolvedValue({ code: 'EVENT_NOT_FOUND' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/unknown/result', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(404)
  })

  it('eventPhase が DONE の場合も 200 と RevealResult を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.getRevealResult).mockResolvedValue({
      ...mockRevealResult,
      revealPhase: 3,
      eventPhase: 'DONE',
    })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/result', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eventPhase).toBe('DONE')
    expect(body.revealPhase).toBe(3)
  })
})

describe('PATCH /api/events/:id/reveal-phase', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('管理者が PATCH すると 200 と { revealPhase, eventPhase } を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.advanceRevealPhase).mockResolvedValue({
      revealPhase: 2,
      eventPhase: 'REVEALING',
    })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.revealPhase).toBe(2)
    expect(body.eventPhase).toBe('REVEALING')
  })

  it('管理者が PATCH すると hub.broadcast で phase_update SSEが配信される', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.advanceRevealPhase).mockResolvedValue({
      revealPhase: 2,
      eventPhase: 'REVEALING',
    })
    const { hub } = await import('../routes/stream.js')

    const token = await adminToken()
    const app = buildApp()
    await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(hub.broadcast).toHaveBeenCalledWith('event-1', 'phase_update', {
      eventId: 'event-1',
      phase: 'REVEALING',
      revealPhase: 2,
    })
  })

  it('revealPhase=3 のとき eventPhase が DONE になり SSE も配信される', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.advanceRevealPhase).mockResolvedValue({
      revealPhase: 3,
      eventPhase: 'DONE',
    })
    const { hub } = await import('../routes/stream.js')

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.eventPhase).toBe('DONE')
    expect(hub.broadcast).toHaveBeenCalledWith('event-1', 'phase_update', {
      eventId: 'event-1',
      phase: 'DONE',
      revealPhase: 3,
    })
  })

  it('非管理者で 403 を返す', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(403)
  })

  it('未認証で 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
    })

    expect(res.status).toBe(401)
  })

  it('PHASE_NOT_REVEALING エラーで 409 を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.advanceRevealPhase).mockResolvedValue({
      code: 'PHASE_NOT_REVEALING',
      current: 'COLLECTING',
    })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(409)
  })

  it('REVEAL_PHASE_MAXED エラーで 409 を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.advanceRevealPhase).mockResolvedValue({
      code: 'REVEAL_PHASE_MAXED',
    })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(409)
  })

  it('EVENT_NOT_FOUND エラーで 404 を返す', async () => {
    const { resultService } = await import('../services/result-service.js')
    vi.mocked(resultService.advanceRevealPhase).mockResolvedValue({
      code: 'EVENT_NOT_FOUND',
    })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/reveal-phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(404)
  })
})
