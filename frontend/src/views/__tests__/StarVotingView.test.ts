import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import StarVotingView from '../StarVotingView.vue'

// ── useStarVoting モック ─────────────────────────────────────────────────────
const mockLoadPlayers = vi.hoisted(() => vi.fn())
const mockSubmitVote = vi.hoisted(() => vi.fn())
const mockIncrement = vi.hoisted(() => vi.fn())
const mockDecrement = vi.hoisted(() => vi.fn())

const mockPlayers = ref<{ playerId: string; playerName: string; allocated: number }[]>([])
const mockRemaining = ref(3)
const mockIsReadyToSubmit = ref(false)
const mockIsSubmitting = ref(false)
const mockSubmitted = ref(false)
const mockStarError = ref<string | null>(null)
const mockPhaseNotVoting = ref(false)

vi.mock('@/composables/useStarVoting', () => ({
  useStarVoting: () => ({
    players: readonly(mockPlayers),
    remaining: readonly(mockRemaining),
    isReadyToSubmit: readonly(mockIsReadyToSubmit),
    isSubmitting: readonly(mockIsSubmitting),
    submitted: readonly(mockSubmitted),
    error: readonly(mockStarError),
    phaseNotVoting: readonly(mockPhaseNotVoting),
    loadPlayers: mockLoadPlayers,
    submitVote: mockSubmitVote,
    increment: mockIncrement,
    decrement: mockDecrement,
  }),
}))

// ── useEventStream モック ─────────────────────────────────────────────────────
const mockConnect = vi.hoisted(() => vi.fn())
const mockDisconnect = vi.hoisted(() => vi.fn())
const mockCurrentPhase = ref<string | null>(null)
const mockStarVoteUpdate = ref<{ completedCount: number; totalCount: number } | null>(null)

vi.mock('@/composables/useEventStream', () => ({
  useEventStream: () => ({
    currentPhase: readonly(mockCurrentPhase),
    starVoteUpdate: readonly(mockStarVoteUpdate),
    progressUpdate: ref(null),
    resultReady: ref(false),
    latestPhaseUpdate: ref(null),
    isConnected: ref(false),
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}))

// ── コンポーネントスタブ ──────────────────────────────────────────────────────
vi.mock('@/components/star/StarVotingPanel.vue', () => ({
  default: {
    name: 'StarVotingPanel',
    props: ['players', 'remaining', 'isReadyToSubmit', 'completedCount', 'totalCount'],
    emits: ['increment', 'decrement', 'openConfirm'],
    template: `
      <div data-testid="star-voting-panel">
        <span data-testid="panel-remaining">{{ remaining }}</span>
        <span data-testid="panel-completed">{{ completedCount }}/{{ totalCount }}</span>
        <button data-testid="open-confirm-btn" @click="$emit('openConfirm')">投票する</button>
      </div>
    `,
  },
}))

vi.mock('@/components/star/StarConfirmDialog.vue', () => ({
  default: {
    name: 'StarConfirmDialog',
    props: ['visible', 'allocations', 'isSubmitting'],
    emits: ['confirm', 'cancel'],
    template: `
      <div v-if="visible" data-testid="star-confirm-dialog">
        <button data-testid="dialog-confirm-btn" @click="$emit('confirm')">確定</button>
        <button data-testid="dialog-cancel-btn" @click="$emit('cancel')">戻る</button>
      </div>
    `,
  },
}))

function createTestRouter(initialPath = '/events/event-1/star-voting') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/events/:id/star-voting', component: StarVotingView },
      { path: '/events/:id/result', component: { template: '<div />' } },
      { path: '/', component: { template: '<div />' } },
    ],
  })
  router.push(initialPath)
  return router
}

