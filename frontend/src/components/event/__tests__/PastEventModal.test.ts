import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PastEventModal from '../PastEventModal.vue'

const mockGetResultFn = vi.hoisted(() => vi.fn())
const mockGetStarsFn = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  client: {
    api: {
      events: {
        ':id': {
          result: { $get: mockGetResultFn },
        },
      },
      stars: {
        results: {
          ':eventId': { $get: mockGetStarsFn },
        },
      },
    },
  },
}))

vi.mock('@/components/ui/BottomSheet.vue', () => ({
  default: {
    name: 'BottomSheet',
    props: ['visible', 'title'],
    emits: ['close'],
    template: `
      <div v-if="visible" data-testid="bottom-sheet">
        <slot name="header" />
        <button data-testid="bottom-sheet-close-btn" @click="$emit('close')">×</button>
        <slot />
      </div>
    `,
  },
}))

const baseProps = {
  eventId: 'event-1',
  heldAt: '2026-05-12T12:00:00.000Z',
  visible: true,
  name: 'テスト大会',
  venue: null as string | null,
  description: null as string | null,
  hasPromotionRelegation: false,
}

const samplePlayers = [
  {
    playerId: 'p1',
    playerName: 'Alice',
    team: 'FIRST',
    wins: 5,
    losses: 1,
    absent: false,
    rank: 1,
    group: 'FIRST_STAY',
    borderDirection: null,
  },
  {
    playerId: 'p2',
    playerName: 'Bob',
    team: 'SECOND',
    wins: 3,
    losses: 3,
    absent: false,
    rank: 2,
    group: 'SECOND_STAY',
    borderDirection: null,
  },
  {
    playerId: 'p3',
    playerName: 'Carol',
    team: 'FIRST',
    wins: 0,
    losses: 0,
    absent: true,
    rank: null,
    group: null,
    borderDirection: null,
  },
]

const sampleStarRankings = [
  { rank: 1, playerId: 'p1', playerName: 'Alice', starCount: 5 },
  { rank: 2, playerId: 'p2', playerName: 'Bob', starCount: 2 },
]

