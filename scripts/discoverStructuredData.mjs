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

const URLS = [
  "https://www.visitlancastercity.com/events/",
  "https://www.discoverlancaster.com/events/",
  "https://www.cityoflancasterpa.gov/calendar/",
  "https://www.thefulton.org/events/",
  "https://www.longspark.org/events/",
  "https://www.tellus360.com/events/",
  "https://phantompowerlancaster.com/shows/",
  "https://www.lancaster.lib.pa.us/events/",
  "https://www.theamericanmusictheatre.com/events/",
];

const rows = [];
for (const url of URLS) {
  const origin = new URL(url).origin;
  const page = await fetchPage(url);

  if (page.blocked) { rows.push({ url, status: `BLOCKED (${page.blocked})`, jsonld: "—", ics: "—", rss: "—", sample: "skipped" }); continue; }
  if (page.error)   { rows.push({ url, status: "ERROR", jsonld: "—", ics: "—", rss: "—", sample: page.error }); continue; }
  if (page.status === 404) { rows.push({ url, status: "404", jsonld: "—", ics: "—", rss: "—", sample: "—" }); continue; }

  const jl = scanJsonLd(page.text);
  const ics = await scanIcs(page.text, origin);
  const rss = await scanRss(origin);

  rows.push({
    url,
    status: "OK",
    jsonld: jl.count,
    ics: ics.count + (ics.url ? ` (${ics.url.replace(origin, "")})` : ""),
    rss: rss.found ? `${rss.items} (${rss.path})` : "0",
    sample: jl.sample?.name ? `"${String(jl.sample.name).slice(0, 50)}" @ ${jl.sample.startDate ?? "?"}` : "—",
  });
}

console.log("\n══════ STRUCTURED-DATA DISCOVERY (Phase 1) ══════\n");
for (const r of rows) {
  console.log(`URL:      ${r.url}`);
  console.log(`  status: ${r.status}  |  JSON-LD events: ${r.jsonld}  |  iCal: ${r.ics}  |  RSS: ${r.rss}`);
  if (r.sample && r.sample !== "—") console.log(`  sample: ${r.sample}`);
  console.log("");
}
