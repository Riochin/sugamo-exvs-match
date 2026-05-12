# 実装タスク — star-voting

## タスク一覧

- [x] 1. Foundation — データベーススキーマと型定義の基盤整備
- [x] 1.1 DB スキーマ変更と Drizzle マイグレーション
  - `events.phase` の enum に `'STAR_VOTING'` を追加する
  - `scores` テーブルに `starVotingSubmitted` boolean カラム（デフォルト `false`）を追加する
  - `stars` テーブルの `(eventId, fromPlayerId, toPlayerId)` に一意制約インデックスを追加する
  - `drizzle-kit generate` + `drizzle-kit migrate` でマイグレーションを生成・DB に反映する
  - スキーマ変更後に TypeScript コンパイルエラーが発生しないことを確認する
  - _Requirements: 4.7, 5.2, 8.4_

- [x] 1.2 バックエンド型定義とフェーズ管理の拡張
  - `event-service.ts` の `EventPhase` 型を `'COLLECTING' | 'STAR_VOTING' | 'REVEALING' | 'DONE'` に更新する
  - `PHASE_MAP` を `{ COLLECTING: 'STAR_VOTING', STAR_VOTING: 'REVEALING', REVEALING: 'DONE' }` に更新する
  - `stream.ts` の `SSEEventType` Union 型に `'star_vote_update'` を追加する
  - 型変更に伴う既存コードの型エラーをすべて解消し、`tsc` が正常終了すること
  - _Requirements: 6.2, 8.1, 8.2, 8.4_

- [x] 2. バックエンド — ビジネスロジックと API 実装
- [x] 2.1 (P) スコア入力完了時の STAR_VOTING フェーズ自動遷移
  - `score-service.ts` の全スコア完了ブランチで `result_ready` ブロードキャストを廃止する
  - 全スコア完了検出時に `events.phase` を `'STAR_VOTING'` に DB 更新する処理を追加する
  - `phase_update { eventId, phase: 'STAR_VOTING' }` SSE イベントをハブ経由でブロードキャストする
  - 最後のスコアが送信された後、全クライアントに `phase_update` イベントが届くこと
  - _Requirements: 8.4_
  - _Boundary: score-service_
  - _Depends: 1.2_

- [x] 2.2 (P) Star 投票サービス（star-service）の実装
  - `submitVote`: フェーズ確認・自己投票禁止・二重投票禁止・合計 3 検証を Drizzle トランザクション内で実行し、`stars` INSERT と `scores.starVotingSubmitted = true` 更新をアトミックに行う
  - 全員投票完了時に `events.phase = 'REVEALING'` に更新し `phase_update REVEALING` SSE をブロードキャストする
  - `getVotingStatus`: 自己プレイヤーを除外した参加プレイヤー一覧・完了数・`hasVoted` フラグを返す
  - `getResults`: 各プレイヤーの Star 受取総数を集計し、DENSE_RANK 相当の同順位ランキングを計算して返す
  - 各エラーケース（`PHASE_NOT_STAR_VOTING`・`ALREADY_VOTED`・`SELF_VOTE_FORBIDDEN`・`INVALID_TOTAL`）に対して正しいエラーコードを返すこと
  - _Requirements: 3.2, 3.3, 4.4, 4.7, 5.1, 5.2, 5.3, 5.4, 6.2, 6.3, 7.4, 8.1, 8.2, 8.3_
  - _Boundary: star-service_
  - _Depends: 1.1, 1.2_

