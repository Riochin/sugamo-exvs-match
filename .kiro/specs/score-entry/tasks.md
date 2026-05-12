# 実装計画

- [ ] 1. scoresテーブルにsubmittedカラムを追加してマイグレーションを適用する
  - `backend/src/db/schema.ts` の scores テーブルに `submitted: integer('submitted', { mode: 'boolean' }).notNull().default(false)` を追加する
  - `drizzle-kit generate` でマイグレーションファイルを生成し内容を確認する
  - `drizzle-kit migrate` で Turso に適用し、既存レコードが全て `submitted=false` で初期化されることを確認する
  - _Requirements: 1.1, 3.1, 3.3_

- [ ] 2. バックエンド: ScoreService と scoresRoute の実装
- [ ] 2.1 ScoreServiceにスコア提出ビジネスロジックを実装する
  - `backend/src/services/score-service.ts` を新規作成し `submitScore({ playerId, matches, wins })` を実装する
  - アクティブイベントを取得し、フェーズが `COLLECTING` 以外なら `{ code: 'PHASE_NOT_COLLECTING' }` を返す
  - プレイヤーの `absent` フラグを確認し、`absent=true` なら `{ code: 'PLAYER_ABSENT' }` を返す
  - `losses = matches - wins` を導出し `wins` / `losses` / `submitted=true` を DB に UPDATE する
  - 欠席者を除いた `completedCount` / `totalCount` を計算し `hub.broadcast('progress_update', { completedCount, totalCount })` を呼び出す
  - 全員完了時は続けて `hub.broadcast('result_ready', { eventId })` を呼び出す
  - `submitScore()` が成功すると `{ eventId, completedCount, totalCount, allCompleted }` が返り、SSE クライアントに `progress_update` が届く
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 5.5_
  - _Boundary: ScoreService_

- [ ] 2.2 scoresRouteにHTTPハンドラとZodバリデーションを実装する
  - `backend/src/routes/scores.ts` の `POST /` ハンドラに `authMiddleware` を適用し、未認証リクエストに 401 を返す
  - `matches: z.number().int().min(0)` / `wins: z.number().int().min(0)` / `.refine(data => data.wins <= data.matches)` の zod スキーマを `zValidator` で設定する
  - `ScoreService.submitScore()` を呼び出し結果に応じて 200 / 400 / 401 / 404 / 409 を返す
  - バリデーションエラーが 400、認証なしが 401、`NO_ACTIVE_EVENT` が 404、`PHASE_NOT_COLLECTING` / `PLAYER_ABSENT` が 409 で返ることを curl で確認できる
  - _Requirements: 1.4, 1.5, 5.1, 5.2, 5.3_
  - _Boundary: scoresRoute_

- [ ] 3. フロントエンド: 提出ロジックとUIコンポーネントの実装
- [ ] 3.1 useScoreEntryコンポーザブルを実装する
  - `frontend/src/composables/useScoreEntry.ts` を新規作成し `matches` / `wins` の ref と `isValid` / `isSubmitting` / `submitted` / `isAbsent` / `error` を公開する
  - `isValid` を `matches !== null && wins !== null && matches >= 0 && wins >= 0 && wins <= matches` の computed で定義する
  - マウント時に `client.api.events.active.$get()` を呼び出し、現在プレイヤーのスコアレコードから `absent` フラグを取得して `isAbsent` を初期化する
  - `submitScore()` で `client.api.scores.$post({ json: { matches, wins } })` を呼び出し、成功後に `submitted=true` をセットする
  - API エラー時は `error` ref にメッセージをセットし `submitted` は `false` のままとする
  - スコア提出後に `submitted` が `true` になりフォームがロック状態に遷移することを確認できる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.2, 4.6, 5.4_
  - _Boundary: useScoreEntry_

