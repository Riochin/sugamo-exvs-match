import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { starsRoute } from '../routes/stars.js'
import { scoresRoute } from '../routes/scores.js'
import { sign } from '../lib/jwt.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('../routes/stream.js', () => ({
  hub: {
    broadcast: vi.fn().mockResolvedValue(undefined),
  },
}))

function buildStarsApp() {
  const app = new Hono()
  app.route('/api/stars', starsRoute)
  return app
}

function buildScoresApp() {
  const app = new Hono()
  app.route('/api/scores', scoresRoute)
  return app
}

async function playerToken(sub = 'player-1') {
  process.env.JWT_SECRET = 'test-secret-key'
  return sign({ sub, name: 'プレイヤー', isAdmin: false })
}

const validStarBody = {
  allocations: [
    { toPlayerId: 'p2', count: 2 },
    { toPlayerId: 'p3', count: 1 },
  ],
}

describe('統合テスト: POST /api/stars → star-service → DB', () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
    const { hub } = await import('../routes/stream.js')
    vi.mocked(hub.broadcast).mockResolvedValue(undefined)
  })

  it('正常系: stars 行と scores.starVotingSubmitted=true が DB に保存される', async () => {
    const { db } = await import('../db/client.js')

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
      }),
    } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ starVotingSubmitted: false }]),
      }),
    } as any)

    let insertValuesMock: ReturnType<typeof vi.fn>
    let updateSetMock: ReturnType<typeof vi.fn>

    vi.mocked(db.transaction).mockImplementationOnce(async (fn: (tx: any) => Promise<any>) => {
      insertValuesMock = vi.fn().mockResolvedValue(undefined)
      updateSetMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
      const txMock = {
        insert: vi.fn().mockReturnValue({ values: insertValuesMock }),
        update: vi.fn().mockReturnValue({ set: updateSetMock }),
      }
      return fn(txMock)
    })

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as any)

    const token = await playerToken('player-1')
    const app = buildStarsApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validStarBody),
    })

    expect(res.status).toBe(200)
    expect(vi.mocked(db.transaction)).toHaveBeenCalled()
    expect(insertValuesMock!).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ toPlayerId: 'p2', count: 2, eventId: 'ev1', fromPlayerId: 'player-1' }),
        expect.objectContaining({ toPlayerId: 'p3', count: 1, eventId: 'ev1', fromPlayerId: 'player-1' }),
      ]),
    )
    expect(updateSetMock!).toHaveBeenCalledWith({ starVotingSubmitted: true })
  })

  it('二重投票: 409 が返り DB トランザクションは実行されない', async () => {
    const { db } = await import('../db/client.js')

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
      }),
    } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ starVotingSubmitted: true }]),
      }),
    } as any)

    const token = await playerToken()
    const app = buildStarsApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validStarBody),
    })

    expect(res.status).toBe(409)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('STAR_VOTING 外フェーズ: 409 が返り DB トランザクションは実行されない', async () => {
    const { db } = await import('../db/client.js')

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'COLLECTING' }]),
      }),
    } as any)

    const token = await playerToken()
    const app = buildStarsApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validStarBody),
    })

    expect(res.status).toBe(409)
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled()
  })

  it('全員投票完了後: events.phase が REVEALING に自動遷移し SSE がブロードキャストされる', async () => {
    const { db } = await import('../db/client.js')
    const { hub } = await import('../routes/stream.js')

    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'ev1', phase: 'STAR_VOTING' }]),
      }),
    } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ starVotingSubmitted: false }]),
      }),
    } as any)

    vi.mocked(db.transaction).mockImplementationOnce(async (fn: (tx: any) => Promise<any>) => {
      const txMock = {
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      }
      return fn(txMock)
    })

    // completedCount = totalCount = 3 (all voted)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    } as any)

    const phaseWhereMock = vi.fn().mockResolvedValue(undefined)
    const phaseSetMock = vi.fn().mockReturnValue({ where: phaseWhereMock })
    vi.mocked(db.update).mockReturnValueOnce({ set: phaseSetMock } as any)

    const token = await playerToken()
    const app = buildStarsApp()
    const res = await app.request('/api/stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(validStarBody),
    })

    expect(res.status).toBe(200)
    expect(phaseSetMock).toHaveBeenCalledWith({ phase: 'REVEALING' })
    expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith('ev1', 'phase_update', { eventId: 'ev1', phase: 'REVEALING' })
  })
})

describe('統合テスト: POST /api/scores → score-service → DB（STAR_VOTING 自動遷移）', () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
    const { hub } = await import('../routes/stream.js')
    vi.mocked(hub.broadcast).mockResolvedValue(undefined)
  })

  it('スコア全員完了後: events.phase が STAR_VOTING に自動遷移し SSE がブロードキャストされる', async () => {
    const { db } = await import('../db/client.js')
    const { hub } = await import('../routes/stream.js')

    const activeEvent = { id: 'event-1', phase: 'COLLECTING', heldAt: new Date(), createdAt: new Date() }

    // select active event
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([activeEvent]),
      }),
    } as any)
    // select score record (not absent, not submitted)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'score-1', absent: false, submitted: false }]),
      }),
    } as any)

    // update score
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as any)

    // completed count = total count = 5 (all submitted)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    } as any)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    } as any)

    // phase update to STAR_VOTING
    const phaseWhereMock = vi.fn().mockResolvedValue(undefined)
    const phaseSetMock = vi.fn().mockReturnValue({ where: phaseWhereMock })
    vi.mocked(db.update).mockReturnValueOnce({ set: phaseSetMock } as any)

    const token = await playerToken()
    const app = buildScoresApp()
    const res = await app.request('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify({ matches: 10, wins: 5 }),
    })

    expect(res.status).toBe(200)
    expect(phaseSetMock).toHaveBeenCalledWith({ phase: 'STAR_VOTING' })
    expect(vi.mocked(hub.broadcast)).toHaveBeenCalledWith('event-1', 'phase_update', { eventId: 'event-1', phase: 'STAR_VOTING' })
  })
})
