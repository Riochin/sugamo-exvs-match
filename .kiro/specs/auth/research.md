# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

---

## Summary

- **Feature**: `auth`
- **Discovery Scope**: Extension（既存フロントエンド骨格への認証UI追加）
- **Key Findings**:
  - バックエンド認証エンドポイント（`POST /api/auth/login`・`POST /api/auth/logout`）はfoundation スペックで実装済み。本スペックは **フロントエンドUIのみ** を追加する。
  - セッション復元に必要な `GET /api/auth/me` エンドポイントが未実装のため、本スペックの範囲でバックエンドに小追加が必要。
  - `AppLayout.vue` が全画面に `BottomNav` を表示するため、ログイン画面ではナビゲーション非表示のレイアウト分岐が必要。
  - Pinia は導入されていないため、`useAuth` composable はモジュールスコープの singleton ref パターンで認証状態を保持する。

## Research Log

### 既存フロントエンド統合ポイント

- **Context**: ログイン画面が既存の `AppLayout` + `BottomNav` と競合する可能性の調査
- **Sources Consulted**: `frontend/src/App.vue`, `frontend/src/components/AppLayout.vue`, `frontend/src/router/index.ts`
- **Findings**:
  - `App.vue` が `AppLayout` を全ルートに適用しており、BottomNav が常時表示される
  - ルートメタ `layout: 'plain'` で分岐することで、ログイン画面のみ AppLayout を外せる
  - Vue Router の `meta` 型を `RouteMeta` 拡張宣言で型安全に使える
- **Implications**: `App.vue` と `router/index.ts` の修正が必要。新規レイアウトコンポーネントは不要。

### セッション復元エンドポイントの不在

- **Context**: Requirement 3.2「アプリ初回ロード時にセッション状態を確認する」の実現手段の調査
- **Sources Consulted**: `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`
- **Findings**:
  - `POST /api/auth/login`, `POST /api/auth/logout` は実装済みだが `GET /api/auth/me` は未実装
  - `authMiddleware` は HttpOnly Cookie の JWT を検証し `jwtPayload`（`sub`, `name`）をコンテキストにセットする
  - `GET /api/auth/me` は `authMiddleware` を適用するだけで `c.get('jwtPayload')` から応答を構成できる
- **Implications**: `backend/src/routes/auth.ts` に `GET /me` を1エンドポイント追加する。AppType に自動反映されフロントの型推論に影響なし。

### 状態管理ライブラリの選択

- **Context**: フロントエンドにPiniaが未導入の状態でのグローバル認証状態の共有
- **Sources Consulted**: `frontend/src/composables/useEventStream.ts`（既存composableパターン）
- **Findings**:
  - 既存の `useEventStream` はコンポーネントローカルな状態管理（呼び出しごとに新しい ref）
  - 認証状態はアプリ全体で共有が必要なため、モジュールスコープ singleton ref パターンが適切
  - Pinia 導入はオーバースペック（対象ユーザー12名、状態は認証のみ）
- **Implications**: `currentPlayer` と `isLoading` をモジュールスコープの `ref` として定義し、`useAuth()` 関数内で参照を返す。

### PIN入力UX

- **Context**: スマートフォン縦画面最適化でのPIN入力方式の選択
- **Sources Consulted**: product.md（「筐体前での手軽さを優先」）、tech.md（スマートフォン縦画面最適化）
- **Findings**:
  - `<input inputmode="numeric">` はOS標準のテンキーを呼び出すが、4桁入力完了の自動検知が実装コストがやや高い
  - 4つの1文字入力フィールドを並べるOTPスタイルは自動フォーカス移動でUXが良く、入力完了を即座に検知できる
  - 画面幅430px以内のスマートフォンUIに適合する
- **Implications**: OTPスタイルの4桁PINウィジェット（各フィールドが1文字を受け取り次へ自動フォーカス）を採用。PinInputStep の実装詳細とする。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| モジュールスコープ singleton ref | `useAuth()` 外部でrefを定義、関数内で返す | Pinia不要、既存パターン拡張、型安全 | Hot Reload時に状態がリセットされる場合あり | 12名専用アプリでは問題なし |
| Pinia store | 専用ストアで認証状態管理 | デバッグツール充実、SSR対応 | 新依存追加、現スケールではオーバースペック | 将来要件が増えたら移行候補 |
| provide/inject | App.vue から子へ注入 | Vue標準 | 呼び出し元がProviderより深い場所でないと使えない制約 | 今回はcomposableが適切 |

## Design Decisions

### Decision: ログイン画面のレイアウト分岐

- **Context**: `AppLayout` が全画面に `BottomNav` を表示するため、ログイン画面でボトムナビを隠す必要がある
- **Alternatives Considered**:
  1. `AppLayout.vue` 内で `route.meta` を見てBottomNavを条件表示
  2. `App.vue` でレイアウトを切り替える（`layout: 'plain'` メタ）
  3. 新しいAuthLayout.vueコンポーネントを作成
- **Selected Approach**: `App.vue` で `route.meta.layout === 'plain'` の場合はAppLayoutを使わず `<RouterView />` を直接レンダリング
- **Rationale**: 新規コンポーネント不要・App.vueの変更最小・拡張性あり
- **Trade-offs**: App.vueにレイアウトロジックが入るが、シンプルなif分岐のため許容範囲
- **Follow-up**: 将来レイアウトバリアントが増えた場合は `meta.layout` の値に基づくcomponent mapパターンへの移行を検討

### Decision: GET /api/auth/me の追加

- **Context**: Requirement 3.2 のセッション復元にバックエンドAPIが必要
- **Alternatives Considered**:
  1. セッション確認をせず Cookie の有無をフロントで判断（セキュリティ上不適切）
  2. 既存の認証済みエンドポイント（例: `GET /api/players`）を叩いて401で判断（副作用あり）
  3. `GET /api/auth/me` を追加（明示的で型安全）
- **Selected Approach**: `backend/src/routes/auth.ts` に `GET /me` を追加し `authMiddleware` を適用
- **Rationale**: 意図が明確、型安全（AppTypeに反映）、実装コスト最小（3行程度）
- **Trade-offs**: バックエンドへの小変更が必要だが、foundation スペック完了後の自然な拡張
- **Follow-up**: AppType が自動更新されるため、フロントの型推論に変更不要

## Risks & Mitigations

- Cookie の SameSite=Lax 設定により、フロントエンド（Vercel）とバックエンド（Railway）がクロスオリジンの場合、Cookie が送信されない — 開発環境はViteプロキシ設定で同一オリジン化、本番は `Secure` + `SameSite=None` への変更が必要な場合あり（要動作確認）
- ページリロード時の認証状態チラつき（`restoreSession` 完了前に一瞬未認証状態になる）— `isLoading` フラグをルートガードで考慮し、復元完了まで遷移を待機する
- `GET /api/auth/me` が遅延した場合のUX劣化 — ローディングスピナーで対応、タイムアウト設定は実装判断に委ねる

## References

- Vue Router ナビゲーションガード公式ドキュメント — ルートメタとガードの使い方
- Vue 3 Composition API ベストプラクティス — モジュールスコープのsingleton refパターン
- Hono HttpOnly Cookie 仕様 — `setCookie`/`getCookie` の `sameSite` オプション
