// Serper.dev Google Search proxy
// Injects SERPER_KEY server-side — never exposed client-side.
// Used for Google Events discovery and keyword activity searches
// in serpEventsService.ts.
//
// Accepts POST: { q, gl, hl, num, type, ... }
// Forwards all body fields to google.serper.dev/search unchanged.
//
// Free tier: 2,500 queries — monitor at serper.dev/dashboard
// After free tier: $1/1,000 queries

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SERPER_KEY ?? process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.error("[serper-search] Neither SERPER_KEY nor SERPER_API_KEY set in environment");
    return res.status(500).json({ error: "API key not configured" });
  }

  const body = req.body ?? {};
  const { q, ...rest } = body;
  console.log(`[serper-search] Received body keys: ${Object.keys(body).join(", ")} | q="${q}" | key set: ${!!apiKey}`);

  if (!q) {
    return res.status(400).json({ error: "Missing body field q", received: Object.keys(body) });
  }

  try {
    const upstream = await fetch("https://google.serper.dev/search", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY":    apiKey,
      },
      body: JSON.stringify({ q, ...rest }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("[serper-search] Serper error:", upstream.status, text.slice(0, 200));
      return res.status(upstream.status).json({
        error: `Serper returned ${upstream.status}`,
      });
    }

    const data = await upstream.json();

    const eventCount = (data.events ?? []).length;
    const organicCount = (data.organic ?? []).length;
    console.log(
      `[serper-search] q="${q}" → events:${eventCount}, organic:${organicCount}`,
      "keys:", Object.keys(data).join(", ")
    );

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      events:         data.events         ?? [],
      organic:        data.organic        ?? [],
      events_results: data.events_results ?? [], // SerpAPI-shape fallback
    });
  } catch (err) {
    console.error("[serper-search] Proxy error:", err);
    return res.status(500).json({
      error:  "Proxy request failed",
      detail: err.message,
    });
  }
};
