#!/usr/bin/env node
// scripts/discoverLancasterBatch.mjs
//
// Probes r/lancaster sidebar venues + Dutch Apple for structured event data.
// TEC REST first, JSON-LD fallback. Runs locally (residential IP).
//
// BOUNDARY: same as all other discovery scripts —
//   - Only reads pages/endpoints returning a normal 200
//   - 403/503/Cloudflare challenge/CAPTCHA body → BLOCKED, skip, NEVER bypass
//   - No proxies, no stealth, no CAPTCHA solving

const TIMEOUT_MS = 10_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36";

const BLOCK_MARKERS = [
  "just a moment", "cf-browser-verification", "challenge-platform",
  "attention required", "captcha", "/cdn-cgi/challenge",
  "enable javascript and cookies", "access denied",
];

function isBlockedBody(text) {
  const t = text.slice(0, 4096).toLowerCase();
  return BLOCK_MARKERS.some(m => t.includes(m));
}

async function get(url, accept = "*/*") {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: accept },
    });
    return res;
  } catch (e) {
    return { ok: false, status: 0, _err: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(id);
  }
}

// ─── TEC REST probe ──────────────────────────────────────────────────────────
async function tryTEC(origin) {
  const url = `${origin}/wp-json/tribe/events/v1/events?per_page=20`;
  const res = await get(url, "application/json");
  if (res._err) return { mode: "TEC", status: res._err, n: 0 };
  if (res.status === 403 || res.status === 503 || res.status === 429)
    return { mode: "TEC", status: `BLOCKED (HTTP ${res.status})`, n: 0 };
  if (res.status === 404) return { mode: "TEC", status: "no-plugin (404)", n: 0 };
  if (!res.ok) return { mode: "TEC", status: `HTTP ${res.status}`, n: 0 };
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) return { mode: "TEC", status: "not-json", n: 0 };
  let data;
  try { data = await res.json(); } catch { return { mode: "TEC", status: "bad-json", n: 0 }; }
  const events = data?.events;
  if (!Array.isArray(events) || events.length === 0)
    return { mode: "TEC", status: "empty", n: 0 };
  const s = events[0];
  return {
    mode: "TEC", status: "OK",
    n: data.total ?? events.length,
    sample: `${String(s.title || "").replace(/<[^>]+>/g, "").slice(0, 55)} — ${s.start_date || "?"}`,
    restUrl: `${origin}/wp-json/tribe/events/v1/events`,
  };
}

// ─── JSON-LD probe ───────────────────────────────────────────────────────────
const EVENT_TYPES = new Set([
  "event","musicevent","theaterevent","comedyevent","danceevent",
  "festival","socialevent","foodevent","screeningevent","exhibitionevent",
  "literaryevent","visualartsevent","childrensevent","educationevent",
]);

function extractJsonLdEvents(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let parsed;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = x => {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (Array.isArray(x["@graph"])) walk(x["@graph"]);
      const t = [].concat(x["@type"] || []).join(" ").toLowerCase();
      if (t.split(/\s+/).some(s => EVENT_TYPES.has(s)) && x.name && x.startDate) out.push(x);
    };
    walk(parsed);
  }
  return out;
}

async function tryJsonLd(pageUrl) {
  const res = await get(pageUrl, "text/html");
  if (res._err) return { mode: "JSON-LD", status: res._err, n: 0 };
  if (res.status === 403 || res.status === 503 || res.status === 429)
    return { mode: "JSON-LD", status: `BLOCKED (HTTP ${res.status})`, n: 0 };
  if (res.status === 404) return { mode: "JSON-LD", status: "404", n: 0 };
  if (!res.ok) return { mode: "JSON-LD", status: `HTTP ${res.status}`, n: 0 };
  const html = await res.text();
  if (isBlockedBody(html)) return { mode: "JSON-LD", status: "BLOCKED (challenge body)", n: 0 };
  const events = extractJsonLdEvents(html);
  if (events.length === 0) return { mode: "JSON-LD", status: "no events in JSON-LD", n: 0 };
  return {
    mode: "JSON-LD", status: "OK", n: events.length,
    sample: `${String(events[0].name).slice(0, 55)} — ${events[0].startDate || "?"}`,
    pageUrl,
  };
}

