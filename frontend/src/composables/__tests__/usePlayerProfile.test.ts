import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'

const mockProfileGetFn = vi.fn()

describe('usePlayerProfile', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          players: {
            ':id': {
              profile: {
                $get: mockProfileGetFn,
              },
            },
          },
        },
      },
    }))
    mockProfileGetFn.mockReset()
  })

  it('初期化時に GET /api/players/:id/profile を呼び出しプロフィールを取得する', async () => {
    const profileData = {
      id: 'p1',
      name: 'Alice',
      team: 'FIRST',
      title: '勇者',
      mainUnit: 'ユニコーンガンダム',
      winRateHistory: [],
    }
    mockProfileGetFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => profileData,
    })

    const { usePlayerProfile } = await import('../usePlayerProfile')
    const { profile, isLoading, notFound } = usePlayerProfile(ref('p1'))

    await flushPromises()

    expect(profile.value).toEqual(profileData)
    expect(isLoading.value).toBe(false)
    expect(notFound.value).toBe(false)
  })

  it('404 レスポンス時に notFound = true・profile = null になる', async () => {
    mockProfileGetFn.mockResolvedValue({ ok: false, status: 404 })

    const { usePlayerProfile } = await import('../usePlayerProfile')
    const { profile, notFound, error } = usePlayerProfile(ref('unknown-id'))

    await flushPromises()

    expect(profile.value).toBeNull()
    expect(notFound.value).toBe(true)
    expect(error.value).toBeNull()
  })

  it('404 以外の API エラー時に error にメッセージがセットされる', async () => {
    mockProfileGetFn.mockResolvedValue({ ok: false, status: 500 })

    const { usePlayerProfile } = await import('../usePlayerProfile')
    const { error, notFound } = usePlayerProfile(ref('p1'))

    await flushPromises()

    expect(error.value).not.toBeNull()
    expect(notFound.value).toBe(false)
  })

  it('ネットワークエラー時に error にメッセージがセットされる', async () => {
    mockProfileGetFn.mockRejectedValue(new Error('network error'))

    const { usePlayerProfile } = await import('../usePlayerProfile')
    const { error } = usePlayerProfile(ref('p1'))

    await flushPromises()

    expect(error.value).not.toBeNull()
  })

  it('取得中は isLoading = true になる', async () => {
    let resolveGet!: (v: unknown) => void
    mockProfileGetFn.mockReturnValue(new Promise((r) => { resolveGet = r }))

    const { usePlayerProfile } = await import('../usePlayerProfile')
    const { isLoading } = usePlayerProfile(ref('p1'))

    expect(isLoading.value).toBe(true)

    resolveGet({ ok: true, status: 200, json: async () => ({ id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, winRateHistory: [] }) })
    await flushPromises()

    expect(isLoading.value).toBe(false)
  })
})
