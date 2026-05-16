import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultCard from '../ResultCard.vue'
import type { PlayerResult } from '@/composables/useResultReveal'

function makePlayer(overrides: Partial<PlayerResult> = {}): PlayerResult {
  return {
    playerId: 'p1',
    playerName: 'テストプレイヤー',
    team: 'FIRST',
    wins: 3,
    losses: 1,
    absent: false,
    rank: 1,
    group: 'FIRST_STAY',
    borderDirection: null,
    ...overrides,
  }
}

describe('ResultCard', () => {
  it('プレイヤー名を表示する', () => {
    const wrapper = mount(ResultCard, {
      props: { player: makePlayer({ playerName: 'アリス' }), rank: 1 },
    })
    expect(wrapper.text()).toContain('アリス')
  })

  it('戦数・勝数を表示する', () => {
    const wrapper = mount(ResultCard, {
      props: { player: makePlayer({ wins: 4, losses: 2 }), rank: 1 },
    })
    expect(wrapper.text()).toContain('6戦')
    expect(wrapper.text()).toContain('4勝')
  })

  it('最終順位を表示する', () => {
    const wrapper = mount(ResultCard, {
      props: { player: makePlayer({ rank: 3 }), rank: 3 },
    })
    expect(wrapper.find('[data-testid="rank"]').text()).toContain('3')
  })

  it('rank が null のとき順位を非表示にする', () => {
    const wrapper = mount(ResultCard, {
      props: { player: makePlayer({ rank: null }), rank: null },
    })
    expect(wrapper.find('[data-testid="rank"]').exists()).toBe(false)
  })

  it('borderDirection が PROMOTION のとき昇格インジケーターを表示する', () => {
    const wrapper = mount(ResultCard, {
      props: {
        player: makePlayer({ borderDirection: 'PROMOTION', group: 'BORDER' }),
        rank: 2,
      },
    })
    expect(wrapper.find('[data-testid="indicator-promotion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="indicator-relegation"]').exists()).toBe(false)
  })

  it('borderDirection が RELEGATION のとき降格インジケーターを表示する', () => {
    const wrapper = mount(ResultCard, {
      props: {
        player: makePlayer({ borderDirection: 'RELEGATION', group: 'BORDER' }),
        rank: 5,
      },
    })
    expect(wrapper.find('[data-testid="indicator-relegation"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="indicator-promotion"]').exists()).toBe(false)
  })

  it('borderDirection が null のときインジケーターを表示しない', () => {
    const wrapper = mount(ResultCard, {
      props: { player: makePlayer({ borderDirection: null }), rank: 1 },
    })
    expect(wrapper.find('[data-testid="indicator-promotion"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="indicator-relegation"]').exists()).toBe(false)
  })

  it('昇格インジケーターに gekokujo-stamp クラスが付く', () => {
    const wrapper = mount(ResultCard, {
      props: {
        player: makePlayer({ borderDirection: 'PROMOTION', group: 'BORDER' }),
        rank: 2,
      },
    })
    const el = wrapper.find('[data-testid="indicator-promotion"]')
    expect(el.classes()).toContain('gekokujo-stamp')
  })

  it('降格インジケーターに youchien-stamp クラスが付く', () => {
    const wrapper = mount(ResultCard, {
      props: {
        player: makePlayer({ borderDirection: 'RELEGATION', group: 'BORDER' }),
        rank: 5,
      },
    })
    const el = wrapper.find('[data-testid="indicator-relegation"]')
    expect(el.classes()).toContain('youchien-stamp')
  })
})
