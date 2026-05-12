# リサーチ・設計決定ログ

---
**目的**: ディスカバリーフェーズでの調査結果、アーキテクチャ検討、設計根拠を記録する。

---

## サマリー

- **フィーチャー**: `group-profile`
- **ディスカバリースコープ**: Extension（既存システムへの機能追加）
- **主要な知見**:
  1. `GET /api/players` エンドポイントが既存で実装済みであり、必要なフィールド（id, name, team, title, mainUnit）をすべて返却している。認証ガードの追加のみ必要。
  2. `scores`・`events` テーブルに勝率推移計算に必要なデータがすべて揃っており、DBスキーマ変更は不要。
  3. `frontend/src/views/GroupView.vue` と `ProfileView.vue` はスタブとして既存。ルーター `/profile` を `/profile/:id` に変更し BottomNav を動的化する必要がある。

---

## リサーチログ

### 既存APIルートの調査

- **コンテキスト**: `GET /api/players` の実装内容と認証状態を確認。
- **調査箇所**: `backend/src/routes/players.ts`
- **知見**:
  - `GET /` は認証ガードなし（authMiddleware 未適用）
  - レスポンスフィールド: `id, name, team, title, mainUnit, createdAt`
  - Requirement 4.1 を満たすフィールド構成だが、Req 4.5 の認証ガードが欠落
- **影響**: authMiddleware を全 playersRoute に適用する必要がある。既存クライアント（フロントエンド）もルーターガードで認証済みユーザーのみアクセスするため破壊的変更にはならない。

### スキーマ・勝率計算クエリの確認

- **コンテキスト**: Req 3.1〜3.4 の実装に必要なデータが存在するか確認。
- **調査箇所**: `backend/src/db/schema.ts`
- **知見**:
  - `scores.submitted`（boolean）, `scores.absent`（boolean）, `scores.wins`, `scores.losses` が存在
  - `events.held_at`（timestamp）が存在し、降順ソートに使用可能
  - `scores` と `events` は `event_id → events.id` で外部キー結合可能
  - DBスキーマ変更ゼロで実現可能
- **影響**: ProfileService は `scores JOIN events` を Drizzle ORM で実装するだけでよい。

### フロントエンドルーター・BottomNavの調査

- **コンテキスト**: 個人プロフィール画面への動的ルーティング設計。
- **調査箇所**: `frontend/src/router/index.ts`, `frontend/src/components/BottomNav.vue`
- **知見**:
  - `/profile` は現在静的ルート（パラメータなし）
  - BottomNav の "プロフィール" タブが `/profile` を参照
  - `useAuth` の `currentPlayer.value?.playerId` でログイン中のプレイヤーIDを取得可能
- **影響**: `/profile` → `/profile/:id` に変更し、BottomNav は `currentPlayer.value?.playerId` を使用して動的ナビゲーション。

### 既存ミドルウェア・サービスパターンの確認

- **コンテキスト**: authMiddleware 適用パターン、サービス層の設計規約を確認。
- **調査箇所**: `backend/src/routes/scores.ts`, `backend/src/services/score-service.ts`
- **知見**:
  - `authMiddleware` は `.use('/*', authMiddleware)` でルート全体に適用するパターンが確立
  - サービス層は `export const xxxService = { ... }` 形式のオブジェクト（クラス不使用）
  - エラーは discriminated union `{ code: 'ERROR_TYPE' }` で返却
- **影響**: ProfileService も同じパターンで実装する。null 返却（プレイヤー未存在時）はルートハンドラが 404 に変換する。

---

## アーキテクチャパターン評価

| オプション | 説明 | 強み | リスク/制限 | 備考 |
|---|---|---|---|---|
| playersRoute を拡張 | 既存 `players.ts` に `/:id/profile` を追加 | 既存パターンに沿う・ルーティング一貫性 | ファイルが多少肥大化 | 採用 |
| 独立した `profileRoute` を新設 | `profile.ts` として分離 | 関心の分離 | オーバーエンジニアリング（機能が小さい） | 不採用 |
| ProfileService を playersRoute 内に inline | サービス層を設けない | ファイル数削減 | テスト困難・ビジネスロジックとルーティング混在 | 不採用 |

---

## 設計決定

### 決定: playersRoute 全体に authMiddleware を適用

- **コンテキスト**: Req 4.5 では「プロフィールAPI」への認証ガード適用を要件とする。`GET /api/players` はこれまで認証不要だった。
- **検討した選択肢**:
  1. `GET /api/players` はそのまま、`GET /api/players/:id/profile` のみ認証ガード
  2. `playersRoute` 全体（`GET /` 含む）に認証ガード
- **選択**: オプション 2（全体ガード）
- **根拠**: 既存の eventsRoute・scoresRoute がすべて `use('/*', authMiddleware)` で保護されており、一貫性を保つ。フロントエンドはすでにルーターガードで認証必須のため既存機能への影響なし。
- **トレードオフ**: 認証未実施クライアントからの `GET /api/players` が 401 になる。現在そのようなクライアントは存在しない。

### 決定: 勝率推移の表示方式は外部ライブラリ不使用

- **コンテキスト**: Req 3.5「グラフまたはリスト形式で視覚的に表示する」。グラフライブラリ（Chart.js等）を使うか検討。
- **選択**: Tailwind CSS のインラインスタイル幅指定によるバー表示（ライブラリ不使用）
- **根拠**: 5件程度の単純な勝率表示に外部ライブラリは過剰。既存 UI パターン（Tailwind のみ）と一致。バンドルサイズを増やさない。
- **トレードオフ**: 凝ったアニメーションや軸ラベルは実装が難しいが、要件上不要。

### 決定: BottomNav のプロフィールリンクを動的化

- **コンテキスト**: `/profile` が `/profile/:id` になるため、BottomNav の静的リンクを更新する必要がある。
- **選択**: BottomNav 内で `useAuth()` を呼び出し、`/profile/${currentPlayer.value?.playerId}` を動的に生成。ログイン中の場合のみ有効化。
- **根拠**: 既存の `useAuth` パターンを再利用でき、追加の状態管理不要。
- **トレードオフ**: 未ログイン時はプロフィールリンクが無効になるが、BottomNav はログイン後のみ表示される（AppLayout 配下）ため問題なし。

---

## リスクと軽減策

- `GET /api/players` の認証ガード追加による破壊的変更リスク → フロントエンドのルーターガードが認証前アクセスを防いでいるため実質なし
- `wins + losses = 0` の勝率計算でゼロ除算 → winRate = 0.0 として明示的にハンドリング
- `/profile/:id` ルート変更による既存テスト（guard.test.ts）への影響 → テストを `/profile` → `/profile/:id` に更新が必要（実装時）

---

## 参考

- Hono RPC パスパラメータ: `client.api.players[':id'].profile.$get({ param: { id } })`
- Drizzle ORM JOIN パターン: `db.select().from(scores).innerJoin(events, eq(scores.eventId, events.id))`
