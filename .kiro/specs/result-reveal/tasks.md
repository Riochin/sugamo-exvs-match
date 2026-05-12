# Implementation Plan

- [x] 1. Foundation: DBスキーマ変更とマイグレーション
- [x] 1.1 eventsテーブルにrevealPhaseカラムを追加してマイグレーションを適用する
  - events テーブルに `reveal_phase INTEGER NOT NULL DEFAULT 0` カラムを追加する
  - drizzle-kit でマイグレーションファイルを生成し、Turso に適用する
  - 既存レコードには DEFAULT 0 が設定され、既存 API が継続動作することを確認する
  - マイグレーション適用後、schema.ts の型推論が revealPhase フィールドを含む状態になること
  - _Requirements: 2.6_

- [x] 2. バックエンドサービス：ResultService実装
- [x] 2.1 全プレイヤーの順位計算とグループ分類ロジックを実装する
  - result-service.ts を新規作成し、scores テーブルから各プレイヤーの wins/losses/absent を集計する
  - 勝率（wins/(wins+losses)、0/0 は 0.0）降順、同勝率の場合は勝利数降順で順位を付与する
  - FIRST/SECOND チームの非欠席人数 F/S を集計し、rank<=F を1軍スロット・rank>F を2軍スロットとして判定する
  - チームとスロットの組み合わせで FIRST_STAY / SECOND_STAY / BORDER（PROMOTION/RELEGATION）に分類する
  - 欠席者は rank=null, group=null, borderDirection=null として返す
  - F=0 または S=0 のエッジケースで全員 group:null を返しても安全に動作すること
  - getRevealResult を呼び出すと正しくソートされた PlayerResult[] を含む RevealResult が返ること
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: ResultService_

- [x] 2.2 結果データ取得・フェーズ進行制御・DONE自動遷移を実装する
  - getRevealResult(eventId) メソッドで events/scores/players を結合して RevealResult を組み立てる
  - events.phase が DONE の場合も revealPhase を含む正常な結果を返す（6.3 を満たす）
  - advanceRevealPhase(eventId) メソッドで revealPhase をインクリメントして DB に保存する
  - revealPhase === 3 のとき events.phase を 'DONE' に自動更新する
  - events.phase が 'REVEALING' でない場合は PHASE_NOT_REVEALING エラーを返す
  - revealPhase が既に 3 の場合は REVEAL_PHASE_MAXED エラーを返す
  - advanceRevealPhase 成功後に { revealPhase, eventPhase } を返すこと
  - _Requirements: 2.3, 2.6, 4.4, 6.1, 6.3_
  - _Boundary: ResultService_

- [x] 3. バックエンドAPI：resultRouteエンドポイント実装
- [x] 3.1 結果データ取得APIエンドポイントを実装する
  - result.ts を新規作成し、GET /api/events/:id/result を authMiddleware で保護して実装する
  - ResultService.getRevealResult を呼び出し RevealResult を JSON で返す
  - EVENT_NOT_FOUND の場合は 404、未認証は 401 を返す
  - resultRoute を backend/src/index.ts で `/api/events` プレフィックス配下に登録する
  - GET /api/events/:id/result に認証ありでアクセスすると 200 と RevealResult が返ること
  - _Requirements: 4.4, 4.5, 6.3_
  - _Boundary: resultRoute_

- [x] 3.2 フェーズ進行APIエンドポイントを実装する
  - PATCH /api/events/:id/reveal-phase を authMiddleware + adminMiddleware で保護して実装する
  - ResultService.advanceRevealPhase を呼び出し { revealPhase, eventPhase } を返す
  - PHASE_NOT_REVEALING / REVEAL_PHASE_MAXED の場合は 409 を返す
  - 成功時に hub.broadcast で phase_update SSEイベント（eventId, phase, revealPhase を含む）を全クライアントへブロードキャストする
  - 管理者が PATCH すると DB の revealPhase がインクリメントされ、全クライアントに phase_update SSEが配信されること
  - _Requirements: 2.3, 2.5, 6.1_
  - _Boundary: resultRoute_

