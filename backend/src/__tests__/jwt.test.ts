import { describe, it, expect, beforeEach } from 'vitest'
import { sign, verify } from '../lib/jwt.js'

describe('JwtHelper', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-testing'
  })

  describe('sign', () => {
    it('ペイロードから JWT トークンを生成する', async () => {
      const token = await sign({ sub: 'player-1', name: 'テストプレイヤー', isAdmin: false })
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('JWT_SECRET が未設定の場合はエラーを投げる', async () => {
      delete process.env.JWT_SECRET
      await expect(sign({ sub: 'player-1', name: 'テスト', isAdmin: false })).rejects.toThrow()
    })
  })

  describe('verify', () => {
    it('有効なトークンを検証してペイロードを返す', async () => {
      const token = await sign({ sub: 'player-1', name: 'テストプレイヤー', isAdmin: false })
      const payload = await verify(token)
      expect(payload.sub).toBe('player-1')
      expect(payload.name).toBe('テストプレイヤー')
    })

    it('isAdmin: true クレームを含む JWT を生成・検証できる', async () => {
      const token = await sign({ sub: 'admin-1', name: '管理者', isAdmin: true })
      const payload = await verify(token)
      expect(payload.isAdmin).toBe(true)
    })

    it('isAdmin: false クレームを含む JWT を生成・検証できる', async () => {
      const token = await sign({ sub: 'player-1', name: '一般', isAdmin: false })
      const payload = await verify(token)
      expect(payload.isAdmin).toBe(false)
    })

    it('改ざんされたトークンは拒否する', async () => {
      const token = await sign({ sub: 'player-1', name: 'テスト', isAdmin: false })
      const tampered = token.slice(0, -5) + 'XXXXX'
      await expect(verify(tampered)).rejects.toThrow()
    })

    it('別のシークレットで署名されたトークンは拒否する', async () => {
      process.env.JWT_SECRET = 'secret-a'
      const token = await sign({ sub: 'player-1', name: 'テスト', isAdmin: false })
      process.env.JWT_SECRET = 'secret-b'
      await expect(verify(token)).rejects.toThrow()
    })
  })
})
