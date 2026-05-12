# ギャップ分析：result-reveal

## 1. 現状調査（Current State）

### 既存コードベースの主要資産

| 資産 | パス | 関連性 |
|---|---|---|
| DBスキーマ | `backend/src/db/schema.ts` | `events.phase`、`scores.submitted`、`players.team` |
| SSEハブ | `backend/src/routes/stream.ts` | `result_ready`・`phase_update` イベント配信基盤 |
| イベントサービス | `backend/src/services/event-service.ts` | `advancePhase()`（`COLLECTING→REVEALING→DONE`） |
| スコアサービス | `backend/src/services/score-service.ts` | 全員提出完了時に `result_ready` ブロードキャスト実装済み |
| SSE composable | `frontend/src/composables/useEventStream.ts` | `resultReady`・`phase_update` 受信実装済み |
| ルーター | `frontend/src/router/index.ts` | 認証ガード実装済み、結果発表ルートなし |
| TournamentView | `frontend/src/views/TournamentView.vue` | `result_ready` を console.log のみ（遷移未実装） |
| AdminView | `frontend/src/views/AdminView.vue` | REVEALING フェーズで「DONE へ」ボタンのみ（段階的発表制御なし） |

### 既存パターンと規約

- **型の流れ**: `schema.ts ($inferSelect)` → `service.ts` → Hono RPC → Vue composable → View
- **SSE**: `hub.broadcast(eventId, type, payload)` でイベント配信
- **認証ガード**: `router/index.ts` の `requiresAuth` / `requiresAdmin` meta
- **管理者操作**: `adminMiddleware` + `authMiddleware` のスタック
- **テスト配置**: `__tests__/` を各ドメインに隣接配置、Vitest 使用
- **レイアウト**: `App.vue` が `route.meta.layout` で `AppLayout`（BottomNav付き）と `plain` を切替

---

## 2. 要件フィージビリティ分析

### 要件ごとの技術ニーズと現状ギャップ

#### 要件1: 全員入力完了後の強制遷移

| 技術ニーズ | 現状 | ギャップ |
|---|---|---|
| `result_ready` SSEブロードキャスト | ✅ `score-service.ts` 実装済み | なし |
| クライアント側でイベント受信 | ✅ `useEventStream.ts` 実装済み | なし |
| `/events/:id/result` への強制遷移 | ❌ `console.log` のみ | **Missing**: ルート追加 + ナビゲーションロジック |
| `result_ready` 受信前のガード（→スコア入力へリダイレクト） | ❌ なし | **Missing**: ルートガード条件追加 |
| 未認証アクセスのガード | ✅ `requiresAuth` で対応可能 | なし |

#### 要件2: 段階的発表フェーズ進行制御（フェーズ 0〜3）

| 技術ニーズ | 現状 | ギャップ |
|---|---|---|
| 発表サブフェーズ（0-3）の永続化 | ❌ `events.phase` は `COLLECTING/REVEALING/DONE` のみ | **Missing**: DBスキーマ拡張（`revealPhase` カラム追加）|
| 管理者による発表フェーズ進行API | ❌ 既存 `PATCH /:id/phase` は大会フェーズのみ | **Missing**: 新エンドポイントまたは既存拡張 |
| `phase_update` SSEペイロードに発表サブフェーズ含む | ⚠️ 現在は `{ eventId, phase: EventPhase }` のみ | **Constraint**: ペイロード型拡張が必要 |
| 管理者権限チェック（403） | ✅ `adminMiddleware` 実装済み | なし |
| フェーズ3到達時のボタン無効化 | ❌ なし | **Missing**: フロントエンド制御 |

#### 要件3: リアルタイムフェーズ同期

| 技術ニーズ | 現状 | ギャップ |
|---|---|---|
| SSE接続維持 | ✅ `useEventStream.ts` 実装済み | なし |
| SSE切断時の自動再接続（最大3回、指数バックオフ） | ❌ 再接続ロジックなし | **Missing**: composable に再接続ロジック追加 |
| 再接続後の最新フェーズ取得・同期 | ❌ なし | **Missing**: `GET /api/events/:id/result` からの同期処理 |
| 初期表示時のフェーズ状態取得 | ❌ なし | **Missing**: 結果発表ページのマウント時API呼び出し |

