import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import GroupView from '../GroupView.vue'

type PlayerListItem = {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  createdAt: string
}

const mockFirstTeam = ref<PlayerListItem[]>([])
const mockSecondTeam = ref<PlayerListItem[]>([])
const mockIsLoading = ref(false)
const mockError = ref<string | null>(null)
const mockRefresh = vi.fn()

vi.mock('@/composables/useGroupProfile', () => ({
  useGroupProfile: () => ({
    firstTeam: mockFirstTeam,
    secondTeam: mockSecondTeam,
    isLoading: mockIsLoading,
    error: mockError,
    refresh: mockRefresh,
  }),
}))

vi.mock('@/components/group/PlayerCard.vue', () => ({
  default: {
    name: 'PlayerCard',
    props: ['player'],
    template: '<div data-testid="player-card" :data-player-id="player.id">{{ player.name }}</div>',
  },
}))

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/group', component: { template: '<div />' } },
    ],
  })
}

describe('GroupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirstTeam.value = []
    mockSecondTeam.value = []
    mockIsLoading.value = false
    mockError.value = null
  })

  it('isLoading = true のときローディングスピナーを表示する', async () => {
    mockIsLoading.value = true

    const router = createTestRouter()
    const wrapper = mount(GroupView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-team-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="second-team-section"]').exists()).toBe(false)
  })

  it('error が存在するときエラーメッセージを表示する', async () => {
    mockError.value = 'データの取得に失敗しました'

    const router = createTestRouter()
    const wrapper = mount(GroupView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('データの取得に失敗しました')
    expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(false)
  })

  it('1軍セクションを表示する', async () => {
    mockFirstTeam.value = [
      { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: '' },
    ]
    mockSecondTeam.value = []

    const router = createTestRouter()
    const wrapper = mount(GroupView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="first-team-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="first-team-section"]').text()).toContain('1軍')
  })

  it('2軍セクションを表示する', async () => {
    mockFirstTeam.value = []
    mockSecondTeam.value = [
      { id: 'p2', name: 'Bob', team: 'SECOND', title: null, mainUnit: null, createdAt: '' },
    ]

    const router = createTestRouter()
    const wrapper = mount(GroupView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="second-team-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="second-team-section"]').text()).toContain('2軍')
  })

  it('firstTeam の PlayerCard が全員分レンダリングされる', async () => {
    mockFirstTeam.value = [
      { id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null, createdAt: '' },
      { id: 'p2', name: 'Charlie', team: 'FIRST', title: null, mainUnit: null, createdAt: '' },
    ]

    const router = createTestRouter()
    const wrapper = mount(GroupView, { global: { plugins: [router] } })

    const cards = wrapper.findAll('[data-testid="player-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Alice')
    expect(cards[1].text()).toContain('Charlie')
  })

  it('「?」ボタンクリックでヘルプモーダルが表示される', async () => {
    const router = createTestRouter()
    const wrapper = mount(GroupView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="help-button"]').trigger('click')
    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(true)
  })
})
