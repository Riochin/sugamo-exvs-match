# リサーチ & 設計意思決定ログ

---
**Purpose**: score-entry 機能のデザインフェーズにおける調査記録と設計判断の根拠を残す。
**Discovery Scope**: Extension（既存システムの拡張）

---

## サマリー
- **Feature**: `score-entry`
- **Discovery Scope**: Extension — 既存の SSE ハブ・認証基盤・scores テーブルを活用しながら、スコア提出エンドポイントとフロントエンド入力 UI を追加する
- **Key Findings**:
  - `scores` テーブルは `wins` / `losses` カラムを持ち、デフォルト 0 / NOT NULL。`submitted` フラグがないため、"未入力 0/0" と "入力済み 0/0" を区別できない問題がある → `submitted` boolean カラムの追加が必要
  - `stream.ts` の `hub.broadcast()` は既に `progress_update` / `result_ready` / `phase_update` を型定義済みで即利用可能
  - `useEventStream` composable は `progress_update` / `result_ready` イベントを既にハンドルしており、フロントエンドへの状態提供は完成している
  - `scoresRoute` は認証ミドルウェアのみ適用された空のスタブとして存在する

---

## リサーチログ

### スコア提出済み判定の問題

- **Context**: 要件 3.1「全員提出完了の検知」を実装するため、スコアが提出済みかどうかの判定ロジックが必要
- **Findings**:
  - 現在の `scores` テーブル: `wins INTEGER NOT NULL DEFAULT 0`, `losses INTEGER NOT NULL DEFAULT 0`
  - "試合数 0・勝利数 0"（0/0）は有効な提出値（要件 1.5 で 0 以上の整数を許容）
  - よって wins=0 かつ losses=0 を「未提出」とみなす sentinel 値アプローチは不可
- **Implications**: `submitted BOOLEAN NOT NULL DEFAULT false` カラムを `scores` テーブルに追加し、提出時に `true` に更新する。Drizzle マイグレーションが必要。

### DB スキーマと入力インターフェースの不一致

- **Context**: 要件の「設計上の注意事項」で、入力は「対戦数・勝利数」だが DB は `wins` + `losses` の選択を求められている
- **Findings**:
  - Option 1（導出方式）: API が `matches` + `wins` を受け取り、`losses = matches - wins` を計算してDBに保存。スキーマ変更なし（`submitted` カラム追加のみ）
  - Option 2（スキーマ変更）: `losses` カラムを `matches` に改名。既存データを含むマイグレーションが必要。`event-service.ts` の `ScoreEntry` 型（`wins`, `losses` フィールド）も改修が必要
- **Selected Approach**: **Option 1（導出方式）** を採用
- **Rationale**: スキーマ変更は `event-service.ts` の `ScoreEntry` 型、既存の seed データ、他のルートに影響波及。Option 1 なら `submitted` カラム追加のみに変更範囲を限定できる。フロントエンドの入力と DB ストレージの関心分離は標準的な設計パターン。
- **Trade-offs**: `losses` カラム名が「敗数」の意味を持ち続け、`matches - wins` で導出されることをコードコメントで明示する必要がある

### SSE ハブの既存実装

- **Context**: `progress_update` と `result_ready` のブロードキャスト方法の確認
- **Sources Consulted**: `backend/src/routes/stream.ts`
- **Findings**:
  - `hub.broadcast(eventId, 'progress_update', payload)` / `hub.broadcast(eventId, 'result_ready', payload)` がすでに利用可能
  - `SSEEventType` 型に両イベントが定義済み
  - score-service から `hub` をインポートすれば即利用可能
- **Implications**: 新規 SSE 実装は不要。`score-service.ts` が `hub` を直接呼び出すだけ

### フロントエンドの SSE ハンドリング

- **Context**: `useEventStream` composable の完成度確認
- **Sources Consulted**: `frontend/src/composables/useEventStream.ts`
- **Findings**:
  - `progressUpdate: Ref<ProgressUpdatePayload | null>` — `{ completedCount, totalCount }` 型で既定義
  - `resultReady: Ref<boolean>` — `result_ready` イベント受信で `true` になる
  - `connect(eventId: string)` / `disconnect()` メソッドが存在
