# 要件定義書

## はじめに

本スペックは「sugamo-exvs-match」プロジェクトの基盤（Foundation）を定義する。身内12名専用のガンダムEXVS 2 IB 月例下剋上決定戦管理Webアプリとして、フロントエンド（Vue 3 SPA）・バックエンド（Hono API）・データベース（Turso + Prisma）の全レイヤーにわたる共通インフラを構築する。本スペックで確立した基盤の上に、各機能スペック（大会管理、Star投票、結果発表等）が積み上がる。

## スコープ

- **対象**: モノレポ構成・TypeScript設定・データベーススキーマ・PIN認証・Hono API骨格・Vue SPA骨格・SSE基盤・UI共通テーマ
- **対象外**: 個別機能（大会作成・成績入力・Star投票・結果発表演出）の詳細実装
- **隣接スペック**: 各機能スペックは本スペックのDB型・Hono RPCクライアント・SSEイベント定義を利用する

---

## 要件

### 要件 1: モノレポ・プロジェクト構成

**目的:** 開発者として、フロントエンドとバックエンドをひとつのリポジトリで一貫して管理したい。TypeScript の型安全性が全レイヤーを貫くようにすることで、開発速度と品質を確保する。

#### 受け入れ基準

1. The システム shall ルートに `frontend/` と `backend/` ディレクトリを持つモノレポ構成を採用する。
2. The システム shall TypeScript strict モードをフロントエンド・バックエンド双方で有効化する（`"strict": true`）。
3. The システム shall `any` 型の使用を ESLint ルールで禁止する（`@typescript-eslint/no-explicit-any: error`）。
4. When 新しいパッケージを追加するとき、The システム shall 各ワークスペース（`frontend/`・`backend/`）のスコープ内にのみインストールする。
5. The システム shall ルートレベルの `package.json` に `dev`（全ワークスペース起動）・`build`・`lint` スクリプトを定義する。

---

### 要件 2: データベーススキーマ

**目的:** 開発者として、アプリケーション全体で使用するデータモデルを Drizzle スキーマとして定義したい。Drizzle の `$inferSelect` / `$inferInsert` 型を唯一の型ソースとして活用することで、手書き型定義を最小化する。

#### 受け入れ基準

1. The システム shall 以下のテーブルを `backend/src/db/schema.ts` に定義する: `players`・`events`・`scores`・`stars`。
2. The `players` テーブル shall `id`・`name`（ユニーク）・`pinHash`・`team`（`FIRST` | `SECOND`）・`title`・`mainUnit`・`createdAt` カラムを持つ。
3. The `events` テーブル shall `id`・`heldAt`・`phase`（`COLLECTING` | `REVEALING` | `DONE`）・`createdAt` カラムを持つ。
4. The `scores` テーブル shall `id`・`eventId`（events外部キー）・`playerId`（players外部キー）・`wins`・`losses`・`absent`（Boolean）カラムを持つ。
5. The `stars` テーブル shall `id`・`eventId`・`fromPlayerId`・`toPlayerId`・`count`（1〜3の整数）カラムを持ち、`fromPlayerId != toPlayerId` の制約をアプリ層で強制する。
6. When スキーマを変更するとき、The システム shall `drizzle-kit generate` でマイグレーションファイルを生成し、`drizzle-kit migrate` で Turso に適用する。
7. The システム shall `backend/src/db/client.ts` に Drizzle クライアントを初期化し、`TURSO_DATABASE_URL` および `TURSO_AUTH_TOKEN` 環境変数で接続する。

---

### 要件 3: 認証システム（PIN認証）

**目的:** プレイヤーとして、プレイヤー名を選択して4桁PINを入力するだけで素早くログインしたい。筐体前での手軽さを優先するため、操作は最小限にしたい。

#### 受け入れ基準

1. When プレイヤーがログイン画面でプレイヤー名と4桁PINを送信するとき、The 認証システム shall PINをハッシュ比較して正否を判定する。
2. When 認証に成功するとき、The 認証システム shall セッションCookieまたは署名付きJWTを発行し、クライアントに返す。
3. If PINが一致しないとき、The 認証システム shall HTTP 401 を返し、エラーメッセージを含む JSON を返す。
4. While セッション・JWTが有効なとき、The 認証システム shall 保護されたAPIエンドポイントへのアクセスを許可する。
5. If セッション・JWTが失効または不正なとき、The 認証システム shall HTTP 401 を返す。
6. The 認証システム shall PINを平文でDBに保存せず、bcrypt 等のハッシュ関数で保存する。
7. The 認証システム shall プレイヤー一覧取得エンドポイント（`GET /api/players`）は認証なしで参照できるようにする（ログイン画面での名前選択用）。

