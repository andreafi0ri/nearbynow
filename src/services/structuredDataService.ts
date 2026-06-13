// Schema.org Event JSON-LD parser
//
// Reads openly-published structured data (<script type="application/ld+json">)
// from venue event pages and maps schema.org/Event objects → EventItem.
//
// BOUNDARY: reads ONLY pages that return a normal 200. Any bot-protection
// response (403/503, Cloudflare "Just a moment", "Attention Required",
// "challenge-platform", CAPTCHA) is logged and SKIPPED — never bypassed,
// no stealth, no retries against protection. Plain fetch through the existing
// public CORS proxy chain only.
//
// schema.org/Event fields used: name, startDate, endDate, location{name,address,geo},
// description, image, url, offers.

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";
import { STRUCTURED_SOURCES, StructuredSource } from "../config/structuredDataSources";

// Venue event pages are fetched through our own server-side proxy (api/fetch-page):
// many send no CORS header and are too large for the public proxy chain. The
// proxy fetches server-side (no CORS, no size cap) and host-allowlists targets.
// Web resolves the relative path; native uses the absolute production URL.
const PROXY_BASE = Platform.OS === "web" ? "" : "https://www.nearbyandnow.com";

// Markers that indicate bot protection — if seen, the page is SKIPPED.
const BLOCK_MARKERS = [
  "just a moment",
  "cf-browser-verification",
  "challenge-platform",
  "attention required",
  "captcha",
  "/cdn-cgi/challenge",
  "enable javascript and cookies",
];

function isBlocked(status: number, body: string): boolean {
  if (status === 403 || status === 503 || status === 429) return true;
  // Scan only the first 4KB — bot challenges (Cloudflare, CAPTCHA walls) appear
  // in <head> or early <body>. A "captcha" string mid-page is a contact-form
  // widget, not a block (e.g. discovercolumbia.com reCAPTCHA field at char ~474K).
  const lower = body.slice(0, 4096).toLowerCase();
  return BLOCK_MARKERS.some(m => lower.includes(m));
}

// ─── Accepted schema.org Event @types (case-insensitive) ────────────────────────
const EVENT_TYPES = new Set([
  "event", "musicevent", "theaterevent", "comedyevent", "danceevent",
  "festival", "socialevent", "foodevent", "sportsevent", "screeningevent",
  "exhibitionevent", "educationevent", "childrensevent", "visualartsevent",
  "literaryevent", "businessevent",
].map(s => s.toLowerCase()));

function typeMatchesEvent(t: unknown): boolean {
  const types = Array.isArray(t) ? t : t != null ? [t] : [];
  return types.some(x => typeof x === "string" && EVENT_TYPES.has(x.toLowerCase()));
}

// ─── Types ──────────────────────────────────────────────────────────────────────
type JsonLdNode = Record<string, any>;

type FetchResult = { status: number; body: string } | { blocked: true } | null;

// The Events Calendar REST API event shape (only fields we use)
type TECEvent = {
  id:          number;
  title:       string;
  description: string;
  url:         string;
  start_date:  string;   // "2026-06-13 19:30:00" local time
  end_date?:   string;
  cost?:       string;
  image?:      { url: string };
  venue?: {
    venue?:   string;
    address?: string;
    city?:    string;
    state?:   string;
    geo_lat?: string | number;
    geo_lng?: string | number;
  };
  categories?: Array<{ name: string }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripHTML(s: string): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/&#8217;/g, "’").replace(/&#8211;/g, "–").replace(/&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

// Category detection from @type + title
function detectCategory(types: string[], title: string): string {
  const tl = types.map(t => t.toLowerCase());
  const text = title.toLowerCase();
  if (tl.includes("musicevent") || /concert|live music|band|gig|dj set/.test(text)) return "Music";
  if (/trivia|karaoke|happy hour|\bdj\b|nightlife|dance party/.test(text))          return "Nightlife";
  if (tl.includes("foodevent") || /dinner|tasting|brunch|food|beer|wine/.test(text)) return "Food & Drink";
  if (tl.includes("comedyevent") || /comedy/.test(text))                            return "Events";
  if (tl.includes("festival") || /festival|fest|fair/.test(text))                   return "Events";
  return "Events";
}

const CAT_COLORS: Record<string, { catColor: string; catDot: string; img: string }> = {
  "Music":        { catColor: "#7B5CE0", catDot: "#A688FF", img: "🎸" },
  "Nightlife":    { catColor: "#4A1570", catDot: "#9B59B6", img: "🌙" },
  "Food & Drink": { catColor: "#D43030", catDot: "#FF6B6B", img: "🍽️" },
  "Events":       { catColor: "#2860C8", catDot: "#5A90F8", img: "📍" },
};

function locationString(loc: any): string {
  if (!loc) return "";
  if (typeof loc === "string") return stripHTML(loc);
  if (Array.isArray(loc)) return locationString(loc[0]);
  const name = loc.name ? stripHTML(loc.name) : "";
  const addr = loc.address;
  let addrStr = "";
  if (typeof addr === "string") addrStr = stripHTML(addr);
  else if (addr && typeof addr === "object") {
    addrStr = [addr.streetAddress, addr.addressLocality, addr.addressRegion]
      .filter(Boolean).map((x: string) => stripHTML(x)).join(", ");
  }
  return [name, addrStr].filter(Boolean).join(", ");
}

function imageUrlOf(image: any): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return imageUrlOf(image[0]);
  if (typeof image === "object" && image.url) return String(image.url);
  return undefined;
}