- **Implications**: フロントエンドは `useEventStream` を使うだけ。追加の SSE ロジックは不要

### スコア提出エンドポイントの URL 設計

- **Context**: `POST /api/scores` vs `POST /api/scores/:eventId` の選択
- **Findings**:
  - プレイヤーのセッションからは常に「アクティブイベントに対して提出」という操作
  - `playerId` は JWT の `sub` クレームから取得
  - `eventId` はサービス層でアクティブイベントを検索することで解決可能
  - シンプルな `POST /api/scores` にすると、フロントエンドはイベント ID を知らなくてよい
- **Selected Approach**: `POST /api/scores` — リクエストボディは `{ matches: number; wins: number }` のみ。サービス層がアクティブイベントを特定する

### TournamentView のフェーズ対応

- **Context**: スコア入力 UI をどこに配置するか
- **Findings**:
  - 現在 `TournamentView.vue` は `/` ルートに配置され、ほぼ空実装
  - `useEventStream` で `currentPhase` が取得可能
  - `COLLECTING` フェーズ中だけスコア入力パネルを表示する構成が最適
- **Selected Approach**: `TournamentView.vue` をフェーズ対応コンテナとして拡充。`COLLECTING` 時は `ScoreEntryPanel.vue` を表示

---

## アーキテクチャパターン評価

| オプション | 概要 | 強み | リスク | 採用 |
|-----------|------|------|--------|------|
| 直接 DB 呼び出し（route 内） | scores route 内で直接 Drizzle クエリ | シンプル | ビジネスロジックがルートに混在、テスト困難 | × |
| service 層分離 | score-service.ts でロジック集中 | 既存の event-service と一貫性、テスト容易 | わずかな間接参照増加 | **○** |
| 専用ドメインサービス | スコアと進捗検知を別サービスに分離 | 関心分離が明確 | 本機能規模では過剰 | × |

---

## 設計決定

### Decision: `submitted` カラム追加による提出済み管理

- **Context**: 0/0 スコアが有効な提出値であり、sentinel 値が使えない
- **Alternatives Considered**:
  1. `wins`/`losses` を nullable に変更 — NULL = 未提出、0 = 提出済み0勝0敗
  2. `submitted BOOLEAN` カラム追加 — 提出状態を明示管理
  3. `submitted_at TIMESTAMP` カラム追加 — 提出時刻も記録可能
- **Selected Approach**: `submitted BOOLEAN NOT NULL DEFAULT false`
- **Rationale**: 意図が明確、既存の `wins`/`losses` の型を変えない、マイグレーションが単純
- **Follow-up**: Drizzle `drizzle-kit generate` でマイグレーションファイルを生成し、Turso に適用する

### Decision: Drizzle migration 方針

- **Context**: `backend/drizzle/` ディレクトリが存在しない（初回マイグレーション）
- **Selected Approach**: `drizzle-kit generate` でマイグレーションファイルを生成し、`drizzle-kit migrate` で Turso に適用。実装タスクに migration step を含める。

---

## リスクと緩和策

- **`submitted` カラムが既存 seed データに未適用**: seed.ts を更新し、既存 score レコードの `submitted` を `false` で初期化する。マイグレーションの `DEFAULT false` で既存行も自動的に `false` になる
- **全員完了後に追加提出が来た場合のレース条件**: フェーズが `COLLECTING` のときだけ提出を受け付けることで解消（管理者が `COLLECTING → REVEALING` に進めた後は提出不可）
- **SSE 接続前の `result_ready` 見逃し**: クライアント接続時にアクティブイベントのフェーズを確認し、`COLLECTING` でなければ適切な画面を表示することで対処

---

## 参考

- Hono SSE: `hono/streaming` の `streamSSE` ユーティリティ
- Drizzle ORM Turso: `drizzle-orm/libsql` (既存スタック)
- `backend/src/routes/stream.ts` — 既存 SSE ハブ実装
- `backend/src/services/event-service.ts` — service 層パターンの参考実装
- `frontend/src/composables/useEventStream.ts` — SSE クライアント composable（完成済み）