describe('StarVotingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPlayers.value = []
    mockRemaining.value = 3
    mockIsReadyToSubmit.value = false
    mockIsSubmitting.value = false
    mockSubmitted.value = false
    mockStarError.value = null
    mockPhaseNotVoting.value = false
    mockCurrentPhase.value = null
    mockStarVoteUpdate.value = null
  })

  // ── マウント時の初期化 ──────────────────────────────────────────────────────

  it('onMounted で loadPlayers(eventId) が呼ばれる', async () => {
    const router = createTestRouter()
    await router.isReady()
    mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockLoadPlayers).toHaveBeenCalledWith('event-1')
  })

  it('onMounted で useEventStream.connect(eventId) が呼ばれる', async () => {
    const router = createTestRouter()
    await router.isReady()
    mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockConnect).toHaveBeenCalledWith('event-1')
  })

  // ── 通常の投票 UI 表示 ────────────────────────────────────────────────────

  it('通常状態では StarVotingPanel が表示される', async () => {
    mockPlayers.value = [{ playerId: 'p2', playerName: 'Player2', allocated: 0 }]

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="star-voting-panel"]').exists()).toBe(true)
  })

  it('StarVotingPanel に starVoteUpdate の completedCount/totalCount が渡される', async () => {
    mockPlayers.value = [{ playerId: 'p2', playerName: 'Player2', allocated: 0 }]
    mockStarVoteUpdate.value = { completedCount: 3, totalCount: 5 }

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="panel-completed"]').text()).toBe('3/5')
  })

  // ── 投票完了後の表示 ──────────────────────────────────────────────────────

  it('submitted=true のとき投票完了メッセージが表示される', async () => {
    mockSubmitted.value = true

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="vote-completed-message"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="star-voting-panel"]').exists()).toBe(false)
  })

  // ── フェーズ外の表示 ──────────────────────────────────────────────────────

  it('phaseNotVoting=true のとき「現在は投票を受け付けていません」が表示される', async () => {
    mockPhaseNotVoting.value = true

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="phase-not-voting"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="star-voting-panel"]').exists()).toBe(false)
  })

  // ── エラー表示 ────────────────────────────────────────────────────────────

  it('error が存在するとき エラーメッセージが表示される', async () => {
    mockStarError.value = 'ネットワークエラーが発生しました'

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
  })

  // ── SSE phase_update REVEALING → 結果ページへ遷移 ───────────────────────

  it('currentPhase が REVEALING になると /events/:id/result へ遷移する', async () => {
    const router = createTestRouter()
    await router.isReady()
    mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    mockCurrentPhase.value = 'REVEALING'
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/events/event-1/result')
  })

  // ── 確認ダイアログ操作 ────────────────────────────────────────────────────

  it('StarVotingPanel から openConfirm を受けると StarConfirmDialog が表示される', async () => {
    mockPlayers.value = [{ playerId: 'p2', playerName: 'Player2', allocated: 0 }]
    mockIsReadyToSubmit.value = true

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="open-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="star-confirm-dialog"]').exists()).toBe(true)
  })

  it('ダイアログで「確定」を押すと submitVote が呼ばれる', async () => {
    mockPlayers.value = [{ playerId: 'p2', playerName: 'Player2', allocated: 3 }]
    mockIsReadyToSubmit.value = true

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="open-confirm-btn"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="dialog-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(mockSubmitVote).toHaveBeenCalledOnce()
  })

  it('ダイアログで「戻る」を押すとダイアログが閉じる', async () => {
    mockPlayers.value = [{ playerId: 'p2', playerName: 'Player2', allocated: 0 }]

    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="open-confirm-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="star-confirm-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="dialog-cancel-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="star-confirm-dialog"]').exists()).toBe(false)
  })

  it('「?」ボタンクリックで StarIntroModal が表示される', async () => {
    const router = createTestRouter()
    await router.isReady()
    const wrapper = mount(StarVotingView, { global: { plugins: [router] } })
    await flushPromises()

    // 最初に表示されているモーダルを閉じる
    const closeBtn = wrapper.find('[data-testid="star-intro-modal"] button')
    await closeBtn.trigger('click')
    expect(wrapper.find('[data-testid="star-intro-modal"]').exists()).toBe(false)

    // ?ボタンで再表示
    await wrapper.find('[data-testid="help-button"]').trigger('click')
    expect(wrapper.find('[data-testid="star-intro-modal"]').exists()).toBe(true)
  })
})