---

### 要件 4: Hono API 骨格

**目的:** 開発者として、Hono RPC を基盤とした型安全な API サーバーを構築したい。フロントエンドとバックエンドの型を共有し、手書きの API 型定義を排除する。

#### 受け入れ基準

1. The API サーバー shall Hono を使用し、`backend/src/index.ts` をエントリポイントとして起動する。
2. The API サーバー shall ルートを `backend/src/routes/` 配下にドメインごとのファイルに分割する（例: `players.ts`・`events.ts`・`scores.ts`・`stars.ts`・`stream.ts`）。
3. The API サーバー shall Hono RPC 形式でルートを定義し、`AppType` をフロントエンドに export する。
4. The API サーバー shall 認証が必要なルートに Hono ミドルウェアで認証ガードを適用する。
5. If リクエストボディのバリデーションに失敗するとき、The API サーバー shall HTTP 400 と詳細なエラーメッセージを返す。
6. The API サーバー shall Railway へのデプロイ設定（`Procfile` またはビルドコマンド）を含む。

---

### 要件 5: SSE（Server-Sent Events）基盤

**目的:** 開発者として、全参加者のスマートフォンをリアルタイムに同期させる SSE インフラを整備したい。成績入力の進捗や結果発表トリガーをサーバーから全クライアントへプッシュする。

#### 受け入れ基準

1. The SSE サービス shall `GET /api/stream/events/:eventId` エンドポイントを提供する。
2. When クライアントが SSE エンドポイントに接続するとき、The SSE サービス shall `text/event-stream` ヘッダーでレスポンスを開始し、接続を維持する。
3. The SSE サービス shall 以下のイベントタイプを定義する: `progress_update`・`result_ready`・`phase_update`。
4. When いずれかのプレイヤーが成績を入力完了するとき、The SSE サービス shall 同一 `eventId` に接続中の全クライアントへ `progress_update` イベントを送信する。
5. When 全プレイヤーの成績入力が完了するとき、The SSE サービス shall 全クライアントへ `result_ready` イベントを送信する。
6. When 管理者が結果発表フェーズを更新するとき、The SSE サービス shall 全クライアントへ `phase_update` イベントを送信する。
7. If SSE クライアントが切断するとき、The SSE サービス shall 接続リストからそのクライアントを除去し、メモリリークを防ぐ。

---

### 要件 6: Vue SPA 骨格・共通テーマ

**目的:** フロントエンド開発者として、ダークテーマに統一されたスマートフォン縦画面最適化の Vue 3 SPA を構築したい。ボトムナビゲーションを持つ共通レイアウトを基盤として、各画面を開発できるようにする。

#### 受け入れ基準

1. The フロントエンド shall Vue 3 + Vite + TypeScript を使用し、`frontend/src/main.ts` をエントリポイントとする。
2. The フロントエンド shall Tailwind CSS を設定し、以下のカスタムカラーを `tailwind.config.ts` で定義する: `base-900: #090014`・`base-800: #12002b`・`base-600: #2b008e`・`accent: #d946ef`。
3. The フロントエンド shall ダークテーマを固定とし、`html` 要素に `class="dark"` または等価の設定を行う。
4. The フロントエンド shall スマートフォン縦画面（375px〜430px 幅）を主対象とした共通レイアウトコンポーネント（`AppLayout.vue`）を持つ。
5. The フロントエンド shall ボトムナビゲーション（`BottomNav.vue`）を `AppLayout.vue` 内に配置し、主要タブ（大会・グループ・プロフィール等）へのリンクを提供する。
6. The フロントエンド shall `frontend/src/api/` に Hono RPC クライアント（`hc<AppType>`）を初期化するモジュールを配置し、全APIコールの窓口とする。
7. The フロントエンド shall `frontend/src/composables/useEventStream.ts` に SSE クライアントのロジックを実装し、受信イベントを Vue リアクティブ状態に変換する。
8. The フロントエンド shall `@/` エイリアスを `frontend/src/` にマップするパス設定を `vite.config.ts` および `tsconfig.json` に含める。
