# 実装計画

## タスク一覧

- [x] 1. ProfileService の実装
- [x] 1.1 getProfile ビジネスロジックを実装する
  - `players` テーブルから指定 ID のプレイヤーを1件取得し、存在しない場合は `null` を返す
  - `scores INNER JOIN events` で `submitted = true`・`heldAt` 降順・最大5件のスコアを取得する
  - `absent = true` のエントリは `{ absent: true }` として返し、勝率を計算しない
  - `absent = false` かつ `wins + losses > 0` の場合、勝率を `wins / (wins + losses)` × 100 で計算し小数点以下1桁に丸める
  - `wins + losses = 0` の場合は `winRate = 0.0` として返す（ゼロ除算を明示的にハンドリング）
  - `getProfile(playerId)` が存在するIDで `PlayerProfileResponse` 型の値を返し、存在しないIDで `null` を返す
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 4.4_

- [x] 1.2 ProfileService のユニットテストを実装する
  - `submitted = true` のスコア5件がある通常プレイヤーで `winRateHistory` が5件返ることを検証する
  - `absent = true` のエントリが混在する場合に該当エントリが `{ absent: true }` で返ることを検証する
  - スコアが5件未満の場合に実際の件数のみ返ることを検証する
  - 存在しない `playerId` で `null` が返ることを検証する
  - `wins + losses = 0` の場合に `winRate = 0.0` が返ることを検証する
  - 全テストが passing となる
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.4_

- [x] 2. playersRoute の修正（認証ガードとプロフィールエンドポイント）
- [x] 2.1 認証ガードを全エンドポイントに適用し、プロフィールエンドポイントを追加する
  - `use('/*', authMiddleware)` パターンで全エンドポイントに認証ガードを適用する
  - `GET /:id/profile` ルートハンドラを追加し、`ProfileService.getProfile(id)` を呼び出す
  - `getProfile` が `null` を返した場合は HTTP 404 を返す
  - `PlayerProfileResponse` を JSON として返し、Hono RPC の型推論で `AppType` に反映される
  - 未認証リクエストが `GET /api/players` および `GET /api/players/:id/profile` の両方に対して 401 を返す
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.2 playersRoute の統合テストを実装する
  - `GET /api/players`：認証あり → 200 + `PlayerListItem[]`、認証なし → 401 を検証する
  - `GET /api/players/:id/profile`：認証あり・存在するID → 200 + `PlayerProfileResponse` を検証する
  - `GET /api/players/:id/profile`：認証あり・存在しないID → 404 を検証する
  - `GET /api/players/:id/profile`：認証なし → 401 を検証する
  - 全テストが passing となる
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [x] 3. フロントエンドコア実装（Composables・UIコンポーネント・ルーター）
- [x] 3.1 (P) useGroupProfile composable を実装する
  - `onMounted` 時に `GET /api/players` を呼び出し、`team` フィールドで `firstTeam`・`secondTeam` に分類する
  - `isLoading` と `error` のリアクティブ状態を管理し、取得失敗時に `error` にメッセージを設定する
  - `isLoading = true` の間は `refresh()` を early return して重複呼び出しを防ぐ
  - `firstTeam`・`secondTeam`・`isLoading`・`error` が GroupView から参照可能な状態になる
  - _Requirements: 1.1, 1.5_
  - _Boundary: useGroupProfile_

- [x] 3.2 (P) usePlayerProfile composable を実装する
  - `watchEffect` または `onMounted` で `playerId` を監視し、`GET /api/players/:id/profile` を呼び出す
  - 404 レスポンス時に `notFound.value = true` を設定し、`profile.value = null` にする
  - `isLoading`・`error`・`notFound`・`profile` のリアクティブ状態を提供する
  - `profile`・`isLoading`・`error`・`notFound` が ProfileView から参照可能な状態になる
  - _Requirements: 2.1, 2.2, 2.3, 2.6_
  - _Boundary: usePlayerProfile_

