import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const mockPlayersGetFn = vi.fn()

describe('useGroupProfile', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          players: {
            $get: mockPlayersGetFn,
          },
        },
      },
    }))
    mockPlayersGetFn.mockReset()
  })

  it('初期化時に GET /api/players を呼び出し firstTeam・secondTeam を分類する', async () => {
    mockPlayersGetFn.mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'p2', name: 'Bob', team: 'SECOND', title: null, mainUnit: null, createdAt: '2026-01-01T00:00:00Z' },
      ]),
    })

    const { useGroupProfile } = await import('../useGroupProfile')
    const { firstTeam, secondTeam, isLoading } = useGroupProfile()

    await flushPromises()

    expect(firstTeam.value).toHaveLength(1)
    expect(firstTeam.value[0].name).toBe('Alice')
    expect(secondTeam.value).toHaveLength(1)
    expect(secondTeam.value[0].name).toBe('Bob')
    expect(isLoading.value).toBe(false)
  })

  it('FIRST プレイヤーが複数いる場合は全員 firstTeam に入る', async () => {
    mockPlayersGetFn.mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'p2', name: 'Bob', team: 'FIRST', title: null, mainUnit: null, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'p3', name: 'Carol', team: 'SECOND', title: null, mainUnit: null, createdAt: '2026-01-01T00:00:00Z' },
      ]),
    })

    const { useGroupProfile } = await import('../useGroupProfile')
    const { firstTeam, secondTeam } = useGroupProfile()

    await flushPromises()

    expect(firstTeam.value).toHaveLength(2)
    expect(secondTeam.value).toHaveLength(1)
  })

  it('API エラー時に error にメッセージがセットされる', async () => {
    mockPlayersGetFn.mockResolvedValue({ ok: false, status: 500 })

    const { useGroupProfile } = await import('../useGroupProfile')
    const { error, firstTeam, secondTeam } = useGroupProfile()

    await flushPromises()

    expect(error.value).not.toBeNull()
    expect(firstTeam.value).toHaveLength(0)
    expect(secondTeam.value).toHaveLength(0)
  })

  it('ネットワークエラー時に error にメッセージがセットされる', async () => {
    mockPlayersGetFn.mockRejectedValue(new Error('network error'))

    const { useGroupProfile } = await import('../useGroupProfile')
    const { error } = useGroupProfile()

    await flushPromises()

    expect(error.value).not.toBeNull()
  })

  it('isLoading = true のとき refresh() を呼んでも API を重複呼び出ししない', async () => {
    let resolveGet!: (v: unknown) => void
    mockPlayersGetFn.mockReturnValue(new Promise((r) => { resolveGet = r }))

    const { useGroupProfile } = await import('../useGroupProfile')
    const { isLoading, refresh } = useGroupProfile()

    expect(isLoading.value).toBe(true)

    await refresh()

    expect(mockPlayersGetFn).toHaveBeenCalledTimes(1)

    resolveGet({ ok: true, json: async () => ([]) })
    await flushPromises()
  })
})
