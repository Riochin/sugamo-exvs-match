# 実装計画

## タスク 1: 基盤設定 — DB スキーマ・JWT・認証拡張

- [x] 1.1 Drizzle スキーマに `isAdmin` カラムを追加しマイグレーションを適用する
  - `players` テーブルに `is_admin INTEGER NOT NULL DEFAULT 0` カラムを Drizzle スキーマ定義で追加する
  - `drizzle-kit migrate` でマイグレーションファイルを生成し、Turso に適用する
  - マイグレーション適用後、既存プレイヤーの `is_admin` が `false` のまま正常動作することを確認する
  - _Requirements: 5.1, 5.4_

- [x] 1.2 JWT ペイロードと認証ルートに `isAdmin` クレームを反映する
  - `JwtPayload` インターフェースに `isAdmin: boolean` フィールドを追加する
  - `auth.ts` の `sign()` 関数が DB から取得した `player.isAdmin` を JWT に含めるよう修正する
  - `/me` エンドポイントのレスポンスに `isAdmin` フィールドを追加する
  - ログイン後に発行された JWT に `isAdmin` クレームが含まれることを確認する
  - _Requirements: 5.4_

## タスク 2: バックエンドコア — 管理者ミドルウェアとイベントサービス

- [x] 2.1 (P) 管理者認可ミドルウェアを実装する
  - `authMiddleware` が設定した `c.var.jwtPayload.isAdmin` を読み取り、`false` の場合は 403 を返す
  - Hono RPC の型推論を維持するため `MiddlewareHandler<{ Variables: Variables }>` 型で実装する
  - 非管理者からのリクエストが 403 で拒否され、管理者は次のハンドラへ進むことを確認する
  - _Requirements: 1.4, 2.5, 3.5, 5.1, 5.2, 5.3_
  - _Boundary: adminMiddleware_

- [x] 2.2 (P) `EventService` の全ビジネスロジックを実装する
  - 大会作成: 進行中大会（`COLLECTING` または `REVEALING`）の存在チェックを行い、存在する場合は `ACTIVE_EVENT_EXISTS` エラーを返す。存在しない場合は `events` レコードと全プレイヤー分の `scores` レコード（`wins=0, losses=0, absent=false`）をバッチ挿入する
  - 欠席管理: `COLLECTING` フェーズ中のみ `scores.absent` を更新し、それ以外は `PHASE_NOT_COLLECTING` エラーを返す
  - フェーズ遷移: 遷移マップ `{ COLLECTING: 'REVEALING', REVEALING: 'DONE' }` を使い、`DONE` からの遷移要求は `INVALID_PHASE_TRANSITION` エラーを返す。DB 更新成功後に `hub.broadcast` で `{ eventId, phase }` ペイロードの `phase_update` イベントを送出する
  - 大会情報取得: `getActiveEvent` で進行中大会と全スコアを返し、`listDoneEvents` で DONE 大会を `heldAt` 降順で返す
  - 各メソッドが `EventError` discriminated union と正常レスポンスを正しく返すことを確認する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.6, 4.1, 4.2, 4.3_
  - _Boundary: EventService_

## タスク 3: イベント API エンドポイントの実装

- [x] 3.1 `eventsRoute` に大会管理の全エンドポイントを実装する
  - `POST /api/events`（`adminMiddleware` 適用、`heldAt` を zod で ISO 8601 文字列 → Date にバリデーション）
  - `GET /api/events/active`（`authMiddleware` のみ、進行中大会と全スコアを `{ event: EventWithScores | null }` で返す）
  - `GET /api/events`（`authMiddleware` のみ、DONE 大会を `EventSummary[]` で降順に返す）
  - `PATCH /api/events/:id/absent/:playerId`（`adminMiddleware` 適用、`{ absent: boolean }` を受け取り `{ ok: true }` を返す）
  - `PATCH /api/events/:id/phase`（`adminMiddleware` 適用、フェーズ遷移を実行し `{ id, phase }` を返す）
  - `EventError` コードを HTTP ステータスにマッピングし（`ACTIVE_EVENT_EXISTS` → 409、`EVENT_NOT_FOUND` → 404 等）、未認証リクエストが 401 で拒否されることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

## タスク 4: フロントエンド基盤修正

- [x] 4.1 (P) `useEventStream` の `PhaseUpdatePayload` に `eventId` を追加する
  - `PhaseUpdatePayload` インターフェースに `eventId: string` フィールドを追加する
  - SSE `phase_update` イベントのハンドラが `eventId` を参照できるようになることを確認する
  - _Requirements: 3.6_
  - _Boundary: useEventStream_

