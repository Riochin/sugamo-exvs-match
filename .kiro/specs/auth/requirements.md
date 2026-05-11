# Requirements Document

## Project Description (Input)
auth

## Introduction

本スペックは「機動戦士ガンダムEXVS 2 Infinite Boost」月例下剋上決定戦管理Webアプリにおける認証UI（ログイン・ログアウト）を対象とする。バックエンド認証基盤（JWT・PIN検証・HttpOnly Cookie）は foundation スペックで実装済みであり、本スペックではフロントエンドのログインフロー・認証状態管理・ルートガードを扱う。

## Boundary Context

- **In scope**: プレイヤー名選択画面・PIN入力画面・認証状態管理（Vue composable）・ルートガード・ログアウト機能
- **Out of scope**: バックエンド認証ロジック（foundation スペック完了済み）・プレイヤー登録・PIN変更
- **Adjacent expectations**: `GET /api/players`・`POST /api/auth/login`・`POST /api/auth/logout` エンドポイントは foundation スペックで実装済みであることを前提とする

## Requirements

### Requirement 1: プレイヤー選択

**Objective:** プレイヤーとして、一覧からプレイヤー名を選択してログインを開始したい。筐体前での素早い認証が目的のため、手入力を不要にしたい。

#### Acceptance Criteria

1. When ログイン画面が表示される, the 認証UIシステム shall `GET /api/players` を呼び出し全プレイヤー一覧を取得して表示する
2. When プレイヤーが一覧から名前を選択する, the 認証UIシステム shall PIN入力ステップへ遷移する
3. If `GET /api/players` がエラーを返す, the 認証UIシステム shall エラーメッセージを表示しリトライボタンを提供する
4. While プレイヤー一覧取得中, the 認証UIシステム shall ローディング表示を行う
5. The 認証UIシステム shall プレイヤー一覧をタップしやすいカード/リスト形式で表示する

### Requirement 2: PIN入力

**Objective:** プレイヤーとして、4桁のPINを入力して本人確認を完了させたい。スマートフォン上で素早く入力できる操作性を求める。

#### Acceptance Criteria

1. When プレイヤー名が選択される, the 認証UIシステム shall 選択されたプレイヤー名を表示した上でPIN入力UIを表示する
2. When 4桁のPINが入力完了する, the 認証UIシステム shall `POST /api/auth/login` へ `playerName` と `pin` を送信する
3. When ログインAPIが成功を返す, the 認証UIシステム shall 認証済み状態に遷移しログイン前にアクセスしていた画面または大会タブへリダイレクトする
4. If ログインAPIが401を返す, the 認証UIシステム shall 「プレイヤー名またはPINが正しくありません」というエラーメッセージを表示しPIN入力をクリアする
5. If ログインAPIが400を返す, the 認証UIシステム shall 「入力内容に誤りがあります」というエラーメッセージを表示する
6. When プレイヤー名選択へ戻る操作が行われる, the 認証UIシステム shall プレイヤー選択ステップへ戻る
7. The 認証UIシステム shall PIN入力に数字専用の入力方式（数字キーパッドまたは `inputmode="numeric"`）を使用する
8. While ログインAPIへのリクエスト中, the 認証UIシステム shall 送信ボタンを無効化しローディング表示を行う

### Requirement 3: 認証状態管理

**Objective:** プレイヤーとして、ログイン状態がページ遷移やリロードを超えて保持されてほしい。毎回PINを入力し直す手間を避けたい。

#### Acceptance Criteria

1. When ログインが成功する, the 認証UIシステム shall プレイヤーID・プレイヤー名を含む認証状態をリアクティブな状態として保持する
2. When アプリが初回ロードされる, the 認証UIシステム shall バックエンドAPIへ現在のセッション状態を問い合わせて認証状態を復元する
3. The 認証UIシステム shall 認証状態（ログイン中のプレイヤー情報・ログイン済みフラグ）をアプリ全体から参照できるcomposableとして提供する
4. If セッション確認リクエストが401を返す, the 認証UIシステム shall 未認証状態にリセットする

### Requirement 4: ルートガード

**Objective:** システムとして、未認証のユーザーが認証必須画面にアクセスできないよう制御したい。

#### Acceptance Criteria

1. When 未認証状態のユーザーが認証必須ルートへアクセスする, the 認証UIシステム shall ログイン画面へリダイレクトする
2. When 認証済みユーザーがログイン画面へアクセスする, the 認証UIシステム shall 大会タブへリダイレクトする
3. The 認証UIシステム shall ルートメタデータで認証要否を宣言できる仕組みを提供し、Vue Router のナビゲーションガードで評価する

### Requirement 5: ログアウト

**Objective:** プレイヤーとして、必要に応じてログアウトできる手段が欲しい。別のプレイヤーが同じ端末を使ってログインできるようにしたい。

#### Acceptance Criteria

1. When ログアウト操作が実行される, the 認証UIシステム shall `POST /api/auth/logout` を呼び出す
2. When ログアウトAPIが成功を返す, the 認証UIシステム shall 認証状態をクリアしログイン画面へ遷移する
3. If ログアウトAPIがエラーを返す, the 認証UIシステム shall ローカルの認証状態をクリアしてログイン画面へ遷移する

### Requirement 6: データ初期化（プレイヤーseed）

**Objective:** 開発者として、プレイヤーデータをDBに投入するseedスクリプトが欲しい。ログインフローが動作するためにはプレイヤーレコードが事前に存在している必要がある。

#### Acceptance Criteria

1. The システム shall `backend/src/db/seed.ts` にプレイヤーデータをDBへ投入するスクリプトを提供する
2. When seedスクリプトが実行される, the システム shall 各プレイヤーのPINをbcryptjsでハッシュ化してからDBに保存する
3. When seedスクリプトが実行され対象プレイヤーが既にDBに存在する場合, the システム shall エラーなくスキップまたはupsertし冪等に動作する
4. The システム shall `pnpm --filter backend db:seed` コマンドでseedスクリプトを実行できるnpmスクリプトを提供する
