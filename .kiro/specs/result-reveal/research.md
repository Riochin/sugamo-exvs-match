# Research & Design Decisions: result-reveal

---

## Summary

- **Feature**: `result-reveal`
- **Discovery Scope**: Extension（既存SSE基盤・認証・ルーターを活用しつつ、新規View・Service・APIを追加）
- **Key Findings**:
  - 既存SSEハブ（`hub.broadcast`）・`authMiddleware`・`adminMiddleware` は再利用可能。新規ファイルはbackend 2件・frontend 3件の追加が必要。
  - `events` テーブルへの `revealPhase INTEGER DEFAULT 0` カラム追加が最小変更でサブフェーズを永続化できる唯一の方法（DBマイグレーション必須）。
  - ボーダー判定ロジック: 全非欠席プレイヤーをランキングし、1軍人数分の上位スロットと照合することで「FIRST_STAY / SECOND_STAY / BORDER」を自動分類できる。

---

## Research Log

### ボーダー判定ロジック

- **Context**: ギャップ分析で "Research Needed" とされた最重要設計判断。`players.team`（FIRST/SECOND）と最終順位からどう分類するか。
- **Sources Consulted**: requirements.md（要件4.3）、gap-analysis.md（4.3節）、product.md（月例下剋上決定戦説明）
- **Findings**:
  - 「月例下剋上決定戦」はFIRSTチーム vs SECONDチームの入れ替え戦。ボーダーとは「順位結果によりチームが変わる可能性のある選手群」。
  - 全非欠席プレイヤーを勝利数降順・勝率二次ソートで並べる。  
  - 非欠席FIRSTチーム人数 = F、非欠席SECONDチーム人数 = S。
  - 上位F枠＝1軍スロット / 下位S枠＝2軍スロット。
  - FIRSTチームで2軍スロットに入った選手 → BORDER（降格候補）
  - SECONDチームで1軍スロットに入った選手 → BORDER（昇格候補）
  - FIRSTチームで1軍スロット内 → FIRST_STAY
  - SECONDチームで2軍スロット内 → SECOND_STAY
- **Implications**: ハードコードの人数設定なし。チーム編成の変化に自動追従する。欠席者はランキングから除外し group=null を設定する。

### `revealPhase` 永続化方式

- **Context**: ギャップ分析 4.1節で2案が提示された。
- **Findings**:
  - 案1（`events.revealPhase` カラム追加）は後方互換あり、既存コード変更最小。
  - 案2（`events.phase` enum拡張）はBreaking Change。既存の `advancePhase()` やフロントエンドの `EventPhase` 型の全箇所を修正する必要があり変更範囲が大きい。
- **Implications**: 案1を採用。`events.phase` と独立したカラムとして追加することで、大会フェーズ（COLLECTING/REVEALING/DONE）と発表サブフェーズ（0〜3）の役割が明確に分離される。

### `phase_update` SSEペイロード拡張

- **Context**: ギャップ分析 4.2節で2案が提示された。
- **Findings**:
  - 案1（`revealPhase?: number` を既存 `PhaseUpdatePayload` に追加）はオプショナルフィールドのため後方互換。既存 `TournamentView.vue` や `AdminView.vue` は `payload.phase` しか参照しないため無影響。
  - 案2（新型 `reveal_phase_update` イベント追加）は `SSEEventType` と hub へのブロードキャスト呼び出し箇所が増え変更範囲が広い。
- **Implications**: 案1を採用。`useEventStream.ts` の `PhaseUpdatePayload` に `revealPhase?: number` を追加し、`useResultReveal.ts` でこのフィールドを活用する。

### 管理者発表操作UIの配置

- **Context**: ギャップ分析 4.4節で2案が提示された。
- **Findings**:
  - 案1（`ResultRevealView.vue` 内に管理者ボタン）: 管理者も同じ演出画面を見ながら操作でき、体験価値が高い。実装も `useAuth()` の `currentPlayer.isAdmin` で分岐するだけで単純。
  - 案2（`AdminView.vue` に残す）: 管理者が別画面を開く必要があり、演出と操作が分離されてしまう。
- **Implications**: 案1を採用。`ResultRevealView.vue` に管理者専用の「次のフェーズへ」ボタンを条件付きで表示する。

### SSE再接続ロジック

