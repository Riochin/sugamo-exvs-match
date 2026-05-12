import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { playersRoute } from '../routes/players.js'
import { sign } from '../lib/jwt.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../services/profile-service.js', () => ({
  profileService: {
    getProfile: vi.fn(),
  },
}))

function buildApp() {
  const app = new Hono()
  app.route('/api/players', playersRoute)
  return app
}

async function playerToken() {
  process.env.JWT_SECRET = 'test-secret-key'
  return sign({ sub: 'player-1', name: 'テストプレイヤー', isAdmin: false })
}

const mockPlayerList = [
  { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: new Date() },
  { id: 'p2', name: 'Bob', team: 'SECOND', title: null, mainUnit: null, createdAt: new Date() },
]

const mockProfile = {
  id: 'p1',
  name: 'Alice',
  team: 'FIRST',
  title: '称号A',
  mainUnit: '機体X',
  winRateHistory: [
    { eventId: 'e1', heldAt: '2026-01-01T00:00:00.000Z', winRate: 60.0, wins: 3, losses: 2, absent: false },
  ],
}

describe('GET /api/players', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('認証ありで 200 と PlayerListItem[] を返す', async () => {
    const { db } = await import('../db/client.js')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue(mockPlayerList),
    } as any)

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/players', {
      method: 'GET',
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe('p1')
    expect(body[0]).not.toHaveProperty('pinHash')
  })

  it('認証なしで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/players', { method: 'GET' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/players/:id/profile', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('認証あり・存在する ID で 200 と PlayerProfileResponse を返す', async () => {
    const { profileService } = await import('../services/profile-service.js')
    vi.mocked(profileService.getProfile).mockResolvedValue(mockProfile as any)

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/players/p1/profile', {
      method: 'GET',
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('p1')
    expect(body.name).toBe('Alice')
    expect(Array.isArray(body.winRateHistory)).toBe(true)
    expect(body.winRateHistory).toHaveLength(1)
  })

  it('認証あり・存在しない ID で 404 を返す', async () => {
    const { profileService } = await import('../services/profile-service.js')
    vi.mocked(profileService.getProfile).mockResolvedValue(null)

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/players/nonexistent/profile', {
      method: 'GET',
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(404)
  })

  it('認証なしで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/players/p1/profile', { method: 'GET' })
    expect(res.status).toBe(401)
  })
})
