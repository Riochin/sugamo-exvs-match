import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import BottomNav from '../BottomNav.vue'

const mockCurrentPlayer = ref<{ playerId: string; name: string; isAdmin: boolean } | null>({
  playerId: 'p1',
  name: 'Alice',
  isAdmin: false,
})

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentPlayer: mockCurrentPlayer,
  }),
}))

const routes = [
  { path: '/', component: { template: '<div>Home</div>' } },
  { path: '/group', component: { template: '<div>Group</div>' } },
  { path: '/profile/:id', component: { template: '<div>Profile</div>' } },
]

async function mountWithRoute(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  return mount(BottomNav, { global: { plugins: [router] } })
}

describe('BottomNav', () => {
  it('3 つのナビリンクをレンダリングする', async () => {
    const wrapper = await mountWithRoute('/')
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(3)
  })

  it('大会・グループ・プロフィールのリンクラベルを表示する', async () => {
    const wrapper = await mountWithRoute('/')
    const text = wrapper.text()
    expect(text).toContain('大会')
    expect(text).toContain('グループ')
    expect(text).toContain('プロフィール')
  })

  it('/ にいるとき「大会」がアクティブになる', async () => {
    const wrapper = await mountWithRoute('/')
    const activeLink = wrapper.find('[data-testid="nav-tournament"]')
    expect(activeLink.classes()).toContain('active')
  })

  it('/group にいるとき「グループ」がアクティブになる', async () => {
    const wrapper = await mountWithRoute('/group')
    const activeLink = wrapper.find('[data-testid="nav-group"]')
    expect(activeLink.classes()).toContain('active')
  })

  it('/profile/:id にいるとき「プロフィール」がアクティブになる', async () => {
    const wrapper = await mountWithRoute('/profile/p1')
    const activeLink = wrapper.find('[data-testid="nav-profile"]')
    expect(activeLink.classes()).toContain('active')
  })

  it('currentPlayer があるときプロフィールリンクが /profile/:id になる', async () => {
    const wrapper = await mountWithRoute('/')
    const profileLink = wrapper.find('[data-testid="nav-profile"]')
    expect(profileLink.attributes('href')).toBe('/profile/p1')
  })
})
