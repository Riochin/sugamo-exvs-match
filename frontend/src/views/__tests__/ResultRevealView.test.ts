import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, readonly, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import ResultRevealView from '../ResultRevealView.vue'
import type { RevealResult } from '@/composables/useResultReveal'

// useResultReveal モック（関数は hoisted、ref は module-level）
const mockInitialize = vi.hoisted(() => vi.fn())
const mockAdvancePhase = vi.hoisted(() => vi.fn())
const mockCleanup = vi.hoisted(() => vi.fn())

const mockResult = ref<RevealResult | null>(null)
const mockRevealPhase = ref(0)
const mockEventPhase = ref<'COLLECTING' | 'REVEALING' | 'DONE' | null>(null)
const mockIsConnected = ref(false)
const mockIsLoading = ref(false)
const mockError = ref<string | null>(null)

vi.mock('@/composables/useResultReveal', () => ({
  useResultReveal: () => ({
    result: readonly(mockResult),
    revealPhase: readonly(mockRevealPhase),
    eventPhase: readonly(mockEventPhase),
    isConnected: readonly(mockIsConnected),
    isLoading: readonly(mockIsLoading),
    error: readonly(mockError),
    initialize: mockInitialize,
    advancePhase: mockAdvancePhase,
    cleanup: mockCleanup,
  }),
}))

// useAuth モック
const mockCurrentPlayer = ref<{ playerId: string; name: string; isAdmin: boolean } | null>(null)

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentPlayer: readonly(mockCurrentPlayer),
    isAuthenticated: computed(() => mockCurrentPlayer.value !== null),
    isLoading: ref(false),
    login: vi.fn(),
    logout: vi.fn(),
    restoreSession: vi.fn(),
  }),
}))

// ResultCard スタブ
vi.mock('@/components/result/ResultCard.vue', () => ({
  default: {
    name: 'ResultCard',
    props: ['player', 'rank'],
    template:
      '<div data-testid="result-card" :data-player-id="player.playerId" :data-rank="rank" />',
  },
}))

function createTestRouter(initialPath = '/events/event-1/result') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/events/:id/result', component: ResultRevealView },
      { path: '/', component: { template: '<div />' } },
    ],
  })
  router.push(initialPath)
  return router
}

const samplePlayers: RevealResult['players'] = [
  {
    playerId: 'p1',
    playerName: 'Player 1',
    team: 'FIRST',
    wins: 3,
    losses: 1,
    absent: false,
    rank: 1,
    group: 'FIRST_STAY',
    borderDirection: null,
  },
  {
    playerId: 'p2',
    playerName: 'Player 2',
    team: 'SECOND',
    wins: 2,
    losses: 2,
    absent: false,
    rank: 3,
    group: 'SECOND_STAY',
    borderDirection: null,
  },
  {
    playerId: 'p3',
    playerName: 'Player 3',
    team: 'SECOND',
    wins: 4,
    losses: 0,
    absent: false,
    rank: 2,
    group: 'BORDER',
    borderDirection: 'PROMOTION',
  },
]

