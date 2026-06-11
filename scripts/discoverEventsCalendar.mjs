#!/usr/bin/env node
// ============================================================
// discoverEventsCalendar.mjs
// ------------------------------------------------------------
// Probes independent, self-hosted venues for structured events.
//
// For each venue it tries, in order:
//   1. The Events Calendar REST API:
//        {origin}/wp-json/tribe/events/v1/events
//      (sanctioned JSON endpoint — no scraping, no JSON-LD
//       parsing. The Events Calendar is the dominant WordPress
//       events plugin; this is exactly what Tellús360 runs.)
//   2. Fallback: schema.org Event JSON-LD on the events page.
//
// RUN THIS LOCALLY ON YOUR MAC:
//   node scripts/discoverEventsCalendar.mjs
//
// Running locally = residential IP. This is the whole point:
// the Vercel server-side 403s were datacenter-IP blocks at the
// CDN/WAF layer. A residential IP from your Mac avoids them,
// AND avoids the public-CORS-proxy blocks (we fetch direct).
//
// BOUNDARY — unchanged from Phase 1:
//   - Only read pages/endpoints returning a normal 200
//   - 403 / 503 / Cloudflare challenge / CAPTCHA body
//     -> mark BLOCKED, skip, NEVER bypass
//   - No proxies, no stealth, no CAPTCHA solving
//   - This only reads openly-published structured data
// ============================================================

const TIMEOUT_MS = 9000;

// Browser-like UA — legitimate, not evasion. Many WordPress
// sites 403 the default Node UA but serve normal clients fine.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36";

// Event @types accepted in JSON-LD fallback
const EVENT_TYPES = new Set([
  "event", "musicevent", "theaterevent", "comedyevent",
  "danceevent", "festival", "socialevent", "foodevent",
  "screeningevent", "exhibitionevent", "literaryevent",
  "visualartsevent", "childrensevent", "educationevent",
]);

