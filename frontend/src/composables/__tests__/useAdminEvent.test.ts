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
  scores: [{ playerId: 'p1', playerName: 'Alice', wins: 0, losses: 0, absent: false, submitted: false }],
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
      json: async () => ({ events: [] }),
    })
  })

  it('初期化時に refresh() が呼ばれ activeEvents が空配列に設定される', async () => {
    const { useAdminEvent } = await import('../useAdminEvent')
    const { activeEvents } = useAdminEvent()

    await flushPromises()

    expect(mockGetActiveFn).toHaveBeenCalledOnce()
    expect(activeEvents.value).toEqual([])
  })

  it('初期化時に進行中大会がある場合 activeEvents に設定される', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ events: [mockActiveEvent] }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { activeEvents } = useAdminEvent()

    await flushPromises()

    expect(activeEvents.value).toEqual([mockActiveEvent])
  })

  it('COLLECTING イベントは collectingEvents に含まれる', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ events: [mockActiveEvent] }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { collectingEvents } = useAdminEvent()

    await flushPromises()

    expect(collectingEvents.value).toEqual([mockActiveEvent])
  })

  it('STAR_VOTING イベントは ceremonyEvent に設定される', async () => {
    const ceremonyEvent = { ...mockActiveEvent, phase: 'STAR_VOTING' as const }
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ events: [ceremonyEvent] }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { ceremonyEvent: ceremony } = useAdminEvent()

    await flushPromises()

    expect(ceremony.value).toEqual(ceremonyEvent)
  })

  it('COLLECTING イベントは ceremonyEvent に含まれない', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ events: [mockActiveEvent] }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { ceremonyEvent } = useAdminEvent()

    await flushPromises()

    expect(ceremonyEvent.value).toBeNull()
  })

  it('createEvent() 成功後に refresh() が呼ばれ activeEvents が更新される', async () => {
    mockCreateEventFn.mockResolvedValue({
      ok: true,
      json: async () => mockActiveEvent,
    })
    mockGetActiveFn
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [mockActiveEvent] }) })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { createEvent, activeEvents } = useAdminEvent()

    await flushPromises()
    expect(activeEvents.value).toEqual([])

    await createEvent(validCreateParams)

    expect(activeEvents.value).toEqual([mockActiveEvent])
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

  it('advancePhase() 成功後に refresh() が呼ばれ activeEvents の phase が更新される', async () => {
    const revealingEvent = { ...mockActiveEvent, phase: 'REVEALING' as const }
    mockGetActiveFn
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [mockActiveEvent] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [revealingEvent] }) })
    mockAdvancePhaseFn.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'event-1', phase: 'REVEALING' }),
    })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { advancePhase, activeEvents } = useAdminEvent()

    await flushPromises()
    expect(activeEvents.value[0]?.phase).toBe('COLLECTING')

    await advancePhase('event-1')

    expect(activeEvents.value[0]?.phase).toBe('REVEALING')
  })

  it('setAbsent() 成功後に refresh() が呼ばれる', async () => {
    mockGetActiveFn.mockResolvedValue({ ok: true, json: async () => ({ events: [mockActiveEvent] }) })
    mockSetAbsentFn.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { useAdminEvent } = await import('../useAdminEvent')
    const { setAbsent } = useAdminEvent()

    await flushPromises()

    await setAbsent('event-1', 'p1', true)

    expect(mockGetActiveFn).toHaveBeenCalledTimes(2)
  })

  it('refresh() が API エラー時に error を設定する', async () => {
    mockGetActiveFn
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) })
      .mockRejectedValueOnce(new Error('network error'))

    const { useAdminEvent } = await import('../useAdminEvent')
    const { refresh, error } = useAdminEvent()

    await flushPromises()

    await refresh()

    expect(error.value).not.toBeNull()
  })
})
