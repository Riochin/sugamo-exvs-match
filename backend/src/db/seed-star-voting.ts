/**
 * 開発用: STAR_VOTING フェーズのイベントをセットアップする
 * 実行: npm run db:seed:star-voting
 *
 * - players が未作成なら seed.ts を先に実行すること
 * - events / scores / stars を上書きリセットして STAR_VOTING 状態にする
 * - 全員スコア提出済み・星投票未提出なので、すぐに星投票画面へ進める
 */

import { randomUUID } from 'node:crypto'
import { db } from './client.js'
import { events, players, scores, stars } from './schema.js'

const EVENT_ID = 'dev-event-star-voting'

async function seedStarVoting() {
  console.log('=== seed-star-voting ===')

  console.log('Clearing stars / scores / events...')
  await db.delete(stars).execute()
  await db.delete(scores).execute()
  await db.delete(events).execute()

  console.log('Creating event (STAR_VOTING)...')
  await db.insert(events).values({
    id: EVENT_ID,
    name: '開発テスト大会',
    hasPromotionRelegation: false,
    venue: 'テスト会場',
    description: '開発用データ',
    heldAt: new Date(),
    phase: 'STAR_VOTING',
    revealPhase: 0,
    createdAt: new Date(),
  })

  const allPlayers = await db.select().from(players)
  if (allPlayers.length === 0) {
    console.error('プレイヤーが存在しません。先に npm run db:seed を実行してください。')
    process.exit(1)
  }
  console.log(`Found ${allPlayers.length} players.`)

  console.log('Inserting scores (submitted, star voting pending)...')
  for (const p of allPlayers) {
    await db.insert(scores).values({
      id: randomUUID(),
      eventId: EVENT_ID,
      playerId: p.id,
      wins: Math.floor(Math.random() * 5),
      losses: Math.floor(Math.random() * 5),
      absent: false,
      submitted: true,
      starVotingSubmitted: false,
    })
  }

  console.log('Done. Event is now in STAR_VOTING phase.')
  console.log(`Event ID: ${EVENT_ID}`)
  process.exit(0)
}

seedStarVoting().catch((err) => {
  console.error(err)
  process.exit(1)
})
