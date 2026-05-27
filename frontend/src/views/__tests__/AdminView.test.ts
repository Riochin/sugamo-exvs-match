import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminView from '../AdminView.vue'
import type { EventWithScores } from '@/composables/useAdminEvent'

const mockCollectingEvents = ref<EventWithScores[]>([])
const mockCeremonyEvent = ref<EventWithScores | null>(null)
const mockIsLoading = ref(false)
const mockIsInitialLoading = ref(false)
const mockError = ref<string | null>(null)
const mockCreateEvent = vi.fn()
const mockSetAbsent = vi.fn()
const mockSetAbsentBatch = vi.fn()
const mockAdvancePhase = vi.fn()
const mockSetPhase = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/composables/useAdminEvent', () => ({
  useAdminEvent: () => ({
    collectingEvents: computed(() => mockCollectingEvents.value),
    ceremonyEvent: computed(() => mockCeremonyEvent.value),
    isLoading: computed(() => mockIsLoading.value),
    isInitialLoading: computed(() => mockIsInitialLoading.value),
    error: computed(() => mockError.value),
    createEvent: mockCreateEvent,
    setAbsent: mockSetAbsent,
    setAbsentBatch: mockSetAbsentBatch,
    advancePhase: mockAdvancePhase,
    setPhase: mockSetPhase,
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
  { playerId: 'p1', playerName: 'Alice', wins: 0, losses: 0, absent: false, submitted: false },
  { playerId: 'p2', playerName: 'Bob', wins: 1, losses: 0, absent: true, submitted: false },
]

const collectingEvent: EventWithScores = {
  id: 'e1',
  name: 'テスト大会',
  phase: 'COLLECTING',
  heldAt: '2026-05-12T00:00:00.000Z',
  hasPromotionRelegation: false,
  venue: null,
  description: null,
  scores: sampleScores,
}

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
    mockCollectingEvents.value = []
    mockCeremonyEvent.value = null
    mockIsLoading.value = false
    mockIsInitialLoading.value = false
    mockError.value = null
    mockCurrentPlayer.value = { playerId: 'admin-1', name: 'Admin', isAdmin: true }
    mockLatestPhaseUpdate.value = null
  })

  it('大会がない場合に大会作成フォームを表示する', async () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="held-at-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-event-submit"]').exists()).toBe(true)
  })

  it('大会がない場合に参加者一覧を表示しない', async () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="scores-list"]').exists()).toBe(false)
  })

  it('COLLECTING 大会があるとき参加者一覧とフェーズ変更ボタンを表示する', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="scores-list"]').exists()).toBe(true)
    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text() === 'REVEALING')).toBe(true)
  })

  it('COLLECTING 大会があるとき欠席チェックボックスが各プレイヤーに表示される', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    const checkboxes = wrapper.findAll('[data-testid^="absent-checkbox-"]')
    expect(checkboxes).toHaveLength(2)
  })

  it('COLLECTING 大会があっても ceremonyEvent が null なら大会作成フォームを表示する', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(true)
  })

  it('セレモニーイベントがあるとき大会作成フォームを表示しない', async () => {
    mockCeremonyEvent.value = { ...collectingEvent, id: 'e2', phase: 'STAR_VOTING' }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(false)
  })

  it('REVEALING セレモニーイベントのとき advance-to-star-voting-btn を表示しない', async () => {
    mockCeremonyEvent.value = { ...collectingEvent, id: 'e2', phase: 'REVEALING' }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="advance-to-star-voting-btn"]').exists()).toBe(false)
  })

  it('REVEALING セレモニーイベントのときフェーズ名を表示する', async () => {
    mockCeremonyEvent.value = { ...collectingEvent, id: 'e2', phase: 'REVEALING' }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="admin-content"]').text()).toContain('REVEALING')
  })

  it('STAR_VOTING セレモニーイベントがあるとき大会作成フォームと advance-to-star-voting-btn を表示しない', async () => {
    mockCeremonyEvent.value = { ...collectingEvent, id: 'e2', phase: 'STAR_VOTING' }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="advance-to-star-voting-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-event-form"]').exists()).toBe(false)
  })

  it('大会作成フォームを送信すると createEvent() を呼ぶ', async () => {
    mockCreateEvent.mockResolvedValue(undefined)
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="name-input"]').setValue('テスト大会')
    await wrapper.find('[data-testid="held-at-input"]').setValue('2026-06-01T10:00')
    await wrapper.find('[data-testid="create-event-form"]').trigger('submit')
    await flushPromises()

    expect(mockCreateEvent).toHaveBeenCalledOnce()
    const calledArg = mockCreateEvent.mock.calls[0][0] as { heldAt: Date; name: string; hasPromotionRelegation: boolean }
    expect(calledArg.heldAt).toBeInstanceOf(Date)
    expect(calledArg.name).toBe('テスト大会')
    expect(calledArg.hasPromotionRelegation).toBe(false)
  })

  it('フェーズ変更ボタンを押して確認すると setPhase() を eventId 付きで呼ぶ', async () => {
    mockCollectingEvents.value = [collectingEvent]
    mockSetPhase.mockResolvedValue(undefined)
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    const revealingBtn = wrapper.findAll('button').find((b) => b.text() === 'REVEALING')
    await revealingBtn!.trigger('click')
    await flushPromises()

    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('変更する'))
    await confirmBtn!.trigger('click')
    await flushPromises()

    expect(mockSetPhase).toHaveBeenCalledWith('e1', 'REVEALING')
  })

  it('欠席チェックボックスを変更してもすぐにAPIは呼ばれない', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    const checkbox = wrapper.find('[data-testid="absent-checkbox-p1"]')
    await checkbox.trigger('change')
    await flushPromises()

    expect(mockSetAbsent).not.toHaveBeenCalled()
    expect(mockSetAbsentBatch).not.toHaveBeenCalled()
  })

  it('欠席チェックボックスを変更すると出欠更新ボタンが表示される', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="submit-absent-btn"]').exists()).toBe(false)

    await wrapper.find('[data-testid="absent-checkbox-p1"]').trigger('change')

    expect(wrapper.find('[data-testid="submit-absent-btn"]').exists()).toBe(true)
  })

  it('出欠を更新するボタンを押すと setAbsentBatch() を eventId 付きで呼ぶ', async () => {
    mockCollectingEvents.value = [collectingEvent]
    mockSetAbsentBatch.mockResolvedValue(undefined)
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="absent-checkbox-p1"]').trigger('change')
    await wrapper.find('[data-testid="submit-absent-btn"]').trigger('click')
    await flushPromises()

    expect(mockSetAbsentBatch).toHaveBeenCalledWith('e1', [{ playerId: 'p1', absent: true }])
  })

  it('リセットボタンを押すと出欠更新ボタンが消える', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="absent-checkbox-p1"]').trigger('change')
    expect(wrapper.find('[data-testid="submit-absent-btn"]').exists()).toBe(true)

    await wrapper.find('[data-testid="reset-absent-btn"]').trigger('click')

    expect(wrapper.find('[data-testid="submit-absent-btn"]').exists()).toBe(false)
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

  it('ceremonyEvent がある場合に useEventStream.connect が呼ばれる', async () => {
    mockCeremonyEvent.value = { ...collectingEvent, id: 'e1', phase: 'STAR_VOTING' }
    const router = createTestRouter()
    mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockConnect).toHaveBeenCalledWith('e1')
  })

  it('COLLECTING 大会のみの場合は connect が呼ばれない', async () => {
    mockCollectingEvents.value = [collectingEvent]
    const router = createTestRouter()
    mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('latestPhaseUpdate が変化したとき refresh() を呼ぶ', async () => {
    mockCeremonyEvent.value = { ...collectingEvent, id: 'e1', phase: 'STAR_VOTING' }
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

  it('「?」ボタンクリックでヘルプモーダルが表示される', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Admin', isAdmin: true }
    const router = createTestRouter()
    const wrapper = mount(AdminView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="help-button"]').trigger('click')
    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(true)
  })
})
