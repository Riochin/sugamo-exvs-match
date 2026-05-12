# 要件定義書

## Project Description (Input)
1軍/2軍一覧・個人プロフィール（称号・主使用機体・直近5回勝率推移）

## はじめに

本スペック「group-profile」は、月例下剋上決定戦管理Webアプリにおける1軍（FIRST TEAM）・2軍（SECOND TEAM）のプレイヤー一覧表示と、各プレイヤーの個人プロフィール（称号・主使用機体・直近5回の勝率推移）の閲覧機能を定義する。

既存の `players` テーブル（`team: FIRST/SECOND`・`title`・`mainUnit`）と `scores` テーブル（`wins`・`losses`・`absent`・`submitted`）を活用し、フロントエンドに一覧・詳細画面を提供する。

## スコープ境界

- **対象**: 1軍/2軍一覧画面、個人プロフィール画面、勝率推移計算API
- **対象外**: チーム所属の変更・昇格/降格処理（result-reveal スペックで扱う）、称号・主使用機体の管理者による編集
- **隣接スペック**: `auth`（認証状態の依存）、`score-entry`（勝敗スコアデータの供給元）

## Requirements

### Requirement 1: グループ一覧表示

**Objective:** プレイヤーとして、1軍・2軍に所属するメンバーを一目で確認したい。そうすることで、現在のチーム編成をすばやく把握できる。

#### Acceptance Criteria

1. When グループ一覧ページが表示されたとき、the Group Profile Service shall 1軍（FIRST TEAM）と2軍（SECOND TEAM）それぞれのプレイヤーリストをAPIから取得して表示する。
2. The Group Profile Service shall 1軍と2軍を視覚的に区別できるよう別セクションとして表示する。
3. The Group Profile Service shall 各プレイヤーの名前・称号（設定済みの場合）・主使用機体（設定済みの場合）を一覧項目として表示する。
4. When プレイヤー項目がタップされたとき、the Group Profile Service shall 対象プレイヤーの個人プロフィール画面へ遷移する。
5. If データ取得に失敗したとき、the Group Profile Service shall エラーメッセージを表示する。

### Requirement 2: 個人プロフィール表示

**Objective:** プレイヤーとして、特定メンバーの詳細プロフィールを確認したい。そうすることで、そのメンバーのゲームスタイルや実力傾向を把握できる。

#### Acceptance Criteria

1. When 個人プロフィール画面が表示されたとき、the Group Profile Service shall プレイヤーの名前・所属チーム・称号・主使用機体を表示する。
2. The Group Profile Service shall プレイヤーの直近5回の勝率推移データを取得して表示する。
3. While プロフィールデータを取得中のとき、the Group Profile Service shall ローディングインジケーターを表示する。
4. Where 称号が未設定のとき、the Group Profile Service shall 称号欄を「未設定」として表示する。
5. Where 主使用機体が未設定のとき、the Group Profile Service shall 主使用機体欄を「未設定」として表示する。
6. If 存在しないプレイヤーIDが指定された場合、the Group Profile Service shall 404エラー画面を表示する。

### Requirement 3: 勝率推移の計算と表示

**Objective:** プレイヤーとして、直近5回の大会における勝率の変化を確認したい。そうすることで、成長や調子の傾向を把握できる。

#### Acceptance Criteria

1. The Group Profile Service shall 直近5回の大会（`submitted = true` のスコアのみ対象）を、大会開催日時（`held_at`）の降順で取得する。
2. The Group Profile Service shall 勝率を「wins ÷ (wins + losses)」で計算し、パーセンテージ（小数点以下1桁）として返す。
3. Where プレイヤーが欠席（`absent = true`）した大会のとき、the Group Profile Service shall 該当大会を勝率計算の対象から除外し、「欠席」として表示する。
4. If 対象の大会が5回未満のとき、the Group Profile Service shall 実際に存在する回数分のデータのみ表示する（不足分を埋めない）。
5. The Group Profile Service shall 勝率推移をグラフまたはリスト形式で視覚的に表示する。

### Requirement 4: データ提供 API

**Objective:** フロントエンドとして、グループ一覧・個人プロフィール・勝率推移データを型安全に取得したい。そうすることで、画面表示に必要な情報を少ないAPI呼び出しで得られる。

#### Acceptance Criteria

1. The Group Profile Service shall `GET /api/players` エンドポイントで全プレイヤーの名前・称号・主使用機体・チームを返す（既存エンドポイントの拡張または活用）。
2. The Group Profile Service shall `GET /api/players/:id/profile` エンドポイントで個人プロフィール（名前・称号・主使用機体・直近5回の勝率推移）を返す。
3. The Group Profile Service shall APIレスポンスの型をHono RPCクライアントで型安全に共有する。
4. If 存在しないプレイヤーIDが指定された場合、the Group Profile Service shall HTTPステータス404を返す。
5. The Group Profile Service shall 認証済みユーザーのみがプロフィールAPIにアクセスできるよう認証ガードを適用する。

### Requirement 5: UI/UX デザイン

**Objective:** プレイヤーとして、ゲームセンターでスマートフォンから素早く一覧と詳細を確認したい。そうすることで、短時間で必要な情報を得られる。

#### Acceptance Criteria

1. The Group Profile Service shall スマートフォン縦画面に最適化したレイアウトで一覧・詳細画面を表示する。
2. The Group Profile Service shall プロジェクト共通のダークテーマ（`bg-dark: #12002b`・`bg-main: #2b008e`・アクセント`#c20e00`）を適用する。
3. The Group Profile Service shall ボトムナビゲーションからグループ一覧ページへアクセスできるよう導線を設ける。
4. When プレイヤーカードを表示するとき、the Group Profile Service shall 1軍/2軍のチームバッジを視覚的に識別できる形で表示する。