- **Context**: 要件3.3で「最大3回、指数バックオフ」が指定されているが、既存 `useEventStream.ts` には再接続ロジックが存在しない。
- **Findings**:
  - `EventSource` の `onerror` ハンドラでエラーを検知し、`close()` → `setTimeout` → `new EventSource(...)` のパターンで手動再接続を実装する。
  - 試行: 1秒 → 2秒 → 4秒（指数バックオフ）。3回失敗後は再接続を停止。
  - 再接続成功後は `GET /api/events/:id/result` で最新フェーズを同期する（要件3.4）。
  - この機能は `useResultReveal.ts` の内部に閉じて実装し、`useEventStream.ts` には手を加えない（単一責任）。
- **Implications**: `useResultReveal.ts` が自前の `EventSource` を管理する。`useEventStream.ts` は変更なし（`PhaseUpdatePayload` 型定義の拡張のみ）。

### フェーズ3完了時のイベントフェーズ自動遷移

- **Context**: 要件6.1で「revealPhase=3完了時に event.phase を DONE へ更新」が必要。
- **Findings**:
  - `PATCH /api/events/:id/reveal-phase` ハンドラ内で revealPhase を 3 にする際、同時に `events.phase = 'DONE'` を設定するアトミックな実装が最も単純。
  - ブロードキャストは `{ eventId, phase: 'DONE', revealPhase: 3 }` を送信することで、クライアントがフェーズ遷移と発表完了を一度に処理できる。
  - 既存の `advancePhase()`（`REVEALING→DONE`）は今後不要になるが、既存コードとの後方互換のため残す（`AdminView.vue` の DONE ボタンは削除/変更対象）。
- **Implications**: `ResultService.advanceRevealPhase()` が revealPhase=3 になる際に event.phase も更新する。既存の `eventService.advancePhase()` への依存は不要。

---

## Architecture Pattern Evaluation

| オプション | 説明 | 強み | リスク／制約 |
|---|---|---|---|
| Option A: 既存拡張のみ | `event-service.ts` に順位計算追加、`AdminView` に発表UI追加 | 新ファイル最小限 | `event-service.ts` が肥大化、関心事の混在 |
| Option B: 新規のみ | 全機能を新ファイルで実装 | 完全分離 | 既存の共通基盤（SSE・認証）との重複が生じる可能性 |
| **Option C: ハイブリッド（採用）** | 新規ロジックは新ファイル、共通基盤は既存を活用 | 関心分離と変更範囲のバランスが最適 | DBマイグレーション必須、ファイル数増加 |

---

## Design Decisions

### Decision: ボーダー判定ロジック

- **Context**: ボーダー（入れ替え対象）の定義が要件に明示されていない
- **Alternatives Considered**:
  1. ハードコード方式 — 「1軍4名・2軍4名・ボーダー4名」などを設定値で管理
  2. ランクスロット方式 — チーム別人数から動的にスロットを計算
- **Selected Approach**: ランクスロット方式。非欠席FIRST人数 F、非欠席SECOND人数 S をカウントし、全ランキングの上位 F 枠を「1軍スロット」として分類する
- **Rationale**: チーム人数が変動しても設定変更不要。自然なゼロコンフィグ動作
- **Trade-offs**: チームが不均等（FIRST 3名・SECOND 9名など）の場合でも論理的に一貫して動作する
- **Follow-up**: 実装時に欠席者数が多い場合（F=0 や S=0）のエッジケースを単体テストで確認

### Decision: revealPhase 永続化

- **Selected Approach**: `events.revealPhase INTEGER NOT NULL DEFAULT 0` カラム追加
- **Rationale**: 後方互換、変更範囲最小、役割分離（大会フェーズ vs 発表サブフェーズ）

### Decision: phase_update SSEペイロード拡張

- **Selected Approach**: 既存 `PhaseUpdatePayload` に `revealPhase?: number` を追加
- **Rationale**: オプショナル追加のため既存リスナーに影響なし

---

## Risks & Mitigations

- SSE再接続3回超での状態不整合 — ResultRevealView に「再接続中…」インジケーターを表示し、マニュアルリロードを促す
- 欠席者数が多く FIRST/SECOND いずれかが全員欠席 — ResultService でゼロ除算・空配列を安全に処理するガード節を追加
- revealPhase の DB 永続化前にサーバークラッシュ — アトミックな DB UPDATE → broadcast の順序を維持し、再接続後の GET /result で正確な状態を取得できるよう設計

---

## References

- [Drizzle ORM - SQLite column types](https://orm.drizzle.team/docs/column-types/sqlite) — `integer()` の追加方法
- [Hono SSE](https://hono.dev/docs/helpers/streaming) — `streamSSE` の使い方
- gap-analysis.md — 実装可能性分析と推奨アプローチ（本ドキュメントの起点）
