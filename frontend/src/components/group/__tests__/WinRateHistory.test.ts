import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WinRateHistory from '../WinRateHistory.vue'

type WinRateEntry =
  | { eventId: string; heldAt: string; winRate: number; wins: number; losses: number; absent: false }
  | { eventId: string; heldAt: string; absent: true }

function mountHistory(history: WinRateEntry[]) {
  return mount(WinRateHistory, { props: { history } })
}

describe('WinRateHistory', () => {
  it('absent: true のエントリに「欠席」テキストを表示する', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', absent: true },
    ])
    expect(wrapper.text()).toContain('欠席')
  })

  it('absent: true のエントリにバーを描画しない', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', absent: true },
    ])
    expect(wrapper.find('[data-testid="win-rate-bar"]').exists()).toBe(false)
  })

  it('absent: false のエントリに勝率テキストを表示する', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 68.5, wins: 7, losses: 3, absent: false },
    ])
    expect(wrapper.text()).toContain('68.5%')
  })

  it('absent: false のエントリにバーを描画する', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 68.5, wins: 7, losses: 3, absent: false },
    ])
    const bar = wrapper.find('[data-testid="win-rate-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('style')).toContain('width: 68.5%')
  })

  it('winRate = 100 のときバーに bg-accent クラスを付与する', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 100, wins: 10, losses: 0, absent: false },
    ])
    const bar = wrapper.find('[data-testid="win-rate-bar"]')
    expect(bar.classes()).toContain('bg-accent')
  })

  it('winRate < 100 のときバーに bg-main クラスを付与する', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 50, wins: 5, losses: 5, absent: false },
    ])
    const bar = wrapper.find('[data-testid="win-rate-bar"]')
    expect(bar.classes()).toContain('bg-main')
  })

  it('複数エントリを全て表示する', () => {
    const wrapper = mountHistory([
      { eventId: 'e1', heldAt: '2026-01-01T00:00:00Z', winRate: 60, wins: 6, losses: 4, absent: false },
      { eventId: 'e2', heldAt: '2026-02-01T00:00:00Z', absent: true },
      { eventId: 'e3', heldAt: '2026-03-01T00:00:00Z', winRate: 80, wins: 8, losses: 2, absent: false },
    ])
    expect(wrapper.findAll('[data-testid="history-entry"]')).toHaveLength(3)
  })

  it('history が空の場合は何も表示しない', () => {
    const wrapper = mountHistory([])
    expect(wrapper.find('[data-testid="history-entry"]').exists()).toBe(false)
  })
})