- [x] 3.3 (P) PlayerCard UIコンポーネントを実装する
  - `RouterLink` を使用して `/profile/${player.id}` へ遷移するカードリンクを実装する
  - `team === 'FIRST'` は `yellow-400` テキストの「1軍」バッジ、`'SECOND'` は `bg-main` の「2軍」バッジを表示する
  - `title === null` の場合は「未設定」（`text-gray-400`）として表示する
  - `mainUnit === null` の場合は「未設定」（`text-gray-400`）として表示する
  - カード背景 `bg-dark`・ボーダー `border-main` のダークテーマで全パターンが正しく表示される
  - _Requirements: 1.3, 1.4, 2.4, 2.5, 5.2, 5.4_
  - _Boundary: PlayerCard_

- [x] 3.4 (P) WinRateHistory UIコンポーネントを実装する
  - `absent: true` のエントリに「欠席」テキスト（`text-gray-400`）を表示し、バーを描画しない
  - `absent: false` のエントリに勝率テキスト（例: `68.5%`）と、`winRate` 値を幅とするインラインスタイルでバーを描画する
  - バーの色は `bg-main`（通常）・`bg-accent`（100%時）で表示する
  - 最新エントリを先頭にリスト形式で全エントリが表示される
  - _Requirements: 3.3, 3.5_
  - _Boundary: WinRateHistory_

- [x] 3.5 (P) ルーターと BottomNav を更新する
  - フロントエンドルーターの `/profile` ルートを `/profile/:id` に変更する
  - BottomNav のプロフィールタブのリンクを `currentPlayer.value?.playerId` を使用して動的化する
  - `/profile/:id` へ直接アクセスしたとき、ProfileView が `route.params.id` を受け取れる状態になる
  - _Requirements: 1.4, 5.3_
  - _Boundary: Router, BottomNav_

- [ ] 4. View 画面の本実装
- [ ] 4.1 GroupView を本実装する
  - `useGroupProfile` を初期化し `firstTeam`・`secondTeam`・`isLoading`・`error` を受け取る
  - `isLoading = true` の間はローディングスピナーを表示する
  - `error` が存在する場合はエラーメッセージを表示する
  - 1軍（FIRST TEAM）・2軍（SECOND TEAM）の2セクションを `bg-dark` パネル内に表示し、各セクションに `PlayerCard` を一覧表示する
  - 既存の `AppLayout`（`max-w-[430px]`・`pb-16`）でスマートフォン縦画面に最適化されたレイアウトで表示される
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3_
  - _Depends: 3.1, 3.3, 3.5_

- [ ] 4.2 ProfileView を本実装する
  - `useRoute().params.id` から `playerId` を取得し `usePlayerProfile(playerId)` を初期化する
  - `isLoading = true` の間はローディングスピナーを表示する
  - `notFound = true` の場合に「プレイヤーが見つかりません」メッセージと戻るボタンを表示する
  - プレイヤー情報セクション（名前・チームバッジ・称号・主使用機体）と勝率推移セクション（`WinRateHistory` コンポーネント）で画面が構成される
  - `title`・`mainUnit` が `null` の場合に「未設定」を表示し、スマートフォン縦画面に最適化されたダークテーマレイアウトで表示される
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2_
  - _Depends: 3.2, 3.4, 3.5_

- [ ]* 4.3 GroupView のUIテストを実装する
  - 1軍・2軍セクションが正しく表示されることを検証する（Req 1.2）
  - ローディング中にスピナーが表示されることを検証する（Req 2.3 に対応する GroupView 側挙動）
  - エラー時にメッセージが表示されることを検証する（Req 1.5）
  - _Requirements: 1.2, 1.5_
  - _Depends: 4.1_

- [ ]* 4.4 ProfileView・WinRateHistory のUIテストを実装する
  - ProfileView でプレイヤー情報が表示されることを検証する（Req 2.1）
  - `notFound = true` の場合に「プレイヤーが見つかりません」が表示されることを検証する（Req 2.6）
  - WinRateHistory で欠席エントリに「欠席」テキストが表示されることを検証する（Req 3.3）
  - _Requirements: 2.1, 2.6, 3.3_
  - _Depends: 4.2_
