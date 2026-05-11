# リサーチ・設計決定ログ — event-management

---
**目的**: 設計フェーズにおけるリサーチ活動の成果、アーキテクチャ調査、および設計判断の根拠を記録する。

---

## Summary

- **機能**: `event-management`
- **Discovery スコープ**: Extension（既存システムへの拡張）
- **主要な発見**:
  1. `eventsRoute` と `scoresRoute` は認証ミドルウェアのみの空実装であり、安全に拡張できる
  2. SSE ハブ（`stream.ts`）は `phase_update` ブロードキャスト機能をすでに実装済み
  3. `players` テーブルに `isAdmin` フィールドが存在しないため、スキーマ追加とマイグレーションが必要
  4. `JwtPayload` を拡張して `isAdmin` クレームを含める必要がある
  5. `useEventStream` の `PhaseUpdatePayload` に `eventId` を追加する必要がある（要件 3.6）

---

## Research Log

### 既存の拡張ポイント分析

- **コンテキスト**: event-management がどこに統合されるかを確認
- **調査対象ファイル**:
  - `backend/src/routes/events.ts` — `authMiddleware` のみ、エンドポイントなし
  - `backend/src/routes/scores.ts` — 同じく空実装
  - `backend/src/routes/stream.ts` — `hub` オブジェクトでブロードキャスト可能
  - `backend/src/db/schema.ts` — `events`（phase enum）・`scores`（absent フィールド）定義済み
- **発見**:
  - `eventsRoute` は安全に拡張できる（型チェーンを壊さない）
  - `hub.broadcast(eventId, 'phase_update', payload)` はすでに動作する
  - スキーマの `events.phase` は `COLLECTING | REVEALING | DONE` enum が定義済み
  - スキーマの `scores.absent` は boolean フィールドが定義済み
- **影響**: 新規ファイル作成は最小限。既存パターンに沿って拡張するだけでよい

### 管理者認可アプローチ

- **コンテキスト**: 要件 5 系は管理者フラグによる操作制限を求める。`players` テーブルに `isAdmin` がない
- **調査対象**:
  - `backend/src/lib/jwt.ts` — `JwtPayload` は `sub`, `name` のみ
  - `backend/src/middleware/auth.ts` — `c.var.jwtPayload` を介してペイロード提供
  - `backend/src/routes/auth.ts` — ログイン時に `sign({ sub, name })` を呼ぶ
- **発見**:
  - JWT クレームに `isAdmin` を追加することで管理者チェック時に DB アクセス不要
  - 管理者変更は稀（12名固定）なので JWT 有効期限（24h）内の遅延は許容範囲
  - `adminMiddleware` は `authMiddleware` の後段として配置できる
- **影響**: `players.isAdmin` 追加 → スキーマ変更 + `drizzle-kit migrate` が必要。`JwtPayload`・`auth.ts`・`useAuth.ts` も修正対象

### SSE ペイロード仕様（要件 3.6）

- **コンテキスト**: 要件 3.6「phase_update ペイロードに大会 ID と新フェーズを含める」
- **調査対象**: `frontend/src/composables/useEventStream.ts`
- **発見**:
  - 現行 `PhaseUpdatePayload` は `{ phase }` のみ
  - `eventId` を追加することで受信側が対象大会を特定できる
  - フロントエンドの `useEventStream` は修正対象
- **影響**: `PhaseUpdatePayload` の型と `hub.broadcast` 呼び出し時のペイロードを同期変更

### Hono RPC 型安全性

- **コンテキスト**: フロントエンドが `client.api.events.*` を型安全に呼べるか確認
- **調査対象**: `frontend/src/api/client.ts`、`backend/src/index.ts`
- **発見**:
  - `hc<AppType>()` パターンで Hono RPC の型が流れる
  - `eventsRoute` のメソッドチェーンがそのまま `AppType` に反映される
  - `adminMiddleware` を `.use()` ではなく個別ハンドラに渡すことで型推論が維持される
- **影響**: `eventsRoute` は `.post()`, `.get()`, `.patch()` をチェーンし、型付きレスポンスを返す

---

## Architecture Pattern Evaluation

| オプション | 概要 | 強み | リスク・制限 | 備考 |
|-----------|------|------|-------------|------|
| DB ルックアップ認可 | リクエストごとにDB照会してisAdmin確認 | 常に最新 | 余分なDB往復、12名規模では不要 | |
| JWT クレーム認可（採用） | ログイン時にisAdminをトークンに埋め込む | 追加DB往復なし、既存パターンと整合 | 管理者変更は再ログインが必要 | 12名固定なので許容 |
| Drizzle トランザクションなし | scores 一括作成を個別INSERT | 実装が単純 | 部分失敗のリスク | |
| Drizzle バッチ（採用） | `db.insert(scores).values([...])` で一括 | アトミック性が高い | | Drizzle batch insert でOK |

---

## Design Decisions

### Decision: JWT クレームによる管理者認可

- **コンテキスト**: 要件 5.4「JWT トークンのクレームまたはDB レコードから管理者判定」
- **検討候補**:
  1. DB ルックアップ — 毎リクエストで `players` テーブルを照会
  2. JWT クレーム — ログイン時に `isAdmin` をトークンに埋め込む
- **選択**: JWT クレーム
- **根拠**: 12名の固定メンバーで管理者変更は稀。追加DB往復のコスト対効果が低い。既存 `authMiddleware` パターンと整合する
- **トレードオフ**: 管理者フラグ変更時は対象者の再ログインが必要（許容済み）
- **フォローアップ**: シード時に管理者プレイヤーの `isAdmin=true` を設定すること

### Decision: EventService をサービス層に分離

- **コンテキスト**: 大会作成、フェーズ遷移、欠席管理のビジネスロジック配置
- **検討候補**:
  1. ルートハンドラに直接実装 — 既存の `playersRoute` パターン
  2. `services/` 層に分離（採用）
- **選択**: `backend/src/services/event-service.ts` に分離
- **根拠**: スコア一括作成・フェーズバリデーション・SSE ブロードキャストが組み合わさる複雑なロジックをルートから分離することでテスト容易性が上がる。`structure.md` が `services/` 層を明示的に定義している
- **トレードオフ**: ファイル増加。単純な CRUD のみなら不要だが、本機能は該当しない

### Decision: EventWithScores レスポンス形式（GET /api/events/active）

- **コンテキスト**: 要件 4.2「進行中の大会がない場合は null または 404 を返す」
- **選択**: 進行中大会なしの場合は `{ event: null }` として 200 を返す
- **根拠**: 管理者画面がポーリングなしで「大会未開催状態」を判定できる。404 はリソース不存在エラーとして扱うと AdminView で例外処理が必要になる
- **トレードオフ**: REST の厳密な規約より UX 優先

---

## Risks & Mitigations

- `isAdmin` スキーマ変更が既存シードデータに影響する — `DEFAULT false` なので既存行への影響なし。シード更新で管理者プレイヤーに `isAdmin=true` を設定
- `PhaseUpdatePayload` 型変更が `result-reveal` スペックと競合する可能性 — 追加フィールド（`eventId`）なので後方互換。`useEventStream` の変更は additive のみ
- 同一大会への並行フェーズ遷移リクエスト — SQLite（Turso）は WAL モードで直列化される。排他制御は DB レベルで担保

---

## References

- Hono RPC ドキュメント: https://hono.dev/docs/guides/rpc
- Drizzle ORM batch insert: https://orm.drizzle.team/docs/insert
- Hono SSE streaming: https://hono.dev/docs/helpers/streaming
