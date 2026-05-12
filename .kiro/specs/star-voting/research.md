# Research & Design Decisions

---
**Purpose**: Star投票機能の設計決定根拠と調査ログ

---

## Summary

- **Feature**: `star-voting`
- **Discovery Scope**: Extension（既存フェーズ管理システムへの拡張）
- **Key Findings**:
  - `stars` テーブルと `starsRoute` スタブが既存スキーマに存在しており、ゼロからではなく拡張として実装できる
  - フェーズ遷移は `COLLECTING → REVEALING → DONE` から `COLLECTING → STAR_VOTING → REVEALING → DONE` へ変更が必要。`PHASE_MAP` と `EventPhase` 型の更新で対応可能
  - SSEハブ（`hub`）は既に `broadcast` API を提供しており、`SSEEventType` に `star_vote_update` を追加するだけでリアルタイム通知が実現できる

---

## Research Log

### 既存スキーマの調査

- **Context**: `stars` テーブルにユニーク制約がないことを確認
- **Sources Consulted**: `backend/src/db/schema.ts`
- **Findings**:
  - `stars` テーブルは `{ id, eventId, fromPlayerId, toPlayerId, count }` の構成で既存
  - ユニークインデックスは `(eventId, fromPlayerId, toPlayerId)` に追加が必要
  - `scores` テーブルに `starVotingSubmitted` カラムが存在しないため追加が必要
  - `events.phase` の enum が `['COLLECTING', 'REVEALING', 'DONE']` のみ → `'STAR_VOTING'` を追加
- **Implications**: Drizzle KIT でのマイグレーションが必要。既存の `scores` テーブルへの ALTER TABLE は Turso のオンライン SQLite で問題なく実行可能

### SSEハブの既存実装確認

- **Context**: Star投票進捗のリアルタイム通知をどう実装するか
- **Sources Consulted**: `backend/src/routes/stream.ts`, `frontend/src/composables/useEventStream.ts`
- **Findings**:
  - `hub.broadcast(eventId, type, payload)` が既存で利用可能
  - `SSEEventType` は Union 型として `stream.ts` に定義されており、追加が容易
  - `useEventStream.ts` は `addEventListener` でイベント種別ごとにハンドラを登録するパターン
  - `phase_update` イベントは既に存在し、フロントエンドはこれをフェーズ遷移のトリガーとして使用している
- **Implications**: `star_vote_update` を追加し、`useEventStream` の `UseEventStreamReturn` 型を拡張するだけで対応できる

### result_ready イベントの廃止検討

- **Context**: `score-service.ts` が全スコア完了時に `result_ready` をブロードキャストしているが、Star投票では STAR_VOTING への自動遷移に置き換える
- **Sources Consulted**: `backend/src/services/score-service.ts`, `frontend/src/composables/useEventStream.ts`, `frontend/src/views/TournamentView.vue`
- **Findings**:
  - `TournamentView.vue` は `resultReady` を直接ルーティングに使用していない（`currentPhase === 'REVEALING'` を使用）
  - `useAdminEvent.ts` もSSEを購読しておらず、`result_ready` に依存していない
  - `resultReady.value = true` の状態が利用されているコンポーネントが現状ない
- **Implications**: `result_ready` ブロードキャストを安全に廃止し、`phase_update { phase: 'STAR_VOTING' }` に置換できる。`SSEEventType` からの削除は破壊的変更を避けるため行わず、将来的な廃止とする

### 管理者フェーズ操作との整合

- **Context**: 管理者が `PATCH /api/events/:id/phase` で手動フェーズ進行できる。STAR_VOTING追加後の動作確認
- **Sources Consulted**: `backend/src/routes/events.ts`, `backend/src/services/event-service.ts`, `frontend/src/composables/useAdminEvent.ts`
- **Findings**:
  - `PHASE_MAP` を `{ COLLECTING: 'STAR_VOTING', STAR_VOTING: 'REVEALING', REVEALING: 'DONE' }` に更新するだけで管理者操作も正しく動作する
  - `useAdminEvent.ts` の `EventPhase` 型（フロントエンド側）も `'STAR_VOTING'` を追加する必要がある
  - 管理者は投票が揃わない場合のフォールバックとして STAR_VOTING → REVEALING を手動で実行できる（要件8.4）
- **Implications**: `PHASE_MAP` 変更のみで管理者操作のフォールバックが担保される

### Star投票完了状態の追跡方法

