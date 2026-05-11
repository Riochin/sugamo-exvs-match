# Implementation Plan

## Task Format Template

---

- [x] 1. Foundation — バックエンド拡張とseedスクリプト

- [x] 1.1 `GET /api/auth/me` エンドポイントを追加する
  - `backend/src/routes/auth.ts` に `authMiddleware` を適用した `GET /me` ルートを追加する
  - `c.get('jwtPayload')` から `sub`（playerId）と `name` を取得して `{ playerId, name }` をJSONで返す
  - `AppType` に自動反映され、Hono RPC Client 経由でフロントエンドから型安全に呼び出せること
  - _Requirements: 3.2, 3.4_

- [x] 1.2 プレイヤーseedスクリプトを実装する
  - `backend/src/db/seed.ts` にプレイヤー12名分の定数データ配列（名前・平文PIN・チーム等）を定義する
  - `bcryptjs.hash(pin, 10)` でPINをハッシュ化してから Drizzle で `players` テーブルへ INSERT する
  - `onConflictDoNothing()` を使用し、同じプレイヤー名が既に存在する場合はスキップして冪等に実行する
  - `backend/package.json` に `"db:seed": "tsx src/db/seed.ts"` スクリプトを追加する
  - `pnpm --filter backend db:seed` を実行するとプレイヤーがDBに登録され `GET /api/players` でレコードが返ること
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

---

- [x] 2. Core — フロントエンドコアコンポーネントの実装

- [x] 2.1 (P) 認証状態管理composable（useAuth）を実装する
  - モジュールスコープの `currentPlayer` ref と `isLoading` ref をシングルトンとして定義し、`useAuth()` 呼び出しごとに同一インスタンスを参照できるようにする
  - `login(playerName, pin)` が Hono RPC Client 経由で `POST /api/auth/login` を呼び出し、成功時に `currentPlayer` をセットして `{ ok: true }` を返す
  - `login()` が 401を受けた場合は `{ ok: false, errorCode: 'INVALID_CREDENTIALS' }` を、400の場合は `{ ok: false, errorCode: 'VALIDATION_ERROR' }` を返す
  - `logout()` が `POST /api/auth/logout` を呼び出し、APIエラーの有無にかかわらず `currentPlayer` を `null` にクリアする
  - `restoreSession()` が `GET /api/auth/me` を呼び出し、200時に `currentPlayer` をセット・401時に `null` のままにし `isLoading` を適切に管理する
  - `isAuthenticated` が `currentPlayer !== null` と等価な `ComputedRef<boolean>` として公開されること
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3_
  - _Boundary: useAuth_

- [x] 2.2 (P) プレイヤー選択ステップコンポーネントを実装する
  - `players`・`isLoading`・`error` をpropsとして受け取るpresentationalコンポーネントとして実装する
  - プレイヤーを最小タップ領域 `min-h-[56px]` 以上のカード形式で一覧表示する
  - `isLoading` 中はスピナーまたはスケルトンを表示する
  - `error` が非nullのときエラーメッセージと「再読み込み」ボタンを表示し、タップで `retry` イベントを emit する
  - プレイヤーカードをタップすると `select(playerName)` イベントが emit されること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Boundary: PlayerSelectStep_

- [x] 2.3 (P) PIN入力ステップコンポーネントを実装する
  - `playerName`・`isSubmitting`・`error` をpropsとして受け取るpresentationalコンポーネントとして実装する
  - 選択されたプレイヤー名を画面上部に表示する
  - `inputmode="numeric" pattern="\d" maxlength="1"` の input を4つ横並び（OTPスタイル）に配置し、入力ごとに次フィールドへ自動フォーカスする
  - 4桁入力完了時に `submit(pin)` を自動 emit し、`isSubmitting` 中は全inputを `disabled` にしてローディングインジケータを表示する
  - `error` が非nullのとき入力欄下にエラーメッセージを表示し、内部のpin値をリセットする
  - 「戻る」ボタンをタップすると `back` イベントが emit されること
  - _Requirements: 2.1, 2.6, 2.7, 2.8_
  - _Boundary: PinInputStep_

---

- [ ] 3. Integration — LoginViewとルーター統合

- [ ] 3.1 ログイン画面（LoginView）を実装してステップフローを完成させる
  - `meta: { requiresAuth: false, layout: 'plain' }` をルートに設定し `AppLayout`・`BottomNav` が表示されないページとして実装する
  - `onMounted` で Hono RPC Client 経由で `GET /api/players` を呼び出し、`players`・`playersLoading`・`playersError` を管理してPlayerSelectStepへ渡す
  - `playersError` 発生時は `retry` イベントをハンドルして再フェッチできるようにする
  - `step` 状態（`'player-select' | 'pin-input'`）で PlayerSelectStep と PinInputStep を切り替え、`select(playerName)` イベントで pin-input ステップへ遷移する
  - PinInputStep の `submit(pin)` イベントを受け `useAuth.login()` を呼び出し、成功時は `router.replace(redirect ?? '/')` でリダイレクトする
  - ログインAPI 401時は「プレイヤー名またはPINが正しくありません」、400時は「入力内容に誤りがあります」の `loginError` をPinInputStepへ渡す
  - `back` イベントで player-select ステップへ戻れること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_
  - _Depends: 2.1, 2.2, 2.3_

- [ ] 3.2 (P) ルートガードとApp.vueレイアウト分岐を実装する
  - `frontend/src/router/index.ts` に `/login` ルート（`requiresAuth: false, layout: 'plain'`）を追加し、既存ルート（`/`・`/group`・`/profile`）に `requiresAuth: true` を設定する
  - `vue-router` モジュールの `RouteMeta` 型に `requiresAuth?: boolean` と `layout?: 'default' | 'plain'` を宣言拡張する
  - `beforeEach` ナビゲーションガードに `restoreSession()` を初回のみ await するフラグを持たせ、`isLoading` が `true` の間はガード評価を待機させる
  - 未認証で `requiresAuth: true` のルートへアクセスすると `/login?redirect=...` へリダイレクトされること
  - 認証済みで `/login` にアクセスすると `query.redirect` または `/` へリダイレクトされること
  - `App.vue` で `route.meta.layout === 'plain'` のとき `AppLayout` をレンダリングせず `<RouterView />` のみを表示するよう分岐する
  - _Requirements: 4.1, 4.2, 4.3_
  - _Depends: 2.1_

---

- [ ] 4. Validation — テスト

- [ ]* 4.1 useAuth の単体テストを追加する
  - `login()` 成功時に `currentPlayer` が対象プレイヤーの情報にセットされること
  - `login()` 401時に `LoginResult.ok === false` かつ `errorCode === 'INVALID_CREDENTIALS'` が返ること
  - `logout()` がAPIエラーでも `currentPlayer` が `null` にクリアされること
  - `restoreSession()` 401時に `currentPlayer` が `null` のままであること
  - _Requirements: 3.1, 3.2, 3.4, 5.1, 5.2, 5.3_

- [ ]* 4.2 ログインフローとルートガードの統合テストを追加する
  - MSWモックAPIを使い、プレイヤー選択 → PIN入力 → `POST /api/auth/login` → リダイレクトの一連フローが正常動作すること
  - 未認証状態で `/` にアクセスすると `/login` へリダイレクトされること
  - 認証済みで `/login` にアクセスすると `/` へリダイレクトされること
  - _Requirements: 1.1, 2.2, 2.3, 4.1, 4.2_
  - _Depends: 3.1, 3.2_
