# Spec Roadmap

## 完了済み

| スペック | 内容 |
|---|---|
| `foundation` | モノレポ基盤・DBスキーマ・認証バックエンド・Hono API骨格・SSE基盤・Vue SPA骨格 |

## 進行中

| スペック | 内容 |
|---|---|
| `auth` | ログイン/ログアウト UI（プレイヤー名選択 + 4桁PIN） |

## 未着手（推奨順）

| # | スペック | 内容 | 依存 |
|---|---|---|---|
| 1 | `api-integration` | Hono RPC クライアント初期化・`useEventStream` composable（foundation tasks 6.1, 6.2） | foundation, auth |
| 2 | `event-management` | 大会作成・フェーズ遷移（`COLLECTING→REVEALING→DONE`）・管理者画面 | api-integration |
| 3 | `score-entry` | プレイヤーによる勝敗入力・プログレスバー（`progress_update` SSE） | event-management |
| 4 | `result-reveal` | 全員入力完了後の段階的順位発表演出（`result_ready` / `phase_update` SSE） | score-entry |
| 5 | `star-voting` | 3つのStarを分配する投票UI・集計・自己投票禁止 | score-entry |
| 6 | `group-profile` | 1軍/2軍一覧・個人プロフィール（称号・主使用機体・直近5回勝率推移） | — |

## 依存関係

```
api-integration → event-management → score-entry
                                          ↓
                                   result-reveal
                                   star-voting
group-profile（独立して着手可能）
```