- [x] 4.2 (P) `useAuth` に `isAdmin` を反映し `/admin` ルートガードを設定する
  - `AuthenticatedPlayer` インターフェースに `isAdmin: boolean` を追加する
  - `login` と `restoreSession` で `/me` レスポンスの `isAdmin` を `currentPlayer` に反映する
  - `router/index.ts` に `/admin` ルートを追加し、`isAdmin === false` の場合はホームへリダイレクトする管理者ガードを実装する
  - 非管理者ユーザーが `/admin` にアクセスするとホームへリダイレクトされることを確認する
  - _Requirements: 5.1, 5.4, 6.5_
  - _Boundary: useAuth, Vue Router_
  - _Depends: 1.2_

## タスク 5: `useAdminEvent` composable の実装

- [x] 5.1 管理者操作の状態と API 呼び出しを管理する composable を実装する
  - `activeEvent`・`isLoading`・`error` のリアクティブ ref を定義し、外部には `Readonly` で公開する
  - `createEvent(heldAt: Date)`・`setAbsent(playerId, absent)`・`advancePhase()`・`refresh()` を実装し、各操作完了後に `refresh()` を呼んでローカル状態を更新する
  - 初期化時に `refresh()` を呼んで進行中大会を取得する
  - 各非同期操作中は `isLoading=true` に設定し、重複呼び出しを防ぐ
  - `createEvent` 後に `activeEvent` が更新され、`advancePhase` 後に最新フェーズが `activeEvent.phase` に反映されることを確認する
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2, 6.1, 6.2, 6.3, 6.4, 6.7_
  - _Depends: 3.1_

## タスク 6: `AdminView` コンポーネントの実装

- [x] 6.1 管理者ダッシュボード UI を実装する
  - `useAdminEvent` から `activeEvent`・`isLoading`・`error` と各ミューテーション関数を取得して画面を構築する
  - `activeEvent === null` のとき大会作成フォーム（`heldAt` 日時入力と送信ボタン）を表示する
  - `phase === 'COLLECTING'` のとき参加者一覧（欠席チェックボックス付き）と「REVEALING へ」ボタンを表示する
  - `phase === 'REVEALING'` のとき「DONE へ」ボタンを表示する
  - `useAuth` の `currentPlayer.isAdmin` を取得してレンダリング判定に利用する（ルートガードとの二重防衛）
  - `useEventStream` を接続して SSE `phase_update` を受信し、外部クライアントの操作による状態変化に対応する
  - Tailwind のダークテーマ（`bg-dark`・`bg-main`・`border-accent`・`text-main`）をモバイルファーストのスマートフォン縦画面向けに適用する
  - 管理者ログイン → 大会作成 → 欠席設定 → フェーズ遷移の一連の操作がブラウザで正常動作することを確認する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_
  - _Depends: 4.1, 4.2, 5.1_

## タスク 7: テストと検証

- [x] 7.1 `EventService` のユニットテストを実装する
  - `createEvent`: 進行中大会なし → events + scores レコードが正しく作成されること
  - `createEvent`: 進行中大会あり → `ACTIVE_EVENT_EXISTS` エラーを返すこと
  - `advancePhase`: `COLLECTING → REVEALING` → DB 更新と `hub.broadcast` が呼ばれること
  - `advancePhase`: `DONE` から遷移要求 → `INVALID_PHASE_TRANSITION` エラーを返すこと
  - `setAbsent`: `COLLECTING` フェーズ中 → `scores.absent` が更新されること
  - `setAbsent`: `COLLECTING` 以外 → `PHASE_NOT_COLLECTING` エラーを返すこと
  - 全テストケースがパスすることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 7.2 `eventsRoute` のインテグレーションテストを実装する
  - `POST /api/events`: 管理者トークンで正常な大会作成レスポンスを返すこと
  - `POST /api/events`: 非管理者トークンで 403 を返すこと
  - `PATCH /api/events/:id/phase`: 正常遷移で SSE `phase_update` ブロードキャストが送信されること
  - `GET /api/events/active`: 進行中大会なしで `{ event: null }` を返すこと
  - `PATCH /api/events/:id/absent/:playerId`: `COLLECTING` 以外のフェーズで 409 を返すこと
  - 全テストケースがパスすることを確認する
  - _Requirements: 1.1, 1.4, 2.4, 3.1, 4.2, 4.4_

- [x]* 7.3 `AdminView` の E2E テストを実装する
  - 管理者ログイン → `/admin` 表示 → 大会作成 → 参加者一覧が表示されること（要件 6.1, 6.2）
  - `COLLECTING` フェーズで欠席チェック → 状態が更新されること（要件 6.3）
  - REVEALING ボタン押下 → フェーズが更新されて DONE ボタンに切り替わること（要件 6.4, 6.7）
  - 非管理者で `/admin` アクセス → リダイレクトされること（要件 6.5）
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_