- [x] 2.3 Star 投票 API ルートの実装（POST /api/stars・GET /status・GET /results/:eventId）
  - `POST /api/stars`: Zod で `allocations` を検証し `star-service.submitVote` を呼び出す。エラーコードを正しい HTTP ステータス（`ALREADY_VOTED`/`PHASE_NOT_STAR_VOTING` → 409、`SELF_VOTE_FORBIDDEN`/`INVALID_TOTAL` → 422、`NO_ACTIVE_VOTING_EVENT` → 404）にマッピングする
  - `GET /api/stars/status`: `authMiddleware` を適用し `getVotingStatus` の結果を返す
  - `GET /api/stars/results/:eventId`: `authMiddleware` を適用し `getResults` の結果を `{ rankings }` 形式で返す
  - `app` に `starsRoute` を登録し、Hono RPC 経由でフロントエンドから型安全に呼び出せること
  - _Requirements: 3.2, 4.4, 6.1, 7.1_
  - _Depends: 2.2_

- [x] 3. フロントエンド — コンポーザブルとコンポーネント実装
- [x] 3.1 (P) SSE クライアントと管理者フェーズ型の更新
  - `useEventStream.ts` に `star_vote_update` イベントリスナーを追加し、`starVoteUpdate` リアクティブ値（`Ref<{ completedCount: number; totalCount: number } | null>`）を `UseEventStreamReturn` に追加する
  - `useAdminEvent.ts` の `EventPhase` 型参照を `'STAR_VOTING'` を含む型に更新する
  - `star_vote_update` SSE を受信すると `starVoteUpdate.value` がリアルタイムに更新されること
  - _Requirements: 6.2, 8.1_
  - _Boundary: useEventStream, useAdminEvent_
  - _Depends: 1.2_

- [x] 3.2 (P) useStarVoting コンポーザブルの実装
  - `loadPlayers(eventId)` で `GET /api/stars/status` を呼び出し、自己除外済みプレイヤー一覧・完了数・`hasVoted` を取得する
  - `hasVoted === true` の場合はページロード時に `submitted = true` で初期化する（リロード対応）
  - `increment(playerId)`: `remaining === 0` の場合は操作を拒否する
  - `decrement(playerId)`: `allocated === 0` の場合は操作を拒否する
  - `remaining`（`3 - sum(allocated)` の computed 値）をリアルタイムに更新する
  - `isReadyToSubmit`（`remaining === 0` のとき `true`）を提供する
  - `submitVote()`: `POST /api/stars` を呼び出し、成功時に `submitted = true` をセット、ネットワークエラー時は `error.value` にメッセージをセットし `submitted` を維持する
  - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.3, 4.1, 4.2, 4.4, 4.5, 4.6_
  - _Boundary: useStarVoting_
  - _Depends: 2.3_

- [x] 3.3 Star 投票 UI コンポーネントの実装（PlayerStarCard・StarVotingPanel・StarConfirmDialog）
  - `PlayerStarCard`: `allocated === 0` のとき `-` ボタンを disabled、`remaining === 0 && allocated === 0` のとき `+` ボタンを disabled にし、`+`/`-` 押下で `increment`/`decrement` を呼び出す
  - `StarVotingPanel`: 残り Star 数ヘッダー・`PlayerStarCard` 一覧・投票完了人数（例: 5/12名完了）・「投票する」ボタン（`isReadyToSubmit` のときのみ活性）を描画する
  - `StarConfirmDialog`: 配分内容一覧（プレイヤー名・配分数）を表示し「確定」「戻る」を提供する
  - 残り Star 数が 0 になると「投票する」ボタンが活性化し、確認ダイアログが表示されること
  - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.3, 6.1_
  - _Depends: 3.2_

- [x] 4. 統合 — 画面・ルーティング・結果表示の組み立て
- [x] 4.1 (P) StarVotingView の実装（投票画面の組み立てと SSE 統合）
  - `onMounted` で `useStarVoting.loadPlayers(eventId)` を呼び出しプレイヤー一覧を取得する
  - `useEventStream.connect(eventId)` で SSE に接続し、`star_vote_update` 受信時に完了人数表示を更新する
  - `phase_update REVEALING` 受信時に `/events/:id/result` へ自動遷移する
  - `submitted === true` のとき投票完了メッセージを表示し、再操作を不可にする
  - `error.value` が存在するときエラーメッセージを表示し再送信ボタンを提供する
  - フェーズが `STAR_VOTING` でない場合は「現在は投票を受け付けていません」を表示する
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 8.1, 8.2_
  - _Boundary: StarVotingView_
  - _Depends: 3.1, 3.2, 3.3_

