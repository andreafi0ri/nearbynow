// Vercel Edge Function — server-side proxy for the Viator Affiliate API.
// The Viator API does not allow browser cross-origin requests (CORS), so all
// web requests are routed here instead of calling api.viator.com directly.
//
// Route:  POST /api/viator/<endpoint>
// Proxy:  POST https://api.viator.com/partner/<endpoint>

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const viatorPath = url.pathname.replace(/^\/api\/viator\/?/, "");

  const apiKey = process.env.EXPO_PUBLIC_VIATOR_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Viator API key not configured on server" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.text();

  const viatorResponse = await fetch(
    `https://api.viator.com/partner/${viatorPath}`,
    {
      method: "POST",
      headers: {
        "exp-api-key":     apiKey,
        "Accept-Language": "en-US",
        "Content-Type":    "application/json",
        "Accept":          "application/json;version=2.0",
      },
      body,
    },
  );

  const responseText = await viatorResponse.text();

  return new Response(responseText, {
    status: viatorResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
