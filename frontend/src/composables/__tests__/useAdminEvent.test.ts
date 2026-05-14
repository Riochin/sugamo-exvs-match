import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const mockGetActiveFn = vi.fn()
const mockCreateEventFn = vi.fn()
const mockSetAbsentFn = vi.fn()
const mockAdvancePhaseFn = vi.fn()

const mockActiveEvent = {
  id: 'event-1',
  name: 'テスト大会',
  hasPromotionRelegation: false,
  venue: null,
  description: null,
  phase: 'COLLECTING' as const,
  heldAt: '2026-05-12T00:00:00.000Z',
  scores: [{ playerId: 'p1', playerName: 'Alice', wins: 0, losses: 0, absent: false }],
}

const validCreateParams = { heldAt: new Date('2026-05-12T00:00:00.000Z'), name: 'テスト大会', hasPromotionRelegation: false }

describe('useAdminEvent', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          events: {
            $post: mockCreateEventFn,
            active: { $get: mockGetActiveFn },
            ':id': {
              absent: { ':playerId': { $patch: mockSetAbsentFn } },
              phase: { $patch: mockAdvancePhaseFn },
            },
          },
        },
      },
    }))
    mockGetActiveFn.mockReset()
    mockCreateEventFn.mockReset()
    mockSetAbsentFn.mockReset()
    mockAdvancePhaseFn.mockReset()

    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: null }),
    })
  })

  it('初期化時に refresh() が呼ばれ activeEvent が null に設定される', async () => {
    const { useAdminEvent } = await import('../useAdminEvent')
    const { activeEvent } = useAdminEvent()

    await flushPromises()

    expect(mockGetActiveFn).toHaveBeenCalledOnce()
    expect(activeEvent.value).toBeNull()
  })

  it('初期化時に進行中大会がある場合 activeEvent に設定される', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: mockActiveEvent }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { activeEvent } = useAdminEvent()

    await flushPromises()

    expect(activeEvent.value).toEqual(mockActiveEvent)
  })

  it('createEvent() 成功後に refresh() が呼ばれ activeEvent が更新される', async () => {
    mockCreateEventFn.mockResolvedValue({
      ok: true,
      json: async () => mockActiveEvent,
    })
    mockGetActiveFn
      .mockResolvedValueOnce({ ok: true, json: async () => ({ event: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ event: mockActiveEvent }) })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { createEvent, activeEvent } = useAdminEvent()

    await flushPromises()
    expect(activeEvent.value).toBeNull()

    await createEvent(validCreateParams)

    expect(activeEvent.value).toEqual(mockActiveEvent)
  })

  it('createEvent() 中は isLoading が true になり完了後 false に戻る', async () => {
    let resolveCreate!: (v: unknown) => void
    mockCreateEventFn.mockReturnValue(new Promise((r) => { resolveCreate = r }))

    const { useAdminEvent } = await import('../useAdminEvent')
    const { createEvent, isLoading } = useAdminEvent()

    await flushPromises()

    const createPromise = createEvent(validCreateParams)
    expect(isLoading.value).toBe(true)

    resolveCreate({ ok: true, json: async () => mockActiveEvent })
    await createPromise

    expect(isLoading.value).toBe(false)
  })

  it('createEvent() は isLoading 中の重複呼び出しを無視する', async () => {
    let resolveCreate!: (v: unknown) => void
    mockCreateEventFn.mockReturnValue(new Promise((r) => { resolveCreate = r }))

    const { useAdminEvent } = await import('../useAdminEvent')
    const { createEvent } = useAdminEvent()

    await flushPromises()

    createEvent(validCreateParams)
    createEvent(validCreateParams)

    resolveCreate({ ok: true, json: async () => mockActiveEvent })
    await flushPromises()

    expect(mockCreateEventFn).toHaveBeenCalledOnce()
  })

  it('createEvent() API エラー時に error に ErrorCode が設定される', async () => {
    mockCreateEventFn.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'ACTIVE_EVENT_EXISTS' }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { createEvent, error, isLoading } = useAdminEvent()

    await flushPromises()

    await createEvent(validCreateParams)

    expect(error.value).toBe('ACTIVE_EVENT_EXISTS')
    expect(isLoading.value).toBe(false)
  })

  it('advancePhase() 成功後に refresh() が呼ばれ activeEvent.phase が更新される', async () => {
    const revealingEvent = { ...mockActiveEvent, phase: 'REVEALING' as const }
    mockGetActiveFn
      .mockResolvedValueOnce({ ok: true, json: async () => ({ event: mockActiveEvent }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ event: revealingEvent }) })
    mockAdvancePhaseFn.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'event-1', phase: 'REVEALING' }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { advancePhase, activeEvent } = useAdminEvent()

    await flushPromises()
    expect(activeEvent.value?.phase).toBe('COLLECTING')

    await advancePhase()

    expect(activeEvent.value?.phase).toBe('REVEALING')
  })

  it('advancePhase() は activeEvent が null のとき何もしない', async () => {
    const { useAdminEvent } = await import('../useAdminEvent')
    const { advancePhase } = useAdminEvent()

    await flushPromises()

    await advancePhase()

    expect(mockAdvancePhaseFn).not.toHaveBeenCalled()
  })

  it('setAbsent() 成功後に refresh() が呼ばれる', async () => {
    mockGetActiveFn.mockResolvedValue({ ok: true, json: async () => ({ event: mockActiveEvent }) })
    mockSetAbsentFn.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { setAbsent } = useAdminEvent()

    await flushPromises()

    await setAbsent('p1', true)

    expect(mockGetActiveFn).toHaveBeenCalledTimes(2)
  })

  it('setAbsent() は activeEvent が null のとき何もしない', async () => {
    const { useAdminEvent } = await import('../useAdminEvent')
    const { setAbsent } = useAdminEvent()

    await flushPromises()

    await setAbsent('p1', true)

    expect(mockSetAbsentFn).not.toHaveBeenCalled()
  })

  it('refresh() が API エラー時に error を設定する', async () => {
    mockGetActiveFn
      .mockResolvedValueOnce({ ok: true, json: async () => ({ event: null }) })
      .mockRejectedValueOnce(new Error('network error'))

    const { useAdminEvent } = await import('../useAdminEvent')
    const { refresh, error } = useAdminEvent()

    await flushPromises()

    await refresh()

    expect(error.value).not.toBeNull()
  })
})