- [x] 4.2 (P) フロントエンドルーティングと TournamentView の STAR_VOTING 遷移
  - `router/index.ts` に `/events/:id/star-voting` ルートを追加する（`requiresAuth: true`、`layout: 'plain'`、コンポーネント: `StarVotingView`）
  - `TournamentView.vue` の `phase_update` ハンドラに `STAR_VOTING` を受信したとき `/events/:id/star-voting` へ遷移する処理を追加する
  - スコア全員入力完了後、すべてのクライアントが `StarVotingView` 画面へ自動遷移すること
  - _Requirements: 1.1, 8.1, 8.4_
  - _Boundary: router, TournamentView_
  - _Depends: 1.2_

- [x] 4.3 (P) StarResultsSection の実装と ResultRevealView への統合
  - `StarResultsSection`: `onMounted` で `GET /api/stars/results/:eventId` を呼び出しランキングデータを取得する
  - `rank`・`playerName`・`starCount`（`★` アイコン、`yellow-400`）を Star 数降順で描画する
  - 同数 Star のプレイヤーには同一 `rank` 値を表示する
  - `ResultRevealView.vue` に `StarResultsSection` を組み込み、`REVEALING` または `DONE` フェーズで表示する
  - 結果画面でスターランキングが視覚的に確認できること
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - _Boundary: StarResultsSection, ResultRevealView_
  - _Depends: 2.3_

- [ ] 5. テスト — ユニット・統合テスト
- [ ] 5.1 (P) star-service ユニットテスト
  - `submitVote` の検証: 自己投票（`SELF_VOTE_FORBIDDEN`）・合計≠3（`INVALID_TOTAL`）・二重投票（`ALREADY_VOTED`）・STAR_VOTING 外フェーズ（`PHASE_NOT_STAR_VOTING`）・正常系 の各ケース
  - 全員投票完了時に `events.phase` が `'REVEALING'` に遷移し SSE ブロードキャストが呼ばれることを検証する
  - `getResults` の検証: 同順位計算（複数プレイヤー同数 Star での同 rank）・空集計・部分投票時の各ケース
  - _Requirements: 3.2, 3.3, 4.7, 5.1, 5.4, 7.4, 8.1, 8.2, 8.3_
  - _Boundary: star-service_

- [ ] 5.2 (P) useStarVoting ユニットテスト
  - `increment`: `remaining === 0` のとき配分数が変化しないことを検証する
  - `decrement`: `allocated === 0` のとき配分数が変化しないことを検証する
  - `isReadyToSubmit`: `remaining === 0` のときのみ `true` になることを検証する
  - 1 人への最大配分数（3 Stars 全ツッパ）が正しく機能することを検証する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1_
  - _Boundary: useStarVoting_

- [ ] 5.3 バックエンド統合テスト（API・フェーズ自動遷移）
  - `POST /api/stars` 正常系: `stars` 行と `scores.starVotingSubmitted = true` が DB に保存されることを確認する
  - `POST /api/stars` 二重投票: 409 レスポンスが返ることを確認する
  - `POST /api/stars` STAR_VOTING 外フェーズ: 409 レスポンスが返ることを確認する
  - 全員投票完了後: `events.phase` が `'REVEALING'` に自動遷移していることを確認する
  - スコア全員完了後: `events.phase` が `'STAR_VOTING'` に自動遷移していることを確認する
  - _Requirements: 4.4, 4.7, 5.4, 6.3, 8.3, 8.4_
  - _Depends: 2.1, 2.2, 2.3_
