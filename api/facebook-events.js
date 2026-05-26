// api/facebook-events.js
// Vercel serverless proxy for Facebook Graph API — public page events.
//
// WHY a proxy and not direct client calls:
//   1. CORS — graph.facebook.com blocks XHR/fetch from browsers.
//   2. Security — APP_SECRET must never appear in the client JS bundle.
//   3. Endpoint — /search?type=event is deprecated (error code 3 for all
//      third-party apps since ~2020). We use /{page-id}/events instead,
//      which works once "Page Public Content Access" feature is approved.
//
// Facebook App Review status:
//   ✅ pages_read_engagement — approved (user permission)
//   ⏳ Page Public Content Access — REQUIRED for /{page-id}/events with
//      an app access token. Apply at:
//      Meta Developer Console → App Review → Request a Feature
//      Until it is approved this proxy returns [] and logs a clear message.
//
// Rate limits: 200 calls/hour per app token (app access token is shared
// across all users). Responses are cached for 30 minutes server-side.

// ─── Facebook Pages registry ──────────────────────────────────────────────────
// Keep in sync with src/config/facebookPages.ts
const FACEBOOK_PAGES = [
  // Brooklyn / NYC
  { pageId: "DUMBOArtsDistrict",      area: "brooklyn",  category: "Culture"      },
  { pageId: "ProspectParkAlliance",   area: "brooklyn",  category: "Events"       },
  { pageId: "BrooklynMuseum",         area: "brooklyn",  category: "Culture"      },
  { pageId: "BrooklynBowl",           area: "brooklyn",  category: "Music"        },
  { pageId: "SmorgasburgMarkets",     area: "brooklyn",  category: "Food & Drink" },
  { pageId: "barcadenyc",             area: "brooklyn",  category: "Events"       },
  // Lancaster, PA
  { pageId: "DiscoverLancasterPA",    area: "lancaster", category: "Events"       },
  { pageId: "LancasterCityPA",        area: "lancaster", category: "Community"    },
];

const GRAPH_BASE  = "https://graph.facebook.com/v19.0";
const MAX_RESULTS = 20;

// In-memory cache (survives warm Lambda invocations)
const cache = new Map();
const CACHE_MS = 30 * 60 * 1_000; // 30 min

// ─── App access token (cached) ────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getToken(appId, appSecret) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const url = `${GRAPH_BASE}/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&grant_type=client_credentials`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Token fetch failed: ${r.status}`);
  const { access_token } = await r.json();
  cachedToken = access_token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1_000; // refresh every 23 h
  return access_token;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const appId     = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.EXPO_PUBLIC_FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return res.status(500).json({ error: "Facebook credentials not configured", events: [] });
  }

  const { area = "" } = req.query;
  if (!area) return res.status(400).json({ error: "area param required", events: [] });

  // Cache check
  const cacheKey = area.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json({ events: hit.events });
  }

  // Match pages to the requested area
  const matchedPages = FACEBOOK_PAGES.filter(p => area.toLowerCase().includes(p.area));

  if (matchedPages.length === 0) {
    return res.status(200).json({ events: [], note: "No registered pages for this area" });
  }

  let token;
  try {
    token = await getToken(appId, appSecret);
  } catch (err) {
    console.error("[facebook-events] Token error:", err.message);
    return res.status(502).json({ error: "Could not obtain Facebook token", events: [] });
  }

  const eventFields = "id,name,description,start_time,end_time,place,cover,is_canceled,ticket_uri";
  const now = Date.now();
  const allEvents = [];

  // Fetch events from each matched page in parallel
  await Promise.all(
    matchedPages.map(async page => {
      const url =
        `${GRAPH_BASE}/${encodeURIComponent(page.pageId)}/events` +
        `?fields=${eventFields}` +
        `&since=${Math.floor(now / 1000)}` +
        `&limit=${MAX_RESULTS}` +
        `&access_token=${encodeURIComponent(token)}`;

      try {
        const r = await fetch(url);
        const data = await r.json();

        if (!r.ok || data.error) {
          const code = data.error?.code;
          const msg  = data.error?.message ?? "unknown";

          // Code 100 / 200 with "Page Public Content Access" message = feature not yet approved
          if (code === 100 || code === 200) {
            console.warn(
              `[facebook-events] Page Public Content Access not yet approved.\n` +
              `  Apply at: Meta Developer Console → App Review → Request a Feature\n` +
              `  Page: ${page.pageId} | Error ${code}: ${msg}`
            );
          } else {
            console.warn(`[facebook-events] ${page.pageId} failed (${code}): ${msg}`);
          }
          return;
        }

        const events = (data.data ?? []).map(ev => ({ ...ev, _pageCategory: page.category }));
        allEvents.push(...events);
      } catch (err) {
        console.warn(`[facebook-events] ${page.pageId} fetch error:`, err.message);
      }
    })
  );

  // Deduplicate by event ID
  const seen = new Set();
  const unique = allEvents.filter(ev => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  // Sort by start_time ascending
  unique.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const result = unique.slice(0, MAX_RESULTS);
  console.log(`[facebook-events] area="${area}" pages=${matchedPages.length} raw=${allEvents.length} deduped=${result.length}`);

  cache.set(cacheKey, { events: result, expiresAt: Date.now() + CACHE_MS });
  res.setHeader("X-Cache", "MISS");
  res.status(200).json({ events: result });
};
