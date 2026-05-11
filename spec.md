# **システム仕様書 (Tech Spec)**

## **1\. システムアーキテクチャ**

* **Frontend**: Vue 3 (Composition API / TypeScript) \+ Tailwind CSS  
* **Backend**: Hono (TypeScript)  
* **Database**: Turso (Edge SQLite)  
* **ORM**: Prisma  
* **Hosting / CI/CD**: Railway  
* **Type Safety**: Prisma Schema → Hono RPC → Vue へと続く End-to-End の型安全性を構築する。

## **2\. データベース設計 (Prisma Schema)**

### **2.1. テーブル構造**

* **Player**: メンバー情報。currentGroup (1軍/2軍), pinCode, mainChar, role (ADMIN/USER) などを保持。  
* **Event**: 大会情報。status (active/finished), date を保持。  
* **Score**: 各大会の成績。playCount, winCount, winRate, usedChar, isAbsent (お休みフラグ)。下剋上判定用に groupBefore と groupAfter を保持。  
* **Star**: 投票データ。eventId, senderId, receiverId。  
* **Achievement / PlayerAchievement**: 称号マスタと、プレイヤーが獲得した称号の中間テーブル。

### **2.2. ロジック制約（Backendで制御）**

* **Star投票**: 1大会につき1ユーザーが送れるStarは最大3つまで。senderId \=== receiverId はエラー。  
* **欠席処理**: isAbsent \== true のプレイヤーは順位計算時のソートロジックから外し、groupAfter を groupBefore と同じ値（現状維持）に設定する。

## **3\. API仕様案 (Hono / REST & SSE)**

### **3.1. REST API**

* POST /api/auth/login: PIN認証。JWTまたはセッションCookieを発行。  
* GET /api/events: 開催一覧・過去大会履歴の取得。  
* GET /api/players: 所属チームやプロフィールの取得。  
* POST /api/events/:id/submit: 成績（対戦数/勝利数）とStar送信情報の確定。

### **3.2. SSE (Server-Sent Events)**

* GET /api/stream/events/:id: クライアント全員が接続して待機するエンドポイント。  
  * **Event**: progress\_update (誰かが入力を終えた際のプログレスバー更新)  
  * **Event**: result\_ready (全員入力完了・結果発表の強制画面切り替えトリガー)  
  * **Event**: phase\_update (管理者が「次へ」を押した際の段階的オープンの同期)

## **4\. 画面・UI設計**

### **4.1. カラーパレット (Tailwind Config)**

* base-900: \#090014 (最暗の背景)  
* base-800: \#12002b (パネル背景)  
* base-600: \#2b008e (メインブランドカラー)  
* accent: \#d946ef (ネオンフクシャ \- 1軍やハイライト用)  
* 差し色: yellow-400 / yellow-500 (Star, 順位, 称号用)

### **4.2. 画面遷移 (SPA)**

1. **ホーム (Tab)**: 開催情報 / グループ / プロフィール の3タブ構成。  
2. **ログイン (Modal)**: プレイヤー選択とPIN入力。  
3. **結果発表 (Overlay)**: SSE経由で showResultView \= true になり、全画面を覆う。タブ操作は無効化される。

## **5\. アニメーション・演出要件**

Vueの \<Transition\> および \<TransitionGroup\> を駆使して実装。

* **カード登場**: 下からフェードインしながらめくれるような3D変形エフェクト。  
* **下剋上エフェクト**: 赤い発光（drop-shadow）と点滅アニメーション。  
* **Starポップエフェクト**: 最終フェーズにて、獲得したStar数が拡大・回転しながら出現し、キラキラと輝くアニメーションを付与。

## **6\. 今後の開発ステップ**

1. リポジトリ初期設定 (Vue \+ Hono \+ Prisma)。  
2. Prisma Schemaのデプロイ (Turso) とモックデータ(Seed)の流し込み。  
3. Hono API の基本CRUDと Hono RPC のフロントエンド連携。  
4. SSEエンドポイントの実装と、Vue側での一斉画面遷移の動作検証。