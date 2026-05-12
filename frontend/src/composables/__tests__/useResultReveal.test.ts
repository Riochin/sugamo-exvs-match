import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  onerror: ((e: Event) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(handler)
  }

  dispatchEvent(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent
    this.listeners[type]?.forEach((h) => h(event))
  }

  triggerError() {
    if (this.onerror) this.onerror(new Event('error'))
  }

  close() {
    this.closed = true
  }
}

vi.stubGlobal('EventSource', MockEventSource)

const mockGetResult = vi.fn()
const mockPatchRevealPhase = vi.fn()

describe('useResultReveal', () => {
  beforeEach(() => {
    vi.resetModules()
    MockEventSource.instances = []

    vi.doMock('@/api/client', () => ({
      client: {
        api: {
          events: {
            ':id': {
              result: { $get: mockGetResult },
              'reveal-phase': { $patch: mockPatchRevealPhase },
            },
          },
        },
      },
    }))

    mockGetResult.mockReset()
    mockPatchRevealPhase.mockReset()

    mockGetResult.mockResolvedValue({
      ok: true,
      json: async () => ({
        eventId: 'event-1',
        revealPhase: 0,
        eventPhase: 'REVEALING',
        players: [],
      }),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ───── 5.1 initialize / 状態管理 ─────
  describe('initialize', () => {
    it('initialize後にrevealPhase・eventPhase・playersが正しく設定されること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, revealPhase, eventPhase, result } = useResultReveal()

      await initialize('event-1')

      expect(revealPhase.value).toBe(0)
      expect(eventPhase.value).toBe('REVEALING')
      expect(result.value?.players).toEqual([])
    })

    it('initialize後にSSE接続が開始されること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize } = useResultReveal()

      await initialize('event-1')

      expect(MockEventSource.instances).toHaveLength(1)
      expect(MockEventSource.instances[0].url).toContain('event-1')
    })

    it('initializeでisConnectedがtrueになること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, isConnected } = useResultReveal()

      await initialize('event-1')

      expect(isConnected.value).toBe(true)
    })

    it('phase_update SSEを受信したらrevealPhaseとeventPhaseが更新されること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, revealPhase, eventPhase } = useResultReveal()

      await initialize('event-1')
      MockEventSource.instances[0].dispatchEvent('phase_update', {
        eventId: 'event-1',
        phase: 'REVEALING',
        revealPhase: 1,
      })

      expect(revealPhase.value).toBe(1)
      expect(eventPhase.value).toBe('REVEALING')
    })

    it('fetchResult時にeventPhaseがDONEならrevealPhaseを3として扱うこと', async () => {
      mockGetResult.mockResolvedValue({
        ok: true,
        json: async () => ({
          eventId: 'event-1',
          revealPhase: 0,
          eventPhase: 'DONE',
          players: [],
        }),
      })

      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, revealPhase, eventPhase } = useResultReveal()

      await initialize('event-1')

      expect(revealPhase.value).toBe(3)
      expect(eventPhase.value).toBe('DONE')
    })

    it('phase_update SSEでeventPhase=DONEのときrevealPhaseが3になること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, revealPhase, eventPhase } = useResultReveal()

      await initialize('event-1')
      MockEventSource.instances[0].dispatchEvent('phase_update', {
        eventId: 'event-1',
        phase: 'DONE',
        revealPhase: 3,
      })

      expect(revealPhase.value).toBe(3)
      expect(eventPhase.value).toBe('DONE')
    })
  })

  // ───── 5.2 SSE再接続 ─────
  describe('SSE再接続', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('onerror検知後に1000msで再接続を試みること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize } = useResultReveal()

      await initialize('event-1')
      MockEventSource.instances[0].triggerError()

      vi.advanceTimersByTime(1000)
      await flushPromises()

      expect(MockEventSource.instances).toHaveLength(2)
      expect(MockEventSource.instances[1].url).toContain('event-1')
    })

    it('onerror後はisConnected=false、再接続後はtrueに戻ること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, isConnected } = useResultReveal()

      await initialize('event-1')
      expect(isConnected.value).toBe(true)

      MockEventSource.instances[0].triggerError()
      expect(isConnected.value).toBe(false)

      vi.advanceTimersByTime(1000)
      await flushPromises()

      expect(isConnected.value).toBe(true)
    })

    it('再接続成功後にGET /resultを呼び出してフェーズを同期すること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize } = useResultReveal()

      await initialize('event-1')
      expect(mockGetResult).toHaveBeenCalledTimes(1)

      MockEventSource.instances[0].triggerError()
      vi.advanceTimersByTime(1000)
      await flushPromises()

      expect(mockGetResult).toHaveBeenCalledTimes(2)
    })

    it('2回目の再接続は2000msの遅延を使うこと', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize } = useResultReveal()

      await initialize('event-1')

      MockEventSource.instances[0].triggerError()
      vi.advanceTimersByTime(1000)
      await flushPromises()

      MockEventSource.instances[1].triggerError()
      vi.advanceTimersByTime(1999)
      expect(MockEventSource.instances).toHaveLength(2)

      vi.advanceTimersByTime(1)
      await flushPromises()
      expect(MockEventSource.instances).toHaveLength(3)
    })

    it('3回の再接続失敗後にisConnected=falseとなりリロードメッセージが設定されること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, isConnected, error } = useResultReveal()

      await initialize('event-1')

      MockEventSource.instances[0].triggerError()
      vi.advanceTimersByTime(1000)
      await flushPromises()

      MockEventSource.instances[1].triggerError()
      vi.advanceTimersByTime(2000)
      await flushPromises()

      MockEventSource.instances[2].triggerError()
      vi.advanceTimersByTime(4000)
      await flushPromises()

      MockEventSource.instances[3].triggerError()

      expect(isConnected.value).toBe(false)
      expect(error.value).toContain('リロード')
    })
  })

  // ───── 5.3 advancePhase・クリーンアップ ─────
  describe('advancePhase', () => {
    it('PATCH /reveal-phaseを正しい引数で呼び出すこと', async () => {
      mockPatchRevealPhase.mockResolvedValue({
        ok: true,
        json: async () => ({ revealPhase: 1, eventPhase: 'REVEALING' }),
      })

      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, advancePhase } = useResultReveal()

      await initialize('event-1')
      await advancePhase()

      expect(mockPatchRevealPhase).toHaveBeenCalledWith({ param: { id: 'event-1' } })
    })

    it('advancePhase呼び出し中はisLoading=trueになること', async () => {
      let resolvePost!: (v: unknown) => void
      mockPatchRevealPhase.mockReturnValue(new Promise((r) => { resolvePost = r }))

      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, advancePhase, isLoading } = useResultReveal()

      await initialize('event-1')
      const promise = advancePhase()
      expect(isLoading.value).toBe(true)

      resolvePost({ ok: true, json: async () => ({ revealPhase: 1, eventPhase: 'REVEALING' }) })
      await promise

      expect(isLoading.value).toBe(false)
    })

    it('二重送信防止: isLoading=trueのときadvancePhaseはAPIを呼ばないこと', async () => {
      let resolvePost!: (v: unknown) => void
      mockPatchRevealPhase.mockReturnValue(new Promise((r) => { resolvePost = r }))

      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, advancePhase } = useResultReveal()

      await initialize('event-1')
      const p1 = advancePhase()
      const p2 = advancePhase()

      resolvePost({ ok: true, json: async () => ({ revealPhase: 1, eventPhase: 'REVEALING' }) })
      await Promise.all([p1, p2])

      expect(mockPatchRevealPhase).toHaveBeenCalledTimes(1)
    })

    it('advancePhase失敗時にerror状態にエラーメッセージが設定されること', async () => {
      mockPatchRevealPhase.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'REVEAL_PHASE_MAXED' }),
      })

      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, advancePhase, error } = useResultReveal()

      await initialize('event-1')
      await advancePhase()

      expect(error.value).not.toBeNull()
    })

    it('ネットワークエラー時にerror状態にメッセージが設定されること', async () => {
      mockPatchRevealPhase.mockRejectedValue(new Error('network error'))

      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, advancePhase, error } = useResultReveal()

      await initialize('event-1')
      await advancePhase()

      expect(error.value).not.toBeNull()
    })

    it('cleanup後にEventSourceがクローズされること', async () => {
      const { useResultReveal } = await import('../useResultReveal')
      const { initialize, cleanup } = useResultReveal()

      await initialize('event-1')
      const source = MockEventSource.instances[0]

      cleanup()

      expect(source.closed).toBe(true)
    })

    it('onUnmountedでcleanupが自動呼び出しされること', async () => {
      const { useResultReveal } = await import('../useResultReveal')

      const TestComponent = defineComponent({
        setup() {
          const { initialize } = useResultReveal()
          initialize('event-1')
          return {}
        },
        template: '<div />',
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const source = MockEventSource.instances[0]
      expect(source.closed).toBe(false)

      wrapper.unmount()

      expect(source.closed).toBe(true)
    })
  })
})