#### 要件4: 順位計算と発表グループ分類

| 技術ニーズ | 現状 | ギャップ |
|---|---|---|
| 勝利数降順・勝率二次ソートで最終順位算出 | ❌ なし | **Missing**: 新サービス（`result-service.ts`） |
| 1軍残留/2軍残留/ボーダー分類 | ❌ なし | **Missing**: 分類ロジック（**Research Needed**: ボーダー判定の詳細ルール） |
| `GET /api/events/:id/result` エンドポイント | ❌ なし | **Missing**: 新ルート |
| 認証済みユーザーのみ返す | ✅ `authMiddleware` で対応可能 | なし |

> **Research Needed**: 「ボーダー（入れ替え対象）」の判定ルール。12名構成で何名が1軍/2軍/ボーダーになるか。`players.team` のみで判定するか、順位との組み合わせで判定するか。デザインフェーズで確認が必要。

#### 要件5: 結果発表UI演出

| 技術ニーズ | 現状 | ギャップ |
|---|---|---|
| ダークテーマ全画面レイアウト | ✅ `bg-[#090014]` Tailwind設定済み | **Constraint**: `AppLayout` の `BottomNav` を非表示にする機構が必要 |
| プレイヤーカードのフェード・スライドアニメーション | ❌ なし | **Missing**: 新コンポーネント + CSS transitions |
| `ResultRevealView.vue` | ❌ なし | **Missing**: 新Viewコンポーネント |
| `ResultCard.vue` | ❌ なし | **Missing**: 新UIコンポーネント |
| 未開示フェーズの情報秘匿 | ❌ なし | **Missing**: フロントエンド表示制御 |

#### 要件6: 発表完了後の状態管理

| 技術ニーズ | 現状 | ギャップ |
|---|---|---|
| フェーズ3完了後に大会フェーズを `DONE` へ更新 | ⚠️ `advancePhase()` は `REVEALING→DONE` への遷移を持つ | **Constraint**: 発表サブフェーズ3完了時に連動させる設計が必要 |
| Star投票ページへの遷移誘導UI | ❌ なし | **Missing**: `DONE` 時のCTA表示 |
| `DONE` 状態での全フェーズ開示済み表示 | ❌ なし | **Missing**: 初期ロード時の状態反映 |

---

## 3. 実装アプローチ選択肢

### Option A: 既存コンポーネントの拡張

- `events.ts` に `GET /:id/result` と `PATCH /:id/reveal-phase` を追加
- `event-service.ts` に順位計算・分類ロジックを追加
- `useEventStream.ts` に再接続ロジックと発表サブフェーズ対応を追加
- `AdminView.vue` に段階的発表制御UIを追加

**トレードオフ**:
- ✅ 新ファイル最小限
- ❌ `event-service.ts` と `useEventStream.ts` が肥大化
- ❌ 結果発表という独立した関心事がサービス・composableに混在する

### Option B: 新規コンポーネント作成

- `backend/src/services/result-service.ts`（順位計算・分類）
- `backend/src/routes/result.ts`（`GET /api/events/:id/result`、`PATCH /api/events/:id/reveal-phase`）
- `frontend/src/views/ResultRevealView.vue`（結果発表ページ）
- `frontend/src/composables/useResultReveal.ts`（発表フェーズ状態管理）
- `frontend/src/components/result/ResultCard.vue`（プレイヤーカード）

**トレードオフ**:
- ✅ 関心事の明確な分離
- ✅ 独立したテストが容易
- ✅ `event-service.ts` や `useEventStream.ts` の複雑度を維持
- ❌ ファイル数増加

### Option C: ハイブリッドアプローチ（推奨）

**拡張する既存資産:**
- `backend/src/db/schema.ts`: `events` テーブルに `revealPhase` integer カラム追加
- `frontend/src/composables/useEventStream.ts`: SSE再接続ロジック追加、`phase_update` ペイロード型を拡張
- `frontend/src/router/index.ts`: `/events/:id/result` ルート追加、ガード条件更新
- `frontend/src/views/TournamentView.vue`: `result_ready` 時の強制遷移ロジック追加
- `frontend/src/views/AdminView.vue`: REVEALING フェーズの発表サブフェーズ進行UI追加

