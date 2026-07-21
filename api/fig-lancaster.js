// FIG Lancaster proxy — figlancaster.com blocks cross-origin browser requests.
// Forwards query params to the WordPress Events Calendar REST endpoint.

const ENDPOINT = "https://figlancaster.com/wp-json/tribe/events/v1/events";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query ?? {})) {
    params.set(k, String(v));
  }

  try {
    const upstream = await fetch(`${ENDPOINT}?${params}`, {
      headers: { "User-Agent": "NearbyAndNow/1.0", Accept: "application/json" },
    });

    if (!upstream.ok) {
      console.error(`[fig-lancaster] upstream ${upstream.status}`);
      return res.status(upstream.status).json({ error: `FIG returned ${upstream.status}` });
    }

    const data = await upstream.json();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");
    return res.status(200).json(data);
  } catch (err) {
    console.error("[fig-lancaster] error:", err);
    return res.status(502).json({ error: "Proxy error", detail: err.message });
  }
};
