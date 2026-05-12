# Requirements Document

## Introduction

result-reveal機能は、月例下剋上決定戦において全プレイヤーの成績入力が完了した後に実行される段階的な順位発表演出システムです。全員のスマートフォンが一斉に結果発表画面へ強制遷移し、管理者の操作によって「1軍残留」→「2軍残留」→「ボーダー（入れ替え対象）」の順で段階的に順位を開示します。SSEによりリアルタイムで全クライアントの状態を同期し、eスポーツ大会のような緊張感と熱狂体験を提供します。

## Boundary Context

- **In scope**: 全員入力完了後の結果発表ページへの強制遷移、管理者による段階的フェーズ進行制御、SSEを用いた全クライアントへのリアルタイム同期、順位計算と発表グループ分類、結果発表UI演出
- **Out of scope**: スコア入力処理（score-entryスペック）、Star投票UI（star-votingスペック）、大会フェーズ遷移管理（event-managementスペック）
- **Adjacent expectations**: score-entryスペックが全員提出完了を検知し `result_ready` SSEイベントをトリガーする。本スペックはそのイベントを起点とし、完了後にstar-votingへの遷移ポイントを提供する。

## Requirements

### Requirement 1: 全員入力完了後の強制遷移

**Objective:** プレイヤーとして、全員の成績入力が完了したら自動的に結果発表画面へ遷移したい。そうすることで、12名全員が同じタイミングで一斉に結果発表を体験できる。

#### Acceptance Criteria

1. When 全プレイヤーのスコア提出が完了した, the Result Reveal System shall `result_ready` SSEイベントを当該大会の全接続クライアントへブロードキャストする
2. When クライアントが `result_ready` イベントを受信した, the Result Reveal System shall 即座に結果発表ページ（`/events/:id/result`）へ強制遷移する
3. While 強制遷移処理中, the Result Reveal System shall ユーザーの手動ナビゲーション操作を無効化する
4. If 認証済みユーザーが `result_ready` 受信前に結果発表ページへ直接アクセスした, the Result Reveal System shall スコア入力ページへリダイレクトする
5. If ユーザーが未認証の状態で結果発表ページへアクセスした, the Result Reveal System shall ログインページへリダイレクトする

---

### Requirement 2: 段階的発表フェーズの進行制御

**Objective:** 管理者として、結果発表の各フェーズを手動で進行させたい。そうすることで、適切なタイミングと演出で緊張感を高めながら順位を開示できる。

#### Acceptance Criteria

1. The Result Reveal System shall 結果発表ページを初期フェーズ0（全プレイヤー非表示）の状態で表示する
2. The Result Reveal System shall 発表フェーズを以下の4段階で管理する: フェーズ0（待機中）→ フェーズ1（1軍残留を開示）→ フェーズ2（2軍残留を開示）→ フェーズ3（ボーダー・入れ替え対象を開示）
3. When 管理者が「次のフェーズへ進む」操作を実行した, the Result Reveal System shall フェーズ番号をインクリメントし `phase_update` SSEイベントを全接続クライアントへブロードキャストする
4. While 発表フェーズがフェーズ3（最終）に達している, the Result Reveal System shall「次のフェーズへ進む」操作ボタンを無効化する
5. If 管理者権限を持たないユーザーがフェーズ進行APIを呼び出した, the Result Reveal System shall リクエストを拒否し403エラーを返す
6. The Result Reveal System shall 現在のフェーズ状態を大会レコードに永続化する

---

### Requirement 3: リアルタイムフェーズ同期

**Objective:** プレイヤーとして、管理者の操作と同時に自分のスマートフォン上でも発表が更新されたい。そうすることで、12名全員が同じ瞬間に同じ演出を体験できる。

#### Acceptance Criteria

