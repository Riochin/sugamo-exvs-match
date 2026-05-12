import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { scoresRoute } from '../routes/scores.js'
import { sign } from '../lib/jwt.js'

vi.mock('../services/score-service.js', () => ({
  scoreService: {
    submitScore: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

function buildApp() {
  const app = new Hono()
  app.route('/api/scores', scoresRoute)
  return app
}

async function playerToken() {
  process.env.JWT_SECRET = 'test-secret-key'
  return sign({ sub: 'player-1', name: 'プレイヤー', isAdmin: false })
}

describe('POST /api/scores', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  it('認証済みプレイヤーが有効値を送信すると 200 が返る', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.submitScore).mockResolvedValue({
      eventId: 'event-1',
      completedCount: 2,
      totalCount: 5,
      allCompleted: false,
    })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 5, wins: 3 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completedCount).toBe(2)
    expect(body.totalCount).toBe(5)
  })

  it('認証なしで 401 が返る', async () => {
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches: 5, wins: 3 }),
    })

    expect(res.status).toBe(401)
  })

  it('wins > matches のバリデーションエラーで 400 が返る', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 3, wins: 5 }),
    })

    expect(res.status).toBe(400)
  })

  it('負の matches でバリデーションエラー 400 が返る', async () => {
    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: -1, wins: 0 }),
    })

    expect(res.status).toBe(400)
  })

  it('PHASE_NOT_COLLECTING エラーで 409 が返る', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.submitScore).mockResolvedValue({ code: 'PHASE_NOT_COLLECTING', current: 'REVEALING' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 5, wins: 3 }),
    })

    expect(res.status).toBe(409)
  })

  it('PLAYER_ABSENT エラーで 409 が返る', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.submitScore).mockResolvedValue({ code: 'PLAYER_ABSENT' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 5, wins: 3 }),
    })

    expect(res.status).toBe(409)
  })

  it('NO_ACTIVE_EVENT エラーで 404 が返る', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.submitScore).mockResolvedValue({ code: 'NO_ACTIVE_EVENT' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 5, wins: 3 }),
    })

    expect(res.status).toBe(404)
  })

  it('SCORE_NOT_FOUND エラーで 404 が返る', async () => {
    const { scoreService } = await import('../services/score-service.js')
    vi.mocked(scoreService.submitScore).mockResolvedValue({ code: 'SCORE_NOT_FOUND' })

    const token = await playerToken()
    const app = buildApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 5, wins: 3 }),
    })

    expect(res.status).toBe(404)
  })
})
