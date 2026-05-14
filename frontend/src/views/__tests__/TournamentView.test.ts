import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import TournamentView from '../TournamentView.vue'

const mockGetActiveFn = vi.hoisted(() => vi.fn())
const mockGetPastFn = vi.hoisted(() => vi.fn())
const mockConnect = vi.hoisted(() => vi.fn())
const mockDisconnect = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  client: {
    api: {
      events: {
        active: { $get: mockGetActiveFn },
        $get: mockGetPastFn,
      },
    },
  },
}))

vi.mock('@/components/event/PastEventModal.vue', () => ({
  default: {
    name: 'PastEventModal',
    props: ['eventId', 'heldAt', 'visible'],
    emits: ['close'],
    template: '<div data-testid="past-event-modal" :data-event-id="eventId"></div>',
  },
}))

const mockProgressUpdate = ref<{ completedCount: number; totalCount: number } | null>(null)
const mockResultReady = ref(false)
const mockCurrentPhase = ref<'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE' | null>(null)

vi.mock('@/composables/useEventStream', () => ({
  useEventStream: () => ({
    progressUpdate: computed(() => mockProgressUpdate.value),
    resultReady: computed(() => mockResultReady.value),
    currentPhase: computed(() => mockCurrentPhase.value),
    starVoteUpdate: ref(null),
    latestPhaseUpdate: ref(null),
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
      { path: '/events/:id/star-voting', component: { template: '<div />' } },
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
    mockGetPastFn.mockResolvedValue({
      ok: true,
      json: async () => [],
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

  it('SSE phase_update で STAR_VOTING を受信すると /events/:id/star-voting へ遷移する', async () => {
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

    mockCurrentPhase.value = 'STAR_VOTING'
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/events/event-1/star-voting')
  })

  it('初期フェーズが STAR_VOTING の場合は /events/:id/star-voting へ遷移する', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { id: 'event-1', phase: 'STAR_VOTING', heldAt: '2026-05-12T00:00:00.000Z', scores: [] },
      }),
    })

    const router = createTestRouter()
    await router.push('/')
    mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/events/event-1/star-voting')
  })

  it('マウント時に past events API も呼ばれる', async () => {
    const router = createTestRouter()
    mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockGetPastFn).toHaveBeenCalledOnce()
  })

  it('開催済みイベントがある場合にリストが表示される', async () => {
    mockGetPastFn.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'past-1', phase: 'DONE', heldAt: '2026-04-01T12:00:00.000Z' },
        { id: 'past-2', phase: 'DONE', heldAt: '2026-03-01T12:00:00.000Z' },
      ],
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('2026/04/01')
    expect(wrapper.text()).toContain('2026/03/01')
  })

  it('開催済みイベントが 0 件のときはセクションが表示されない', async () => {
    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('開催済みの大会')
  })

  it('開催済みイベントをクリックすると PastEventModal が表示される', async () => {
    mockGetPastFn.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'past-1', phase: 'DONE', heldAt: '2026-04-01T12:00:00.000Z' }],
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="past-event-modal"]').exists()).toBe(false)
    await wrapper.find('li').trigger('click')
    expect(wrapper.find('[data-testid="past-event-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="past-event-modal"]').attributes('data-event-id')).toBe('past-1')
  })

  it('past events API エラーがあってもアクティブイベント表示に影響しない', async () => {
    mockGetPastFn.mockRejectedValue(new Error('network error'))
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
})
