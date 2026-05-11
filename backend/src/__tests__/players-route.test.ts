import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { playersRoute } from '../routes/players.js'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('GET /api/players', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function buildApp() {
    const app = new Hono()
    app.route('/api/players', playersRoute)
    return app
  }

  it('認証なしで 200 とプレイヤー一覧を返す', async () => {
    const { db } = await import('../db/client.js')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: new Date() },
        { id: 'p2', name: 'Bob', team: 'SECOND', title: null, mainUnit: null, createdAt: new Date() },
      ]),
    })

    const app = buildApp()
    const res = await app.request('/api/players', { method: 'GET' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe('p1')
    expect(body[0]).not.toHaveProperty('pinHash')
  })

  it('プレイヤーが存在しない場合は空配列を返す', async () => {
    const { db } = await import('../db/client.js')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    })

    const app = buildApp()
    const res = await app.request('/api/players', { method: 'GET' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
