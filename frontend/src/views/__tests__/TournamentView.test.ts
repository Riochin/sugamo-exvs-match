import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import TournamentView from '../TournamentView.vue'

const mockGetActiveFn = vi.hoisted(() => vi.fn())
const mockConnect = vi.hoisted(() => vi.fn())
const mockDisconnect = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  client: {
    api: {
      events: {
        active: { $get: mockGetActiveFn },
      },
    },
  },
}))

const mockProgressUpdate = ref<{ completedCount: number; totalCount: number } | null>(null)
const mockResultReady = ref(false)
const mockCurrentPhase = ref<'COLLECTING' | 'REVEALING' | 'DONE' | null>(null)

vi.mock('@/composables/useEventStream', () => ({
  useEventStream: () => ({
    progressUpdate: computed(() => mockProgressUpdate.value),
    resultReady: computed(() => mockResultReady.value),
    currentPhase: computed(() => mockCurrentPhase.value),
    isConnected: ref(false),
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}))

vi.mock('@/components/score/ScoreEntryPanel.vue', () => ({
  default: {
    name: 'ScoreEntryPanel',
    props: ['eventId', 'progressUpdate'],
    template: '<div data-testid="score-entry-panel" :data-event-id="eventId"></div>',
  },
}))

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/events/:id/result', component: { template: '<div />' } },
    ],
  })
}

describe('TournamentView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgressUpdate.value = null
    mockResultReady.value = false
    mockCurrentPhase.value = null

    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: null }),
    })
  })

  it('マウント時に active event を取得する', async () => {
    const router = createTestRouter()
    mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockGetActiveFn).toHaveBeenCalledOnce()
  })

  it('アクティブイベントがない場合は待機メッセージを表示する', async () => {
    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="no-event-message"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="score-entry-panel"]').exists()).toBe(false)
  })

  it('アクティブイベントがある場合に useEventStream.connect が呼ばれる', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { id: 'event-1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: [] },
      }),
    })

    const router = createTestRouter()
    mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockConnect).toHaveBeenCalledWith('event-1')
  })

  it('フェーズが COLLECTING のとき ScoreEntryPanel を表示する', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { id: 'event-1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: [] },
      }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="score-entry-panel"]').exists()).toBe(true)
  })

  it('ScoreEntryPanel に eventId が渡される', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { id: 'event-1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: [] },
      }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    const panel = wrapper.find('[data-testid="score-entry-panel"]')
    expect(panel.attributes('data-event-id')).toBe('event-1')
  })

  it('SSE phase_update で COLLECTING に変化すると ScoreEntryPanel が表示される', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { id: 'event-1', phase: 'REVEALING', heldAt: '2026-05-12T00:00:00.000Z', scores: [] },
      }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="score-entry-panel"]').exists()).toBe(false)

    mockCurrentPhase.value = 'COLLECTING'
    await flushPromises()

    expect(wrapper.find('[data-testid="score-entry-panel"]').exists()).toBe(true)
  })

  it('result_ready 受信後に router.replace で結果発表ページへ遷移する', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { id: 'event-1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: [] },
      }),
    })

    const router = createTestRouter()
    await router.push('/')
    mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    mockResultReady.value = true
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/events/event-1/result')
  })

  it('API 取得エラー時は待機メッセージを表示する', async () => {
    mockGetActiveFn.mockRejectedValue(new Error('network error'))

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="no-event-message"]').exists()).toBe(true)
  })
})
