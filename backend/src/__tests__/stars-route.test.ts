import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { starsRoute } from '../routes/stars.js'
import { sign } from '../lib/jwt.js'

vi.mock('../services/star-service.js', () => ({
  starService: {
    submitVote: vi.fn(),
    getVotingStatus: vi.fn(),
    getResults: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

function buildApp() {
  const app = new Hono()
  app.route('/api/stars', starsRoute)
  return app
}

async function playerToken(sub = 'player-1') {
  process.env.JWT_SECRET = 'test-secret-key'
  return sign({ sub, name: 'プレイヤー', isAdmin: false })
}

describe('POST /api/stars', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  const validBody = {
    allocations: [
      { toPlayerId: 'p2', count: 2 },
      { toPlayerId: 'p3', count: 1 },
    ],
  }

  it('認証済みプレイヤーが有効な配分を送信すると 200 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.submitVote).mockResolvedValue({ completedCount: 2, totalCount: 5 })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completedCount).toBe(2)
    expect(body.totalCount).toBe(5)
  })

  it('認証なしで 401 が返る', async () => {
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(401)
  })

  it('allocations が空配列のときバリデーションエラー 400 が返る', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ allocations: [] }),
    })

    expect(res.status).toBe(400)
  })

  it('ALREADY_VOTED エラーで 409 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.submitVote).mockResolvedValue({ code: 'ALREADY_VOTED' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(409)
  })

  it('PHASE_NOT_STAR_VOTING エラーで 409 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.submitVote).mockResolvedValue({
      code: 'PHASE_NOT_STAR_VOTING',
      current: 'COLLECTING',
    })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(409)
  })

  it('SELF_VOTE_FORBIDDEN エラーで 422 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.submitVote).mockResolvedValue({ code: 'SELF_VOTE_FORBIDDEN' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(422)
  })

  it('INVALID_TOTAL エラーで 422 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.submitVote).mockResolvedValue({ code: 'INVALID_TOTAL', actual: 2 })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(422)
  })

  it('NO_ACTIVE_VOTING_EVENT エラーで 404 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.submitVote).mockResolvedValue({ code: 'NO_ACTIVE_VOTING_EVENT' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validBody),
    })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/stars/status', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('認証済みプレイヤーが投票状況を取得できる', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.getVotingStatus).mockResolvedValue({
      completedCount: 2,
      totalCount: 5,
      hasVoted: false,
      players: [{ playerId: 'p2', playerName: 'Player2' }],
    })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars/status', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completedCount).toBe(2)
    expect(body.hasVoted).toBe(false)
    expect(body.players).toHaveLength(1)
  })

  it('認証なしで 401 が返る', async () => {
    const app = buildApp()
    const res = await app.request('/api/stars/status')

    expect(res.status).toBe(401)
  })

  it('NO_ACTIVE_VOTING_EVENT エラーで 404 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.getVotingStatus).mockResolvedValue({ code: 'NO_ACTIVE_VOTING_EVENT' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars/status', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/stars/results/:eventId', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('認証済みプレイヤーがランキングを取得できる', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.getResults).mockResolvedValue([
      { rank: 1, playerId: 'p2', playerName: 'Player2', starCount: 5 },
      { rank: 2, playerId: 'p3', playerName: 'Player3', starCount: 2 },
    ])

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars/results/ev1', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rankings).toHaveLength(2)
    expect(body.rankings[0].rank).toBe(1)
  })

  it('認証なしで 401 が返る', async () => {
    const app = buildApp()
    const res = await app.request('/api/stars/results/ev1')

    expect(res.status).toBe(401)
  })

  it('EVENT_NOT_FOUND エラーで 404 が返る', async () => {
    const { starService } = await import('../services/star-service.js')
    vi.mocked(starService.getResults).mockResolvedValue({ code: 'EVENT_NOT_FOUND' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/stars/results/ev1', {
      headers: { Cookie: `token=${token}` },
    })

    expect(res.status).toBe(404)
  })
})
