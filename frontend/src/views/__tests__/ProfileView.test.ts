import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfileView from '../ProfileView.vue'

type WinRateEntry =
  | { eventId: string; heldAt: string; winRate: number; wins: number; losses: number; absent: false }
  | { eventId: string; heldAt: string; absent: true }

type PlayerProfileResponse = {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
  iconUrl: string | null
  totalStarsReceived: number
  biggestFan: { name: string; totalStars: number } | null
  allTimeRecord: { totalWins: number; totalLosses: number; winRate: number }
  winRateHistory: WinRateEntry[]
}

const defaultAllTimeRecord = { totalWins: 0, totalLosses: 0, winRate: 0 }

const mockProfile = ref<PlayerProfileResponse | null>(null)
const mockIsLoading = ref(false)
const mockError = ref<string | null>(null)
const mockNotFound = ref(false)

vi.mock('@/composables/usePlayerProfile', () => ({
  usePlayerProfile: () => ({
    profile: mockProfile,
    isLoading: mockIsLoading,
    error: mockError,
    notFound: mockNotFound,
  }),
}))

vi.mock('@/components/group/WinRateHistory.vue', () => ({
  default: {
    name: 'WinRateHistory',
    props: ['history'],
    template: '<div data-testid="win-rate-history"></div>',
  },
}))

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/group', component: { template: '<div />' } },
      { path: '/profile/:id', component: { template: '<div />' } },
    ],
  })
}

describe('ProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfile.value = null
    mockIsLoading.value = false
    mockError.value = null
    mockNotFound.value = false
  })

  it('isLoading = true のときローディングスピナーを表示する', async () => {
    mockIsLoading.value = true

    const router = createTestRouter()
    await router.push('/profile/p1')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="player-info"]').exists()).toBe(false)
  })

  it('notFound = true のとき「プレイヤーが見つかりません」を表示する', async () => {
    mockNotFound.value = true

    const router = createTestRouter()
    await router.push('/profile/p999')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="not-found-message"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('プレイヤーが見つかりません')
    expect(wrapper.find('[data-testid="player-info"]').exists()).toBe(false)
  })

  it('notFound のとき戻るボタン/リンクを表示する', async () => {
    mockNotFound.value = true

    const router = createTestRouter()
    await router.push('/profile/p999')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    const notFound = wrapper.find('[data-testid="not-found-message"]')
    expect(notFound.find('a').exists()).toBe(true)
  })

  it('profile が存在するときプレイヤー情報を表示する', async () => {
    mockProfile.value = {
      id: 'p1',
      name: 'Alice',
      team: 'FIRST',
      title: '勇者',
      mainUnit: 'ユニコーンガンダム',
      iconUrl: null,
      totalStarsReceived: 0,
      biggestFan: null,
      allTimeRecord: defaultAllTimeRecord,
      winRateHistory: [],
    }

    const router = createTestRouter()
    await router.push('/profile/p1')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="player-info"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('勇者')
    expect(wrapper.text()).toContain('ユニコーンガンダム')
  })

  it('title が null のとき「未設定」を表示する', async () => {
    mockProfile.value = {
      id: 'p1',
      name: 'Alice',
      team: 'FIRST',
      title: null,
      mainUnit: null,
      iconUrl: null,
      totalStarsReceived: 0,
      biggestFan: null,
      allTimeRecord: defaultAllTimeRecord,
      winRateHistory: [],
    }

    const router = createTestRouter()
    await router.push('/profile/p1')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('未設定')
  })

  it('team === FIRST のとき「1軍」バッジを表示する', async () => {
    mockProfile.value = {
      id: 'p1',
      name: 'Alice',
      team: 'FIRST',
      title: null,
      mainUnit: null,
      iconUrl: null,
      totalStarsReceived: 0,
      biggestFan: null,
      allTimeRecord: defaultAllTimeRecord,
      winRateHistory: [],
    }

    const router = createTestRouter()
    await router.push('/profile/p1')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('1軍')
  })

  it('team === SECOND のとき「2軍」バッジを表示する', async () => {
    mockProfile.value = {
      id: 'p2',
      name: 'Bob',
      team: 'SECOND',
      title: null,
      mainUnit: null,
      iconUrl: null,
      totalStarsReceived: 0,
      biggestFan: null,
      allTimeRecord: defaultAllTimeRecord,
      winRateHistory: [],
    }

    const router = createTestRouter()
    await router.push('/profile/p2')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('2軍')
  })

  it('profile が存在するとき WinRateHistory を表示する', async () => {
    mockProfile.value = {
      id: 'p1',
      name: 'Alice',
      team: 'FIRST',
      title: null,
      mainUnit: null,
      iconUrl: null,
      totalStarsReceived: 0,
      biggestFan: null,
      allTimeRecord: defaultAllTimeRecord,
      winRateHistory: [
        { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', absent: true },
      ],
    }

    const router = createTestRouter()
    await router.push('/profile/p1')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="win-rate-history"]').exists()).toBe(true)
  })

  it('「?」ボタンクリックでヘルプモーダルが表示される', async () => {
    const router = createTestRouter()
    await router.push('/profile/p1')
    await router.isReady()
    const wrapper = mount(ProfileView, { global: { plugins: [router] } })

    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="help-button"]').trigger('click')
    expect(wrapper.find('[data-testid="help-modal"]').exists()).toBe(true)
  })
})
