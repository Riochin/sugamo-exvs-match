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
    props: ['eventId', 'heldAt', 'visible', 'name', 'venue', 'description', 'hasPromotionRelegation'],
    emits: ['close'],
    template: '<div data-testid="past-event-modal" :data-event-id="eventId"></div>',
  },
}))

vi.mock('@/components/event/ActiveEventCard.vue', () => ({
  default: {
    name: 'ActiveEventCard',
    props: ['event'],
    emits: ['openScoreModal'],
    template: '<div data-testid="active-event-card" :data-event-id="event.id"><button data-testid="open-score-modal-btn" @click="$emit(\'openScoreModal\')">入力</button></div>',
  },
}))

vi.mock('@/components/score/ScoreEntryModal.vue', () => ({
  default: {
    name: 'ScoreEntryModal',
    props: ['eventId', 'visible', 'progressUpdate'],
    emits: ['close'],
    template: '<div v-if="visible" data-testid="score-entry-modal" :data-event-id="eventId"></div>',
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

const baseEvent = {
  id: 'event-1',
  phase: 'COLLECTING' as const,
  heldAt: '2026-05-12T00:00:00.000Z',
  scores: [],
  name: 'テスト大会',
  hasPromotionRelegation: false,
  venue: null,
  description: null,
}

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
    expect(wrapper.find('[data-testid="active-event-card"]').exists()).toBe(false)
  })

  it('アクティブイベントがある場合に useEventStream.connect が呼ばれる', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: baseEvent }),
    })

    const router = createTestRouter()
    mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockConnect).toHaveBeenCalledWith('event-1')
  })

  it('フェーズが COLLECTING のとき ActiveEventCard を表示する', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: baseEvent }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="active-event-card"]').exists()).toBe(true)
  })

  it('ActiveEventCard に event.id が渡される', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: baseEvent }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    const card = wrapper.find('[data-testid="active-event-card"]')
    expect(card.attributes('data-event-id')).toBe('event-1')
  })

  it('open-score-modal-btn クリックで ScoreEntryModal が表示される', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: baseEvent }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="score-entry-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="open-score-modal-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="score-entry-modal"]').exists()).toBe(true)
  })

  it('アクティブイベントがある場合は常に ActiveEventCard を表示する', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        event: { ...baseEvent, phase: 'REVEALING' as const },
      }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="active-event-card"]').exists()).toBe(true)
  })

  it('SSE phase_update で COLLECTING 以外に変化すると isScoreModalOpen が false になる', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: baseEvent }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="open-score-modal-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="score-entry-modal"]').exists()).toBe(true)

    mockCurrentPhase.value = 'STAR_VOTING'
    await flushPromises()

    expect(wrapper.find('[data-testid="score-entry-modal"]').exists()).toBe(false)
  })

  it('result_ready 受信後に router.replace で結果発表ページへ遷移する', async () => {
    mockGetActiveFn.mockResolvedValue({
      ok: true,
      json: async () => ({ event: baseEvent }),
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
      json: async () => ({ event: baseEvent }),
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
        event: { ...baseEvent, phase: 'STAR_VOTING' as const },
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
        { id: 'past-1', phase: 'DONE', heldAt: '2026-04-01T12:00:00.000Z', name: '第1回大会', hasPromotionRelegation: false, venue: null, description: null },
        { id: 'past-2', phase: 'DONE', heldAt: '2026-03-01T12:00:00.000Z', name: '第2回大会', hasPromotionRelegation: false, venue: null, description: null },
      ],
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('第1回大会')
    expect(wrapper.text()).toContain('第2回大会')
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
      json: async () => [{ id: 'past-1', phase: 'DONE', heldAt: '2026-04-01T12:00:00.000Z', name: '第1回大会', hasPromotionRelegation: false, venue: null, description: null }],
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
      json: async () => ({ event: baseEvent }),
    })

    const router = createTestRouter()
    const wrapper = mount(TournamentView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="active-event-card"]').exists()).toBe(true)
  })
})
