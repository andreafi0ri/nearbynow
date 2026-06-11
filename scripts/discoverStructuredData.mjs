// scripts/discoverStructuredData.mjs — THROWAWAY discovery script (Phase 1).
//
// Reads ONLY pages that return a normal 200. Any bot-protection response
// (403/503/Cloudflare "Just a moment"/Attention Required/CAPTCHA) is marked
// BLOCKED and skipped — no retry, no bypass, no escalation. This only looks at
// openly-published structured data (schema.org Event JSON-LD, .ics, RSS).

const PROXIES = [
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
];

const BLOCK_MARKERS = [
  "just a moment", "cf-browser-verification", "cf-challenge", "challenge-platform",
  "attention required", "captcha", "/cdn-cgi/challenge", "enable javascript and cookies",
];

/** Fetch through the CORS proxy chain. Returns {status, text} or {blocked} or {error}. */
async function fetchPage(url) {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(url), { signal: AbortSignal.timeout(14000) });
      const text = await res.text();
      const low = text.slice(0, 4000).toLowerCase();
      if (res.status === 403 || res.status === 503) return { blocked: `HTTP ${res.status}` };
      if (BLOCK_MARKERS.some((m) => low.includes(m))) return { blocked: "bot-challenge page" };
      if (res.status === 404) return { status: 404, text: "" };
      if (res.ok && text.length > 0) return { status: 200, text };
    } catch { /* try next proxy */ }
  }
  return { error: "all proxies failed" };
}

// ─── A) JSON-LD Event scan ──────────────────────────────────────────────────
function scanJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim());
  const events = [];
  const isEventType = (t) =>
    t === "Event" || (Array.isArray(t) && t.some((x) => /Event$/.test(x))) || (typeof t === "string" && /Event$/.test(t));
  const collect = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(collect); return; }
    if (node["@graph"]) collect(node["@graph"]);
    if (isEventType(node["@type"])) events.push(node);
  };
  for (const raw of blocks) {
    try { collect(JSON.parse(raw)); } catch { /* skip malformed block */ }
  }
  const sample = events[0]
    ? {
        name: events[0].name,
        startDate: events[0].startDate,
        location:
          events[0].location?.name ??
          events[0].location?.address?.addressLocality ??
          (typeof events[0].location === "string" ? events[0].location : undefined),
      }
    : null;
  return { count: events.length, sample };
}

