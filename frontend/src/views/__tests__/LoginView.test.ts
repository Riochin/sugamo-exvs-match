import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../LoginView.vue'
import PlayerSelectStep from '@/components/auth/PlayerSelectStep.vue'
import PinInputStep from '@/components/auth/PinInputStep.vue'

const mockPlayersGet = vi.fn()

vi.mock('@/api/client', () => ({
  client: {
    api: {
      players: {
        $get: () => mockPlayersGet(),
      },
    },
  },
}))

const mockLogin = vi.fn()
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentPlayer: ref(null),
    isAuthenticated: computed(() => false),
    isLoading: ref(false),
    login: mockLogin,
    logout: vi.fn(),
    restoreSession: vi.fn(),
  }),
}))

const samplePlayers = [
  { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: '2024-01-01' },
  { id: 'p2', name: 'Bob', team: 'SECOND', title: null, mainUnit: null, createdAt: '2024-01-01' },
]

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/login', component: LoginView },
    ],
  })
}

function successPlayersResponse() {
  mockPlayersGet.mockResolvedValue({
    ok: true,
    json: async () => samplePlayers,
  })
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('マウント時に GET /api/players を呼び出す', async () => {
    successPlayersResponse()
    const router = createTestRouter()
    mount(LoginView, { global: { plugins: [router] } })
    expect(mockPlayersGet).toHaveBeenCalledOnce()
  })

  it('初期状態では PlayerSelectStep を表示する', async () => {
    successPlayersResponse()
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.findComponent(PlayerSelectStep).exists()).toBe(true)
    expect(wrapper.findComponent(PinInputStep).exists()).toBe(false)
  })

  it('プレイヤーを選択すると PinInputStep へ切り替わる', async () => {
    successPlayersResponse()
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.findComponent(PlayerSelectStep).vm.$emit('select', 'Alice')
    expect(wrapper.findComponent(PinInputStep).exists()).toBe(true)
    expect(wrapper.findComponent(PlayerSelectStep).exists()).toBe(false)
  })

  it('PinInputStep に選択したプレイヤー名が渡される', async () => {
    successPlayersResponse()
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.findComponent(PlayerSelectStep).vm.$emit('select', 'Alice')
    expect(wrapper.findComponent(PinInputStep).props('playerName')).toBe('Alice')
  })

  it('PinInputStep の back イベントで player-select へ戻る', async () => {
    successPlayersResponse()
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.findComponent(PlayerSelectStep).vm.$emit('select', 'Alice')
    await wrapper.findComponent(PinInputStep).vm.$emit('back')
    expect(wrapper.findComponent(PlayerSelectStep).exists()).toBe(true)
    expect(wrapper.findComponent(PinInputStep).exists()).toBe(false)
  })

  it('ログイン成功時にルートへリダイレクトする', async () => {
    successPlayersResponse()
    mockLogin.mockResolvedValue({ ok: true, player: { playerId: 'p1', name: 'Alice' } })
    const router = createTestRouter()
    await router.push('/login')
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.findComponent(PlayerSelectStep).vm.$emit('select', 'Alice')
    await wrapper.findComponent(PinInputStep).vm.$emit('submit', '1234')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('ログイン失敗(401)時に loginError を PinInputStep へ渡す', async () => {
    successPlayersResponse()
    mockLogin.mockResolvedValue({
      ok: false,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'プレイヤー名またはPINが正しくありません',
    })
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.findComponent(PlayerSelectStep).vm.$emit('select', 'Alice')
    await wrapper.findComponent(PinInputStep).vm.$emit('submit', '9999')
    await flushPromises()
    expect(wrapper.findComponent(PinInputStep).props('error')).toBe(
      'プレイヤー名またはPINが正しくありません',
    )
  })

  it('プレイヤー取得失敗時にエラーを PlayerSelectStep へ渡す', async () => {
    mockPlayersGet.mockResolvedValue({ ok: false })
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.findComponent(PlayerSelectStep).props('error')).not.toBeNull()
  })

  it('retry イベントでプレイヤー再取得を行う', async () => {
    mockPlayersGet.mockResolvedValueOnce({ ok: false }).mockResolvedValue({
      ok: true,
      json: async () => samplePlayers,
    })
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.findComponent(PlayerSelectStep).vm.$emit('retry')
    await flushPromises()
    expect(mockPlayersGet).toHaveBeenCalledTimes(2)
  })
})
