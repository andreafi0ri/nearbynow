// SerpAPI Google Events proxy
// Injects SERPAPI_KEY server-side — never exposed client-side.
// Only forwards events_results, not search_metadata (which contains
// the API key in the raw SerpAPI response).
//
// Rate limit: 100 searches/month free, $25/month for 1,000
// Monitor usage at: https://serpapi.com/dashboard
// Sign up at: https://serpapi.com/users/sign_up
//
// Pattern matches api/viator-search.js exactly.

module.exports = async function handler(req, res) {
  // CORS headers — allow requests from the app (including localhost in dev)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.error("[serp-events] SERPAPI_KEY not set in environment");
    return res.status(500).json({ error: "API key not configured" });
  }

  const { q, gl = "us", hl = "en" } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Missing query parameter q" });
  }

  try {
    const params = new URLSearchParams({
      engine:   "google_events",
      q:        String(q),
      gl:       String(gl),
      hl:       String(hl),
      api_key:  apiKey,
      htichips: "date:week", // this week only — matches default "This Week" feed preset
    });

    const upstream = await fetch(
      `https://serpapi.com/search.json?${params}`,
      { headers: { Accept: "application/json" } }
    );

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("[serp-events] SerpAPI error:", upstream.status, text.slice(0, 200));
      return res.status(upstream.status).json({
        error: `SerpAPI returned ${upstream.status}`,
      });
    }

    const data = await upstream.json();

    // Only forward the events array and basic search info.
    // Never forward search_metadata — it contains the raw API key.
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      events_results:     data.events_results      ?? [],
      search_information: data.search_information  ?? {},
    });
  } catch (err) {
    console.error("[serp-events] Proxy error:", err);
    return res.status(500).json({
      error:  "Proxy request failed",
      detail: err.message,
    });
  }
};
