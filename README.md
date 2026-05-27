# x-proxy — コレクター用のX API中継サーバー

コレクター（ブラウザのHTML）から投稿URLを受け取り、X APIで1件取得して
名前・ID・日時・本文・URL の5項目だけ返す小さな中継サーバーです。
Bearer Token はコードに書かず、Vercelの環境変数に入れて隠します。

## ファイル構成
```
x-proxy/
├── api/
│   └── tweet.js      … 本体（X APIを叩く関数）
├── vercel.json       … Vercel設定
└── README.md         … この手順書
```

## デプロイ手順

### 1. Vercelアカウントを作る
https://vercel.com にGitHub等でサインアップ（無料）。

### 2. このフォルダをアップロード
方法A（簡単）: Vercelの画面で「Add New → Project」→「Deploy」時に
このx-proxyフォルダをドラッグ＆ドロップ。
方法B（CLI）: ターミナルで
```
npm i -g vercel
cd x-proxy
vercel
```
画面の質問はすべてEnter（デフォルト）でOK。

### 3. Bearer Token を環境変数に登録（最重要）
Vercelのプロジェクト画面 → Settings → Environment Variables で：
- Name:  X_BEARER_TOKEN
- Value: （ステップ1で控えたBearer Token）
を追加して保存。保存後に「Redeploy」して反映する。

### 4. 動作確認
デプロイ後に割り当てられるURL（例 https://x-proxy-xxxx.vercel.app）に対し、
ブラウザで次を開く：
```
https://x-proxy-xxxx.vercel.app/api/tweet?url=https://x.com/任意の公開投稿のURL
```
名前・ID・日時・本文・URL がJSONで返ってくれば成功。

## 返ってくる形（例）
```json
{
  "name": "けんすう",
  "id": "@kensuu",
  "date": "2026-05-23",
  "body": "投稿の本文...",
  "url": "https://x.com/kensuu/status/2058029976621027446"
}
```

## エラーが出たら
- 401 → Bearer Tokenが間違い/未設定。環境変数を確認しRedeploy。
- 404 → 投稿が削除・非公開。別の公開投稿で試す。
- 429 → レート上限。少し待つ。
- "X_BEARER_TOKENが設定されていません" → 環境変数の登録漏れ。

## このURLを控える
動作確認できたら、割り当てられた
`https://x-proxy-xxxx.vercel.app/api/tweet`
を控えてください。次のステップ（コレクター改修）で、この値を貼り込みます。
