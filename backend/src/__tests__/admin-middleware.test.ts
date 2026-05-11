import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign, type JwtPayload } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import { adminMiddleware } from '../middleware/admin.js'

describe('adminMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-testing'
  })

  function buildApp() {
    const app = new Hono<{ Variables: { jwtPayload: JwtPayload } }>()
    app.use('/admin', authMiddleware)
    app.use('/admin', adminMiddleware)
    app.get('/admin', (c) => c.json({ ok: true }))
    return app
  }

  it('isAdmin=true の JWT で次のハンドラへ進む', async () => {
    const token = await sign({ sub: 'admin-1', name: '管理者', isAdmin: true })
    const app = buildApp()
    const res = await app.request('/admin', {
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('isAdmin=false の JWT で 403 を返す', async () => {
    const token = await sign({ sub: 'player-1', name: '一般プレイヤー', isAdmin: false })
    const app = buildApp()
    const res = await app.request('/admin', {
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('Cookie なしで 401 を返す（authMiddleware が処理）', async () => {
    const app = buildApp()
    const res = await app.request('/admin')
    expect(res.status).toBe(401)
  })
})
