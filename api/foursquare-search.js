// Foursquare Places API proxy
// Injects FOURSQUARE_API_KEY as a Bearer token, server-side only.
//
// IMPORTANT — uses the NEW FSQ OS Places API (the v3 api.foursquare.com
// endpoints were deprecated 15 May 2026). Verified against the live docs:
//   Host:   https://places-api.foursquare.com
//   Path:   /places/search
//   Auth:   Authorization: Bearer {KEY}
//   Header: X-Places-Api-Version: 2025-06-17   (required)
//
// ONLY requests Pro-tier (free) fields. In the new API, `popularity` and
// `description` are PREMIUM ($18.75/1k) — NOT requested here. Adding them
// would silently switch the call to premium billing.
// Free: 500 Pro calls/month + $200 dev credits. Monitor: foursquare.com/developer/console

const FSQ_BASE        = "https://places-api.foursquare.com";
const FSQ_API_VERSION = "2025-06-17";

// Pro-tier fields only — never add popularity, description, photos, tips,
// hours, rating, price, stats, tastes (all Premium).
const PRO_FIELDS = [
  "fsq_place_id",
  "name",
  "categories",
  "location",
  "latitude",
  "longitude",
  "distance",
  "website",
  "tel",
  "link",
].join(",");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    console.error("[foursquare-search] FOURSQUARE_API_KEY not set");
    return res.status(500).json({ error: "API key not configured" });
  }

  const { ll, query, radius, limit = "15", categories } = req.query;
  if (!ll) return res.status(400).json({ error: "Missing ll param (lat,lng)" });

  try {
    const params = new URLSearchParams({
      ll:     String(ll),
      limit:  String(limit),
      sort:   "DISTANCE", // free; POPULARITY would lean on a premium field
      fields: PRO_FIELDS,
    });
    if (radius)     params.set("radius", String(radius));
    if (query)      params.set("query", String(query));
    if (categories) params.set("fsq_category_ids", String(categories));

    const upstream = await fetch(`${FSQ_BASE}/places/search?${params}`, {
      headers: {
        Authorization:          `Bearer ${apiKey}`,
        "X-Places-Api-Version": FSQ_API_VERSION,
        Accept:                 "application/json",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("[foursquare-search] FSQ error:", upstream.status, text.slice(0, 200));
      return res.status(upstream.status).json({
        error:  `FSQ returned ${upstream.status}`,
        detail: text.slice(0, 200),
      });
    }

    const data = await upstream.json();
    res.setHeader("Content-Type", "application/json");
    // Edge-cache 24h — venues don't change hourly; conserves the 500/month free tier.
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=43200");
    return res.status(200).json({ results: data.results ?? [] });
  } catch (err) {
    console.error("[foursquare-search] proxy error:", err);
    return res.status(500).json({ error: "Proxy request failed", detail: err.message });
  }
};