- [ ] 4. フロントエンド基盤：SSEペイロード拡張とルーティング設定
- [ ] 4.1 (P) SSE phase_updateペイロードにrevealPhaseフィールドを追加する
  - useEventStream.ts の PhaseUpdatePayload 型に `revealPhase?: number` フィールドを追加する
  - オプショナル追加のため既存コードへの後方互換性を保つ
  - phase_update イベント受信時に revealPhase フィールドに型安全にアクセスできること
  - _Requirements: 3.1_
  - _Boundary: useEventStream_

- [ ] 4.2 (P) 結果発表ページのルート定義とナビゲーションガードを追加する
  - router/index.ts に `/events/:id/result` ルートを追加する（`requiresAuth: true, layout: 'plain'`）
  - 未認証アクセスでログインページへリダイレクトされること
  - layout: 'plain' メタにより App.vue の BottomNav が非表示になること
  - _Requirements: 1.5, 5.6_
  - _Boundary: Router_

- [ ] 5. フロントエンドコンポーザブル：useResultReveal実装
- [ ] 5.1 結果データ取得・初期フェーズ同期・状態管理を実装する
  - useResultReveal.ts を新規作成し、result・revealPhase・eventPhase・isConnected・isLoading・error のリアクティブ状態を定義する
  - initialize(eventId) で GET /api/events/:id/result を呼び出し revealPhase・eventPhase・players を初期化する
  - その後 useEventStream().connect(eventId) でSSE接続を開始する
  - phase_update SSEイベントを受信したら revealPhase と eventPhase の状態を更新する
  - eventPhase が DONE の場合は revealPhase を 3 として扱う状態管理を実装する
  - initialize 完了後に revealPhase・eventPhase・players が正しく設定されていること
  - _Requirements: 2.1, 3.2, 3.5, 6.4_
  - _Boundary: useResultReveal_

- [ ] 5.2 SSE切断検知・自動再接続・再接続後フェーズ同期を実装する
  - EventSource.onerror を検知したら接続をクローズし指数バックオフ（`2^(retryCount-1) * 1000ms`）で再接続を試みる
  - 最大3回の再接続試行を実施し、超過時は isConnected=false のままエラーメッセージを設定する
  - 再接続成功後に GET /api/events/:id/result を呼び出して revealPhase を現在フェーズに同期する
  - 3回失敗後に isConnected=false となり error 状態に「ページをリロードしてください」メッセージが設定されること
  - _Requirements: 3.3, 3.4_
  - _Boundary: useResultReveal_

- [ ] 5.3 フェーズ進行操作・ローディング制御・クリーンアップを実装する
  - advancePhase() で PATCH /api/events/:id/reveal-phase を呼び出す
  - 呼び出し中は isLoading=true にして二重送信を防ぐ
  - PATCH 失敗時は error 状態にエラーメッセージを設定する
  - onUnmounted で cleanup() を呼び出し EventSource を確実にクローズする
  - advancePhase() 成功後に revealPhase が更新されること
  - _Requirements: 2.4, 6.2_
  - _Boundary: useResultReveal_

- [ ] 6. (P) ResultCardプレイヤーカードコンポーネントを実装する
  - components/result/ResultCard.vue を新規作成し、`player: PlayerResult` と `rank: number | null` を Props として受け取る
  - プレイヤー名・今大会の勝敗数（wins-losses）・最終順位を表示する
  - borderDirection が PROMOTION の場合は yellow-400 の上向き矢印インジケーターを表示する
  - borderDirection が RELEGATION の場合は accent 色（#c20e00）の下向き矢印インジケーターを表示する
  - 各パターンの player props を渡すと正しいUI要素とインジケーターが表示されること
  - _Requirements: 5.4, 5.7_
  - _Boundary: ResultCard_

