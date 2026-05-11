# Technology Stack

## Architecture

Vue 3 SPA（フロントエンド）+ Hono（バックエンド API）の2層構成。Turso（Edge SQLite）をDBとして使用し、Drizzle ORM を介してアクセスする。Drizzle Schema（TypeScript）→ Hono RPC → Vue へと続くEnd-to-End型安全性が設計の中心。

リアルタイム同期はSSE（Server-Sent Events）で実現。WebSocketは使わない。

## Core Technologies

- **Language**: TypeScript（フロント・バック共通）
- **Frontend**: Vue 3 (Composition API) + Tailwind CSS
- **Backend**: Hono
- **Database**: Turso (Edge SQLite)
- **ORM**: Drizzle ORM（`drizzle-orm/libsql` でネイティブ Turso 対応）
- **Hosting / CI/CD**: バックエンド → Railway、フロントエンド → Vercel

## Key Libraries

- **Hono RPC**: フロントエンドとバックエンドの型共有を担う。APIクライアントはHono RPC Clientを通じて生成する。
- **Drizzle ORM**: DBアクセスの唯一の窓口。`drizzle-orm/libsql` で Turso にネイティブ接続。スキーマは `backend/src/db/schema.ts` に TypeScript で定義し、`$inferSelect` / `$inferInsert` 型を利用する。

## Development Standards

### Type Safety

- TypeScript strictモードを前提とする。
- `any` の使用は禁止。
- Prismaの生成型を最大限活用し、手書き型定義は最小化する。

### リアルタイム通信

SSEエンドポイント（`GET /api/stream/events/:id`）が状態同期のハブ。主要イベント:
- `progress_update`: 誰かが入力を完了したときのプログレスバー更新
- `result_ready`: 全員入力完了・結果発表への強制遷移トリガー
- `phase_update`: 管理者操作による段階的オープンの同期

### UI・テーマ

ダークテーマ固定。カラーパレットはTailwind設定（`tailwind.config.ts`）で一元管理する:
- `bg-[#090014]`（任意値）: 最暗背景（ログイン画面など AppLayout 外のページ）
- `dark` → `#12002b`: パネル背景（`bg-dark`）
- `main` → `#2b008e`: メインブランドカラー（`bg-main`, `text-main`, `border-main`）
- `accent` → `#c20e00`: アクセントカラー（`border-accent`, `focus:border-accent`）
- `bg` → `#b38ec7` / `bg-sub` → `#9681a2`: 背景グラデーション用
- 差し色: `yellow-400` / `yellow-500`（Star・順位・称号用）

## Key Technical Decisions

- **Turso + Drizzle**: エッジ環境での軽量SQLite。Drizzle は `drizzle-orm/libsql` でネイティブ対応しており、マイグレーションも `drizzle-kit migrate` で Turso に直接適用できる。
- **SSEによる同期**: WebSocketより実装が軽量でHono/Railwayとの相性が良いため採用。
- **PIN認証**: JWTまたはセッションCookieによる認証。厳密な認証よりUXを優先するが、APIは認証ガード必須。
- **スマートフォン縦画面最適化**: ボトムナビゲーションを採用。PCレイアウトはスコープ外。
- **デプロイ分離**: フロントエンド（Vue SPA）は Vercel、バックエンド（Hono API）は Railway にデプロイする。

---
_Document standards and patterns, not every dependency_