describe('PastEventModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetResultFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        players: samplePlayers,
        eventId: 'event-1',
        revealPhase: 3,
        eventPhase: 'DONE',
      }),
    })
    mockGetStarsFn.mockResolvedValue({
      ok: true,
      json: async () => ({ rankings: sampleStarRankings }),
    })
  })

  it('visible=true でマウント時に result と stars の両 API が呼ばれる', async () => {
    mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(mockGetResultFn).toHaveBeenCalledOnce()
    expect(mockGetStarsFn).toHaveBeenCalledOnce()
  })

  it('visible=false のときは API が呼ばれない', async () => {
    mount(PastEventModal, { props: { ...baseProps, visible: false } })
    await flushPromises()

    expect(mockGetResultFn).not.toHaveBeenCalled()
    expect(mockGetStarsFn).not.toHaveBeenCalled()
  })

  it('大会名がヘッダーに表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('テスト大会')
  })

  it('日付がフォーマットされて表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('2026/05/12')
  })

  it('venue がある場合に会場が表示される', async () => {
    const wrapper = mount(PastEventModal, { props: { ...baseProps, venue: 'ゲームセンターすがも' } })
    await flushPromises()

    expect(wrapper.text()).toContain('ゲームセンターすがも')
  })

  it('venue が null の場合に会場行が表示されない', async () => {
    const wrapper = mount(PastEventModal, { props: { ...baseProps, venue: null } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('会場')
  })

  it('hasPromotionRelegation が true のとき昇格降格バッジが表示される', async () => {
    const wrapper = mount(PastEventModal, { props: { ...baseProps, hasPromotionRelegation: true } })
    await flushPromises()

    expect(wrapper.text()).toContain('下剋上あり')
  })

  it('hasPromotionRelegation が false のとき「下剋上なし」バッジが表示される', async () => {
    const wrapper = mount(PastEventModal, { props: { ...baseProps, hasPromotionRelegation: false } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('下剋上あり')
    expect(wrapper.text()).toContain('下剋上なし')
  })

  it('description がある場合に説明文が表示される', async () => {
    const wrapper = mount(PastEventModal, { props: { ...baseProps, description: '月例下剋上決定戦' } })
    await flushPromises()

    expect(wrapper.text()).toContain('月例下剋上決定戦')
  })

  it('出席者のプレイヤー名が表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('欠席者に「欠席」バッジとプレイヤー名が表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('欠席')
    expect(wrapper.text()).toContain('Carol')
  })

  it('出席者の順位が表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('1位')
    expect(wrapper.text()).toContain('2位')
  })

  it('勝率が正しく計算・表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    // Alice: 5勝1敗 → 83.3%
    expect(wrapper.text()).toContain('83.3%')
    // Bob: 3勝3敗 → 50.0%
    expect(wrapper.text()).toContain('50.0%')
  })

  it('試合数が0の参加者の勝率は "-" が表示される', async () => {
    const playersWithZeroMatches = [
      {
        playerId: 'p4',
        playerName: 'Dave',
        team: 'FIRST',
        wins: 0,
        losses: 0,
        absent: false,
        rank: 1,
        group: 'FIRST_STAY',
        borderDirection: null,
      },
    ]
    mockGetResultFn.mockResolvedValue({
      ok: true,
      json: async () => ({ players: playersWithZeroMatches, eventId: 'event-1', revealPhase: 3, eventPhase: 'DONE' }),
    })
    mockGetStarsFn.mockResolvedValue({
      ok: true,
      json: async () => ({ rankings: [] }),
    })

    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('-')
  })

  it('STAR を受けたプレイヤーに ★N が表示される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('★5')
    expect(wrapper.text()).toContain('★2')
  })

  it('STAR が 0 のプレイヤーには ★0 が表示されない', async () => {
    const playersWithNoStar = [
      ...samplePlayers,
      {
        playerId: 'p4',
        playerName: 'Dave',
        team: 'SECOND',
        wins: 2,
        losses: 4,
        absent: false,
        rank: 3,
        group: 'SECOND_STAY',
        borderDirection: null,
      },
    ]
    mockGetResultFn.mockResolvedValue({
      ok: true,
      json: async () => ({ players: playersWithNoStar, eventId: 'event-1', revealPhase: 3, eventPhase: 'DONE' }),
    })
    // p4 (Dave) は sampleStarRankings に含まれないので starCount = 0

    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).not.toContain('★0')
  })

  it('×ボタンをクリックすると close イベントが発火される', async () => {
    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    await wrapper.find('[data-testid="bottom-sheet-close-btn"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('API エラー時にエラーメッセージが表示される', async () => {
    mockGetResultFn.mockResolvedValue({ ok: false })

    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('データの取得に失敗しました')
  })

  it('ネットワークエラー時にエラーメッセージが表示される', async () => {
    mockGetResultFn.mockRejectedValue(new Error('network error'))

    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    expect(wrapper.text()).toContain('ネットワークエラーが発生しました')
  })

  it('出席者が rank の昇順で表示される', async () => {
    const unorderedPlayers = [
      {
        playerId: 'p2',
        playerName: 'Bob',
        team: 'SECOND',
        wins: 3,
        losses: 3,
        absent: false,
        rank: 2,
        group: 'SECOND_STAY',
        borderDirection: null,
      },
      {
        playerId: 'p1',
        playerName: 'Alice',
        team: 'FIRST',
        wins: 5,
        losses: 1,
        absent: false,
        rank: 1,
        group: 'FIRST_STAY',
        borderDirection: null,
      },
    ]
    mockGetResultFn.mockResolvedValue({
      ok: true,
      json: async () => ({ players: unorderedPlayers, eventId: 'event-1', revealPhase: 3, eventPhase: 'DONE' }),
    })

    const wrapper = mount(PastEventModal, { props: baseProps })
    await flushPromises()

    const text = wrapper.text()
    expect(text.indexOf('Alice')).toBeLessThan(text.indexOf('Bob'))
  })
})
