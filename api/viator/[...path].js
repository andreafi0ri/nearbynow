// Server-side proxy for the Viator Partner API (CORS workaround).
// Route: POST /api/viator/<endpoint> → POST https://api.viator.com/partner/<endpoint>
// REQUIRED: Set EXPO_PUBLIC_VIATOR_API_KEY in Vercel Project Settings → Environment Variables.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const pathParts = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean);
  const viatorPath = pathParts.join("/");

  if (!viatorPath) {
    res.status(400).json({ error: "Missing Viator endpoint path" });
    return;
  }

  const apiKey = process.env.EXPO_PUBLIC_VIATOR_API_KEY;
  if (!apiKey) {
    console.error("[Viator proxy] EXPO_PUBLIC_VIATOR_API_KEY is not set.");
    res.status(500).json({ error: "Viator API key not configured on server" });
    return;
  }

  try {
    const viatorResponse = await fetch(`https://api.viator.com/partner/${viatorPath}`, {
      method: "POST",
      headers: {
        "exp-api-key":     apiKey,
        "Accept-Language": "en-US",
        "Content-Type":    "application/json",
        "Accept":          "application/json;version=2.0",
      },
      body: JSON.stringify(req.body),
    });

    const responseText = await viatorResponse.text();

    if (!viatorResponse.ok) {
      console.error(
        `[Viator proxy] Viator returned ${viatorResponse.status} for /${viatorPath}: ${responseText.slice(0, 200)}`
      );
    }

    res.setHeader("Content-Type", "application/json");
    res.status(viatorResponse.status).send(responseText);
  } catch (err) {
    console.error("[Viator proxy] Error:", err);
    res.status(500).json({ error: "Proxy request failed" });
  }
};
