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
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NearbyNow/1.0; +https://www.nearbyandnow.com)",
        Accept: "application/json, text/plain, */*",
      },
      redirect: "follow",
    });

    const text = await upstream.text();
    console.log(`[fig-lancaster] status=${upstream.status} body=${text.slice(0, 400)}`);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `FIG returned ${upstream.status}` });
    }

    let data;
    try { data = JSON.parse(text); }
    catch {
      console.error("[fig-lancaster] response is not JSON:", text.slice(0, 200));
      return res.status(502).json({ error: "FIG returned non-JSON", body: text.slice(0, 200) });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");
    return res.status(200).json(data);
  } catch (err) {
    console.error("[fig-lancaster] error:", err);
    return res.status(502).json({ error: "Proxy error", detail: err.message });
  }
};
