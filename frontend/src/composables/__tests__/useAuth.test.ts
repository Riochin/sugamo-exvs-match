import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoginFn = vi.fn()
const mockLogoutFn = vi.fn()
const mockMeFn = vi.fn()

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          auth: {
            login: { $post: mockLoginFn },
            logout: { $post: mockLogoutFn },
            me: { $get: mockMeFn },
          },
        },
      },
    }))
    mockLoginFn.mockReset()
    mockLogoutFn.mockReset()
    mockMeFn.mockReset()
  })

  it('login() 成功時に currentPlayer がセットされ ok:true が返る', async () => {
    mockLoginFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice', isAdmin: false }),
    })

    const { useAuth } = await import('../useAuth')
    const { login, currentPlayer } = useAuth()

    const result = await login('Alice', '1234')

    expect(result).toEqual({ ok: true, player: { playerId: 'p1', name: 'Alice', isAdmin: false } })
    expect(currentPlayer.value).toEqual({ playerId: 'p1', name: 'Alice', isAdmin: false })
  })

  it('login() 成功時に isAdmin: true が currentPlayer に反映される', async () => {
    mockLoginFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice', isAdmin: true }),
    })

    const { useAuth } = await import('../useAuth')
    const { login, currentPlayer } = useAuth()

    await login('Alice', '1234')

    expect(currentPlayer.value?.isAdmin).toBe(true)
  })

  it('login() 401時に INVALID_CREDENTIALS errorCode が返る', async () => {
    mockLoginFn.mockResolvedValue({ ok: false, status: 401 })

    const { useAuth } = await import('../useAuth')
    const { login, currentPlayer } = useAuth()

    const result = await login('Alice', '9999')

    expect(result).toMatchObject({ ok: false, errorCode: 'INVALID_CREDENTIALS' })
    expect(currentPlayer.value).toBeNull()
  })

  it('login() 400時に VALIDATION_ERROR errorCode が返る', async () => {
    mockLoginFn.mockResolvedValue({ ok: false, status: 400 })

    const { useAuth } = await import('../useAuth')
    const { login } = useAuth()

    const result = await login('', 'abc')

    expect(result).toMatchObject({ ok: false, errorCode: 'VALIDATION_ERROR' })
  })

  it('login() がネットワークエラーで失敗した場合 NETWORK_ERROR が返る', async () => {
    mockLoginFn.mockRejectedValue(new Error('network error'))

    const { useAuth } = await import('../useAuth')
    const { login, currentPlayer } = useAuth()

    const result = await login('Alice', '1234')

    expect(result).toMatchObject({ ok: false, errorCode: 'NETWORK_ERROR' })
    expect(currentPlayer.value).toBeNull()
  })

  it('logout() が API を呼び出し currentPlayer を null にクリアする', async () => {
    mockLoginFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice' }),
    })
    mockLogoutFn.mockResolvedValue({ ok: true })

    const { useAuth } = await import('../useAuth')
    const { login, logout, currentPlayer } = useAuth()

    await login('Alice', '1234')
    expect(currentPlayer.value).not.toBeNull()

    await logout()

    expect(mockLogoutFn).toHaveBeenCalledOnce()
    expect(currentPlayer.value).toBeNull()
  })

  it('logout() は API エラーが発生しても currentPlayer を null にクリアする', async () => {
    mockLoginFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice' }),
    })
    mockLogoutFn.mockRejectedValue(new Error('network error'))

    const { useAuth } = await import('../useAuth')
    const { login, logout, currentPlayer } = useAuth()

    await login('Alice', '1234')
    expect(currentPlayer.value).not.toBeNull()

    await logout()

    expect(currentPlayer.value).toBeNull()
  })

  it('restoreSession() 200時に currentPlayer がセットされ isLoading が false に戻る', async () => {
    mockMeFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice', isAdmin: false }),
    })

    const { useAuth } = await import('../useAuth')
    const { restoreSession, currentPlayer, isLoading } = useAuth()

    await restoreSession()

    expect(currentPlayer.value).toEqual({ playerId: 'p1', name: 'Alice', isAdmin: false })
    expect(isLoading.value).toBe(false)
  })

  it('restoreSession() 200時に isAdmin が currentPlayer に反映される', async () => {
    mockMeFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice', isAdmin: true }),
    })

    const { useAuth } = await import('../useAuth')
    const { restoreSession, currentPlayer } = useAuth()

    await restoreSession()

    expect(currentPlayer.value?.isAdmin).toBe(true)
  })

  it('restoreSession() 401時に currentPlayer が null のままで isLoading が false に戻る', async () => {
    mockMeFn.mockResolvedValue({ ok: false, status: 401 })

    const { useAuth } = await import('../useAuth')
    const { restoreSession, currentPlayer, isLoading } = useAuth()

    await restoreSession()

    expect(currentPlayer.value).toBeNull()
    expect(isLoading.value).toBe(false)
  })

  it('isAuthenticated は currentPlayer !== null と等価である', async () => {
    mockLoginFn.mockResolvedValue({
      ok: true,
      json: async () => ({ playerId: 'p1', name: 'Alice' }),
    })
    mockLogoutFn.mockResolvedValue({ ok: true })

    const { useAuth } = await import('../useAuth')
    const { login, logout, isAuthenticated } = useAuth()

    expect(isAuthenticated.value).toBe(false)

    await login('Alice', '1234')
    expect(isAuthenticated.value).toBe(true)

    await logout()
    expect(isAuthenticated.value).toBe(false)
  })
})