- [ ] 7. ResultRevealViewページ実装
- [ ] 7.1 没入型フルスクリーンページの基盤・認証ガード・初期化処理を実装する
  - views/ResultRevealView.vue を新規作成し、layout: 'plain' メタで BottomNav を非表示にする
  - bg-[#090014] ダークテーマの全画面レイアウトを実装する
  - onMounted で useResultReveal.initialize(route.params.id) を呼び出す
  - eventPhase が 'COLLECTING' の場合は router.replace('/') でスコア入力ページへリダイレクトする
  - COLLECTING 状態でアクセスするとスコア入力ページへリダイレクトされること
  - _Requirements: 1.4, 5.1, 5.6_
  - _Boundary: ResultRevealView_

- [ ] 7.2 フェーズ別グループ表示・アニメーション演出・情報秘匿を実装する
  - revealPhase に応じて FIRST_STAY（phase>=1）・SECOND_STAY（phase>=2）・BORDER（phase>=3）を v-if/v-show で条件付きレンダリングする
  - 各グループの見出し（「1軍残留」「2軍残留」「ボーダー」）を強調スタイルで表示する
  - Tailwind `transition-all duration-700` とスタガードアニメーション（`index * 100ms` の transition-delay）でフェード・スライド演出を実装する
  - 未開示フェーズのプレイヤー情報は v-if/v-show で非表示にして情報を秘匿する
  - 管理者がフェーズを進めるたびに対応グループがアニメーション付きで出現すること
  - _Requirements: 2.1, 2.2, 5.2, 5.3, 5.5_
  - _Boundary: ResultRevealView_

- [ ] 7.3 管理者フェーズ進行UIとDONE後のCTA表示を実装する
  - currentPlayer.isAdmin が true の場合のみ「次のフェーズへ」ボタンを表示する
  - revealPhase === 3 または eventPhase === 'DONE' のときボタンを disabled にする
  - eventPhase === 'DONE' のとき全ユーザーに Star投票ページへの CTAボタンを表示する
  - DONE 状態では revealPhase を 3 として全グループを開示済み状態で表示する
  - フェーズ3到達後に管理者ボタンが無効化され、Star投票CTAが全ユーザーに表示されること
  - _Requirements: 2.4, 6.2, 6.4_
  - _Boundary: ResultRevealView_

- [ ] 8. 既存コンポーネントの変更
- [ ] 8.1 (P) TournamentViewにresult_ready受信時の強制遷移ロジックを追加する
  - TournamentView.vue に `watch(resultReady)` を実装し、result_ready SSEイベント受信時に `router.replace('/events/${eventId}/result')` を呼び出す（要件1.1のブロードキャストは score-entry スペックの scoreService が担当済み）
  - router.replace を使用することで戻るボタンによる手動ナビゲーションを無効化する
  - result_ready 受信後に TournamentView から ResultRevealView へ自動遷移すること
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: TournamentView_

- [ ] 8.2 (P) AdminViewのREVEALINGフェーズ管理ボタンを削除する
  - AdminView.vue から REVEALING フェーズの「DONE へ」ボタンを削除する
  - フェーズ進行制御は resultRoute の /reveal-phase エンドポイントに移管されるため不要になる
  - AdminView で REVEALING フェーズに不要なボタンが表示されなくなること
  - _Requirements: 2.3_
  - _Boundary: AdminView_

- [ ] 9. テスト実装
- [ ] 9.1 (P) ResultServiceのユニットテストを実装する
  - 勝利数降順・勝率二次ソートによる正確なランキング算出を検証する
  - 標準ケースで FIRST_STAY / SECOND_STAY / BORDER（PROMOTION・RELEGATION）の分類が正しいことを確認する
  - 欠席者を含む場合の分類（欠席者は group=null）を検証する
  - F=0 または S=0 のエッジケースで安全に空の分類結果が返ることを確認する
  - すべてのユニットテストがパスすること
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: ResultService_

- [ ] 9.2 (P) resultRouteのインテグレーションテストを実装する
  - GET /api/events/:id/result：認証あり→200・未認証→401・不明ID→404 を検証する
  - PATCH /api/events/:id/reveal-phase：管理者→200・非管理者→403・phase3済み→409 を検証する
  - revealPhase=3 のとき event.phase が DONE に更新されることを確認する
  - PATCH 成功時に phase_update SSEイベントがブロードキャストされることを確認する
  - すべてのインテグレーションテストがパスすること
  - _Requirements: 2.5, 4.4, 4.5, 6.1_
  - _Boundary: resultRoute_

- [ ]* 9.3 useResultRevealのユニットテストを実装する
  - SSE再接続ロジック（1回成功・3回失敗・再接続後フェーズ同期）を検証する
  - initialize が revealPhase を正しく初期化することを確認する
  - advancePhase 失敗時に error 状態が設定されることを確認する
  - すべてのユニットテストがパスすること
  - _Requirements: 3.3, 3.4_
  - _Boundary: useResultReveal_