function geoOf(loc: any): { lat?: number; lng?: number } {
  const g = (Array.isArray(loc) ? loc[0] : loc)?.geo;
  if (g && g.latitude != null && g.longitude != null) {
    const lat = Number(g.latitude), lng = Number(g.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return {};
}

function priceTag(offers: any): string | null {
  const o = Array.isArray(offers) ? offers[0] : offers;
  if (!o) return null;
  const p = o.price ?? o.lowPrice;
  if (p == null) return null;
  const n = Number(p);
  if (isNaN(n)) return null;
  return n === 0 ? "Free" : `From $${Math.round(n)}`;
}

// ─── JSON-LD extraction ─────────────────────────────────────────────────────────
function collectEvents(node: any, out: JsonLdNode[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(n => collectEvents(n, out)); return; }
  if (typeMatchesEvent(node["@type"])) out.push(node);
  if (Array.isArray(node["@graph"])) collectEvents(node["@graph"], out);
  if (Array.isArray(node.itemListElement)) {
    node.itemListElement.forEach((el: any) => collectEvents(el?.item ?? el, out));
  }
}

export function extractEventsFromHtml(html: string): JsonLdNode[] {
  const events: JsonLdNode[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      collectEvents(JSON.parse(m[1].trim()), events);
    } catch { /* skip malformed block */ }
  }
  return events;
}

// ─── Event mapper ────────────────────────────────────────────────────────────────
const TODAY = () => new Date().toISOString().split("T")[0];

function mapJsonLdEvent(ev: JsonLdNode, source: StructuredSource): EventItem | null {
  const title = ev.name ? stripHTML(String(ev.name)).slice(0, 80) : "";
  if (!title) return null;
  if (!ev.startDate) return null;

  const startIso = String(ev.startDate);
  const date = startIso.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  // Skip events already past (before today)
  if (date < TODAY()) return null;

  const types = (Array.isArray(ev["@type"]) ? ev["@type"] : [ev["@type"]]).filter(Boolean).map(String);
  const category = detectCategory(types, title);
  const palette = CAT_COLORS[category] ?? CAT_COLORS["Events"];

  const desc = stripHTML(ev.description ? String(ev.description) : "").slice(0, 200)
    || `${category} at ${source.sourceLabel}`;
  const longDesc = stripHTML(ev.description ? String(ev.description) : "").slice(0, 600) || undefined;

  const { lat, lng } = geoOf(ev.location);
  const url = ev.url ? String(ev.url) : source.url;
  const price = priceTag(ev.offers);

  const tags = [...source.tags, price].filter((t): t is string => Boolean(t)).slice(0, 3);

  return {
    id:        hashString(`sd-${source.name}-${title}-${startIso}`),
    type:      "event",
    title,
    desc,
    longDesc,
    time:      formatTime(startIso),
    date,
    startIso,
    endIso:    ev.endDate ? String(ev.endDate) : undefined,
    location:  locationString(ev.location) || source.sourceLabel,
    lat, lng,
    source:    source.sourceLabel,
    sourceUrl: url,
    category,
    catColor:  palette.catColor,
    catDot:    palette.catDot,
    saves:     0,
    img:       palette.img,
    booking:   { label: "View event", url, affiliate: false },
    tags:      tags.length > 0 ? tags : undefined,
    imageUrl:  imageUrlOf(ev.image),
    isCanceled: false,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "See event";
  const day  = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day} ${time}`;
}

// ─── TEC REST event mapper ───────────────────────────────────────────────────────
function mapTECEvent(ev: TECEvent, source: StructuredSource): EventItem | null {
  const title = stripHTML(ev.title || "").slice(0, 80);
  if (!title || !ev.start_date) return null;

  // "2026-06-13 19:30:00" → date part only
  const date = ev.start_date.split(" ")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < TODAY()) return null;

  const startIso = ev.start_date.replace(" ", "T");
  const endIso   = ev.end_date  ? ev.end_date.replace(" ", "T") : undefined;

  const catNames = (ev.categories ?? []).map(c => c.name.toLowerCase());
  const category =
    catNames.some(c => /music|concert/.test(c))          ? "Music"  :
    catNames.some(c => /theatre|theater|comedy/.test(c)) ? "Events" :
    detectCategory([], title);
  const palette = CAT_COLORS[category] ?? CAT_COLORS["Events"];

  const desc     = stripHTML(ev.description || "").slice(0, 200) || `${category} at ${source.sourceLabel}`;
  const longDesc = stripHTML(ev.description || "").slice(0, 600) || undefined;

  const v = ev.venue;
  const location = v
    ? [v.venue, v.address, v.city].filter(Boolean).join(", ")
    : source.sourceLabel;

  // Prefer event-level geo; fall back to source anchor
  const rawLat = v?.geo_lat != null ? Number(v.geo_lat) : NaN;
  const rawLng = v?.geo_lng != null ? Number(v.geo_lng) : NaN;
  const lat = !isNaN(rawLat) && rawLat !== 0 ? rawLat : source.lat;
  const lng = !isNaN(rawLng) && rawLng !== 0 ? rawLng : source.lng;

  const costStr = (ev.cost ?? "").trim();
  const price   = costStr === "" || costStr === "0" ? null
    : /free/i.test(costStr)                         ? "Free"
    : costStr.slice(0, 20);

  const tags = [...source.tags, price].filter((t): t is string => Boolean(t)).slice(0, 3);
  const url  = ev.url || source.url;

  return {
    id:        hashString(`tec-${source.name}-${ev.id}`),
    type:      "event",
    title,
    desc,
    longDesc,
    time:      formatTime(startIso),
    date,
    startIso,
    endIso,
    location:  location || source.sourceLabel,
    lat, lng,
    source:    source.sourceLabel,
    sourceUrl: url,
    category,
    catColor:  palette.catColor,
    catDot:    palette.catDot,
    saves:     0,
    img:       palette.img,
    booking:   { label: "View event", url, affiliate: false },
    tags:      tags.length > 0 ? tags : undefined,
    imageUrl:  ev.image?.url,
    isCanceled: false,
  };
}

// ─── Direct fetch for TEC REST endpoints (CORS-open JSON, no proxy needed) ───────
async function fetchTECDirect(url: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    if (!res.ok || !body) return null;
    return { status: res.status, body };
  } catch {
    return null;
  }
}

// ─── Server-side page fetch (via our own proxy) with blocked-page guard ─────────
async function fetchPage(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(`${PROXY_BASE}/api/fetch-page?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    // Upstream bot protection surfaces as 403/503 or a challenge body → SKIP.
    if (isBlocked(res.status, body)) return { blocked: true };
    if (!res.ok || !body || body.length < 100) return null;
    return { status: res.status, body };
  } catch {
    return null;
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1_000; // 60 minutes — these pages update less often than live APIs

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Fetches schema.org Event JSON-LD from the structured-data sources matching
 * `area`, maps to EventItem, and returns events from today through the next
 * 60 days. Blocked/protected pages are skipped (never bypassed). Returns []
 * on any failure so one bad source never breaks the feed.
 */
export async function fetchStructuredEvents(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  const lower = area.toLowerCase();
  const RADIUS_MILES = 20;
  const within = (s: StructuredSource): boolean => {
    if (!coords || s.lat == null || s.lng == null) return false;
    const R = 3_958.8;
    const dLat = ((s.lat - coords.lat) * Math.PI) / 180;
    const dLon = ((s.lng - coords.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((coords.lat * Math.PI) / 180) * Math.cos((s.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= RADIUS_MILES;
  };
  // Name-match OR within ~20mi of the source's anchor (matches RSS/local rule).
  const sources = STRUCTURED_SOURCES.filter(s =>
    lower.includes(s.area) || s.area === "global" || within(s)
  );
  if (sources.length === 0) return [];

  const horizon = new Date(Date.now() + 60 * 86_400_000).toISOString().split("T")[0];

  const lists = await Promise.all(sources.map(async (source): Promise<EventItem[]> => {
    try {
      const cached = cache.get(source.url);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[structuredData] ${source.name} cache hit — ${cached.data.length} events`);
        return cached.data;
      }

      let items: EventItem[];
      if (source.parser === "tec-rest") {
        // TEC REST endpoints are CORS-open JSON — call directly, no proxy needed.
        const result = await fetchTECDirect(source.url);
        if (result === null) {
          console.warn(`[structuredData] ${source.name} — TEC fetch failed, skipping`);
          return [];
        }
        let data: { events?: TECEvent[] };
        try { data = JSON.parse(result.body); } catch { return []; }
        items = (data.events ?? [])
          .map(ev => mapTECEvent(ev, source))
          .filter((x): x is EventItem => x !== null)
          .filter(e => e.date <= horizon);
        console.log(`[structuredData] ${source.name} — ${items.length} events from TEC REST`);
      } else {
        const result = await fetchPage(source.url);
        if (result === null) {
          console.warn(`[structuredData] ${source.name} — all proxies failed, skipping`);
          return [];
        }
        if ("blocked" in result) {
          console.warn(`[structuredData] ${source.name} blocked — skipping (not bypassing)`);
          return [];
        }
        const raw = extractEventsFromHtml(result.body);
        items = raw
          .map(ev => mapJsonLdEvent(ev, source))
          .filter((x): x is EventItem => x !== null)
          .filter(e => e.date <= horizon);
        console.log(`[structuredData] ${source.name} — ${items.length} events from JSON-LD`);
      }

      cache.set(source.url, { data: items, expiresAt: Date.now() + CACHE_TTL });
      return items;
    } catch (err: any) {
      console.warn(`[structuredData] ${source.name} error:`, err?.message);
      return [];
    }
  }));

  return lists.flat();
}
