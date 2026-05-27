import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { eventsRoute } from '../routes/events.js'
import { sign } from '../lib/jwt.js'
import type { EventPhase } from '../services/event-service.js'

vi.mock('../services/event-service.js', () => ({
  eventService: {
    createEvent: vi.fn(),
    getActiveEvents: vi.fn(),
    listDoneEvents: vi.fn(),
    setAbsent: vi.fn(),
    advancePhase: vi.fn(),
  },
}))

vi.mock('../services/score-service.js', () => ({
  scoreService: {
    submitScore: vi.fn(),
    adminUpdateScore: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

function buildApp() {
  const app = new Hono()
  app.route('/api/events', eventsRoute)
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

describe('POST /api/events', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  const validBody = {
    heldAt: '2026-06-01T10:00:00.000Z',
    name: 'テスト大会',
    hasPromotionRelegation: false,
  }

  it('管理者トークンで正常な大会作成レスポンスを返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    const mockResult = {
      id: 'event-1',
      name: 'テスト大会',
      hasPromotionRelegation: false,
      venue: null,
      description: null,
      phase: 'COLLECTING' as EventPhase,
      heldAt: '2026-06-01T10:00:00.000Z',
      scores: [],
    }
    vi.mocked(eventService.createEvent).mockResolvedValue(mockResult)

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('event-1')
    expect(body.phase).toBe('COLLECTING')
    expect(body.name).toBe('テスト大会')
  })

  it('非管理者トークンで 403 を返す', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(403)
  })

  it('認証なしで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(401)
  })

  it('不正な heldAt で 400 を返す', async () => {
    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ ...validBody, heldAt: 'not-a-date' }),
    })

    expect(res.status).toBe(400)
  })

  it('name が空で 400 を返す', async () => {
    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ ...validBody, name: '' }),
    })

    expect(res.status).toBe(400)
  })

  it('進行中大会が存在する場合 409 を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.createEvent).mockResolvedValue({ code: 'ACTIVE_EVENT_EXISTS' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(409)
  })
})

describe('GET /api/events/active', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('進行中大会なしで { events: [] } を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.getActiveEvents).mockResolvedValue([])

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/active', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ events: [] })
  })

  it('進行中大会ありで EventWithScores の配列を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    const mockEvent = {
      id: 'event-1',
      name: 'テスト大会',
      hasPromotionRelegation: false,
      venue: null,
      description: null,
      phase: 'COLLECTING' as EventPhase,
      heldAt: '2026-06-01T10:00:00.000Z',
      scores: [{ playerId: 'p1', playerName: 'Alice', wins: 0, losses: 0, absent: false, submitted: false }],
    }
    vi.mocked(eventService.getActiveEvents).mockResolvedValue([mockEvent])

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/active', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.events).toHaveLength(1)
    expect(body.events[0].id).toBe('event-1')
    expect(body.events[0].scores).toHaveLength(1)
  })

  it('認証なしで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/events/active')

    expect(res.status).toBe(401)
  })
})

describe('GET /api/events', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('DONE 大会一覧を降順で返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    const mockEvents = [
      { id: 'event-2', name: '第2回', hasPromotionRelegation: false, venue: null, description: null, phase: 'DONE' as EventPhase, heldAt: '2026-06-02T10:00:00.000Z' },
      { id: 'event-1', name: '第1回', hasPromotionRelegation: false, venue: null, description: null, phase: 'DONE' as EventPhase, heldAt: '2026-06-01T10:00:00.000Z' },
    ]
    vi.mocked(eventService.listDoneEvents).mockResolvedValue(mockEvents)

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe('event-2')
  })

  it('認証なしで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/events')

    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/events/:id/absent/:playerId', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('管理者が COLLECTING フェーズ中に欠席を設定すると { ok: true } を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.setAbsent).mockResolvedValue(undefined)

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/absent/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ absent: true }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('COLLECTING 以外のフェーズで 409 を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.setAbsent).mockResolvedValue({ code: 'PHASE_NOT_COLLECTING', current: 'REVEALING' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/absent/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ absent: true }),
    })

    expect(res.status).toBe(409)
  })

  it('大会が存在しない場合 404 を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.setAbsent).mockResolvedValue({ code: 'EVENT_NOT_FOUND' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/absent/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ absent: true }),
    })

    expect(res.status).toBe(404)
  })

  it('非管理者で 403 を返す', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/absent/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ absent: true }),
    })

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/events/:id/phase', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('管理者がフェーズ遷移すると { id, phase } を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.advancePhase).mockResolvedValue({ phase: 'REVEALING' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('event-1')
    expect(body.phase).toBe('REVEALING')
  })

  it('大会が存在しない場合 404 を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.advancePhase).mockResolvedValue({ code: 'EVENT_NOT_FOUND' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(404)
  })

  it('不正なフェーズ遷移で 409 を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.advancePhase).mockResolvedValue({ code: 'INVALID_PHASE_TRANSITION', current: 'DONE' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(409)
  })

  it('CEREMONY_IN_PROGRESS エラーで 409 を返す', async () => {
    const { eventService } = await import('../services/event-service.js')
    vi.mocked(eventService.advancePhase).mockResolvedValue({ code: 'CEREMONY_IN_PROGRESS' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(409)
  })

  it('非管理者で 403 を返す', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/phase', {
      method: 'PATCH',
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/events/:id/scores/:playerId', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('管理者が過去大会のスコアを更新すると { ok: true } を返す', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.adminUpdateScore).mockResolvedValue({ ok: true })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/scores/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ wins: 3, losses: 2 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('大会が DONE でない場合 409 を返す', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.adminUpdateScore).mockResolvedValue({ code: 'EVENT_NOT_DONE' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/scores/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ wins: 3, losses: 2 }),
    })

    expect(res.status).toBe(409)
  })

  it('大会が存在しない場合 404 を返す', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.adminUpdateScore).mockResolvedValue({ code: 'EVENT_NOT_FOUND' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/scores/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ wins: 3, losses: 2 }),
    })

    expect(res.status).toBe(404)
  })

  it('プレイヤーが欠席の場合 409 を返す', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.adminUpdateScore).mockResolvedValue({ code: 'PLAYER_ABSENT' })

    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/scores/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ wins: 3, losses: 2 }),
    })

    expect(res.status).toBe(409)
  })

  it('非管理者で 403 を返す', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/scores/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ wins: 3, losses: 2 }),
    })

    expect(res.status).toBe(403)
  })

  it('wins が負の値で 400 を返す', async () => {
    const token = await adminToken()
    const app = buildApp()
    const res = await app.request('/api/events/event-1/scores/player-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ wins: -1, losses: 2 }),
    })

    expect(res.status).toBe(400)
  })
})