- [ ] 3.2 (P) SubmissionProgressBarコンポーネントを実装する
  - `frontend/src/components/score/SubmissionProgressBar.vue` を新規作成し `completedCount: number` と `totalCount: number` を props として受け取る
  - `completedCount / totalCount` のパーセンテージをプログレスバーで描画し "X / Y 人提出済み" テキストを表示する
  - `totalCount=0` のとき 0% 表示となり除算エラーが発生しないことを確認できる
  - ダークテーマ（`bg-dark` / `text-white` / `border-main`）で Tailwind クラスを設計する
  - _Requirements: 2.3, 4.3_
  - _Boundary: SubmissionProgressBar_

- [ ] 3.3 ScoreEntryPanelコンポーネントを実装する
  - `frontend/src/components/score/ScoreEntryPanel.vue` を新規作成し `eventId: string` と `progressUpdate: ProgressUpdatePayload | null` を props として受け取る
  - `useScoreEntry(eventId)` を呼び出しフォーム状態と提出ロジックを管理する
  - `isAbsent=true` のとき入力フォームを非表示にして欠席メッセージを表示し、`submitted=true` のとき送信完了メッセージを表示してフォームをロックする
  - 対戦数・勝利数の入力欄を `type="number"` `inputmode="numeric"` で実装してモバイルキーパッドを最適化する
  - 送信ボタンを `isValid && !submitted && !isAbsent` のときのみ有効化する
  - `SubmissionProgressBar` に `progressUpdate` prop を渡してリアルタイム進捗を表示する
  - フォーム送信後に送信ボタンが無効化され完了メッセージが表示されることを確認できる
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 5.4_
  - _Depends: 3.1, 3.2_
  - _Boundary: ScoreEntryPanel_

- [ ] 4. TournamentViewをCOLLECTINGフェーズ対応コンテナに拡充する
  - マウント時に `client.api.events.active.$get()` でアクティブイベントを取得し、取得後に `useEventStream.connect(eventId)` を呼び出す
  - `currentPhase` が `COLLECTING` のとき `ScoreEntryPanel` を表示し、イベントが存在しないとき待機メッセージを表示する
  - `useEventStream` の `progressUpdate` イベントを受信して `ScoreEntryPanel` の prop に渡す
  - `resultReady` SSE イベント受信時に結果発表ルートへ自動ナビゲートする（本スペックでは `console.log` またはプレースホルダーメッセージで代替）
  - COLLECTING フェーズ中に TournamentView を開くと `ScoreEntryPanel` が描画されることを確認できる
  - _Requirements: 2.4, 4.1, 4.4_
  - _Depends: 3.3_
  - _Boundary: TournamentView_

- [ ] 5. テスト
- [ ] 5.1 ScoreServiceのユニットテストを実装する
  - フェーズが `COLLECTING` 以外のとき `PHASE_NOT_COLLECTING` が返ることをテストする
  - `absent=true` のプレイヤーが `PLAYER_ABSENT` を返すことをテストする
  - `losses = matches - wins` が正しく計算されて DB に保存されることをテストする
  - 全員完了時に `hub.broadcast('result_ready', ...)` が呼ばれることをテストする
  - 一部未完了時は `result_ready` が呼ばれないことをテストする
  - ScoreService の全ユニットテストがパスする
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3_
  - _Boundary: ScoreService_

- [ ] 5.2 (P) scoresRoute APIインテグレーションテストを実装する
  - 正常系: 認証済みプレイヤーが有効値を送信すると 200 が返ることをテストする
  - 認証なし: 401 が返ることをテストする
  - バリデーションエラー (`wins > matches`): 400 が返ることをテストする
  - フェーズエラー (`COLLECTING` 以外): 409 が返ることをテストする
  - 欠席エラー: 409 が返ることをテストする
  - 全ルートテストがパスする
  - _Requirements: 1.4, 1.5, 5.1, 5.2, 5.3_
  - _Boundary: scoresRoute_

- [ ]* 5.3 useScoreEntryのユニットテストを実装する
  - `wins > matches` のとき `isValid = false` であることをテストする
  - 送信成功後に `submitted = true` となりフォームがロックされることをテストする
  - API エラー時に `error` ref にメッセージがセットされることをテストする
  - _Requirements: 4.2, 5.4_
  - _Boundary: useScoreEntry_
