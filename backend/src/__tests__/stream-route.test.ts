import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hub, type SSEEventType } from '../routes/stream.js'

describe('SSE Hub', () => {
  beforeEach(() => {
    hub.clear()
    vi.clearAllMocks()
  })

  it('add で接続ストリームを Hub に登録する', () => {
    const mockStream = createMockStream()
    hub.add('event-1', mockStream)
    expect(hub.size('event-1')).toBe(1)
  })

  it('remove で Hub からストリームを削除する', () => {
    const mockStream = createMockStream()
    hub.add('event-1', mockStream)
    hub.remove('event-1', mockStream)
    expect(hub.size('event-1')).toBe(0)
  })

  it('broadcast で同一 eventId の全クライアントにイベントを送信する', async () => {
    const stream1 = createMockStream()
    const stream2 = createMockStream()
    hub.add('event-1', stream1)
    hub.add('event-1', stream2)

    const payload = { progress: 5 }
    await hub.broadcast('event-1', 'progress_update', payload)

    expect(stream1.writeSSE).toHaveBeenCalledWith({
      event: 'progress_update',
      data: JSON.stringify(payload),
    })
    expect(stream2.writeSSE).toHaveBeenCalledWith({
      event: 'progress_update',
      data: JSON.stringify(payload),
    })
  })

  it('broadcast は別 eventId のクライアントには送信しない', async () => {
    const stream1 = createMockStream()
    const stream2 = createMockStream()
    hub.add('event-1', stream1)
    hub.add('event-2', stream2)

    await hub.broadcast('event-1', 'result_ready', {})

    expect(stream1.writeSSE).toHaveBeenCalled()
    expect(stream2.writeSSE).not.toHaveBeenCalled()
  })

  it('切断後は Hub からストリームが除去されており broadcast の対象にならない', async () => {
    const stream1 = createMockStream()
    hub.add('event-1', stream1)
    hub.remove('event-1', stream1)

    await hub.broadcast('event-1', 'phase_update', {})
    expect(stream1.writeSSE).not.toHaveBeenCalled()
  })

  it('3 種類のイベント型すべてを broadcast できる', async () => {
    const stream = createMockStream()
    hub.add('event-1', stream)

    const eventTypes: SSEEventType[] = ['progress_update', 'result_ready', 'phase_update']
    for (const type of eventTypes) {
      await hub.broadcast('event-1', type, {})
    }
    expect(stream.writeSSE).toHaveBeenCalledTimes(3)
  })
})

function createMockStream() {
  return {
    writeSSE: vi.fn().mockResolvedValue(undefined),
  }
}
