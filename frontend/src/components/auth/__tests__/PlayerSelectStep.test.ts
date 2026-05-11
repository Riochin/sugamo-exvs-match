import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerSelectStep from '../PlayerSelectStep.vue'

const samplePlayers = [
  { id: 'p1', name: 'Alice', team: 'FIRST' as const, title: null, mainUnit: null, createdAt: '2024-01-01' },
  { id: 'p2', name: 'Bob', team: 'SECOND' as const, title: '王者', mainUnit: 'ν-ガンダム', createdAt: '2024-01-01' },
]

describe('PlayerSelectStep', () => {
  it('isLoading が true のときローディング表示が出る', () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: [], isLoading: true, error: null },
    })
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="player-list"]').exists()).toBe(false)
  })

  it('プレイヤー一覧が表示される', () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: samplePlayers, isLoading: false, error: null },
    })
    const cards = wrapper.findAll('[data-testid="player-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Alice')
    expect(cards[1].text()).toContain('Bob')
  })

  it('プレイヤーカードをクリックすると select イベントが emit される', async () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: samplePlayers, isLoading: false, error: null },
    })
    await wrapper.findAll('[data-testid="player-card"]')[0].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['Alice']])
  })

  it('error が非null のときエラーメッセージと再読み込みボタンが表示される', () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: [], isLoading: false, error: 'データの取得に失敗しました' },
    })
    expect(wrapper.find('[data-testid="error-message"]').text()).toContain('データの取得に失敗しました')
    expect(wrapper.find('[data-testid="retry-button"]').exists()).toBe(true)
  })

  it('再読み込みボタンをクリックすると retry イベントが emit される', async () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: [], isLoading: false, error: 'エラー' },
    })
    await wrapper.find('[data-testid="retry-button"]').trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
  })

  it('プレイヤーカードは min-h-[56px] クラスを持つ', () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: samplePlayers, isLoading: false, error: null },
    })
    const card = wrapper.find('[data-testid="player-card"]')
    expect(card.classes()).toContain('min-h-[56px]')
  })

  it('isLoading でも error でもないときプレイヤーリストが表示される', () => {
    const wrapper = mount(PlayerSelectStep, {
      props: { players: samplePlayers, isLoading: false, error: null },
    })
    expect(wrapper.find('[data-testid="player-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="error-message"]').exists()).toBe(false)
  })
})
