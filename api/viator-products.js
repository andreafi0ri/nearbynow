// Proxy: POST /api/viator-products → POST https://api.viator.com/partner/products/search
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.EXPO_PUBLIC_VIATOR_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Viator API key not configured" });
    return;
  }
  try {
    const upstream = await fetch("https://api.viator.com/partner/products/search", {
      method: "POST",
      headers: {
        "exp-api-key":     apiKey,
        "Accept-Language": "en-US",
        "Content-Type":    "application/json",
        "Accept":          "application/json;version=2.0",
      },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.status(upstream.status).send(text);
  } catch (err) {
    console.error("[viator-products] Error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
};
