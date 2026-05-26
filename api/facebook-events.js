// api/facebook-events.js
// Vercel serverless proxy for Facebook Graph API — public page events.
//
// WHY a proxy and not direct client calls:
//   1. CORS — graph.facebook.com blocks XHR/fetch from browsers.
//   2. Security — page token must never appear in the client JS bundle.
//   3. Endpoint — /search?type=event is deprecated for all third-party apps
//      since ~2020. We use /{page-id}/events instead.
//
// App Review status: ✅ Approved — pages_read_engagement granted.
//
// Token: set EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN in Vercel environment variables.
//   Generate a permanent (never-expiring) Page Access Token at:
//   https://developers.facebook.com/tools/explorer/
//
// Rate limits: 200 calls/hour per token. Responses cached 30 min server-side.

// ─── Facebook Pages registry ──────────────────────────────────────────────────
// Keep in sync with src/config/facebookPages.ts
const FACEBOOK_PAGES = [

  // Brooklyn venues
  { pageId: "barcadenyc",             area: "brooklyn",  category: "Events"       },
  { pageId: "brooklynbowl",           area: "brooklyn",  category: "Music"        },
  { pageId: "knittingfactory",        area: "brooklyn",  category: "Music"        },
  { pageId: "BrooklynMuseum",         area: "brooklyn",  category: "Culture"      },
  { pageId: "ProspectParkAlliance",   area: "brooklyn",  category: "Events"       },
  { pageId: "SmorgasburgMarkets",     area: "brooklyn",  category: "Food & Drink" },
  { pageId: "BrooklynNightBazaar",    area: "brooklyn",  category: "Events"       },
  { pageId: "BrooklynArmyTerminal",   area: "brooklyn",  category: "Events"       },
  { pageId: "theBellhouseny",         area: "brooklyn",  category: "Music"        },
  { pageId: "babysallrightny",        area: "brooklyn",  category: "Music"        },

  // NYC-wide
  { pageId: "nycparks",               area: "nyc",       category: "Events"       },
  { pageId: "TimeOutNewYork",         area: "nyc",       category: "Events"       },
  { pageId: "secretnyc",              area: "nyc",       category: "Events"       },

  // Lancaster, PA
  { pageId: "DiscoverLancasterPA",    area: "lancaster", category: "Events"       },
  { pageId: "LancasterCityPA",        area: "lancaster", category: "Community"    },
  { pageId: "LancasterFarmersMarket", area: "lancaster", category: "Food & Drink" },

];

// NYC borough keywords — pages with area "nyc" match any of these
const NYC_KEYWORDS = [
  "brooklyn", "new york", "manhattan",
  "queens", "bronx", "staten island", "nyc",
];

const GRAPH_BASE  = "https://graph.facebook.com/v19.0";
const MAX_RESULTS = 20;

// In-memory cache (survives warm Lambda invocations)
const cache  = new Map();
const CACHE_MS = 30 * 60 * 1_000; // 30 min

// ─── Token ────────────────────────────────────────────────────────────────────

/**
 * Returns the permanent Page Access Token from environment variables.
 * Set EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN in Vercel env vars.
 * Generate at: https://developers.facebook.com/tools/explorer/
 */
function getPageToken() {
  const token = process.env.EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN;
  if (!token) {
    console.warn(
      "[facebook-events] No page token — " +
      "add EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN to Vercel env vars. " +
      "Generate at: developers.facebook.com/tools/explorer"
    );
  }
  return token ?? "";
}

// ─── Area matching ────────────────────────────────────────────────────────────

function matchesArea(pageArea, areaStr) {
  const lower = areaStr.toLowerCase();
  if (pageArea === "nyc") return NYC_KEYWORDS.some(kw => lower.includes(kw));
  return lower.includes(pageArea);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getPageToken();
  if (!token) {
    return res.status(500).json({
      error: "Facebook page token not configured — set EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN in Vercel env vars",
      events: [],
    });
  }

  const { area = "", debug = "" } = req.query;
  const isDebug = debug === "1";
  if (!area) return res.status(400).json({ error: "area param required", events: [] });

  // Cache check (bypassed when debug=1)
  const cacheKey = area.toLowerCase();
  const hit = cache.get(cacheKey);
  if (!isDebug && hit && Date.now() < hit.expiresAt) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json({ events: hit.events });
  }

  // Match pages to the requested area
  const matchedPages = FACEBOOK_PAGES.filter(p => matchesArea(p.area, area));

  if (matchedPages.length === 0) {
    return res.status(200).json({ events: [], note: "No registered pages for this area" });
  }

  const eventFields = "id,name,description,start_time,end_time,place,cover,is_canceled,ticket_uri";
  const now      = Date.now();
  const allEvents = [];
  const pageErrors = [];

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
        const r    = await fetch(url);
        const data = await r.json();

        if (!r.ok || data.error) {
          const code = data.error?.code;
          const msg  = data.error?.message ?? "unknown";
          pageErrors.push({ page: page.pageId, code, msg });

          if (code === 100 || code === 200) {
            console.warn(
              `[facebook-events] Permission error — Page Public Content Access may be required.\n` +
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
        pageErrors.push({ page: page.pageId, code: null, msg: err.message });
        console.warn(`[facebook-events] ${page.pageId} fetch error:`, err.message);
      }
    })
  );

  // Deduplicate by event ID
  const seen   = new Set();
  const unique = allEvents.filter(ev => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  // Sort by start_time ascending
  unique.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const result = unique.slice(0, MAX_RESULTS);
  console.log(
    `[facebook-events] area="${area}" pages=${matchedPages.length} ` +
    `raw=${allEvents.length} deduped=${result.length} errors=${pageErrors.length}`
  );

  if (!isDebug) {
    cache.set(cacheKey, { events: result, expiresAt: Date.now() + CACHE_MS });
  }
  res.setHeader("X-Cache", isDebug ? "BYPASS" : "MISS");

  const payload = { events: result };
  if (isDebug) {
    payload._debug = {
      tokenSource:  "EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN",
      matchedPages: matchedPages.map(p => p.pageId),
      rawCount:     allEvents.length,
      errors:       pageErrors,
    };
  }
  res.status(200).json(payload);
};