// ─────────────────────────────────────────────────────────
// CANDIDATE VENUES — genuinely INDEPENDENT, likely self-hosted
// (WordPress + The Events Calendar). NOT ticketing-platform
// frontends. These are guesses for the script to confirm —
// the high-hit-rate layer Tellús360 and Tabernacle belong to.
//
// base   : venue origin (the script derives /wp-json from this)
// events : best-guess events listing page (JSON-LD fallback)
// area   : feedService city keyword
// ─────────────────────────────────────────────────────────
const VENUES = [
  // New York / Brooklyn
  { base: "https://lpr.com", events: "https://lpr.com/shows/", area: "new york", name: "(Le) Poisson Rouge" },
  { base: "https://www.barbesbrooklyn.com", events: "https://www.barbesbrooklyn.com/events", area: "new york", name: "Barbès" },
  { base: "https://www.unionpool.net", events: "https://www.unionpool.net/calendar", area: "new york", name: "Union Pool" },

  // Chicago
  { base: "https://hideoutchicago.com", events: "https://hideoutchicago.com/events/", area: "chicago", name: "The Hideout" },
  { base: "https://www.emptybottle.com", events: "https://www.emptybottle.com/events/", area: "chicago", name: "Empty Bottle" },
  { base: "https://www.constellation-chicago.com", events: "https://www.constellation-chicago.com/calendar/", area: "chicago", name: "Constellation" },

  // Los Angeles
  { base: "https://zebulon.la", events: "https://zebulon.la/calendar/", area: "los angeles", name: "Zebulon" },
  { base: "https://www.mccabes.com", events: "https://www.mccabes.com/concerts/", area: "los angeles", name: "McCabe's Guitar Shop" },
  { base: "https://www.themintla.com", events: "https://www.themintla.com/events/", area: "los angeles", name: "The Mint" },

  // San Francisco
  { base: "https://www.theindependentsf.com", events: "https://www.theindependentsf.com/calendar/", area: "san francisco", name: "The Independent" },
  { base: "https://www.cafedunord.com", events: "https://www.cafedunord.com/calendar/", area: "san francisco", name: "Café du Nord" },
  { base: "https://www.bottomofthehill.com", events: "https://www.bottomofthehill.com/calendar.html", area: "san francisco", name: "Bottom of the Hill" },

  // Austin
  { base: "https://www.continentalclub.com", events: "https://www.continentalclub.com/calendar/", area: "austin", name: "Continental Club" },
  { base: "https://antonesnightclub.com", events: "https://antonesnightclub.com/events/", area: "austin", name: "Antone's" },

  // Nashville
  { base: "https://bluebirdcafe.com", events: "https://bluebirdcafe.com/calendar/", area: "nashville", name: "Bluebird Cafe" },
  { base: "https://the5spotlive.com", events: "https://the5spotlive.com/events/", area: "nashville", name: "The 5 Spot" },

  // Seattle
  { base: "https://tractortavern.com", events: "https://tractortavern.com/events/", area: "seattle", name: "Tractor Tavern" },
  { base: "https://www.sunsettavern.com", events: "https://www.sunsettavern.com/events/", area: "seattle", name: "The Sunset Tavern" },

  // Portland
  { base: "https://www.mississippistudios.com", events: "https://www.mississippistudios.com/calendar/", area: "portland", name: "Mississippi Studios" },
  { base: "https://dougfirlounge.com", events: "https://dougfirlounge.com/events/", area: "portland", name: "Doug Fir Lounge" },

  // Boston
  { base: "https://www.passim.org", events: "https://www.passim.org/live-music/", area: "boston", name: "Club Passim" },

  // Denver
  { base: "https://hi-dive.com", events: "https://hi-dive.com/events/", area: "denver", name: "Hi-Dive" },
  { base: "https://www.larimerlounge.com", events: "https://www.larimerlounge.com/events/", area: "denver", name: "Larimer Lounge" },

  // New Orleans
  { base: "https://www.tipitinas.com", events: "https://www.tipitinas.com/events/", area: "new orleans", name: "Tipitina's" },
  { base: "https://www.dbaneworleans.com", events: "https://www.dbaneworleans.com/events/", area: "new orleans", name: "d.b.a." },

  // Philadelphia
  { base: "https://www.johnnybrendas.com", events: "https://www.johnnybrendas.com/events/", area: "philadelphia", name: "Johnny Brenda's" },

  // Atlanta
  { base: "https://www.eddiesattic.com", events: "https://www.eddiesattic.com/events/", area: "atlanta", name: "Eddie's Attic" },
  { base: "https://badearl.com", events: "https://badearl.com/calendar/", area: "atlanta", name: "The EARL" },

  // Washington DC
  { base: "https://www.dc9.club", events: "https://www.dc9.club/events/", area: "washington", name: "DC9" },
  { base: "https://www.pearlstreetwarehouse.com", events: "https://www.pearlstreetwarehouse.com/events/", area: "washington", name: "Pearl Street Warehouse" },

  // Asheville (strong indie scene, high self-host rate)
  { base: "https://thegreyeagle.com", events: "https://thegreyeagle.com/events/", area: "asheville", name: "The Grey Eagle" },
];

// ─────────────────────────────────────────────────────────
function isBlockedBody(text) {
  const t = text.slice(0, 1500).toLowerCase();
  return (
    t.includes("just a moment") ||
    t.includes("cf-browser-verification") ||
    t.includes("challenge-platform") ||
    t.includes("attention required") ||
    t.includes("captcha") ||
    t.includes("access denied")
  );
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, "Accept": "*/*", ...(opts.headers || {}) },
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// 1) The Events Calendar REST API
async function tryTEC(origin) {
  const url = `${origin}/wp-json/tribe/events/v1/events?per_page=20`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 403 || res.status === 503) return { mode: "TEC", status: "BLOCKED", n: 0 };
    if (!res.ok) return { mode: "TEC", status: `HTTP ${res.status}`, n: 0 };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return { mode: "TEC", status: "not-json", n: 0 };
    const data = await res.json();
    const events = data?.events;
    if (!Array.isArray(events) || events.length === 0)
      return { mode: "TEC", status: "no-events", n: 0 };
    const sample = events[0];
    return {
      mode: "TEC",
      status: "OK",
      n: data.total ?? events.length,
      sample: `${(sample.title || "").slice(0, 50)} — ${sample.start_date || "?"}`,
    };
  } catch (e) {
    return { mode: "TEC", status: e.name === "AbortError" ? "timeout" : "error", n: 0 };
  }
}

