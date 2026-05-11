import { describe, it, expect, beforeEach } from 'vitest'
import { sign, verify } from '../lib/jwt.js'

describe('JwtHelper', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-testing'
  })

  describe('sign', () => {
    it('ペイロードから JWT トークンを生成する', async () => {
      const token = await sign({ sub: 'player-1', name: 'テストプレイヤー' })
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('JWT_SECRET が未設定の場合はエラーを投げる', async () => {
      delete process.env.JWT_SECRET
      await expect(sign({ sub: 'player-1', name: 'テスト' })).rejects.toThrow()
    })
  })

  describe('verify', () => {
    it('有効なトークンを検証してペイロードを返す', async () => {
      const token = await sign({ sub: 'player-1', name: 'テストプレイヤー' })
      const payload = await verify(token)
      expect(payload.sub).toBe('player-1')
      expect(payload.name).toBe('テストプレイヤー')
    })

    it('改ざんされたトークンは拒否する', async () => {
      const token = await sign({ sub: 'player-1', name: 'テスト' })
      const tampered = token.slice(0, -5) + 'XXXXX'
      await expect(verify(tampered)).rejects.toThrow()
    })

    it('別のシークレットで署名されたトークンは拒否する', async () => {
      process.env.JWT_SECRET = 'secret-a'
      const token = await sign({ sub: 'player-1', name: 'テスト' })
      process.env.JWT_SECRET = 'secret-b'
      await expect(verify(token)).rejects.toThrow()
    })
  })
})
