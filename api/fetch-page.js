// Server-side page fetcher for the schema.org JSON-LD parser.
//
// Some venue event pages (e.g. tellus360.com) send no CORS header AND are too
// large for the public CORS-proxy chain — so the client can't read them. This
// function fetches them server-side and returns the raw HTML.
//
// BOUNDARY: reads ONLY normally-loading pages. If the upstream returns a
// bot-protection response (403/503 or a Cloudflare/CAPTCHA body), it forwards
// that status/marker unchanged — the client treats it as BLOCKED and skips it.
// This never bypasses protection, solves CAPTCHAs, or rotates identities.
//
// SSRF guard: only hosts on ALLOWED_HOSTS may be fetched (not an open proxy).

// Hosts the proxy may fetch: JSON-LD venue pages + every RSS feed host in
// src/config/rssSources.ts. The public CORS-proxy chain (codetabs/allorigins/
// thingproxy) became unreliable, so RSS also routes through here.
// KEEP IN SYNC: adding a source to rssSources.ts or structuredDataSources.ts
// means adding its hostname here, or the proxy will refuse it (403).
const ALLOWED_HOSTS = new Set([
  // JSON-LD venue pages (structuredDataSources.ts)
  "www.tellus360.com", "tellus360.com",
  "www.tabernacleatl.com",
  "www.kaseyacenter.com",
  // RSS feed hosts (rssSources.ts)
  "austinmonitor.com", "billypenn.com", "bklyner.com", "blockclubchicago.org",
  "www.metrochicago.com",
  "brixtonblog.com", "brixtonvillage.com", "chicagoreader.com", "crosscut.com",
  "dcist.com", "denverite.com", "gothamist.com", "laist.com", "londonist.com",
  "miamiherald.com", "nashvillepost.com", "secretboston.com", "secretchicago.com",
  "secretldn.com", "secretlosangeles.com", "secretnyc.co", "secretsanfrancisco.com",
  "sfstandard.com", "wbur.org", "www.austinchronicle.com", "www.barbican.org.uk",
  "www.bfi.org.uk", "www.brixtonbuzz.com", "www.brooklynartscouncil.org",
  "www.brooklynmuseum.org", "www.brownstoner.com", "www.chicagoparkdistrict.com",
  "www.eventbrite.com", "www.lancasterhistory.org", "www.lancasterpa.com",
  "www.london.gov.uk", "www.mickeysblackbox.com", "www.mylondon.news",
  "www.nationaltrust.org.uk", "www.nycgovparks.org", "www.prospectpark.org",
  "www.royalparks.org.uk", "www.southbankcentre.co.uk", "www.timeout.com",
  "www.visitlondon.com", "www.wweek.com",
]);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });

  let host;
  try { host = new URL(String(url)).hostname; }
  catch { return res.status(400).json({ error: "Invalid url" }); }

  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(403).json({ error: `Host not allowed: ${host}` });
  }

  try {
    const upstream = await fetch(String(url), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NearbyNow/1.0; +https://www.nearbyandnow.com)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });

    const body = await upstream.text();
    // Forward the upstream status so the client's BLOCKED guard can act on it.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Edge-cache 1h — these pages update less often than live APIs.
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");
    return res.status(upstream.status).send(body);
  } catch (err) {
    console.error("[fetch-page] error:", err);
    return res.status(502).json({ error: "Upstream fetch failed", detail: err.message });
  }
};
