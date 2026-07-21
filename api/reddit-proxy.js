// Reddit API proxy — Reddit blocks cross-origin browser requests.
// Only allows requests to www.reddit.com (SSRF guard).

const ALLOWED_HOST = "www.reddit.com";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });

  let parsed;
  try { parsed = new URL(String(url)); }
  catch { return res.status(400).json({ error: "Invalid url" }); }

  if (parsed.hostname !== ALLOWED_HOST) {
    return res.status(403).json({ error: `Host not allowed: ${parsed.hostname}` });
  }

  try {
    const upstream = await fetch(String(url), {
      headers: { "User-Agent": "NearbyAndNow/1.0", Accept: "application/json" },
    });

    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(upstream.status).send(text);
  } catch (err) {
    return res.status(502).json({ error: "Upstream fetch failed", detail: err.message });
  }
};
