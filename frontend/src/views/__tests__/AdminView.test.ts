import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminView from '../AdminView.vue'

const mockActiveEvent = ref<{
  id: string
  phase: 'COLLECTING' | 'REVEALING' | 'DONE'
  heldAt: string
  scores: { playerId: string; playerName: string; wins: number; losses: number; absent: boolean }[]
} | null>(null)
const mockIsLoading = ref(false)
const mockError = ref<string | null>(null)
const mockCreateEvent = vi.fn()
const mockSetAbsent = vi.fn()
const mockAdvancePhase = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/composables/useAdminEvent', () => ({
  useAdminEvent: () => ({
    activeEvent: computed(() => mockActiveEvent.value),
    isLoading: computed(() => mockIsLoading.value),
    error: computed(() => mockError.value),
    createEvent: mockCreateEvent,
    setAbsent: mockSetAbsent,
    advancePhase: mockAdvancePhase,
    refresh: mockRefresh,
  }),
}))

const mockCurrentPlayer = ref<{ playerId: string; name: string; isAdmin: boolean } | null>(null)

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentPlayer: computed(() => mockCurrentPlayer.value),
    isAuthenticated: computed(() => mockCurrentPlayer.value !== null),
    isLoading: ref(false),
    login: vi.fn(),
    logout: vi.fn(),
    restoreSession: vi.fn(),
  }),
}))

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockLatestPhaseUpdate = ref<{ eventId: string; phase: 'COLLECTING' | 'REVEALING' | 'DONE' } | null>(null)

vi.mock('@/composables/useEventStream', () => ({
  useEventStream: () => ({
    progressUpdate: ref(null),
    resultReady: ref(false),
    currentPhase: ref(null),
    latestPhaseUpdate: computed(() => mockLatestPhaseUpdate.value),
    isConnected: ref(false),
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}))

const sampleScores = [
  { playerId: 'p1', playerName: 'Alice', wins: 0, losses: 0, absent: false },
  { playerId: 'p2', playerName: 'Bob', wins: 1, losses: 0, absent: true },
]

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/admin', component: AdminView },
    ],
  })
}

describe('AdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveEvent.value = null
    mockIsLoading.value = false
    mockError.value = null
    mockCurrentPlayer.value = { playerId: 'admin-1', name: 'Admin', isAdmin: true }
    mockLatestPhaseUpdate.value = null
  })

  it('activeEvent が null のとき大会作成フォームを表示する', async () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="held-at-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-event-submit"]').exists()).toBe(true)
  })

  it('activeEvent が null のとき参加者一覧を表示しない', async () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="scores-list"]').exists()).toBe(false)
  })

  it('phase === COLLECTING のとき参加者一覧と REVEALING ボタンを表示する', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="scores-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advance-phase-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advance-phase-btn"]').text()).toContain('REVEALING')
  })

  it('phase === COLLECTING のとき欠席チェックボックスが各プレイヤーに表示される', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    const checkboxes = wrapper.findAll('[data-testid^="absent-checkbox-"]')
    expect(checkboxes).toHaveLength(2)
  })

  it('phase === COLLECTING のとき大会作成フォームを表示しない', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(false)
  })

  it('phase === REVEALING のとき DONE ボタンを表示する', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'REVEALING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="advance-phase-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="advance-phase-btn"]').text()).toContain('DONE')
  })

  it('phase === DONE のとき操作ボタンを表示しない', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'DONE', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="advance-phase-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(false)
  })

  it('大会作成フォームを送信すると createEvent() を呼ぶ', async () => {
    mockCreateEvent.mockResolvedValue(undefined)
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="held-at-input"]').setValue('2026-06-01T10:00')
    await wrapper.find('[data-testid="create-event-form"]').trigger('submit')
    await flushPromises()

    expect(mockCreateEvent).toHaveBeenCalledOnce()
    const calledArg = mockCreateEvent.mock.calls[0][0] as Date
    expect(calledArg).toBeInstanceOf(Date)
  })

  it('フェーズ遷移ボタンを押すと advancePhase() を呼ぶ', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    mockAdvancePhase.mockResolvedValue(undefined)
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="advance-phase-btn"]').trigger('click')
    await flushPromises()

    expect(mockAdvancePhase).toHaveBeenCalledOnce()
  })

  it('欠席チェックボックスを変更すると setAbsent() を呼ぶ', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    mockSetAbsent.mockResolvedValue(undefined)
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    const checkbox = wrapper.find('[data-testid="absent-checkbox-p1"]')
    await checkbox.trigger('change')
    await flushPromises()

    expect(mockSetAbsent).toHaveBeenCalledWith('p1', true)
  })

  it('error が設定されているときエラーメッセージを表示する', async () => {
    mockError.value = 'ACTIVE_EVENT_EXISTS'
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-message"]').text()).toContain('ACTIVE_EVENT_EXISTS')
  })

  it('isLoading が true のとき操作ボタンが無効化される', async () => {
    mockIsLoading.value = true
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    const submitBtn = wrapper.find('[data-testid="create-event-submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('activeEvent がある場合に useEventStream.connect が呼ばれる', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockConnect).toHaveBeenCalledWith('e1')
  })

  it('latestPhaseUpdate が変化したとき refresh() を呼ぶ', async () => {
    mockActiveEvent.value = { id: 'e1', phase: 'COLLECTING', heldAt: '2026-05-12T00:00:00.000Z', scores: sampleScores }
    const router = createTestRouter()
    mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    mockLatestPhaseUpdate.value = { eventId: 'e1', phase: 'REVEALING' }
    await flushPromises()

    expect(mockRefresh).toHaveBeenCalled()
  })

  it('isAdmin が false のとき管理者専用コンテンツを表示しない', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'User', isAdmin: false }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="admin-content"]').exists()).toBe(false)
  })
})