1. When クライアントが `phase_update` イベントを受信した, the Result Reveal System shall 受信したフェーズ番号に対応するプレイヤーグループをアニメーションとともに画面に表示する
2. While 結果発表ページが表示されている, the Result Reveal System shall SSE接続（`/api/stream/events/:id`）を維持する
3. If SSE接続が切断された, the Result Reveal System shall 自動的に再接続を試みる（最大3回、指数バックオフ）
4. When 再接続が成功した, the Result Reveal System shall `GET /api/events/:id/result` から最新フェーズ状態を取得し画面を現在のフェーズに同期する
5. When 結果発表ページを初期表示した, the Result Reveal System shall サーバーから現在のフェーズ状態を取得し、既に開示済みのフェーズを正しく反映した状態で表示する

---

### Requirement 4: 順位計算と発表グループ分類

**Objective:** システムとして、全プレイヤーの提出スコアから最終順位を計算し、発表フェーズに対応するグループへ正確に分類する。

#### Acceptance Criteria

1. The Result Reveal System shall 全プレイヤーの勝利数・敗北数をスコアレコードから集計し、勝利数降順で最終順位を算出する
2. When 複数プレイヤーの勝利数が同一である, the Result Reveal System shall 勝率（勝利数 ÷ 総試合数）を二次ソートキーとして適用する
3. The Result Reveal System shall 算出した順位と現在の所属チーム（1軍/2軍）に基づき、各プレイヤーを「1軍残留」「2軍残留」「ボーダー（入れ替え対象）」のいずれかに分類する
4. The Result Reveal System shall 分類結果・各プレイヤーの今大会成績・最終順位を含む結果データを `GET /api/events/:id/result` エンドポイントから提供する
5. The Result Reveal System shall 結果データを認証済みユーザーのみに返す

---

### Requirement 5: 結果発表UI演出

**Objective:** プレイヤーとして、eスポーツ大会のような緊張感ある演出で結果発表を体験したい。そうすることで、単なる成績確認を超えた熱狂体験が得られる。

#### Acceptance Criteria

1. The Result Reveal System shall ダークテーマ（背景色 `bg-[#090014]`）を使用したフルスクリーンの結果発表画面を提供する
2. When 各フェーズが開示される, the Result Reveal System shall フェード・スライド等のアニメーションエフェクトとともにプレイヤーカードを順次表示する
3. The Result Reveal System shall 各開示フェーズの見出しとしてグループ名（「1軍残留」「2軍残留」「ボーダー」）を強調表示する
4. The Result Reveal System shall 各プレイヤーカードにプレイヤー名・今大会の勝敗・最終順位を表示する
5. While 未開示フェーズのプレイヤーが存在する, the Result Reveal System shall 該当プレイヤーの情報を非表示または伏せた状態で保持し、フェーズ開示前に情報が見えないようにする
6. Where スマートフォン縦画面での表示, the Result Reveal System shall ボトムナビゲーションを非表示にした没入型のフルスクリーンレイアウトで演出を行う
7. The Result Reveal System shall ボーダープレイヤーカードには昇格・降格を示す視覚的インジケーター（色・アイコン）を表示する

---

### Requirement 6: 発表完了後の状態管理

**Objective:** 管理者として、全フェーズの発表完了後にStar投票フェーズへスムーズに移行させたい。そうすることで、大会の進行が途切れずに次のイベントへ続けられる。

#### Acceptance Criteria

1. When 全フェーズ（フェーズ3まで）の発表が完了した, the Result Reveal System shall 大会レコードのフェーズを `REVEALING` から `DONE` へ更新する
2. When 大会フェーズが `DONE` に移行した, the Result Reveal System shall 全クライアントにStar投票ページへの遷移誘導UI（ボタン・通知）を表示する
3. The Result Reveal System shall 発表完了後も全認証済みユーザーが結果一覧を閲覧できる状態を維持する
4. If 大会フェーズが `DONE` の状態で結果発表ページへアクセスした, the Result Reveal System shall 全フェーズを開示済みの状態で結果一覧を表示する
