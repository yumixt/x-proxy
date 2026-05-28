// api/search.js
// 検索ワードと取得件数を受け取り、X APIで「最近の投稿検索」を呼んで
// 最新のものから指定件数を返す中継サーバー。
// 戻りはコレクターの表に合わせて 名前・ID・日時・本文・URL の5項目だけ。

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  // --- 入力 ---
  // q:        検索クエリ（X検索構文そのまま）。複数ワードはOR連結してから渡す想定。
  // max:      取得したい件数（合計）。最大500件まで。1リクエスト10〜100件単位でページ送り。
  // excludeReplies: "1"でリプライ除外
  // excludeRetweets: "1"でリツイート除外
  const q = (req.query.q || "").toString().trim();
  const want = Math.min(Math.max(parseInt(req.query.max, 10) || 50, 10), 500);
  const excludeReplies  = req.query.excludeReplies  === "1";
  const excludeRetweets = req.query.excludeRetweets === "1";

  if (!q) { res.status(400).json({ error: "検索ワード q を指定してください" }); return; }

  // 除外フィルタをクエリに付ける（X検索構文）
  let query = q;
  if (excludeReplies)  query += " -is:reply";
  if (excludeRetweets) query += " -is:retweet";
  // 言語フィルタは入れない（北九州/地域系は日本語前提でも誤って弾く可能性があるため）

  const token = process.env.X_BEARER_TOKEN;
  if (!token) { res.status(500).json({ error: "サーバーにX_BEARER_TOKENが設定されていません" }); return; }

  // --- ページ送りで want 件まで集める ---
  // 1回のmax_resultsは10〜100。残り件数に合わせて調整。
  const collected = [];
  let nextToken = null;
  let pages = 0;
  const usersById = new Map();

  try {
    while (collected.length < want && pages < 10) { // 安全弁：最大10ページ
      const remain = want - collected.length;
      const pageSize = Math.min(100, Math.max(10, remain));
      const params = new URLSearchParams({
        query,
        max_results: String(pageSize),
        "tweet.fields": "created_at,text,author_id",
        "expansions":   "author_id",
        "user.fields":  "name,username",
      });
      if (nextToken) params.set("next_token", nextToken);

      const r = await fetch("https://api.x.com/2/tweets/search/recent?" + params.toString(), {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await r.json();

      if (!r.ok) {
        res.status(r.status).json({
          error: "X APIエラー", status: r.status,
          detail: data?.title || data?.detail || data
        });
        return;
      }

      // ユーザー情報を辞書化
      const users = (data.includes && data.includes.users) || [];
      users.forEach(u => usersById.set(u.id, u));

      const tweets = data.data || [];
      for (const t of tweets) {
        if (collected.length >= want) break;
        const u = usersById.get(t.author_id) || {};
        let date = "";
        if (t.created_at) {
          const d = new Date(t.created_at);
          if (!isNaN(d)) date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        }
        collected.push({
          name: u.name || "",
          id:   u.username ? "@" + u.username : "",
          date,
          body: t.text || "",
          url:  u.username ? `https://x.com/${u.username}/status/${t.id}` : ""
        });
      }

      nextToken = (data.meta && data.meta.next_token) || null;
      pages++;
      if (!nextToken) break;       // これ以上ページがない
      if (tweets.length === 0) break;
    }

    res.status(200).json({
      query,
      requested: want,
      returned: collected.length,
      results: collected
    });
  } catch (e) {
    res.status(500).json({ error: "取得に失敗しました", detail: String(e) });
  }
}