// ─── Candidates ──────────────────────────────────────────────────────────────
// Each entry: { name, area, base (origin for TEC), pages (JSON-LD fallback URLs) }
const CANDIDATES = [
  {
    name: "Long's Park",
    area: "lancaster",
    base: "https://www.longspark.org",
    pages: [
      "https://www.longspark.org/events/",
      "https://www.longspark.org/summer-music-series/",
    ],
  },
  {
    name: "ArtsQuest / SteelStacks",
    area: "lancaster",
    base: "https://www.artsmu.com",
    pages: ["https://www.artsmu.com/events/"],
  },
  {
    name: "Lancaster Barnstormers",
    area: "lancaster",
    base: "https://www.lancasterbarnstormers.com",
    pages: [
      "https://www.lancasterbarnstormers.com/schedule/",
      "https://www.lancasterbarnstormers.com/events/",
    ],
  },
  {
    name: "Central Market Lancaster",
    area: "lancaster",
    base: "https://www.centralmarketlancaster.com",
    pages: ["https://www.centralmarketlancaster.com/"],
  },
  {
    name: "Roots Country Market",
    area: "lancaster",
    base: "https://www.rootsmarket.com",
    pages: ["https://www.rootsmarket.com/"],
  },
  {
    name: "Green Dragon Market",
    area: "lancaster",
    base: "https://www.greendragonmarket.com",
    pages: ["https://www.greendragonmarket.com/"],
  },
  {
    name: "Lancaster Transplant",
    area: "lancaster",
    base: "https://lancastertransplant.com",
    pages: ["https://lancastertransplant.com/"],
  },
  {
    name: "Pub Standards",
    area: "lancaster",
    base: "https://pubstandards.us",
    pages: ["https://pubstandards.us/"],
  },
  {
    name: "AMT Shows (verify)",
    area: "lancaster",
    base: "https://amtshows.com",
    pages: [
      "https://amtshows.com/shows/",
      "https://amtshows.com/shows/list/",
    ],
  },
  {
    name: "Dutch Apple Dinner Theatre",
    area: "lancaster",
    base: "https://dutchapple.com",
    pages: [
      "https://dutchapple.com/our-shows/main-theatre-2026/",
      "https://dutchapple.com/our-shows/concerts-2026/",
    ],
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────
console.log(`\nProbing ${CANDIDATES.length} Lancaster-area venues...`);
console.log("TEC REST first, JSON-LD fallback. Local residential IP.\n");

const keepers = [];
const rows = [];

for (const v of CANDIDATES) {
  process.stdout.write(`  ${v.name}...`);

  let result = await tryTEC(v.base);

  if (result.status !== "OK") {
    // Try each page URL for JSON-LD; stop at the first OK
    let best = null;
    for (const pageUrl of v.pages) {
      const jl = await tryJsonLd(pageUrl);
      if (jl.status === "OK") { best = jl; break; }
      if (!best || jl.n > best.n) best = jl;
    }
    if (best && best.status === "OK") result = best;
    else if (best) {
      // If TEC gave a harder failure (BLOCKED) prefer that; else the JSON-LD failure
      const tecBlocked = result.status.startsWith("BLOCKED");
      const jlBlocked  = best.status.startsWith("BLOCKED");
      result = (tecBlocked || jlBlocked)
        ? { ...result, status: "BLOCKED", mode: `${result.mode}+JSON-LD` }
        : best;
    }
  }

  const tag =
    result.status === "OK"           ? `✅ ${result.mode} (${result.n} events)` :
    result.status.startsWith("BLOCKED") ? `⛔ BLOCKED` :
    `· ${result.status}`;

  rows.push({
    name: v.name, area: v.area, tag,
    sample: result.status === "OK" ? result.sample : "",
    result,
    v,
  });

  if (result.status === "OK" && result.n > 0) keepers.push({ ...v, result });
  process.stdout.write(` ${tag}\n`);
}

// ─── Table ───────────────────────────────────────────────────────────────────
console.log("\n" + "".padEnd(90, "─"));
console.log("RESULTS".padEnd(28) + "AREA".padEnd(12) + "STATUS");
console.log("".padEnd(90, "─"));
for (const r of rows) {
  console.log(r.name.padEnd(28) + r.area.padEnd(12) + r.tag);
  if (r.sample) console.log("".padEnd(40) + `↳ ${r.sample}`);
}
console.log("".padEnd(90, "─"));

// ─── Keepers ─────────────────────────────────────────────────────────────────
console.log(`\n${keepers.length} confirmed venue(s) with structured events:\n`);

if (keepers.length === 0) {
  console.log("None confirmed. No changes needed.\n");
  process.exit(0);
}

console.log("// ── Paste into src/config/structuredDataSources.ts ──");
for (const k of keepers) {
  const result = k.result;
  const isTEC = result.mode === "TEC";
  const url = isTEC ? `${k.base}/wp-json/tribe/events/v1/events?per_page=50` : result.pageUrl;
  const hostname = new URL(k.base).hostname;
  console.log(`  {`);
  console.log(`    url:         "${url}",`);
  console.log(`    name:        "${v.name}",`);
  console.log(`    area:        "${v.area}",`);
  console.log(`    sourceLabel: "${v.name}",`);
  console.log(`    tags:        ["Lancaster"],`);
  console.log(`    lat: ??, lng: ??,`);
  if (isTEC) console.log(`    parser:      "tec-rest",   // ${result.n} events`);
  else        console.log(`    // parser: "json-ld" (default)  // ${result.n} events`);
  console.log(`  },`);
  console.log(`  // ALLOWED_HOSTS: "${hostname}",`);
  console.log("");
}
