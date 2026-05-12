import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'

// EventSource のモック
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {}
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(handler)
  }

  removeEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) return
    this.listeners[type] = this.listeners[type].filter((h) => h !== handler)
  }

  dispatchEvent(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent
    this.listeners[type]?.forEach((h) => h(event))
  }

  close() {
    this.closed = true
  }
}

vi.stubGlobal('EventSource', MockEventSource)

describe('useEventStream', () => {
  beforeEach(() => {
    MockEventSource.instances = []
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('connect() で EventSource を生成し isConnected が true になる', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, isConnected } = useEventStream()

    connect('event-1')

    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toContain('event-1')
    expect(isConnected.value).toBe(true)
  })

  it('progress_update イベントを受信したとき progressUpdate ref が更新される', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, progressUpdate } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('progress_update', { completedCount: 3, totalCount: 10 })

    expect(progressUpdate.value).toEqual({ completedCount: 3, totalCount: 10 })
  })

  it('result_ready イベントを受信したとき resultReady が true になる', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, resultReady } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('result_ready', { eventId: 'event-1' })

    expect(resultReady.value).toBe(true)
  })

  it('phase_update イベントを受信したとき currentPhase ref が更新される', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, currentPhase } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('phase_update', { eventId: 'event-1', phase: 'REVEALING' })

    expect(currentPhase.value).toBe('REVEALING')
  })

  it('phase_update イベントを受信したとき latestPhaseUpdate に eventId と phase が含まれる', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, latestPhaseUpdate } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('phase_update', { eventId: 'event-1', phase: 'COLLECTING' })

    expect(latestPhaseUpdate.value).toEqual({ eventId: 'event-1', phase: 'COLLECTING' })
  })

  it('phase_update イベントに revealPhase フィールドが含まれる場合 latestPhaseUpdate に反映される', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, latestPhaseUpdate } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('phase_update', { eventId: 'event-1', phase: 'REVEALING', revealPhase: 2 })

    expect(latestPhaseUpdate.value).toEqual({ eventId: 'event-1', phase: 'REVEALING', revealPhase: 2 })
  })

  it('phase_update イベントに revealPhase がない場合も latestPhaseUpdate が正常に設定される', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, latestPhaseUpdate } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('phase_update', { eventId: 'event-1', phase: 'COLLECTING' })

    expect(latestPhaseUpdate.value?.revealPhase).toBeUndefined()
  })

  it('disconnect() を呼ぶと EventSource が close され isConnected が false になる', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, disconnect, isConnected } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]

    disconnect()

    expect(source.closed).toBe(true)
    expect(isConnected.value).toBe(false)
  })

  it('ping イベントは無視される（progressUpdate が更新されない）', async () => {
    const { useEventStream } = await import('../useEventStream')
    const { connect, progressUpdate } = useEventStream()

    connect('event-1')
    const source = MockEventSource.instances[0]
    source.dispatchEvent('ping', {})

    expect(progressUpdate.value).toBeNull()
  })

  it('onUnmounted で disconnect が自動呼び出しされる', async () => {
    const { useEventStream } = await import('../useEventStream')

    const TestComponent = defineComponent({
      setup() {
        const { connect } = useEventStream()
        connect('event-1')
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
