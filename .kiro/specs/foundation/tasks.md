# 実装計画

- [x] 1. モノレポ・開発環境の基盤構築
- [x] 1.1 pnpm workspaces 構成とルートスクリプトを設定する
  - ルートに `pnpm-workspace.yaml` を作成し `frontend` と `backend` をワークスペースとして定義する
  - ルート `package.json` に `dev`（両ワークスペース同時起動）・`build`・`lint` スクリプトを定義する
  - `frontend/package.json` と `backend/package.json` をそれぞれ作成し、各ワークスペースのスコープ内でのみパッケージインストールが行われることを確認する
  - `pnpm install` 後に `pnpm dev` で両サーバーが起動することで完了とする
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 1.2 TypeScript strict モードと ESLint no-explicit-any を全ワークスペースで有効化する
  - `backend/tsconfig.json` に `"strict": true` および TypeScript Project References 向け `"composite": true` を設定する
  - `frontend/tsconfig.json` に `"strict": true` を設定し、`backend` を references に追加して型を共有できるようにする
  - ルートまたは各ワークスペースの ESLint 設定で `@typescript-eslint/no-explicit-any: "error"` を有効化する
  - `pnpm lint` が `any` 型使用箇所でエラーを報告することで完了とする
  - _Requirements: 1.2, 1.3_

- [x] 2. Drizzle スキーマ定義と DB クライアント設定
- [x] 2.1 全テーブルの Drizzle スキーマを定義し型を公開する
  - `backend/src/db/schema.ts` に `players`・`events`・`scores`・`stars` テーブルを `drizzle-orm/sqlite-core` で定義する
  - `players` テーブルに `id`・`name`（unique）・`pinHash`・`team`（`FIRST|SECOND` enum）・`title`・`mainUnit`・`createdAt` カラムを持たせる
  - `events` テーブルに `id`・`heldAt`・`phase`（`COLLECTING|REVEALING|DONE` enum）・`createdAt` カラムを持たせる
  - `scores` テーブルに `id`・`eventId`（events 外部キー）・`playerId`（players 外部キー）・`wins`・`losses`・`absent`（boolean）カラムと `(eventId, playerId)` 複合ユニーク制約を持たせる
  - `stars` テーブルに `id`・`eventId`・`fromPlayerId`・`toPlayerId`（いずれも外部キー）・`count`（整数）カラムを持たせる
  - `$inferSelect` 型（`Player`・`Event`・`Score`・`Star`）を export し、TypeScript コンパイルがエラーなく通ることで完了とする
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2.2 Drizzle クライアントを初期化し Turso 向けマイグレーション設定を整える
  - `backend/src/db/client.ts` に `@libsql/client` と `drizzle-orm/libsql` を使った Drizzle クライアントシングルトンを実装する
  - `TURSO_DATABASE_URL`・`TURSO_AUTH_TOKEN` 環境変数を読み込み、未設定時に起動エラーで検知できるようにする
  - `backend/drizzle.config.ts` に `dialect: 'turso'`・`dbCredentials`・マイグレーション出力先（`backend/src/db/migrations/`）を設定する
  - `drizzle-kit generate` でマイグレーション SQL が生成され、`drizzle-kit migrate` で Turso に適用できることで完了とする
  - _Requirements: 2.6, 2.7_

- [ ] 3. バックエンド認証基盤（JWT + PIN）
- [ ] 3.1 JWT ヘルパーと認証ミドルウェアを実装する
  - `backend/src/lib/jwt.ts` に HS256・有効期限 24 時間の JWT 署名（`sign`）と検証（`verify`）ヘルパーを実装し、ペイロードに `sub`（playerId）と `name` を格納する
  - `JWT_SECRET` 環境変数から秘密鍵を取得し、未設定時に起動エラーで検知する
  - `backend/src/middleware/auth.ts` に HttpOnly Cookie からトークンを取り出して `verify` し、成功時に `c.set('jwtPayload', payload)` でコンテキストにセットする Hono ミドルウェアを実装する
  - 無効・失効トークンでのアクセス時に HTTP 401 が返ることで完了とする
  - _Requirements: 3.2, 3.4, 3.5_

- [ ] 3.2 PIN 認証エンドポイントを実装する
  - `backend/src/routes/auth.ts` に `POST /api/auth/login` と `POST /api/auth/logout` を実装する
  - `zValidator` で `playerName`（文字列）と `pin`（4 桁数字）のバリデーションを行い、失敗時に HTTP 400 を返す
  - DB からプレイヤーを名前で検索し `bcryptjs.compare` で PIN ハッシュを検証する。プレイヤー未存在・PIN 不一致いずれも HTTP 401 と `{ error: "Invalid credentials" }` を返す
  - 認証成功時に JWT を署名して `HttpOnly; SameSite=Lax` Cookie にセットし `{ playerId, name }` を返す。PIN が DB に平文保存されていないことを確認できることで完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [ ] 4. Hono API ルート骨格と AppType 公開
- [ ] 4.1 (P) 認証不要のプレイヤー一覧ルートと各ドメインルート骨格を実装する
  - `backend/src/routes/players.ts` に `GET /api/players`（認証なしで全プレイヤー一覧を返す）を実装する
  - `backend/src/routes/events.ts`・`scores.ts`・`stars.ts` を作成し、後続機能スペック向けの空のルート骨格を配置する
  - 認証が必要なルートに `authMiddleware` を適用し、未認証アクセスで HTTP 401 が返る構造にする
  - `GET /api/players` が認証なしで 200 を返し、保護ルートが未認証で 401 を返すことで完了とする
  - _Requirements: 3.7, 4.2, 4.4, 4.5_
  - _Boundary: RouteHandlers_

