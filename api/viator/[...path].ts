// Vercel Edge Function — server-side proxy for the Viator Affiliate API.
// The Viator API does not allow browser cross-origin requests (CORS), so all
// web requests are routed here instead of calling api.viator.com directly.
//
// Route:  POST /api/viator/<endpoint>
// Proxy:  POST https://api.viator.com/partner/<endpoint>
//
// REQUIRED: Set EXPO_PUBLIC_VIATOR_API_KEY in Vercel Project Settings →
// Environment Variables. The value is the key from your local .env file.

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

  if (!viatorPath) {
    return new Response(JSON.stringify({ error: "Missing Viator endpoint path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.EXPO_PUBLIC_VIATOR_API_KEY;
  if (!apiKey) {
    console.error(
      "[Viator proxy] ❌ EXPO_PUBLIC_VIATOR_API_KEY is not set. " +
      "Add it to Vercel Project Settings → Environment Variables."
    );
    return new Response(
      JSON.stringify({ error: "Viator API key not configured on server" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
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

  if (!viatorResponse.ok) {
    console.error(
      `[Viator proxy] Viator returned ${viatorResponse.status} for /${viatorPath}: ${responseText.slice(0, 200)}`
    );
  }

  return new Response(responseText, {
    status: viatorResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
