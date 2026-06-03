// Lititz PA events proxy
// lititzpa.com is a Squarespace events collection. Its ?format=json endpoint
// returns events under `upcoming[]` / `past[]` — but only when fetched
// server-side (Squarespace serves no CORS headers and the public CORS proxies
// receive an empty payload). This function fetches it server-side and returns
// a trimmed list of upcoming events.
//
// No API key required — public Squarespace JSON.

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const upstream = await fetch("https://lititzpa.com/events?format=json", {
      headers: {
        // Squarespace returns the populated upcoming[] only for a browser-like
        // User-Agent with Accept: */* — application/json yields an empty payload.
        "User-Agent": "Mozilla/5.0 (compatible; NearbyNow/1.0)",
        Accept: "*/*",
      },
    });

    if (!upstream.ok) {
      console.error("[lititz-events] upstream", upstream.status);
      return res.status(upstream.status).json({ error: `lititzpa.com returned ${upstream.status}` });
    }

    const data = await upstream.json();
    const upcoming = Array.isArray(data.upcoming) ? data.upcoming : [];

    // Trim each event to the fields the client needs (keeps the payload small).
    const events = upcoming.map(it => ({
      id:          it.id,
      title:       it.title,
      startDate:   it.startDate,   // ms timestamp
      endDate:     it.endDate,     // ms timestamp
      fullUrl:     it.fullUrl,     // relative path
      assetUrl:    it.assetUrl,    // hero image (squarespace CDN)
      excerpt:     it.excerpt,     // HTML string
      tags:        it.tags ?? [],
      categories:  it.categories ?? [],
      location:    it.location
        ? {
            addressTitle: it.location.addressTitle,
            addressLine1: it.location.addressLine1,
            addressLine2: it.location.addressLine2,
            mapLat:       it.location.mapLat,
            mapLng:       it.location.mapLng,
          }
        : null,
    }));

    res.setHeader("Content-Type", "application/json");
    // Cache at the edge for 30 min — events don't change minute-to-minute.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({ events });
  } catch (err) {
    console.error("[lititz-events] error:", err);
    return res.status(500).json({ error: "Proxy request failed", detail: err.message });
  }
};
