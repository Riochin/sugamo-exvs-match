import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WinRateHistory from '../WinRateHistory.vue'

type EventMeta = {
  eventId: string
  heldAt: string
  name: string
  venue: string | null
  description: string | null
  hasPromotionRelegation: boolean
}
type WinRateEntry =
  | (EventMeta & { winRate: number; wins: number; losses: number; absent: false })
  | (EventMeta & { absent: true })

const baseMeta = {
  name: '大会',
  venue: null as null,
  description: null as null,
  hasPromotionRelegation: false,
}

function mountHistory(history: WinRateEntry[]) {
  return mount(WinRateHistory, { props: { history } })
}

describe('WinRateHistory', () => {
  it('absent: true のエントリに「欠席」テキストを表示する', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', absent: true },
    ])
    expect(wrapper.text()).toContain('欠席')
  })

  it('absent: true のエントリにポイントを描画しない', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', absent: true },
    ])
    expect(wrapper.find('[data-testid="win-rate-point"]').exists()).toBe(false)
  })

  it('absent: false のエントリに勝率テキストを表示する', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 68.5, wins: 7, losses: 3, absent: false },
    ])
    expect(wrapper.text()).toContain('68.5%')
  })

  it('absent: false のエントリにポイントを描画する', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 68.5, wins: 7, losses: 3, absent: false },
    ])
    expect(wrapper.find('[data-testid="win-rate-point"]').exists()).toBe(true)
  })

  it('winRate = 100 のときポイントに fill-accent クラスを付与する', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 100, wins: 10, losses: 0, absent: false },
    ])
    const point = wrapper.find('[data-testid="win-rate-point"]')
    expect(point.classes()).toContain('fill-accent')
  })

  it('winRate < 100 のときポイントに fill-main クラスを付与する', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 50, wins: 5, losses: 5, absent: false },
    ])
    const point = wrapper.find('[data-testid="win-rate-point"]')
    expect(point.classes()).toContain('fill-main')
  })

  it('複数エントリを全て表示する', () => {
    const wrapper = mountHistory([
      { ...baseMeta, eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 60, wins: 6, losses: 4, absent: false },
      { ...baseMeta, eventId: 'e2', heldAt: '2026-02-01T00:00:00Z', absent: true },
      { ...baseMeta, eventId: 'e3', heldAt: '2026-03-01T00:00:00Z', winRate: 80, wins: 8, losses: 2, absent: false },
    ])
    expect(wrapper.findAll('[data-testid="history-entry"]')).toHaveLength(3)
  })

  it('history が空の場合は何も表示しない', () => {
    const wrapper = mountHistory([])
    expect(wrapper.find('[data-testid="history-entry"]').exists()).toBe(false)
  })
})
