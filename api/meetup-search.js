// Proxy: POST /api/meetup-search → POST https://api.meetup.com/gql
//
// WHY a proxy:
//   Meetup's GraphQL endpoint (api.meetup.com/gql) blocks XHR/fetch from
//   browsers with a CORS error.  Requests from the web client route here
//   instead; this function calls Meetup server-side where CORS doesn't apply.
//
// Auth:
//   Meetup public GraphQL allows keyword/location event searches without an
//   OAuth token.  No Authorization header is added — only public event data
//   is queried.  For user-specific endpoints an OAuth flow would be required.
module.exports = async function handler(req, res) {
  // CORS headers — allow requests from the app (including localhost in dev)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, variables } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Missing query" });
    }

    const upstream = await fetch("https://api.meetup.com/gql2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":       "application/json",
        // No Authorization header — public event queries do not require OAuth
      },
      body: JSON.stringify({ query, variables }),
    });

    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.status(upstream.status).send(text);
  } catch (err) {
    console.error("[meetup-search] Error:", err);
    res.status(500).json({ error: "Proxy error", detail: err.message });
  }
};
