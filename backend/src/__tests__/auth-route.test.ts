import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcryptjs from 'bcryptjs'
import { authRoute } from '../routes/auth.js'
import { Hono } from 'hono'

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key'
    vi.clearAllMocks()
  })

  function buildApp() {
    const app = new Hono()
    app.route('/api/auth', authRoute)
    return app
  }

  it('正常なログインで 200 と Cookie を返す', async () => {
    const pinHash = await bcryptjs.hash('1234', 10)
    const { db } = await import('../db/client.js')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 'player-1',
          name: 'テストプレイヤー',
          pinHash,
          team: 'FIRST',
          title: null,
          mainUnit: null,
          createdAt: new Date(),
        }]),
      }),
    })

    const app = buildApp()
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'テストプレイヤー', pin: '1234' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.playerId).toBe('player-1')
    expect(body.name).toBe('テストプレイヤー')
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('token=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('存在しないプレイヤーで 401 を返す', async () => {
    const { db } = await import('../db/client.js')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    const app = buildApp()
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: '存在しない', pin: '1234' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid credentials')
  })

  it('PIN 不一致で 401 を返す', async () => {
    const pinHash = await bcryptjs.hash('9999', 10)
    const { db } = await import('../db/client.js')
    const mockSelect = db.select as ReturnType<typeof vi.fn>
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 'player-1',
          name: 'テストプレイヤー',
          pinHash,
          team: 'FIRST',
          title: null,
          mainUnit: null,
          createdAt: new Date(),
        }]),
      }),
    })

    const app = buildApp()
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'テストプレイヤー', pin: '1234' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid credentials')
  })

  it('PIN が 4 桁数字でない場合 400 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'テスト', pin: 'abc' }),
    })
    expect(res.status).toBe(400)
  })

  it('playerName が空の場合 400 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: '', pin: '1234' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/logout', () => {
  function buildApp() {
    const app = new Hono()
    app.route('/api/auth', authRoute)
    return app
  }

  it('Cookie をクリアして 200 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/api/auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