// ─── B) iCal scan ────────────────────────────────────────────────────────────
async function scanIcs(html, origin) {
  const found = [...html.matchAll(/href=["']([^"']+\.ics[^"']*)["']/gi)].map((m) => m[1]);
  const candidates = [
    ...new Set(found.map((h) => (h.startsWith("http") ? h : origin + (h.startsWith("/") ? h : "/" + h)))),
    `${origin}/events.ics`, `${origin}/calendar.ics`, `${origin}/calendar/ical`, `${origin}/?ical=1`,
  ];
  for (const url of candidates) {
    const r = await fetchPage(url);
    if (r.status === 200 && r.text.includes("BEGIN:VEVENT")) {
      return { count: (r.text.match(/BEGIN:VEVENT/g) ?? []).length, url };
    }
  }
  return { count: 0, url: null };
}

// ─── C) RSS/Atom scan ──────────────────────────────────────────────────────────
async function scanRss(origin) {
  for (const path of ["/events/feed", "/events/feed/", "/feed", "/feed/", "/rss"]) {
    const r = await fetchPage(origin + path);
    if (r.status === 200 && (r.text.includes("<rss") || r.text.includes("<feed") || r.text.includes("<channel"))) {
      const items = (r.text.match(/<item[\s>]/gi) ?? []).length + (r.text.match(/<entry[\s>]/gi) ?? []).length;
      if (items > 0) return { found: true, items, path };
    }
  }
  return { found: false, items: 0, path: null };
}

// area values are aligned with rssSources.ts convention:
// "nyc" (not "new york"), "washington" (not "dc"), etc.
const CANDIDATES = [
  // Lancaster, PA (original set)
  { url: "https://www.visitlancastercity.com/events/",          area: "lancaster",     name: "Visit Lancaster City" },
  { url: "https://www.discoverlancaster.com/events/",           area: "lancaster",     name: "Discover Lancaster" },
  { url: "https://www.cityoflancasterpa.gov/calendar/",         area: "lancaster",     name: "City of Lancaster" },
  { url: "https://www.thefulton.org/events/",                   area: "lancaster",     name: "Fulton Theatre" },
  { url: "https://www.longspark.org/events/",                   area: "lancaster",     name: "Long's Park" },
  { url: "https://www.tellus360.com/events/",                   area: "lancaster",     name: "Tellus360" },
  { url: "https://phantompowerlancaster.com/shows/",            area: "lancaster",     name: "Phantom Power" },
  { url: "https://www.lancaster.lib.pa.us/events/",             area: "lancaster",     name: "Lancaster Library" },
  { url: "https://www.theamericanmusictheatre.com/events/",     area: "lancaster",     name: "American Music Theatre" },

  // New York, NY — "nyc" matches rssSources convention
  { url: "https://www.bowerypresents.com/shows/",               area: "nyc",           name: "The Bowery Presents" },
  { url: "https://www.carnegiehall.org/Calendar",               area: "nyc",           name: "Carnegie Hall" },
  { url: "https://www.bam.org/calendar",                        area: "nyc",           name: "Brooklyn Academy of Music" },
  { url: "https://www.msg.com/calendar",                        area: "nyc",           name: "Madison Square Garden" },
  { url: "https://www.brooklynbowl.com/new-york/events",        area: "nyc",           name: "Brooklyn Bowl" },
  { url: "https://www.bluenote.net/newyork/schedule/",          area: "nyc",           name: "Blue Note NYC" },

  // Los Angeles, CA
  { url: "https://www.hollywoodbowl.com/events",                area: "los angeles",   name: "Hollywood Bowl" },
  { url: "https://www.theforum.com/events",                     area: "los angeles",   name: "Kia Forum" },
  { url: "https://www.waltdisneyconcerthall.org/",              area: "los angeles",   name: "Walt Disney Concert Hall" },
  { url: "https://www.theroxy.com/calendar/",                   area: "los angeles",   name: "The Roxy" },
  { url: "https://www.crypto.com/arena/events",                 area: "los angeles",   name: "Crypto.com Arena" },
  { url: "https://www.thewiltern.com/shows",                    area: "los angeles",   name: "The Wiltern" },

  // Chicago, IL
  { url: "https://www.thaliahallchicago.com/calendar",          area: "chicago",       name: "Thalia Hall" },
  { url: "https://www.metrochicago.com/shows/",                 area: "chicago",       name: "Metro Chicago" },
  { url: "https://www.jamusa.com/venues/house-of-blues-chicago/", area: "chicago",     name: "House of Blues Chicago" },
  { url: "https://www.unitedcenter.com/events/",                area: "chicago",       name: "United Center" },
  { url: "https://www.auditoriumtheatre.org/events",            area: "chicago",       name: "Auditorium Theatre" },
  { url: "https://www.lh-st.com/",                              area: "chicago",       name: "Lincoln Hall / Schubas" },

  // Houston, TX
  { url: "https://www.houstonsymphony.org/tickets-events/",     area: "houston",       name: "Houston Symphony" },
  { url: "https://www.thehobbycenter.org/events/",              area: "houston",       name: "Hobby Center" },
  { url: "https://www.warehouselive.com/calendar/",             area: "houston",       name: "Warehouse Live" },
  { url: "https://www.houstontoyotacenter.com/events",          area: "houston",       name: "Toyota Center" },
  { url: "https://www.whiteoakmusichall.com/calendar/",         area: "houston",       name: "White Oak Music Hall" },

  // Phoenix, AZ
  { url: "https://www.footprintcenter.com/events",              area: "phoenix",       name: "Footprint Center" },
  { url: "https://www.thevanburenphx.com/shows",                area: "phoenix",       name: "The Van Buren" },
  { url: "https://www.crescentphx.com/calendar/",              area: "phoenix",       name: "Crescent Ballroom" },
  { url: "https://www.phoenixsymphony.org/concerts-tickets/",   area: "phoenix",       name: "Phoenix Symphony" },

  // Philadelphia, PA
  { url: "https://www.kimmelculturalcampus.org/events-and-tickets/", area: "philadelphia", name: "Kimmel Center" },
  { url: "https://www.thefillmorephilly.com/shows",             area: "philadelphia",  name: "The Fillmore Philadelphia" },
  { url: "https://www.uniontransfer.com/calendar/",             area: "philadelphia",  name: "Union Transfer" },
  { url: "https://www.wellsfargocenterphilly.com/events",       area: "philadelphia",  name: "Wells Fargo Center" },
  { url: "https://www.worldcafelive.com/calendar/",             area: "philadelphia",  name: "World Cafe Live" },

  // San Antonio, TX
  { url: "https://www.majesticempire.com/events",               area: "san antonio",   name: "Majestic Theatre" },
  { url: "https://www.frostbankcenter.com/events",              area: "san antonio",   name: "Frost Bank Center" },
  { url: "https://www.thepapertiger.com/",                      area: "san antonio",   name: "Paper Tiger" },

  // San Diego, CA
  { url: "https://www.thesoundsd.com/calendar/",                area: "san diego",     name: "The Sound" },
  { url: "https://www.houseofblues.com/sandiego",               area: "san diego",     name: "House of Blues San Diego" },
  { url: "https://www.theobservatorysd.com/calendar/",          area: "san diego",     name: "Observatory North Park" },
  { url: "https://www.sandiegotheatres.org/events/",            area: "san diego",     name: "San Diego Theatres" },

  // Dallas, TX
  { url: "https://www.granadatheater.com/calendar/",            area: "dallas",        name: "Granada Theater" },
  { url: "https://www.americanairlinescenter.com/events",       area: "dallas",        name: "American Airlines Center" },
  { url: "https://www.attpac.org/on-sale/",                     area: "dallas",        name: "AT&T Performing Arts Center" },
  { url: "https://www.thebombfactory.com/events",               area: "dallas",        name: "The Factory in Deep Ellum" },

  // Austin, TX
  { url: "https://www.acl-live.com/calendar",                   area: "austin",        name: "ACL Live" },
  { url: "https://www.stubbsaustin.com/calendar/",              area: "austin",        name: "Stubb's" },
  { url: "https://www.mohawkaustin.com/calendar/",              area: "austin",        name: "Mohawk" },
  { url: "https://www.emosaustin.com/events",                   area: "austin",        name: "Emo's" },
  { url: "https://www.thelongcenter.org/events/",               area: "austin",        name: "The Long Center" },

  // Jacksonville, FL
  { url: "https://www.fscjartistseries.org/events/",            area: "jacksonville",  name: "FSCJ Artist Series" },
  { url: "https://www.jaxevents.com/events/",                   area: "jacksonville",  name: "VyStar Veterans Memorial Arena" },
  { url: "https://www.pvconcerthall.com/events",                area: "jacksonville",  name: "Ponte Vedra Concert Hall" },

  // San Jose, CA
  { url: "https://www.sapcenter.com/events",                    area: "san jose",      name: "SAP Center" },
  { url: "https://www.thecitynational.com/",                    area: "san jose",      name: "City National Civic" },
  { url: "https://www.sanjosetheaters.org/events/",             area: "san jose",      name: "San Jose Theaters" },

  // Fort Worth, TX
  { url: "https://www.basshall.com/events",                     area: "fort worth",    name: "Bass Performance Hall" },
  { url: "https://www.dickiesarena.com/events/",                area: "fort worth",    name: "Dickies Arena" },
  { url: "https://www.billybobstexas.com/events/",              area: "fort worth",    name: "Billy Bob's Texas" },

  // Columbus, OH
  { url: "https://www.promowestlive.com/columbus",              area: "columbus",      name: "PromoWest / KEMBA Live" },
  { url: "https://www.capa.com/events/",                        area: "columbus",      name: "CAPA Columbus" },
  { url: "https://www.nationwidearena.com/events",              area: "columbus",      name: "Nationwide Arena" },

  // Charlotte, NC
  { url: "https://www.blumenthalarts.org/events",               area: "charlotte",     name: "Blumenthal Arts" },
  { url: "https://www.spectrumcentercharlotte.com/events",      area: "charlotte",     name: "Spectrum Center" },
  { url: "https://www.theundergroundnc.com/calendar/",          area: "charlotte",     name: "The Underground" },

  // San Francisco, CA
  { url: "https://www.thefillmore.com/calendar/",               area: "san francisco", name: "The Fillmore" },
  { url: "https://www.sfsymphony.org/Buy-Tickets/Calendar",     area: "san francisco", name: "SF Symphony" },
  { url: "https://www.thegreatamericanmusichall.com/calendar/", area: "san francisco", name: "Great American Music Hall" },
  { url: "https://www.thechapelsf.com/music/",                  area: "san francisco", name: "The Chapel" },
  { url: "https://www.billgrahamcivic.com/events",              area: "san francisco", name: "Bill Graham Civic Auditorium" },

  // Seattle, WA
  { url: "https://www.theshowboxpresents.com/shows",            area: "seattle",       name: "The Showbox" },
  { url: "https://www.stgpresents.org/events",                  area: "seattle",       name: "STG Presents" },
  { url: "https://www.climatepledgearena.com/events/",          area: "seattle",       name: "Climate Pledge Arena" },
  { url: "https://www.neumos.com/calendar/",                    area: "seattle",       name: "Neumos" },
  { url: "https://www.thecrocodile.com/calendar/",              area: "seattle",       name: "The Crocodile" },

  // Denver, CO
  { url: "https://www.axs.com/venues/103633/ogden-theatre-denver-tickets", area: "denver", name: "Ogden Theatre" },
  { url: "https://www.bluebirdtheater.net/calendar/",           area: "denver",        name: "Bluebird Theater" },
  { url: "https://www.ballarena.com/events/",                   area: "denver",        name: "Ball Arena" },
  { url: "https://www.gothictheatre.com/calendar/",             area: "denver",        name: "Gothic Theatre" },
  { url: "https://www.redrocksonline.com/events/",              area: "denver",        name: "Red Rocks Amphitheatre" },

  // Nashville, TN
  { url: "https://www.ryman.com/events/",                       area: "nashville",     name: "Ryman Auditorium" },
  { url: "https://www.bridgestonearena.com/events",             area: "nashville",     name: "Bridgestone Arena" },
  { url: "https://www.exitin.com/calendar/",                    area: "nashville",     name: "Exit/In" },
  { url: "https://www.thebasementnashville.com/shows",          area: "nashville",     name: "The Basement" },
  { url: "https://www.tpac.org/events/",                        area: "nashville",     name: "Tennessee Performing Arts Center" },

  // Boston, MA
  { url: "https://www.crossroadspresents.com/venues/house-of-blues-boston", area: "boston", name: "House of Blues Boston" },
  { url: "https://www.bostonsymphony.org/Performances.aspx",    area: "boston",        name: "Boston Symphony" },
  { url: "https://www.tdgarden.com/events",                     area: "boston",        name: "TD Garden" },
  { url: "https://www.crossroadspresents.com/venues/paradise-rock-club", area: "boston", name: "Paradise Rock Club" },
  { url: "https://www.thesinclair.com/calendar/",               area: "boston",        name: "The Sinclair" },

  // Washington, DC — "washington" matches rssSources convention
  { url: "https://www.930.com/calendar/",                       area: "washington",    name: "9:30 Club" },
  { url: "https://www.thekennedycenter.org/whats-on/",          area: "washington",    name: "Kennedy Center" },
  { url: "https://www.capitalonearena.com/events",              area: "washington",    name: "Capital One Arena" },
  { url: "https://www.theanthemdc.com/shows",                   area: "washington",    name: "The Anthem" },
  { url: "https://www.blackcatdc.com/calendar.html",            area: "washington",    name: "Black Cat" },

  // Atlanta, GA
  { url: "https://www.tabernacleatl.com/shows",                 area: "atlanta",       name: "Tabernacle" },
  { url: "https://www.foxtheatre.org/events",                   area: "atlanta",       name: "Fox Theatre" },
  { url: "https://www.statefarmarena.com/events",               area: "atlanta",       name: "State Farm Arena" },
  { url: "https://www.variety-playhouse.com/calendar/",         area: "atlanta",       name: "Variety Playhouse" },
  { url: "https://www.theroxyatlanta.com/shows",                area: "atlanta",       name: "The Roxy Atlanta" },

  // Miami, FL
  { url: "https://www.arshtcenter.org/tickets/calendar/",       area: "miami",         name: "Arsht Center" },
  { url: "https://www.kaseyacenter.com/events",                 area: "miami",         name: "Kaseya Center" },
  { url: "https://www.northbeachbandshell.com/events",          area: "miami",         name: "North Beach Bandshell" },
  { url: "https://www.olympiatheater.org/events",               area: "miami",         name: "Olympia Theater" },
];

const rows = [];
for (const { url, area, name } of CANDIDATES) {
  const origin = new URL(url).origin;
  const page = await fetchPage(url);

  if (page.blocked) { rows.push({ url, area, name, status: `BLOCKED (${page.blocked})`, jsonld: "—", ics: "—", rss: "—", sample: "skipped" }); continue; }
  if (page.error)   { rows.push({ url, area, name, status: "ERROR",                      jsonld: "—", ics: "—", rss: "—", sample: page.error }); continue; }
  if (page.status === 404) { rows.push({ url, area, name, status: "404",                 jsonld: "—", ics: "—", rss: "—", sample: "—" }); continue; }

  const jl = scanJsonLd(page.text);
  const ics = await scanIcs(page.text, origin);
  const rss = await scanRss(origin);

  rows.push({
    url, area, name,
    status: "OK",
    jsonld: jl.count,
    ics: ics.count + (ics.url ? ` (${ics.url.replace(origin, "")})` : ""),
    rss: rss.found ? `${rss.items} (${rss.path})` : "0",
    sample: jl.sample?.name ? `"${String(jl.sample.name).slice(0, 50)}" @ ${jl.sample.startDate ?? "?"}` : "—",
  });
}

console.log("\n══════ STRUCTURED-DATA DISCOVERY (Phase 2 — US Cities) ══════\n");
for (const r of rows) {
  const keep = r.jsonld > 0 ? " ✓ KEEP" : "";
  console.log(`[${r.area}] ${r.name}${keep}`);
  console.log(`  URL:    ${r.url}`);
  console.log(`  status: ${r.status}  |  JSON-LD events: ${r.jsonld}  |  iCal: ${r.ics}  |  RSS: ${r.rss}`);
  if (r.sample && r.sample !== "—") console.log(`  sample: ${r.sample}`);
  console.log("");
}

// Summary of keepers
const keepers = rows.filter(r => r.status === "OK" && r.jsonld > 0);
console.log(`\n══════ KEEPERS (${keepers.length}/${rows.length}) ══════\n`);
console.log("// Paste into src/config/structuredDataSources.ts:");
for (const r of keepers) {
  console.log(`  { url: "${r.url}", name: "${r.name}", area: "${r.area}", sourceLabel: "${r.name}", tags: ["${r.area.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}"] },`);
}
console.log("\n// Add these hostnames to ALLOWED_HOSTS in api/fetch-page.js:");
const hosts = [...new Set(keepers.map(r => new URL(r.url).hostname))];
for (const h of hosts) console.log(`  "${h}",`);
