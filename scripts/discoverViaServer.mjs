// scripts/discoverViaServer.mjs
//
// Like discoverStructuredData.mjs but fetches through the deployed
// /api/fetch-page server-side proxy instead of the public CORS chain.
// Requires the TEMPORARY x-discovery-test: 1 bypass to be active in
// api/fetch-page.js — run ONLY during the discovery window, then remove
// that bypass and delete this script.
//
// BOUNDARY: same as the main parser — 403/503/challenge = BLOCKED, skip.
// Never bypasses protection, never retries against a block.

const PROXY_BASE = "https://www.nearbyandnow.com";

const BLOCK_MARKERS = [
  "just a moment", "cf-browser-verification", "cf-challenge", "challenge-platform",
  "attention required", "captcha", "/cdn-cgi/challenge", "enable javascript and cookies",
];

async function fetchViaServer(url) {
  try {
    const res = await fetch(
      `${PROXY_BASE}/api/fetch-page?url=${encodeURIComponent(url)}`,
      {
        headers: {
          "x-discovery-test": "1",
          "Accept": "text/html,*/*",
        },
        signal: AbortSignal.timeout(15_000),
      }
    );
    const text = await res.text();
    if (res.status === 403 || res.status === 503 || res.status === 429) {
      return { blocked: `HTTP ${res.status}` };
    }
    if (res.status === 404) return { status: 404, text: "" };
    const low = text.slice(0, 4000).toLowerCase();
    if (BLOCK_MARKERS.some(m => low.includes(m))) return { blocked: "bot-challenge page" };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    if (!text || text.length < 100) return { error: "empty body" };
    return { status: res.status, text };
  } catch (e) {
    return { error: e.message ?? "fetch failed" };
  }
}

// ─── JSON-LD scanner (same logic as discoverStructuredData.mjs) ─────────────

function scanJsonLd(html) {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ].map(m => m[1].trim());
  const events = [];
  const isEventType = t =>
    t === "Event" ||
    (Array.isArray(t) && t.some(x => /Event$/.test(x))) ||
    (typeof t === "string" && /Event$/.test(t));
  const collect = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(collect); return; }
    if (node["@graph"]) collect(node["@graph"]);
    if (isEventType(node["@type"])) events.push(node);
  };
  for (const raw of blocks) {
    try { collect(JSON.parse(raw)); } catch { /* skip malformed */ }
  }
  const s = events[0];
  const sample = s
    ? {
        name: s.name,
        startDate: s.startDate,
        location:
          s.location?.name ??
          s.location?.address?.addressLocality ??
          (typeof s.location === "string" ? s.location : undefined),
      }
    : null;
  return { count: events.length, sample };
}

// ─── Candidates — all "all proxies failed" from Phase 2 run ─────────────────

