import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign, type JwtPayload } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'

describe('authMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-testing'
  })

  function buildApp() {
    const app = new Hono<{ Variables: { jwtPayload: JwtPayload } }>()
    app.use('/protected', authMiddleware)
    app.get('/protected', (c) => {
      const payload = c.get('jwtPayload')
      return c.json({ sub: payload.sub, name: payload.name })
    })
    return app
  }

  it('有効な Cookie トークンで 200 と jwtPayload をセットする', async () => {
    const token = await sign({ sub: 'player-1', name: 'テストプレイヤー' })
    const app = buildApp()
    const res = await app.request('/protected', {
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sub).toBe('player-1')
    expect(body.name).toBe('テストプレイヤー')
  })

  it('Cookie なしで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('無効なトークンで 401 を返す', async () => {
    const app = buildApp()
    const res = await app.request('/protected', {
      headers: { Cookie: 'token=invalid.token.here' },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('別シークレットで署名されたトークンで 401 を返す', async () => {
    process.env.JWT_SECRET = 'secret-a'
    const token = await sign({ sub: 'player-1', name: 'テスト' })
    process.env.JWT_SECRET = 'secret-b'
    const app = buildApp()
    const res = await app.request('/protected', {
      headers: { Cookie: `token=${token}` },
    })
    expect(res.status).toBe(401)
  })
})
