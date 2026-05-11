import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClient = { api: { players: { $get: vi.fn() } } }
vi.mock('hono/client', () => ({ hc: vi.fn(() => mockClient) }))

describe('client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('VITE_API_BASE_URL 未設定時は "/" をベース URL として hc を呼び出す', async () => {
    const { hc } = await import('hono/client')
    vi.mocked(hc).mockReturnValue(mockClient as unknown as ReturnType<typeof hc>)

    const { client } = await import('../client')

    expect(hc).toHaveBeenCalledWith('/')
    expect(client).toBe(mockClient)
  })

  it('VITE_API_BASE_URL が設定されているときはその値をベース URL として使う', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
    const { hc } = await import('hono/client')
    vi.mocked(hc).mockReturnValue(mockClient as unknown as ReturnType<typeof hc>)

    const { client } = await import('../client')

    expect(hc).toHaveBeenCalledWith('https://api.example.com')
    vi.unstubAllEnvs()
  })
})
