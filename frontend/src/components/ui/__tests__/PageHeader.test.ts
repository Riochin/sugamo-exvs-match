import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import PageHeader from '../PageHeader.vue'

const mockCurrentPlayer = ref<{ playerId: string; name: string; isAdmin: boolean } | null>(null)

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentPlayer: readonly(mockCurrentPlayer),
  }),
}))

function createTestRouter(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/admin', component: { template: '<div />' } },
      { path: '/group', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  return router
}

describe('PageHeader', () => {
  it('title prop がテキストとして表示される', async () => {
    mockCurrentPlayer.value = null
    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(PageHeader, {
      props: { title: '大会' },
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('大会')
  })

  it('「?」ボタンクリックで help イベントが発火する', async () => {
    mockCurrentPlayer.value = null
    const router = createTestRouter()
    await router.isReady()

    const wrapper = mount(PageHeader, {
      props: { title: 'テスト' },
      global: { plugins: [router] },
    })
    await wrapper.find('[data-testid="help-button"]').trigger('click')
    expect(wrapper.emitted('help')).toBeTruthy()
  })

  it('管理者の場合「管理」リンクが表示される', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Alice', isAdmin: true }
    const router = createTestRouter('/group')
    await router.isReady()

    const wrapper = mount(PageHeader, {
      props: { title: 'グループ' },
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('管理')
  })

  it('非管理者の場合「管理」リンクが表示されない', async () => {
    mockCurrentPlayer.value = { playerId: 'p2', name: 'Bob', isAdmin: false }
    const router = createTestRouter('/group')
    await router.isReady()

    const wrapper = mount(PageHeader, {
      props: { title: 'グループ' },
      global: { plugins: [router] },
    })
    const links = wrapper.findAll('a')
    expect(links.every((l) => !l.text().includes('管理'))).toBe(true)
  })

  it('管理者でも /admin ページでは「管理」リンクが表示されない', async () => {
    mockCurrentPlayer.value = { playerId: 'p1', name: 'Alice', isAdmin: true }
    const router = createTestRouter('/admin')
    await router.isReady()

    const wrapper = mount(PageHeader, {
      props: { title: '管理' },
      global: { plugins: [router] },
    })
    const links = wrapper.findAll('a')
    expect(links.every((l) => !l.text().includes('管理'))).toBe(true)
  })
})
