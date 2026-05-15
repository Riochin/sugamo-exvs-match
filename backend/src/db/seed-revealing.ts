/**
 * 開発用: REVEALING フェーズのイベントをセットアップする
 * 実行: npm run db:seed:revealing
 *
 * - players が未作成なら seed.ts を先に実行すること
 * - events / scores / stars を上書きリセットして REVEALING 状態にする
 */

import { randomUUID } from 'node:crypto'
import { db } from './client.js'
import { events, players, scores, stars } from './schema.js'

const EVENT_ID = 'dev-event-revealing'

async function seedRevealing() {
  console.log('=== seed-revealing ===')

  // 1. 既存の dev イベントに紐づく stars / scores を削除
  console.log('Clearing stars / scores for dev event...')
  await db.delete(stars).execute()
  await db.delete(scores).execute()
  await db.delete(events).execute()

  // 2. イベントを REVEALING フェーズで作成
  console.log('Creating event (REVEALING)...')
  await db.insert(events).values({
    id: EVENT_ID,
    name: '開発テスト大会',
    hasPromotionRelegation: false,
    venue: 'テスト会場',
    description: '開発用データ',
    heldAt: new Date(),
    phase: 'REVEALING',
    revealPhase: 0,
    createdAt: new Date(),
  })

  // 3. 全プレイヤーを取得
  const allPlayers = await db.select().from(players)
  if (allPlayers.length === 0) {
    console.error('プレイヤーが存在しません。先に npm run db:seed を実行してください。')
    process.exit(1)
  }
  console.log(`Found ${allPlayers.length} players.`)

  // 4. 全員分のスコアを作成 (スコア提出済み + 星投票済み)
  console.log('Inserting scores...')
  for (const p of allPlayers) {
    await db.insert(scores).values({
      id: randomUUID(),
      eventId: EVENT_ID,
      playerId: p.id,
      wins: Math.floor(Math.random() * 5),
      losses: Math.floor(Math.random() * 5),
      absent: false,
      submitted: true,
      starVotingSubmitted: true,
    })
  }

  // 5. 各プレイヤーから他プレイヤーへ計3票の星を配布
  console.log('Inserting stars...')
  for (const voter of allPlayers) {
    const targets = allPlayers.filter((p) => p.id !== voter.id)
    // ランダムに2人を選んで 2+1 で配る
    const shuffled = targets.sort(() => Math.random() - 0.5)
    const allocations = [
      { toPlayerId: shuffled[0].id, count: 2 },
      { toPlayerId: shuffled[1].id, count: 1 },
    ]

    for (const alloc of allocations) {
      await db.insert(stars).values({
        id: randomUUID(),
        eventId: EVENT_ID,
        fromPlayerId: voter.id,
        toPlayerId: alloc.toPlayerId,
        count: alloc.count,
      })
    }
  }

  console.log('Done. Event is now in REVEALING phase.')
  console.log(`Event ID: ${EVENT_ID}`)
  process.exit(0)
}

seedRevealing().catch((err) => {
  console.error(err)
  process.exit(1)
})
