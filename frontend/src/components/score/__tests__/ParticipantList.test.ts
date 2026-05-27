import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ParticipantList from '../ParticipantList.vue'
import type { EventWithScores } from '@/composables/useAdminEvent'

const baseEvent: EventWithScores = {
  id: 'event-1',
  name: 'テスト大会',
  hasPromotionRelegation: false,
  venue: 'テスト会場',
  description: null,
  phase: 'COLLECTING',
  heldAt: '2026-05-12T12:00:00.000Z',
  scores: [],
}

describe('ParticipantList', () => {
  it('トグルボタンに参加者数（欠席者除く）が表示される', () => {
    const event: EventWithScores = {
      ...baseEvent,
      scores: [
        { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: false, submitted: false },
        { playerId: 'p2', playerName: 'Player2', wins: 0, losses: 0, absent: false, submitted: false },
        { playerId: 'p3', playerName: 'Player3', wins: 0, losses: 0, absent: true, submitted: false },
      ],
    }

    const wrapper = mount(ParticipantList, { props: { event } })

    expect(wrapper.find('[data-testid="participant-list-toggle"]').text()).toContain('2人')
  })

  it('初期状態ではコンテンツが非表示', () => {
    const wrapper = mount(ParticipantList, { props: { event: baseEvent } })

    expect(wrapper.find('[data-testid="participant-list-content"]').exists()).toBe(false)
  })

  it('トグルクリックでコンテンツが展開される', async () => {
    const wrapper = mount(ParticipantList, { props: { event: baseEvent } })

    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').exists()).toBe(true)
  })

  it('再クリックで折りたたまれる', async () => {
    const wrapper = mount(ParticipantList, { props: { event: baseEvent } })

    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').exists()).toBe(false)
  })

  it('展開後に日時が正しいフォーマットで表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      heldAt: '2026-05-12T12:00:00.000Z',
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').text()).toContain('2026/05/12')
  })

  it('展開後に会場名が表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      venue: 'ゲームセンターすがも',
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').text()).toContain('ゲームセンターすがも')
  })

  it('会場が null のとき「未定」と表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      venue: null,
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').text()).toContain('未定')
  })

  it('展開後に参加者名が表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      scores: [
        { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: false, submitted: false },
        { playerId: 'p2', playerName: 'Player2', wins: 0, losses: 0, absent: false, submitted: false },
      ],
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    const content = wrapper.find('[data-testid="participant-list-content"]')
    expect(content.text()).toContain('Player1')
    expect(content.text()).toContain('Player2')
  })

  it('提出済みプレイヤーに ✓ マークが表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      scores: [
        { playerId: 'p1', playerName: 'Player1', wins: 3, losses: 2, absent: false, submitted: true },
      ],
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').text()).toContain('✓')
  })

  it('未提出プレイヤーに「未提出」が表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      scores: [
        { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: false, submitted: false },
      ],
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').text()).toContain('未提出')
  })

  it('欠席プレイヤーに「欠席」が表示される', async () => {
    const event: EventWithScores = {
      ...baseEvent,
      scores: [
        { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: true, submitted: false },
      ],
    }

    const wrapper = mount(ParticipantList, { props: { event } })
    await wrapper.find('[data-testid="participant-list-toggle"]').trigger('click')

    expect(wrapper.find('[data-testid="participant-list-content"]').text()).toContain('欠席')
  })
})
