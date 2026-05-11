# Research & Design Decisions

---

## Summary

- **Feature**: foundation
- **Discovery Scope**: New Feature（グリーンフィールド）/ Complex Integration
- **Key Findings**:
  - Hono RPC の `AppType` export + `hc<AppType>()` クライアントはモノレポ TypeScript Project References で動作。`strict: true` が両ワークスペースで必須。
  - Prisma + Turso は `driverAdapters` プレビュー機能 + `@prisma/adapter-libsql` で接続。`prisma migrate dev` は使えないため、ローカル SQLite でマイグレーションを生成し Turso CLI で適用するワークフローが必要。
  - Hono の `streamSSE` ヘルパーが SSE 実装の標準。Railway は Keep-alive SSE に対応しているが、タイムアウト設定の確認が必要。

---

## Research Log

### Hono RPC モノレポ統合

- **Context**: フロントエンド・バックエンド間で手書き型を排除するための RPC 構成の確認
- **Sources Consulted**: https://hono.dev/docs/guides/rpc
- **Findings**:
  - バックエンドで `export type AppType = typeof app` を定義し、フロントエンドで `hc<AppType>(baseUrl)` を初期化する
  - TypeScript strict モードが双方で必須
  - モノレポでは `tsconfig.json` の `references` と `composite: true` を使用
  - ステータスコードを明示的に指定（`c.json(data, 200)`）することで union 型が正確になる
- **Implications**: `backend/src/index.ts` から `AppType` を export し、`frontend/src/api/client.ts` で `hc<AppType>` を初期化する

### Drizzle ORM + Turso（libSQL）

- **Context**: Edge SQLite 接続と ORM 型安全性の確認。Prisma + Turso の `driverAdapters` プレビュー・マイグレーション制限を回避するため Drizzle を採用
- **Sources Consulted**: https://orm.drizzle.team/docs/get-started/turso-new, https://docs.turso.tech/sdk/ts/orm/drizzle
- **Findings**:
  - `drizzle-orm` + `@libsql/client` + `drizzle-kit`（dev dependency）の3点セット
  - `drizzle-orm/libsql` が Turso をネイティブサポート（追加アダプタ不要）
  - スキーマは TypeScript ファイル（`schema.ts`）で定義。コード生成ステップが不要
  - `drizzle-kit generate` で SQL マイグレーション生成 → `drizzle-kit migrate` で Turso に直接適用
  - `drizzle.config.ts` に `dialect: 'turso'`・`dbCredentials: { url, authToken }` を設定
  - `$inferSelect` / `$inferInsert` 型がそのままアプリ型として使用可能
- **Implications**: `backend/src/db/schema.ts` がスキーマ＋型ソース。`backend/src/db/client.ts` でクライアントシングルトンを管理

### Hono SSE（streamSSE）

- **Context**: リアルタイム同期のインフラ確認
- **Sources Consulted**: https://hono.dev/docs/helpers/streaming
- **Findings**:
  - `streamSSE(c, async (stream) => { await stream.writeSSE({ data, event, id }) })` が標準 API
  - `text/event-stream`・`Cache-Control: no-cache`・`Connection: keep-alive` は自動付与
  - 接続切断は `stream.pipe` の中断検出か `AbortSignal` で検知
- **Implications**: `backend/src/routes/stream.ts` にチャネル管理（`Map<eventId, Set<SSEStreamingApi>>`）を実装

### PIN 認証 / JWT

- **Context**: 軽量認証の実装パターン確認
- **Sources Consulted**: https://hono.dev/docs/middleware/builtin/jwt
- **Findings**:
  - Hono 組み込みの `jwt()` ミドルウェア（HS256）で保護ルートを認証
  - `sign(payload, secret)` / `verify(token, secret)` ヘルパーが利用可能
  - bcrypt（`bcryptjs` or Node `crypto`）でハッシュ保存。`crypto.subtle` の PBKDF2 も Edge 対応の選択肢
- **Implications**: PIN はサインアップ時に `bcryptjs` でハッシュ化し `Player.pinHash` に保存。ログイン成功時に JWT を発行し Cookie に格納

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Flat monorepo (pnpm workspaces) | `frontend/` + `backend/` を同一リポジトリで管理 | シンプル、CI 統一 | TS project references の設定が必要 | 採用 |
| Turborepo | タスクキャッシュ付きモノレポ | ビルド高速化 | セットアップコスト | 小規模のため不採用 |
| 共有 `packages/types` | 型専用パッケージ | 明示的な境界 | Hono RPC の型共有で不要 | 不採用 |

---

## Design Decisions

### Decision: Drizzle ORM vs Prisma

- **Context**: Turso（libSQL）との ORM 選定
- **Alternatives Considered**:
  1. Prisma — 成熟したエコシステム、型生成は強力だが Turso と `driverAdapters`（プレビュー）経由が必要。`prisma migrate dev` 非対応で手動ワークフローが煩雑
  2. Drizzle ORM — TypeScript ネイティブ、`drizzle-orm/libsql` で Turso に直接対応、マイグレーションも `drizzle-kit migrate` で完結
- **Selected Approach**: Drizzle ORM
- **Rationale**: Turso との相性・マイグレーションの簡便さ・コード生成不要の三点で Drizzle が優位。スキーマが TypeScript ファイルなので IDE 補完も即時有効
- **Trade-offs**: Prisma より抽象度が低く SQL 知識が必要。ただし本プロジェクトのクエリ複雑度では問題なし
- **Follow-up**: `drizzle-kit studio` でローカルDB確認が可能

### Decision: JWT vs セッション Cookie

- **Context**: PIN 認証後のセッション管理方式
- **Alternatives Considered**:
  1. セッション Cookie + サーバーサイドストア — シンプルだが Railway 複数インスタンス時に共有ストア必要
  2. 署名付き JWT (HS256) — ステートレス、Railway 単一インスタンスで十分
- **Selected Approach**: JWT を HttpOnly Cookie に格納
- **Rationale**: Railway 単一インスタンス想定。ステートレスで SSR 不要の SPA と相性が良い
- **Trade-offs**: トークン失効（ログアウト）は Cookie 削除で対処。厳密なリフレッシュ機構は不要

### Decision: SSE チャネル管理をインメモリで実装

- **Context**: 接続中クライアントへのブロードキャスト方式
- **Alternatives Considered**:
  1. インメモリ Map — シンプル、追加依存なし
  2. Redis Pub/Sub — スケーラブル、依存追加
- **Selected Approach**: `Map<eventId, Set<SSEStreamingApi>>` をモジュールスコープで管理
- **Rationale**: 12名専用・単一サーバーインスタンス想定。Redis は不要
- **Trade-offs**: サーバー再起動で接続リセット。許容範囲内

---

## Risks & Mitigations

- Drizzle Kit の Turso dialect が比較的新しい — バージョン固定（`drizzle-kit` と `drizzle-orm` のバージョンを揃える）を推奨
- Railway SSE タイムアウト — `ping` イベントを 30 秒間隔で送信し接続維持
- Hono RPC 型解決の遅延 — `composite: true` と `declarationMap: true` を tsconfig に設定し IDE 補完を確保

---

## References

- [Hono RPC](https://hono.dev/docs/guides/rpc)
- [Turso + Prisma](https://docs.turso.tech/sdk/ts/orm/prisma)
- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming)
- [Hono JWT Middleware](https://hono.dev/docs/middleware/builtin/jwt)