- [ ] 4.2 (P) SSE エンドポイントとブロードキャスト Hub を実装する
  - `backend/src/routes/stream.ts` に `GET /api/stream/events/:eventId` を Hono `streamSSE` で実装する
  - `Map<eventId, Set<SSEStreamingApi>>` をモジュールスコープで管理し、接続時に `add`・切断時に `remove` する Hub（`add`・`remove`・`broadcast` の 3 メソッド）を実装する
  - `broadcast` 関数で `progress_update`・`result_ready`・`phase_update` の 3 イベント型を受け取り、同一 `eventId` に接続中の全クライアントへ送信できるようにする
  - `c.req.raw.signal` の `abort` イベントで切断を検知して Hub から除去し、30 秒間隔の `ping` keepalive を送信する
  - SSE エンドポイントへの接続後に `broadcast` を呼ぶと全接続クライアントにイベントが届き、切断後は Hub から除去されることで完了とする
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - _Boundary: SSEHub_

- [ ] 4.3 Hono アプリを統合して AppType を公開し Railway デプロイ設定を追加する
  - `backend/src/index.ts` に全ルート（auth・players・events・scores・stars・stream）を `.route()` でマウントした Hono アプリを作成する
  - `export type AppType = typeof app` をモジュールから公開し、フロントエンドの TypeScript Project References 経由で参照できるようにする
  - `backend/Procfile` に Railway 向けの起動コマンドを定義する
  - `AppType` を import した TypeScript ファイルがコンパイルエラーなく通り、全ルートが正しいパスでマウントされることで完了とする
  - _Depends: 4.1, 4.2_
  - _Requirements: 4.1, 4.3, 4.6_

- [ ] 5. (P) Vue SPA 骨格と共通 UI テーマ
- [ ] 5.1 Vite・Vue 3 プロジェクトを初期化し Tailwind ダークテーマを設定する
  - `frontend/` に Vue 3 + TypeScript + Vite プロジェクトを作成し、`frontend/src/main.ts` をエントリポイントとする
  - `tailwind.config.ts` に `base-900: #090014`・`base-800: #12002b`・`base-600: #2b008e`・`accent: #d946ef` のカスタムカラーを定義する
  - `index.html` の `<html>` タグに `class="dark"` を追加してダークテーマを固定する
  - `vite.config.ts` と `tsconfig.json` に `@/` → `frontend/src/` のパスエイリアスを設定する
  - `pnpm dev` でフロントエンドが起動し、ダークテーマとカスタムカラーが Tailwind から利用できることで完了とする
  - _Requirements: 6.1, 6.2, 6.3, 6.8_
  - _Boundary: VueSPA, TailwindConfig_

- [ ] 5.2 共通レイアウトとボトムナビゲーションコンポーネントを実装する
  - `frontend/src/components/AppLayout.vue` を作成し、`<slot>` で画面コンテンツを受け取り下部に `BottomNav.vue` を配置するレイアウトシェルを実装する
  - `frontend/src/components/BottomNav.vue` を作成し、Vue Router の `<RouterLink>` でメインタブ（大会・グループ・プロフィール）へのナビゲーションとアクティブ状態表示を実装する
  - スマートフォン縦画面（375px〜430px 幅）に最適化されたスタイルを Tailwind で適用し、画面幅 430px 超ではコンテナを中央揃えにする
  - `App.vue` に `AppLayout` を組み込み、ボトムナビゲーションが表示されて各タブへの遷移が機能することで完了とする
  - _Requirements: 6.4, 6.5_
  - _Boundary: AppLayout, BottomNav_

- [ ] 6. フロントエンド・バックエンド API 連携
- [ ] 6.1 Hono RPC クライアントを初期化する
  - `frontend/src/api/client.ts` に `hc<AppType>` を初期化し、`VITE_API_BASE_URL` 環境変数（未設定時は `/`）を使って全 API コールの窓口となるクライアントを実装する
  - TypeScript Project References で `backend/src/index.ts` の `AppType` を import し、レスポンス型推論付きの API クライアントとして利用できるようにする
  - `client.api.players.$get()` 呼び出しがコンパイルエラーなく型推論付きで動作することで完了とする
  - _Depends: 4.3_
  - _Requirements: 6.6_

- [ ] 6.2 useEventStream composable を実装する
  - `frontend/src/composables/useEventStream.ts` に SSE エンドポイントへの接続・切断と受信イベントを Vue リアクティブ状態（`ref`）に変換するロジックを実装する
  - `connect(eventId)` で `EventSource` を生成し、`progress_update`・`result_ready`・`phase_update` イベントをそれぞれ対応する `ref` に格納する
  - `onUnmounted` で `disconnect()` を自動呼び出しして `EventSource` をクリーンアップし、`ping` イベントは無視する
  - composable を使用するコンポーネントで `isConnected` が `true` に変わり、イベント受信時にリアクティブ状態が更新されることで完了とする
  - _Depends: 4.2_
  - _Requirements: 6.7_