describe('ResultRevealView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.value = null
    mockRevealPhase.value = 0
    mockEventPhase.value = null
    mockIsConnected.value = false
    mockIsLoading.value = false
    mockError.value = null
    mockCurrentPlayer.value = null
    mockInitialize.mockResolvedValue(undefined)
    mockAdvancePhase.mockResolvedValue(undefined)
  })

  // ─── 7.1: 基盤・認証ガード・初期化 ───────────────────────────────

  it('onMounted で initialize(eventId) が呼ばれる', async () => {
    const router = createTestRouter()
    await router.isReady()
    mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockInitialize).toHaveBeenCalledWith('event-1')
  })

  it('data-testid="result-reveal-view" のルートコンテナが存在する', async () => {
    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="result-reveal-view"]').exists()).toBe(true)
  })

  it('eventPhase が COLLECTING のとき / へリダイレクトされる', async () => {
    mockInitialize.mockImplementation(async () => {
      mockEventPhase.value = 'COLLECTING'
    })

    const router = createTestRouter()
    const replaceSpy = vi.spyOn(router, 'replace')
    await router.isReady()
    mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(replaceSpy).toHaveBeenCalledWith('/')
  })

  // ─── 7.2: フェーズ別グループ表示・情報秘匿 ─────────────────────────

  it('revealPhase=0 のとき全グループが非表示', async () => {
    mockRevealPhase.value = 0
    mockEventPhase.value = 'REVEALING'
    mockResult.value = {
      eventId: 'event-1',
      revealPhase: 0,
      eventPhase: 'REVEALING',
      players: samplePlayers,
    }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="first-stay-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="second-stay-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="border-group"]').exists()).toBe(false)
  })

  it('revealPhase=1 のとき FIRST_STAY グループのみ表示される', async () => {
    mockRevealPhase.value = 1
    mockEventPhase.value = 'REVEALING'
    mockResult.value = {
      eventId: 'event-1',
      revealPhase: 1,
      eventPhase: 'REVEALING',
      players: samplePlayers,
    }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="first-stay-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="second-stay-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="border-group"]').exists()).toBe(false)
  })

  it('revealPhase=2 のとき FIRST_STAY と SECOND_STAY が表示される', async () => {
    mockRevealPhase.value = 2
    mockEventPhase.value = 'REVEALING'
    mockResult.value = {
      eventId: 'event-1',
      revealPhase: 2,
      eventPhase: 'REVEALING',
      players: samplePlayers,
    }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="first-stay-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="second-stay-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="border-group"]').exists()).toBe(false)
  })

  it('revealPhase=3 のとき全グループが表示される', async () => {
    mockRevealPhase.value = 3
    mockEventPhase.value = 'REVEALING'
    mockResult.value = {
      eventId: 'event-1',
      revealPhase: 3,
      eventPhase: 'REVEALING',
      players: samplePlayers,
    }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="first-stay-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="second-stay-group"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="border-group"]').exists()).toBe(true)
  })

  it('各グループに ResultCard が表示される', async () => {
    mockRevealPhase.value = 3
    mockEventPhase.value = 'REVEALING'
    mockResult.value = {
      eventId: 'event-1',
      revealPhase: 3,
      eventPhase: 'REVEALING',
      players: samplePlayers,
    }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    const cards = wrapper.findAll('[data-testid="result-card"]')
    expect(cards.length).toBe(3)
  })

  // ─── 7.3: 管理者ボタン・DONE後CTA ──────────────────────────────

  it('管理者には「次のフェーズへ」ボタンが表示される', async () => {
    mockCurrentPlayer.value = { playerId: 'admin', name: 'Admin', isAdmin: true }
    mockEventPhase.value = 'REVEALING'
    mockRevealPhase.value = 1

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="advance-button"]').exists()).toBe(true)
  })

  it('非管理者には「次のフェーズへ」ボタンが非表示', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Player', isAdmin: false }
    mockEventPhase.value = 'REVEALING'
    mockRevealPhase.value = 1

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="advance-button"]').exists()).toBe(false)
  })

  it('revealPhase=3 のとき「次のフェーズへ」ボタンが disabled', async () => {
    mockCurrentPlayer.value = { playerId: 'admin', name: 'Admin', isAdmin: true }
    mockEventPhase.value = 'REVEALING'
    mockRevealPhase.value = 3

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    const btn = wrapper.find('[data-testid="advance-button"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('eventPhase=DONE のとき「次のフェーズへ」ボタンが disabled', async () => {
    mockCurrentPlayer.value = { playerId: 'admin', name: 'Admin', isAdmin: true }
    mockEventPhase.value = 'DONE'
    mockRevealPhase.value = 3

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    const btn = wrapper.find('[data-testid="advance-button"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('「次のフェーズへ」クリックで advancePhase が呼ばれる', async () => {
    mockCurrentPlayer.value = { playerId: 'admin', name: 'Admin', isAdmin: true }
    mockEventPhase.value = 'REVEALING'
    mockRevealPhase.value = 1

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="advance-button"]').trigger('click')
    expect(mockAdvancePhase).toHaveBeenCalledOnce()
  })

  it('eventPhase=DONE のとき Star投票 CTA が全ユーザーに表示される', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Player', isAdmin: false }
    mockEventPhase.value = 'DONE'
    mockRevealPhase.value = 3
    mockResult.value = {
      eventId: 'event-1',
      revealPhase: 3,
      eventPhase: 'DONE',
      players: samplePlayers,
    }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="star-vote-cta"]').exists()).toBe(true)
  })

  it('eventPhase が DONE でない場合は CTA が表示されない', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Player', isAdmin: false }
    mockEventPhase.value = 'REVEALING'
    mockRevealPhase.value = 1

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(ResultRevealView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="star-vote-cta"]').exists()).toBe(false)
  })
})
