# 要件定義書

## はじめに

`event-management` は「機動戦士ガンダムEXVS 2 Infinite Boost」月例下剋上決定戦において、大会の作成・参加者管理・フェーズ遷移・管理者画面を提供する機能である。管理者は大会を作成し、成績収集フェーズ（`COLLECTING`）から結果発表フェーズ（`REVEALING`）、完了フェーズ（`DONE`）へと手動で遷移させる。フェーズ変更は SSE 経由で全接続クライアントにリアルタイムで通知される。

## スコープ境界

- **対象**: 大会の作成、欠席管理、フェーズ遷移（`COLLECTING → REVEALING → DONE`）、管理者画面 UI、フェーズ変更の SSE ブロードキャスト、大会一覧・詳細 API
- **対象外**: 成績入力 UI（`score-entry` スペック）、段階的順位発表演出（`result-reveal` スペック）、Star 投票（`star-voting` スペック）
- **隣接スペックへの期待**: `score-entry` は `COLLECTING` フェーズ中に動作する。`result-reveal` は `REVEALING` フェーズへの遷移をトリガーとして起動する。`api-integration` が提供する Hono RPC クライアントと `useEventStream` composable を前提とする。

## 要件

### 要件 1: 大会作成

**目的:** 管理者として、月例大会を新規作成したい。そうすることで、参加プレイヤーが成績を入力できる場を設定できる。

#### 受け入れ基準

1. When 管理者が開催日時を指定して大会作成を要求した, the Event Management Service shall 新しい大会レコードを `COLLECTING` フェーズで作成し、一意の ID を割り当てて返す
2. When 大会が作成された, the Event Management Service shall 全登録プレイヤーの `scores` レコードを `wins=0, losses=0, absent=false` の初期状態で一括作成する
3. If `COLLECTING` または `REVEALING` フェーズの大会がすでに存在する, the Event Management Service shall 新規作成を拒否し、エラーを返す
4. If 管理者ロールを持たないプレイヤーが大会作成を要求した, the Event Management Service shall 操作を拒否し 403 エラーを返す
5. The Event Management Service shall 大会作成リクエストに対してバリデーションを実施し、開催日時の不正値は拒否する

### 要件 2: 欠席プレイヤー管理

**目的:** 管理者として、特定プレイヤーの欠席を設定・解除したい。そうすることで、欠席者を除いた正確な成績集計ができる。

#### 受け入れ基準

1. When 管理者が特定プレイヤーの欠席フラグを `true` に設定した, the Event Management Service shall 該当プレイヤーの `scores.absent` を `true` に更新する
2. When 管理者が特定プレイヤーの欠席フラグを `false` に解除した, the Event Management Service shall 該当プレイヤーの `scores.absent` を `false` に更新する
3. While 大会フェーズが `COLLECTING` である, the Event Management Service shall 欠席フラグの変更操作を許可する
4. If 大会フェーズが `COLLECTING` でない, the Event Management Service shall 欠席フラグの変更を拒否しエラーを返す
5. If 管理者ロールを持たないプレイヤーが欠席フラグ変更を要求した, the Event Management Service shall 操作を拒否し 403 エラーを返す

### 要件 3: フェーズ遷移管理

**目的:** 管理者として、大会フェーズを手動で遷移させたい。そうすることで、成績収集完了後に結果発表フェーズへ移行できる。

#### 受け入れ基準

1. When 管理者が `COLLECTING → REVEALING` のフェーズ遷移を要求した, the Event Management Service shall 大会の `phase` を `REVEALING` に更新し、SSE `phase_update` イベントを全接続クライアントにブロードキャストする
2. When 管理者が `REVEALING → DONE` のフェーズ遷移を要求した, the Event Management Service shall 大会の `phase` を `DONE` に更新し、SSE `phase_update` イベントを全接続クライアントにブロードキャストする
3. If 要求されたフェーズ遷移が許可順序（`COLLECTING→REVEALING→DONE`）に反する, the Event Management Service shall 遷移を拒否しエラーを返す
4. If `DONE` フェーズの大会に対してフェーズ遷移が要求された, the Event Management Service shall 操作を拒否しエラーを返す
5. If 管理者ロールを持たないプレイヤーがフェーズ遷移を要求した, the Event Management Service shall 操作を拒否し 403 エラーを返す
6. The Event Management Service shall SSE `phase_update` イベントのペイロードに大会 ID と新しいフェーズ値を含める

### 要件 4: 大会情報取得

**目的:** プレイヤーおよび管理者として、現在進行中の大会の状態を取得したい。そうすることで、フェーズに応じた適切な画面を表示できる。

#### 受け入れ基準

1. When 認証済みクライアントが進行中の大会情報を要求した, the Event Management Service shall 最新の大会レコード（`id`、`phase`、`heldAt`）と全参加プレイヤーの成績入力状態を返す
2. If 進行中（`COLLECTING` または `REVEALING` フェーズ）の大会が存在しない, the Event Management Service shall `null` または 404 を返す
3. When 認証済みクライアントが大会一覧を要求した, the Event Management Service shall `DONE` フェーズの大会を開催日時の降順で返す
4. If 未認証のクライアントが大会情報を要求した, the Event Management Service shall 401 エラーを返す
5. The Event Management Service shall 大会一覧レスポンスに各大会の `id`、`phase`、`heldAt` を含める

### 要件 5: 管理者権限制御

**目的:** システム管理者として、特定プレイヤーのみに大会管理操作を許可したい。そうすることで、無許可の操作から大会データを保護できる。

#### 受け入れ基準

1. The Event Management Service shall プレイヤーの管理者フラグ（`isAdmin`）に基づいて大会管理操作を認可する
2. When 管理者フラグを持つプレイヤーがログインしている, the Event Management Service shall 大会作成・欠席管理・フェーズ遷移の各操作を許可する
3. The Event Management Service shall 管理者フラグを持たない一般プレイヤーに大会管理操作への 403 レスポンスを返す
4. The Event Management Service shall 管理者判定を JWT トークンのクレームまたはデータベースのプレイヤーレコードから導出する

### 要件 6: 管理者画面 UI

**目的:** 管理者として、スマートフォンから直感的に大会管理操作を行いたい。そうすることで、ゲームセンターでの大会運営をスムーズに進められる。

#### 受け入れ基準

1. When 管理者ロールのプレイヤーが管理者画面にアクセスした, the Event Management Service shall 現在の大会フェーズ・参加者一覧・欠席状況を表示する
2. While 進行中の大会が存在しない, the Event Management Service shall 管理者画面に大会作成フォームを表示する
3. While 大会フェーズが `COLLECTING` である, the Event Management Service shall 欠席プレイヤー設定 UI と `REVEALING` フェーズへの遷移ボタンを表示する
4. While 大会フェーズが `REVEALING` である, the Event Management Service shall `DONE` フェーズへの遷移ボタンを表示する
5. When 管理者が一般プレイヤーロールでアクセスした, the Event Management Service shall 管理者画面へのアクセスを拒否しリダイレクトする
6. The Event Management Service shall 管理者画面をスマートフォン縦画面（モバイルファースト）向けに最適化し、既存のダークテーマ・カラーパレットを適用する
7. When フェーズ遷移ボタンが押された, the Event Management Service shall 操作完了後に最新の大会状態を再取得して画面を更新する
