// api/amc.js
// Vercel serverless proxy for AMC Theatres API.
// Forwards GET requests to https://api.amctheatres.com/v2{path}
// with the vendor key added server-side (avoids CORS on Expo web).
//
// Usage: GET /api/amc?path=/theatres&page-size=100&page-number=1
//        GET /api/amc?path=/theatres/123/showtimes/2026-05-27&page-size=50
//        GET /api/amc?path=/movies/456

module.exports = async function handler(req, res) {
  // Only GET is needed
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.EXPO_PUBLIC_AMC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AMC API key not configured" });
  }

  const { path, ...rest } = req.query;
  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "path query param required" });
  }

  // Prevent proxy abuse — only allow paths under /v2
  if (!path.startsWith("/")) {
    return res.status(400).json({ error: "path must start with /" });
  }

  // Forward remaining query params to upstream
  const params = new URLSearchParams(rest);
  const qs = params.toString();
  const upstreamUrl = `https://api.amctheatres.com/v2${path}${qs ? "?" + qs : ""}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "X-AMC-Vendor-Key": apiKey,
        Accept: "application/json",
      },
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.status(upstream.status).send(text);
  } catch (err) {
    console.error("[amc-proxy] upstream error:", err);
    res.status(502).json({ error: "Upstream error" });
  }
};
