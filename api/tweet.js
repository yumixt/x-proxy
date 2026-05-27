// api/tweet.js
// コレクターから投稿URL（または投稿ID）を受け取り、X APIで1件取得して
// 名前・ID・日時・本文・URL の5項目だけ返す中継サーバー。
// Bearer Token はコードに書かず、Vercelの環境変数 X_BEARER_TOKEN から読む。

export default async function handler(req, res) {
  // --- CORS（ブラウザのコレクターから呼べるように） ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  // --- 入力：?url=... または ?id=... どちらでも受け付ける ---
  const url = (req.query.url || "").toString().trim();
  let id = (req.query.id || "").toString().trim();

  // URLから投稿ID（末尾の数字）を抜く： https://x.com/xxx/status/123456 → 123456
  if (!id && url) {
    const m = url.match(/status\/(\d+)/);
    if (m) id = m[1];
  }
  if (!id) {
    res.status(400).json({ error: "投稿URLまたはIDを指定してください（例 ?url=https://x.com/.../status/123）" });
    return;
  }

  // --- Bearer Token を環境変数から ---
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    res.status(500).json({ error: "サーバーにX_BEARER_TOKENが設定されていません" });
    return;
  }

  // --- X API v2：投稿1件を、作成日時・著者展開つきで取得 ---
  const api = "https://api.x.com/2/tweets/" + id
    + "?tweet.fields=created_at,text"
    + "&expansions=author_id"
    + "&user.fields=name,username";

  try {
    const r = await fetch(api, { headers: { Authorization: "Bearer " + token } });
    const data = await r.json();

    if (!r.ok) {
      // X API側のエラー（404=投稿が無い/非公開, 429=レート上限 など）をそのまま伝える
      res.status(r.status).json({
        error: "X APIエラー",
        status: r.status,
        detail: data?.title || data?.detail || data
      });
      return;
    }
    if (!data.data) {
      res.status(404).json({ error: "投稿が見つかりませんでした（削除・非公開の可能性）" });
      return;
    }

    const t = data.data;
    const author = (data.includes && data.includes.users && data.includes.users[0]) || {};

    // created_at（ISO8601）を YYYY-MM-DD に整形
    let date = "";
    if (t.created_at) {
      const d = new Date(t.created_at);
      if (!isNaN(d)) {
        date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      }
    }

    res.status(200).json({
      name: author.name || "",                         // 表示名
      id: author.username ? "@" + author.username : "", // @ID
      date,                                            // 日時 YYYY-MM-DD
      body: t.text || "",                              // 本文
      url: author.username ? `https://x.com/${author.username}/status/${id}` : url // 正規化したURL
    });
  } catch (e) {
    res.status(500).json({ error: "取得に失敗しました", detail: String(e) });
  }
}