const CANDIDATES = [
  // Lancaster, PA
  { url: "https://www.visitlancastercity.com/events/",          area: "lancaster",     name: "Visit Lancaster City" },
  { url: "https://www.discoverlancaster.com/events/",           area: "lancaster",     name: "Discover Lancaster" },
  { url: "https://www.thefulton.org/events/",                   area: "lancaster",     name: "Fulton Theatre" },
  { url: "https://phantompowerlancaster.com/shows/",            area: "lancaster",     name: "Phantom Power" },

  // NYC
  { url: "https://www.carnegiehall.org/Calendar",               area: "nyc",           name: "Carnegie Hall" },
  { url: "https://www.msg.com/calendar",                        area: "nyc",           name: "Madison Square Garden" },
  { url: "https://www.brooklynbowl.com/new-york/events",        area: "nyc",           name: "Brooklyn Bowl" },

  // Los Angeles
  { url: "https://www.hollywoodbowl.com/events",                area: "los angeles",   name: "Hollywood Bowl" },
  { url: "https://www.waltdisneyconcerthall.org/",              area: "los angeles",   name: "Walt Disney Concert Hall" },
  { url: "https://www.theroxy.com/calendar/",                   area: "los angeles",   name: "The Roxy" },
  { url: "https://www.crypto.com/arena/events",                 area: "los angeles",   name: "Crypto.com Arena" },
  { url: "https://www.thewiltern.com/shows",                    area: "los angeles",   name: "The Wiltern" },

  // Chicago
  { url: "https://www.unitedcenter.com/events/",                area: "chicago",       name: "United Center" },
  { url: "https://www.auditoriumtheatre.org/events",            area: "chicago",       name: "Auditorium Theatre" },
  { url: "https://www.lh-st.com/",                              area: "chicago",       name: "Lincoln Hall / Schubas" },

  // Houston
  { url: "https://www.houstonsymphony.org/tickets-events/",     area: "houston",       name: "Houston Symphony" },
  { url: "https://www.thehobbycenter.org/events/",              area: "houston",       name: "Hobby Center" },
  { url: "https://www.warehouselive.com/calendar/",             area: "houston",       name: "Warehouse Live" },
  { url: "https://www.houstontoyotacenter.com/events",          area: "houston",       name: "Toyota Center" },
  { url: "https://www.whiteoakmusichall.com/calendar/",         area: "houston",       name: "White Oak Music Hall" },

  // Phoenix
  { url: "https://www.footprintcenter.com/events",              area: "phoenix",       name: "Footprint Center" },
  { url: "https://www.thevanburenphx.com/shows",                area: "phoenix",       name: "The Van Buren" },
  { url: "https://www.crescentphx.com/calendar/",              area: "phoenix",       name: "Crescent Ballroom" },
  { url: "https://www.phoenixsymphony.org/concerts-tickets/",   area: "phoenix",       name: "Phoenix Symphony" },

  // Philadelphia
  { url: "https://www.kimmelculturalcampus.org/events-and-tickets/", area: "philadelphia", name: "Kimmel Center" },
  { url: "https://www.thefillmorephilly.com/shows",             area: "philadelphia",  name: "The Fillmore Philadelphia" },
  { url: "https://www.uniontransfer.com/calendar/",             area: "philadelphia",  name: "Union Transfer" },
  { url: "https://www.worldcafelive.com/calendar/",             area: "philadelphia",  name: "World Cafe Live" },

  // San Antonio
  { url: "https://www.majesticempire.com/events",               area: "san antonio",   name: "Majestic Theatre" },

  // San Diego
  { url: "https://www.thesoundsd.com/calendar/",                area: "san diego",     name: "The Sound" },
  { url: "https://www.houseofblues.com/sandiego",               area: "san diego",     name: "House of Blues San Diego" },
  { url: "https://www.theobservatorysd.com/calendar/",          area: "san diego",     name: "Observatory North Park" },
  { url: "https://www.sandiegotheatres.org/events/",            area: "san diego",     name: "San Diego Theatres" },

  // Dallas
  { url: "https://www.attpac.org/on-sale/",                     area: "dallas",        name: "AT&T Performing Arts Center" },
  { url: "https://www.thebombfactory.com/events",               area: "dallas",        name: "The Factory in Deep Ellum" },

  // Austin
  { url: "https://www.acl-live.com/calendar",                   area: "austin",        name: "ACL Live" },
  { url: "https://www.stubbsaustin.com/calendar/",              area: "austin",        name: "Stubb's" },
  { url: "https://www.mohawkaustin.com/calendar/",              area: "austin",        name: "Mohawk" },
  { url: "https://www.emosaustin.com/events",                   area: "austin",        name: "Emo's" },
  { url: "https://www.thelongcenter.org/events/",               area: "austin",        name: "The Long Center" },

  // Jacksonville
  { url: "https://www.fscjartistseries.org/events/",            area: "jacksonville",  name: "FSCJ Artist Series" },
  { url: "https://www.pvconcerthall.com/events",                area: "jacksonville",  name: "Ponte Vedra Concert Hall" },

  // San Jose
  { url: "https://www.sapcenter.com/events",                    area: "san jose",      name: "SAP Center" },
  { url: "https://www.thecitynational.com/",                    area: "san jose",      name: "City National Civic" },
  { url: "https://www.sanjosetheaters.org/events/",             area: "san jose",      name: "San Jose Theaters" },

  // Fort Worth
  { url: "https://www.basshall.com/events",                     area: "fort worth",    name: "Bass Performance Hall" },
  { url: "https://www.dickiesarena.com/events/",                area: "fort worth",    name: "Dickies Arena" },

  // Columbus
  { url: "https://www.promowestlive.com/columbus",              area: "columbus",      name: "PromoWest / KEMBA Live" },
  { url: "https://www.capa.com/events/",                        area: "columbus",      name: "CAPA Columbus" },

  // Charlotte
  { url: "https://www.blumenthalarts.org/events",               area: "charlotte",     name: "Blumenthal Arts" },
  { url: "https://www.spectrumcentercharlotte.com/events",      area: "charlotte",     name: "Spectrum Center" },
  { url: "https://www.theundergroundnc.com/calendar/",          area: "charlotte",     name: "The Underground" },

  // San Francisco
  { url: "https://www.thefillmore.com/calendar/",               area: "san francisco", name: "The Fillmore" },
  { url: "https://www.sfsymphony.org/Buy-Tickets/Calendar",     area: "san francisco", name: "SF Symphony" },
  { url: "https://www.thegreatamericanmusichall.com/calendar/", area: "san francisco", name: "Great American Music Hall" },
  { url: "https://www.thechapelsf.com/music/",                  area: "san francisco", name: "The Chapel" },
  { url: "https://www.billgrahamcivic.com/events",              area: "san francisco", name: "Bill Graham Civic Auditorium" },

  // Seattle
  { url: "https://www.theshowboxpresents.com/shows",            area: "seattle",       name: "The Showbox" },
  { url: "https://www.stgpresents.org/events",                  area: "seattle",       name: "STG Presents" },
  { url: "https://www.climatepledgearena.com/events/",          area: "seattle",       name: "Climate Pledge Arena" },
  { url: "https://www.neumos.com/calendar/",                    area: "seattle",       name: "Neumos" },

  // Denver
  { url: "https://www.bluebirdtheater.net/calendar/",           area: "denver",        name: "Bluebird Theater" },
  { url: "https://www.gothictheatre.com/calendar/",             area: "denver",        name: "Gothic Theatre" },
  { url: "https://www.redrocksonline.com/events/",              area: "denver",        name: "Red Rocks Amphitheatre" },

  // Nashville
  { url: "https://www.ryman.com/events/",                       area: "nashville",     name: "Ryman Auditorium" },
  { url: "https://www.bridgestonearena.com/events",             area: "nashville",     name: "Bridgestone Arena" },
  { url: "https://www.exitin.com/calendar/",                    area: "nashville",     name: "Exit/In" },
  { url: "https://www.tpac.org/events/",                        area: "nashville",     name: "Tennessee Performing Arts Center" },

  // Boston
  { url: "https://www.crossroadspresents.com/venues/house-of-blues-boston", area: "boston", name: "House of Blues Boston" },
  { url: "https://www.bostonsymphony.org/Performances.aspx",    area: "boston",        name: "Boston Symphony" },
  { url: "https://www.tdgarden.com/events",                     area: "boston",        name: "TD Garden" },
  { url: "https://www.crossroadspresents.com/venues/paradise-rock-club", area: "boston", name: "Paradise Rock Club" },
  { url: "https://www.thesinclair.com/calendar/",               area: "boston",        name: "The Sinclair" },

  // Washington DC
  { url: "https://www.930.com/calendar/",                       area: "washington",    name: "9:30 Club" },
  { url: "https://www.thekennedycenter.org/whats-on/",          area: "washington",    name: "Kennedy Center" },
  { url: "https://www.capitalonearena.com/events",              area: "washington",    name: "Capital One Arena" },
  { url: "https://www.theanthemdc.com/shows",                   area: "washington",    name: "The Anthem" },
  { url: "https://www.blackcatdc.com/calendar.html",            area: "washington",    name: "Black Cat" },

  // Atlanta
  { url: "https://www.foxtheatre.org/events",                   area: "atlanta",       name: "Fox Theatre" },
  { url: "https://www.statefarmarena.com/events",               area: "atlanta",       name: "State Farm Arena" },
  { url: "https://www.variety-playhouse.com/calendar/",         area: "atlanta",       name: "Variety Playhouse" },
  { url: "https://www.theroxyatlanta.com/shows",                area: "atlanta",       name: "The Roxy Atlanta" },

  // Miami
  { url: "https://www.arshtcenter.org/tickets/calendar/",       area: "miami",         name: "Arsht Center" },
  { url: "https://www.northbeachbandshell.com/events",          area: "miami",         name: "North Beach Bandshell" },
  { url: "https://www.olympiatheater.org/events",               area: "miami",         name: "Olympia Theater" },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

const rows = [];
for (const { url, area, name } of CANDIDATES) {
  process.stdout.write(`  testing ${name}...`);
  const page = await fetchViaServer(url);

  if (page.blocked) {
    rows.push({ url, area, name, status: `BLOCKED (${page.blocked})`, jsonld: "—", sample: "skipped" });
    process.stdout.write(` blocked\n`);
    continue;
  }
  if (page.error) {
    rows.push({ url, area, name, status: `ERROR (${page.error})`, jsonld: "—", sample: page.error });
    process.stdout.write(` error\n`);
    continue;
  }
  if (page.status === 404) {
    rows.push({ url, area, name, status: "404", jsonld: "—", sample: "—" });
    process.stdout.write(` 404\n`);
    continue;
  }

  const jl = scanJsonLd(page.text);
  rows.push({
    url, area, name,
    status: "OK",
    jsonld: jl.count,
    sample: jl.sample?.name
      ? `"${String(jl.sample.name).slice(0, 60)}" @ ${jl.sample.startDate ?? "?"}`
      : "—",
  });
  process.stdout.write(` ok — ${jl.count} events\n`);
}

console.log("\n══════ SERVER-PROXY DISCOVERY RESULTS ══════\n");
for (const r of rows) {
  const keep = typeof r.jsonld === "number" && r.jsonld > 0 ? "  ✓ KEEP" : "";
  console.log(`[${r.area}] ${r.name}${keep}`);
  console.log(`  URL:    ${r.url}`);
  console.log(`  status: ${r.status}  |  JSON-LD events: ${r.jsonld}`);
  if (r.sample && r.sample !== "—" && r.sample !== "skipped") console.log(`  sample: ${r.sample}`);
  console.log("");
}

const keepers = rows.filter(r => typeof r.jsonld === "number" && r.jsonld > 0);
console.log(`\n══════ KEEPERS (${keepers.length}/${rows.length}) ══════\n`);
if (keepers.length === 0) {
  console.log("No new venues confirmed.");
} else {
  console.log("// Add to src/config/structuredDataSources.ts:");
  for (const r of keepers) {
    const label = r.name;
    const city = r.area.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    console.log(`  { url: "${r.url}", name: "${label}", area: "${r.area}", sourceLabel: "${label}", tags: ["${city}"] },`);
  }
  console.log("\n// Add to ALLOWED_HOSTS in api/fetch-page.js:");
  const hosts = [...new Set(keepers.map(r => new URL(r.url).hostname))];
  for (const h of hosts) console.log(`  "${h}",`);
}
