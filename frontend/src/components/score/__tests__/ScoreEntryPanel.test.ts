import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, readonly } from 'vue'
import ScoreEntryPanel from '../ScoreEntryPanel.vue'
import type { EventWithScores } from '@/composables/useAdminEvent'
import type { ProgressUpdatePayload } from '@/composables/useEventStream'

vi.mock('@/composables/useScoreEntry', () => ({
  useScoreEntry: () => ({
    matches: ref(null),
    wins: ref(null),
    view: readonly(ref('form')),
    isValid: readonly(ref(false)),
    isSubmitting: readonly(ref(false)),
    isAbsent: readonly(ref(false)),
    error: readonly(ref(null)),
    confirmScore: vi.fn(),
    cancelConfirm: vi.fn(),
    submitScore: vi.fn(),
    editScore: vi.fn(),
  }),
}))

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

describe('ScoreEntryPanel', () => {
  describe('提出進捗バー - progressUpdate フォールバック', () => {
    it('progressUpdate が null のとき event.scores から提出数を計算する', () => {
      const event: EventWithScores = {
        ...baseEvent,
        scores: [
          { playerId: 'p1', playerName: 'Player1', wins: 3, losses: 2, absent: false, submitted: true },
          { playerId: 'p2', playerName: 'Player2', wins: 0, losses: 0, absent: false, submitted: true },
          { playerId: 'p3', playerName: 'Player3', wins: 0, losses: 0, absent: false, submitted: false },
          { playerId: 'p4', playerName: 'Player4', wins: 0, losses: 0, absent: true, submitted: false },
        ],
      }

      const wrapper = mount(ScoreEntryPanel, {
        props: { event, progressUpdate: null },
      })

      expect(wrapper.text()).toContain('2 / 3 人提出済み')
    })

    it('progressUpdate が null で未提出のみの場合は 0/N を表示する', () => {
      const event: EventWithScores = {
        ...baseEvent,
        scores: [
          { playerId: 'p1', playerName: 'Player1', wins: 0, losses: 0, absent: false, submitted: false },
          { playerId: 'p2', playerName: 'Player2', wins: 0, losses: 0, absent: false, submitted: false },
        ],
      }

      const wrapper = mount(ScoreEntryPanel, {
        props: { event, progressUpdate: null },
      })

      expect(wrapper.text()).toContain('0 / 2 人提出済み')
    })

    it('progressUpdate がある場合は SSE の値を優先する', () => {
      const event: EventWithScores = {
        ...baseEvent,
        scores: [
          { playerId: 'p1', playerName: 'Player1', wins: 3, losses: 2, absent: false, submitted: true },
          { playerId: 'p2', playerName: 'Player2', wins: 0, losses: 0, absent: false, submitted: false },
        ],
      }

      const progressUpdate: ProgressUpdatePayload = { completedCount: 5, totalCount: 8 }

      const wrapper = mount(ScoreEntryPanel, {
        props: { event, progressUpdate },
      })

      expect(wrapper.text()).toContain('5 / 8 人提出済み')
    })
  })
})
