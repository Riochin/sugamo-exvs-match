# Project Structure

## Organization Philosophy

フロントエンド（Vue SPA）とバックエンド（Hono API）をモノレポで管理する想定。関心事（features / domains）ごとにファイルを束ねるフィーチャーファースト構成を基本とする。

## Directory Patterns

### フロントエンド (`/frontend/` または `/client/`)

- `src/views/` — ページ単位のコンポーネント（Tab画面、結果発表Overlay等）
- `src/components/` — 再利用可能なUIコンポーネント
- `src/composables/` — Vue Composition API のロジック分離（SSEクライアント等）
- `src/api/` — Hono RPC Clientを使ったAPIコール層

### バックエンド (`/backend/` または `/server/`)

- `src/routes/` — Honoのルートハンドラ（ドメインごとに分割）
- `src/services/` — ビジネスロジック（Star投票バリデーション、順位計算等）
- `prisma/` — `schema.prisma` と seedスクリプト

## Naming Conventions

- **Vueコンポーネント**: PascalCase（`ResultCard.vue`）
- **composables**: `use` プレフィックス + camelCase（`useEventStream.ts`）
- **Honoルート**: kebab-caseのエンドポイントパス（`/api/events/:id/submit`）
- **Prismaモデル**: PascalCase（`Player`, `Event`, `Score`, `Star`）

## Import Organization

```typescript
// フロントエンド: 絶対パスエイリアスを優先
import { useEventStream } from '@/composables/useEventStream'
import ResultCard from '@/components/ResultCard.vue'

// 同一モジュール内: 相対パス
import { calcWinRate } from './utils'
```

**Path Aliases**:
- `@/`: フロントエンドの `src/` ディレクトリにマップ

## Code Organization Principles

- **SSEとReactive State**: SSEイベント受信はcomposable層で処理し、Vueのリアクティブ状態（ref/reactive）に変換してからViewへ渡す。
- **型の流れ**: `prisma/schema.prisma` → Prisma生成型 → Honoルート → Hono RPCクライアント → Vueコンポーネント。手書きの型定義を挟まない。
- **ビジネスルール**: Star投票の上限チェック（1人最大3個/大会）・自己投票禁止・欠席フラグ処理はすべてHonoのservice層で実装。フロントは制御しない。

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
