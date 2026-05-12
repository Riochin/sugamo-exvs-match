import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StarResultsSection from '../StarResultsSection.vue'

const mockStarsResultsGetFn = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  client: {
    api: {
      stars: {
        results: {
          ':eventId': { $get: mockStarsResultsGetFn },
        },
      },
    },
  },
}))

const sampleRankings = [
  { rank: 1, playerId: 'p1', playerName: 'Alice', starCount: 5 },
  { rank: 2, playerId: 'p2', playerName: 'Bob', starCount: 3 },
  { rank: 2, playerId: 'p3', playerName: 'Carol', starCount: 3 },
  { rank: 4, playerId: 'p4', playerName: 'Dave', starCount: 1 },
]

describe('StarResultsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStarsResultsGetFn.mockResolvedValue({
      ok: true,
      json: async () => ({ rankings: sampleRankings }),
    })
  })

  it('onMounted で GET /api/stars/results/:eventId が呼ばれる', async () => {
    mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    expect(mockStarsResultsGetFn).toHaveBeenCalledOnce()
  })

  it('ランキングデータが表示される', async () => {
    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ranking-row"]')
    expect(rows).toHaveLength(4)
  })

  it('1位のプレイヤー名が表示される', async () => {
    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ranking-row"]')
    expect(rows[0].text()).toContain('Alice')
  })

  it('★ アイコンで starCount が表示される', async () => {
    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ranking-row"]')
    expect(rows[0].find('[data-testid="star-count"]').text()).toContain('★')
    expect(rows[0].find('[data-testid="star-count"]').text()).toContain('5')
  })

  it('同数 Star のプレイヤーには同一 rank が表示される（DENSE_RANK）', async () => {
    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ranking-row"]')
    const rank2a = rows[1].find('[data-testid="rank-value"]').text()
    const rank2b = rows[2].find('[data-testid="rank-value"]').text()
    expect(rank2a).toBe(rank2b)
    expect(rank2a).toContain('2')
  })

  it('rank 値が各行に表示される', async () => {
    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ranking-row"]')
    expect(rows[0].find('[data-testid="rank-value"]').text()).toContain('1')
    expect(rows[3].find('[data-testid="rank-value"]').text()).toContain('4')
  })

  it('API エラー時はエラーメッセージが表示される', async () => {
    mockStarsResultsGetFn.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'EVENT_NOT_FOUND' }),
    })

    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="ranking-error"]').exists()).toBe(true)
  })

  it('ランキングが 0 件の場合は空メッセージが表示される', async () => {
    mockStarsResultsGetFn.mockResolvedValue({
      ok: true,
      json: async () => ({ rankings: [] }),
    })

    const wrapper = mount(StarResultsSection, { props: { eventId: 'event-1' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="ranking-empty"]').exists()).toBe(true)
  })
})