- **Context**: 1大会1プレイヤー1回制限をどう実装するか
- **Findings**:
  - Option A: `scores.starVotingSubmitted boolean` カラム追加
  - Option B: `stars` テーブルのクエリで存在確認（`fromPlayerId` の行があれば投票済み）
  - Option C: 専用の `star_vote_submissions` テーブルを追加
- **Selected**: Option A（`scores.starVotingSubmitted`）
- **Rationale**: `scores` テーブルは既にプレイヤーの大会参加状態を管理しており、投票ステータスも同テーブルに持たせることでクエリが単純になる。「非欠席プレイヤー全員が投票済みか」のカウントが `scores` 1テーブルで完結する

---

## Architecture Pattern Evaluation

| Option | 説明 | 強み | リスク | 備考 |
|--------|------|------|--------|------|
| フェーズ拡張（採用） | 既存 `COLLECTING → REVEALING → DONE` に `STAR_VOTING` を挿入 | 最小変更で既存パターンを踏襲 | `PHASE_MAP` の変更が既存管理者操作に影響 | `PHASE_MAP` を更新するだけで管理者フォールバックも担保 |
| 別フロー | Star投票を独立したサブフローとして実装 | 依存関係が明確 | 既存フェーズ管理との二重管理になる | オーバーエンジニアリング |

---

## Design Decisions

### Decision: `COLLECTING → STAR_VOTING` の自動遷移を `score-service.ts` で担う

- **Context**: 全スコア入力完了時に誰がフェーズ遷移を実行するか
- **Alternatives Considered**:
  1. 管理者が手動で `PATCH /api/events/:id/phase` を呼ぶ
  2. `score-service.ts` が直接 `events.phase` を更新する（採用）
- **Selected Approach**: `score-service.ts` の `allCompleted` 時に `db.update(events)` で `STAR_VOTING` へ更新し、`hub.broadcast(phase_update)` する
- **Rationale**: 要件8.4が自動遷移を主要オプションとして定義。既存の `allCompleted` 判定ロジックが既にあり、最小変更で実装できる
- **Trade-offs**: `score-service` がフェーズ変更責務を持つことになるが、既に `result_ready` ブロードキャストを行っており一貫性がある
- **Follow-up**: `score-service.ts` の `result_ready` ブロードキャスト削除後、`useEventStream` の `resultReady` 状態も非活性化されることを確認

### Decision: `STAR_VOTING → REVEALING` の自動遷移を `star-service.ts` で担う

- **Context**: 全投票完了後のフェーズ遷移
- **Selected Approach**: `star-service.submitVote` で全員投票完了を検出した際に `db.update(events)` で `REVEALING` へ更新し `hub.broadcast(phase_update)` する
- **Rationale**: 投票の「全員完了」状態を最も正確に知っているのは `star-service` 自身
- **Trade-offs**: 管理者フォールバックとして `PATCH /api/events/:id/phase` も機能する（`PHASE_MAP` に `STAR_VOTING: 'REVEALING'` を追加するため）

### Decision: `GET /api/stars/status` でプレイヤー一覧も返す

- **Context**: 投票画面マウント時の API コール数最適化
- **Selected Approach**: `GET /api/stars/status` のレスポンスに `players: [{ playerId, playerName }]`（自己除外・非欠席のみ）を含める
- **Rationale**: 2回のAPIコール（プレイヤー一覧取得 + 投票状況取得）を1回に削減できる。進捗更新はSSEで行うため、プレイヤー一覧は初回取得のみで十分

---

## Risks & Mitigations

- **二重投票の競合条件**: `starVotingSubmitted` チェックと `INSERT` の間に複数リクエストが同時に到達する可能性 → Drizzle の `transaction` で `scores.starVotingSubmitted` の読み取りと更新・`stars` の INSERT をアトミックに実行
- **`phase_update STAR_VOTING` を既存 `TournamentView` が処理しない**: 現在 `TournamentView` は `REVEALING` のみ watch → `STAR_VOTING` ケースの追加が必要（設計で明示）
- **`scores.starVotingSubmitted` の Drizzle マイグレーション**: 既存データへの `DEFAULT false` 適用は SQLite では ALTER TABLE ADD COLUMN で安全に実行可能

---

## References

- [Drizzle ORM SQLite unique index](https://orm.drizzle.team/docs/indexes-constraints) — uniqueIndex の構文確認
- [Hono SSE streaming](https://hono.dev/docs/helpers/streaming#server-sent-events) — streamSSE の使い方
