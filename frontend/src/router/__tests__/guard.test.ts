import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref, computed } from 'vue'

const mockCurrentPlayer = ref<{ playerId: string; name: string; isAdmin: boolean } | null>(null)
const mockIsLoading = ref(false)
const mockRestoreSession = vi.fn()

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentPlayer: mockCurrentPlayer,
    isAuthenticated: computed(() => mockCurrentPlayer.value !== null),
    isLoading: mockIsLoading,
    login: vi.fn(),
    logout: vi.fn(),
    restoreSession: mockRestoreSession,
  }),
}))

async function buildRouter(authenticated: boolean, isAdmin = false) {
  mockCurrentPlayer.value = authenticated
    ? { playerId: 'p1', name: 'Alice', isAdmin }
    : null
  mockIsLoading.value = false
  mockRestoreSession.mockResolvedValue(undefined)

  const { router } = await import('../index')
  router.currentRoute // warm up
  return router
}

describe('ルートガード', () => {
  beforeEach(() => {
    vi.resetModules()
    mockCurrentPlayer.value = null
    mockIsLoading.value = false
    mockRestoreSession.mockReset()
    mockRestoreSession.mockResolvedValue(undefined)
  })

  it('未認証で requiresAuth ルートにアクセスすると /login へリダイレクトされる', async () => {
    const router = await buildRouter(false)
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/')
  })

  it('認証済みで /login にアクセスすると / へリダイレクトされる', async () => {
    const router = await buildRouter(true)
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('認証済みで requiresAuth ルートにアクセスするとそのまま表示される', async () => {
    const router = await buildRouter(true)
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('未認証で /login にアクセスするとそのまま表示される', async () => {
    const router = await buildRouter(false)
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('restoreSession は初回ナビゲーションのみ呼ばれる', async () => {
    const router = await buildRouter(true)
    await router.push('/')
    await router.push('/group')
    expect(mockRestoreSession).toHaveBeenCalledTimes(1)
  })

  it('管理者ユーザーで /admin にアクセスするとそのまま表示される', async () => {
    const router = await buildRouter(true, true)
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/admin')
  })

  it('非管理者ユーザーで /admin にアクセスすると / へリダイレクトされる', async () => {
    const router = await buildRouter(true, false)
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('未認証で /admin にアクセスすると /login へリダイレクトされる', async () => {
    const router = await buildRouter(false)
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
