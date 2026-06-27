// TEMPORARY DIAGNOSTIC — remove after confirming Serper works
// Usage: /api/serper-test?q=events+in+Philadelphia+PA+this+week
// Returns raw Serper response so you can see exactly what comes back

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.SERPER_KEY ?? process.env.SERPER_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      status: "ERROR",
      reason: "No API key found",
      checked: ["SERPER_KEY", "SERPER_API_KEY"],
    });
  }

  const q = req.query.q ?? "events in Philadelphia PA this week";

  try {
    const upstream = await fetch("https://google.serper.dev/search", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY":    apiKey,
      },
      body: JSON.stringify({ q, gl: "us", hl: "en", num: 10 }),
    });

    const data = await upstream.json();

    return res.status(200).json({
      status:         upstream.status,
      keyPresent:     true,
      keyPrefix:      apiKey.slice(0, 6) + "...",
      responseKeys:   Object.keys(data),
      eventsCount:    (data.events ?? []).length,
      organicCount:   (data.organic ?? []).length,
      firstEvent:     data.events?.[0] ?? null,
      firstOrganic:   data.organic?.[0] ?? null,
      serperError:    data.message ?? data.error ?? null,
    });
  } catch (err) {
    return res.status(200).json({
      status: "FETCH_ERROR",
      error:  err.message,
    });
  }
};
