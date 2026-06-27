// TEMPORARY DIAGNOSTIC — remove after confirming SerpAPI works
// Usage: /api/serp-test?q=events+in+Philadelphia+Pennsylvania+this+week

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(200).json({
      status: "ERROR",
      reason: "SERPAPI_KEY not set in environment",
    });
  }

  const q  = req.query.q ?? "events in Philadelphia Pennsylvania this week";
  const gl = req.query.gl ?? "us";

  const params = new URLSearchParams({
    engine:   "google_events",
    q,
    gl,
    hl:       "en",
    api_key:  apiKey,
    htichips: "date:week",
  });

  try {
    const upstream = await fetch(`https://serpapi.com/search.json?${params}`);
    const data     = await upstream.json();

    const events   = data.events_results ?? [];
    const sources  = events.map(e => {
      const link = e.link ?? "";
      try { return new URL(link).hostname.replace("www.", ""); } catch { return link; }
    });

    return res.status(200).json({
      status:          upstream.status,
      keyPrefix:       apiKey.slice(0, 6) + "...",
      eventsCount:     events.length,
      sources,
      firstEvent:      events[0] ?? null,
      serpError:       data.error ?? null,
      searchInfo:      data.search_information ?? null,
    });
  } catch (err) {
    return res.status(200).json({ status: "FETCH_ERROR", error: err.message });
  }
};