**新規作成するコンポーネント:**
- `backend/src/services/result-service.ts`: 順位計算・グループ分類
- `backend/src/routes/result.ts`: 結果エンドポイント群
- `frontend/src/views/ResultRevealView.vue`: 結果発表専用ページ（`layout: 'plain'` で BottomNav 非表示）
- `frontend/src/composables/useResultReveal.ts`: 発表フェーズ管理・API呼び出し
- `frontend/src/components/result/ResultCard.vue`: プレイヤー表示カード

**トレードオフ**:
- ✅ 新規ロジックは新ファイルに分離しつつ、共通基盤（SSE・認証・ルーター）は既存を活用
- ✅ バランスの取れた変更範囲
- ❌ DBマイグレーションが必要（`revealPhase` カラム追加）

---

## 4. 重要な設計判断事項（デザインフェーズへ持越し）

### 4.1 発表サブフェーズの管理方式

- **案1**: `events` テーブルに `revealPhase INTEGER DEFAULT 0` カラム追加
- **案2**: `events.phase` のenum値を `REVEALING_0〜3` に拡張（Breaking Change）
- **推奨**: 案1（後方互換性維持、既存コード変更最小）

### 4.2 `phase_update` SSEペイロードの拡張

現在: `{ eventId: string, phase: 'COLLECTING' | 'REVEALING' | 'DONE' }`
必要: 発表サブフェーズ番号も含む

- **案1**: `{ eventId, phase, revealPhase?: number }` に拡張
- **案2**: 新SSEイベント型 `reveal_phase_update` を追加
- **推奨**: 案1（`SSEEventType` 型の変更最小限）

### 4.3 ボーダー判定ロジック（Research Needed）

`players.team`（`FIRST` / `SECOND`）と最終順位から分類する際の詳細ルール:
- 1軍は何位まで残留？2軍は何位から昇格候補？
- 欠席プレイヤーはどのグループに入るか？

### 4.4 管理者の発表サブフェーズ進行UIの配置

- **案1**: `ResultRevealView.vue` 内に管理者専用ボタンを表示（同一画面で制御）
- **案2**: `AdminView.vue` に発表フェーズ進行ボタンを残す（管理者は別画面で操作）
- **推奨**: 案1（管理者も同じ演出画面を見ながら操作できる体験価値）

---

## 5. 実装工数とリスク評価

| 項目 | 評価 | 根拠 |
|---|---|---|
| **工数** | **M（3〜7日）** | DBマイグレーション・新サービス・新View・アニメーション演出を含む。既存SSE基盤・認証基盤の再利用でXLには至らない |
| **リスク** | **Medium** | SSE再接続（指数バックオフ）は既存パタール外。ボーダー判定ルールが未確定。アニメーション演出はUX調整を要する |

---

## 分析サマリー

- **スコープ**: バックエンド2ファイル新規作成 + 既存3ファイル拡張、フロントエンド3ファイル新規作成 + 既存4ファイル拡張、DBマイグレーション1件
- **主な課題**: 発表サブフェーズ（0-3）の管理方式、`phase_update` SSEペイロード拡張、ボーダー判定ルールの未確定
- **再利用可能な既存資産**: SSEハブ（`hub.broadcast`）、`adminMiddleware`、`useEventStream`の受信ロジック、Tailwindカラー定義、ルーターガード機構
- **推奨**: ハイブリッドアプローチ（Option C）で進める。`revealPhase` カラム追加と新規ファイル分離が品質・保守性のバランス上最適
- **要調査項目**: ボーダー判定の具体的な人数・ルール（デザインフェーズで確認）

---

## 次のステップ

```
/kiro:spec-design result-reveal
```

ギャップ分析の結果を踏まえ、上記コマンドでテクニカルデザインを生成してください。
デザインフェーズでは特に「ボーダー判定ロジック」と「発表サブフェーズの管理方式」の詳細を確定する必要があります。
