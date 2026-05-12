import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import PlayerCard from '../PlayerCard.vue'

const routes = [
  { path: '/', component: { template: '<div />' } },
  { path: '/profile/:id', component: { template: '<div />' } },
]

async function mountCard(player: {
  id: string
  name: string
  team: 'FIRST' | 'SECOND'
  title: string | null
  mainUnit: string | null
}) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  await router.isReady()
  return mount(PlayerCard, {
    props: { player },
    global: { plugins: [router] },
  })
}

describe('PlayerCard', () => {
  it('プレイヤー名を表示する', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null })
    expect(wrapper.text()).toContain('Alice')
  })

  it('/profile/:id へのリンクを持つ', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/profile/p1')
  })

  it('team === FIRST のとき「1軍」バッジを表示する', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null })
    expect(wrapper.text()).toContain('1軍')
    expect(wrapper.find('[data-testid="badge-first"]').exists()).toBe(true)
  })

  it('team === SECOND のとき「2軍」バッジを表示する', async () => {
    const wrapper = await mountCard({ id: 'p2', name: 'Bob', team: 'SECOND', title: null, mainUnit: null })
    expect(wrapper.text()).toContain('2軍')
    expect(wrapper.find('[data-testid="badge-second"]').exists()).toBe(true)
  })

  it('title が null のとき「未設定」を表示する', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: null })
    expect(wrapper.text()).toContain('未設定')
  })

  it('title が設定されているとき称号を表示する', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: '勇者', mainUnit: null })
    expect(wrapper.text()).toContain('勇者')
  })

  it('mainUnit が null のとき「未設定」を表示する', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: '勇者', mainUnit: null })
    const text = wrapper.text()
    expect(text).toContain('未設定')
  })

  it('mainUnit が設定されているとき機体名を表示する', async () => {
    const wrapper = await mountCard({ id: 'p1', name: 'Alice', team: 'FIRST', title: null, mainUnit: 'ユニコーンガンダム' })
    expect(wrapper.text()).toContain('ユニコーンガンダム')
  })
})