// 2) JSON-LD fallback on the events page
function extractJsonLdEvents(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let parsed;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    const nodes = [];
    const pushAll = (x) => {
      if (Array.isArray(x)) x.forEach(pushAll);
      else if (x && typeof x === "object") {
        if (Array.isArray(x["@graph"])) x["@graph"].forEach(pushAll);
        nodes.push(x);
      }
    };
    pushAll(parsed);
    for (const node of nodes) {
      let type = node["@type"];
      if (Array.isArray(type)) type = type.join(" ");
      if (typeof type !== "string") continue;
      if (type.toLowerCase().split(/\s+/).some((t) => EVENT_TYPES.has(t))) {
        if (node.name && node.startDate) out.push(node);
      }
    }
  }
  return out;
}

async function tryJsonLd(eventsUrl) {
  try {
    const res = await fetchWithTimeout(eventsUrl, {
      headers: { Accept: "text/html" },
    });
    if (res.status === 403 || res.status === 503) return { mode: "JSON-LD", status: "BLOCKED", n: 0 };
    if (!res.ok) return { mode: "JSON-LD", status: `HTTP ${res.status}`, n: 0 };
    const html = await res.text();
    if (isBlockedBody(html)) return { mode: "JSON-LD", status: "BLOCKED", n: 0 };
    const events = extractJsonLdEvents(html);
    if (events.length === 0) return { mode: "JSON-LD", status: "no-jsonld", n: 0 };
    return {
      mode: "JSON-LD",
      status: "OK",
      n: events.length,
      sample: `${(events[0].name || "").slice(0, 50)} — ${events[0].startDate || "?"}`,
    };
  } catch (e) {
    return { mode: "JSON-LD", status: e.name === "AbortError" ? "timeout" : "error", n: 0 };
  }
}

function originOf(url) {
  try { return new URL(url).origin; } catch { return url.replace(/\/+$/, ""); }
}

// ─────────────────────────────────────────────────────────
(async () => {
  console.log(`\nProbing ${VENUES.length} independent venues...`);
  console.log("TEC REST API first, JSON-LD fallback. Local residential IP.\n");

  const keepers = [];
  const rows = [];

  for (const v of VENUES) {
    const origin = originOf(v.base);

    let result = await tryTEC(origin);          // 1) sanctioned JSON API
    if (result.status !== "OK") {
      const jl = await tryJsonLd(v.events);      // 2) JSON-LD fallback
      // prefer whichever found events; otherwise keep the more informative status
      if (jl.status === "OK") result = jl;
      else result = result.status === "BLOCKED" || jl.status === "BLOCKED"
        ? { mode: `${result.mode}/${jl.mode}`, status: "BLOCKED", n: 0 }
        : jl.n >= result.n ? jl : result;
    }

    const tag =
      result.status === "OK" ? `✅ ${result.mode} ${result.n}` :
      result.status === "BLOCKED" ? "⛔ BLOCKED" :
      `· ${result.status}`;

    rows.push({
      name: v.name, area: v.area, status: tag,
      sample: result.status === "OK" ? result.sample : "",
    });

    if (result.status === "OK" && result.n > 0) {
      keepers.push({ ...v, origin, mode: result.mode, n: result.n });
    }
  }

  // ---- table ----
  console.log("RESULTS");
  console.log("".padEnd(86, "─"));
  for (const r of rows) {
    console.log(
      r.name.padEnd(26) +
      r.area.padEnd(15) +
      r.status.padEnd(16) +
      (r.sample || "")
    );
  }
  console.log("".padEnd(86, "─"));

  // ---- keepers summary ----
  console.log(`\n${keepers.length} CONFIRMED venue(s) with structured events:\n`);
  if (keepers.length === 0) {
    console.log("None. Try a different batch of self-hosted independents.\n");
    return;
  }

  console.log("Paste into src/config/structuredDataSources.ts:");
  console.log("(TEC keepers can use the REST API directly; JSON-LD keepers use the page URL)\n");
  for (const k of keepers) {
    const usesTEC = k.mode === "TEC";
    console.log(`  {`);
    console.log(`    url: "${usesTEC ? k.origin + "/wp-json/tribe/events/v1/events" : k.events}",`);
    console.log(`    name: "${k.name}",`);
    console.log(`    area: "${k.area}",`);
    console.log(`    sourceLabel: "${k.name}",`);
    console.log(`    parser: "${usesTEC ? "tec-rest" : "json-ld"}",   // ${k.n} events found`);
    console.log(`    tags: ["${k.area}", "Live Music"],`);
    console.log(`  },`);
  }

  console.log(`\nAdd these hostnames to api/fetch-page.js ALLOWED_HOSTS:`);
  for (const k of keepers) console.log(`  "${new URL(k.origin).hostname}",`);
  console.log("");
})();
