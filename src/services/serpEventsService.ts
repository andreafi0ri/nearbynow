// Google Events — split source strategy:
//
// searchSerpEvents  → SerpAPI  (api/serp-events.js, engine: google_events)
//   Returns the same structured events as Google's udm=54 search tab.
//   Always-on (no threshold gate). 30-min cache per area.
//   Free tier: 100 searches/month. Monitor: serpapi.com/dashboard
//
// searchSerpKeywords → Serper.dev (api/serper-search.js, organic results)
//   Compound OR query for activity keywords (karaoke, trivia, yoga…).
//   Threshold-gated — only fires in sparse areas. 1-hr cache.
//   Falls back to organic event-like results when no events panel.
//   Free tier: 2,500 queries/month. Monitor: serper.dev/dashboard
//
// Key security: SERPAPI_KEY and SERPER_KEY live only in Vercel proxies.
// Neither is prefixed EXPO_PUBLIC_.

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";
import { SERP_KEYWORD_QUERY } from "../config/keywordSearchConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

type SerpTicketInfo = {
  source?:    string;
  link?:      string;
  link_type?: string;
};

type SerpEventDate = {
  start_date?: string;
  when?:       string;
};

type SerpEvent = {
  title?:       string;
  // Serper returns date as a plain string; SerpAPI returns an object
  date?:        string | SerpEventDate;
  address?:     string[];
  link?:        string;
  description?: string;
  ticket_info?: SerpTicketInfo[];
  venue?: {
    name?:    string;
    rating?:  number;
    reviews?: number;
    link?:    string;
  };
  thumbnail?: string;
};

type SerperOrganic = {
  title?:   string;
  link?:    string;
  snippet?: string;
  date?:    string;
};

type SerperResponse = {
  events?:         SerpEvent[];
  events_results?: SerpEvent[];   // SerpAPI fallback shape
  organic?:        SerperOrganic[];
};

// ─── Known-source filter ──────────────────────────────────────────────────────

// Sources we already aggregate directly.
// Filter these from Serper results so we only surface content
// from sources we DON'T already have.
const KNOWN_SOURCE_DOMAINS = [
  "ticketmaster.com",
  "ticketweb.com",
  "livenation.com",
  "meetup.com",
  "eventbrite.com",
  "axs.com",
  "stubhub.com",
  "seatgeek.com",
  "vividseats.com",
  "fandango.com",
  "amctheatres.com",
  "viator.com",
  "reddit.com",
];

function isKnownSource(event: SerpEvent): boolean {
  const linkLower = (event.link ?? "").toLowerCase();
  const ticketLinks = (event.ticket_info ?? [])
    .map((t: SerpTicketInfo) => (t.link ?? "").toLowerCase());

  return KNOWN_SOURCE_DOMAINS.some(domain =>
    linkLower.includes(domain) ||
    ticketLinks.some(tl => tl.includes(domain))
  );
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const serpCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1_000; // 30 minutes

function getCacheKey(area: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `serp-${area.toLowerCase().trim()}-${today}`;
}

// ─── ID generation ────────────────────────────────────────────────────────────

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Category helpers ─────────────────────────────────────────────────────────

function detectCategory(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (/concert|music|band|live music|festival|jazz|blues|orchestra|symphony/.test(text))
    return "Music";
  if (/food|drink|wine|beer|tasting|dining|restaurant|market|farmers/.test(text))
    return "Food & Drink";
  if (/art|exhibit|museum|gallery|theatre|theater|film|cinema|comedy|show/.test(text))
    return "Culture";
  if (/sport|run|race|marathon|game|match|tournament|yoga|fitness/.test(text))
    return "Sport";
  if (/family|kids|children|community|volunteer|fundraiser|charity/.test(text))
    return "Community";
  if (/outdoor|hike|park|nature|garden|trail|walk/.test(text))
    return "Outdoors";
  if (/nightlife|bar|club|dance/.test(text))
    return "Nightlife";
  return "Events";
}

function mapCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    "Music":        "#7B5CE0",
    "Food & Drink": "#D43030",
    "Culture":      "#B8920A",
    "Sport":        "#1A9E98",
    "Community":    "#2860C8",
    "Outdoors":     "#2D7A3A",
    "Nightlife":    "#4A1570",
    "Events":       "#2860C8",
  };
  return map[cat] ?? "#2860C8";
}

function mapCategoryDot(cat: string): string {
  const map: Record<string, string> = {
    "Music":        "#A688FF",
    "Food & Drink": "#FF6B6B",
    "Culture":      "#D4A80C",
    "Sport":        "#3ABFB8",
    "Community":    "#5A90F8",
    "Outdoors":     "#4AAD5C",
    "Nightlife":    "#9B59B6",
    "Events":       "#5A90F8",
  };
  return map[cat] ?? "#5A90F8";
}

function mapCategoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    "Music":        "🎵",
    "Food & Drink": "🍽️",
    "Culture":      "🎨",
    "Sport":        "🏃",
    "Community":    "🤝",
    "Outdoors":     "🌿",
    "Nightlife":    "🌙",
    "Events":       "📍",
  };
  return map[cat] ?? "📍";
}

function buildEventTags(event: SerpEvent): string[] {
  return [
    event.venue?.name ?? null,
    event.ticket_info?.[0]?.source ?? null,
    event.venue?.rating ? `★ ${event.venue.rating}` : null,
  ].filter((t): t is string => t !== null).slice(0, 3);
}

// ─── Organic-result event detection ──────────────────────────────────────────
// Serper's /search doesn't always return a structured `events` array —
// it depends on whether Google shows an events panel for that query.
// When events is empty, fall back to organic results that look event-like.

const EVENT_KEYWORDS = /\b(event|festival|concert|show|performance|exhibit|fair|market|meetup|conference|workshop|gala|parade|race|game|match|tournament|screening|opening|launch|expo|summit|hackathon|trivia|karaoke|comedy|opera|ballet|lecture)\b/i;

function isEventLike(title: string, snippet: string): boolean {
  return EVENT_KEYWORDS.test(title) || EVENT_KEYWORDS.test(snippet);
}

function mapSerperOrganic(result: SerperOrganic, area: string): EventItem | null {
  if (!result.title || !result.link) return null;

  // Skip known aggregator domains — we already pull from them directly
  const linkLower = result.link.toLowerCase();
  if (KNOWN_SOURCE_DOMAINS.some(d => linkLower.includes(d))) return null;

  const today    = new Date().toISOString().split("T")[0];
  const category = detectCategory(result.title, result.snippet ?? "");

  return {
    id:        hashString(`serper-org-${result.title}-${result.link}`),
    type:      "event",
    title:     result.title.slice(0, 80),
    desc:      (result.snippet ?? result.title).slice(0, 200),
    longDesc:  result.snippet?.slice(0, 600) ?? result.title,
    time:      "See website for times",
    date:      today,
    startIso:  `${today}T00:00:00`,
    location:  area,
    lat:       undefined,
    lng:       undefined,
    source:    "Google Events",
    category,
    catColor:  mapCategoryColor(category),
    catDot:    mapCategoryDot(category),
    saves:     0,
    img:       mapCategoryEmoji(category),
    booking:   { label: "View event", url: result.link, affiliate: false as const },
    tags:      [],
    isCanceled: false,
    imageUrl:  undefined,
  };
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parses both Serper (string) and SerpAPI (object) date shapes into YYYY-MM-DD.
 *
 * Serper: event.date = "Sat, Jun 28 · 7:00 PM"  (plain string)
 * SerpAPI: event.date = { when: "Dec 7, 9:00 PM – Dec 30, 10:30 PM CST" }
 */
function parseEventDate(date?: string | SerpEventDate): string {
  const today = new Date().toISOString().split("T")[0];

  if (!date) return today;

  const when = typeof date === "string"
    ? date
    : (date.when ?? date.start_date ?? "");

  if (!when) return today;

  const cleaned = when
    .split("–")[0]                                            // start of range
    .replace(/\b(sun|mon|tue|wed|thu|fri|sat)\w*,?\s*/i, "") // strip "Sat, "
    .split(" at ")[0]                                         // strip " at HH:MM PM"
    .replace(/·.*$/, "")                                      // strip "· 7:00 PM" (Serper)
    .replace(/\d{1,2}:\d{2}\s*(am|pm)/i, "")                 // strip inline time
    .replace(/\s*(cst|est|pst|mst|edt|pdt|cdt|mdt)\s*/i, "") // strip TZ
    .replace(/,\s*$/, "")                                     // trailing comma
    .trim();

  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      const now = new Date();
      if (parsed < now && parsed.getFullYear() === now.getFullYear()) {
        parsed.setFullYear(parsed.getFullYear() + 1);
      }
      return parsed.toISOString().split("T")[0];
    }
  } catch { /* fall through */ }

  return today;
}

// ─── Event mapping ────────────────────────────────────────────────────────────

function buildSearchQuery(area: string): string {
  const city = area.replace(/,\s*/g, " ").trim();
  // Natural-language query triggers Google's event index reliably
  return `events in ${city} this week`;
}

function mapSerpEvent(event: SerpEvent, area: string): EventItem | null {
  if (!event.title) return null;

  const dateStr = parseEventDate(event.date);

  // Extract display time — Serper date is a string, SerpAPI date is an object
  const rawWhen = typeof event.date === "string"
    ? event.date
    : (event.date?.when ?? "");
  const time = rawWhen
    ? rawWhen.split("–")[0].trim()
    : "Check event for time";

  const location = event.address?.join(", ") ?? event.venue?.name ?? area;

  const category = detectCategory(event.title, event.description ?? "");
  const booking  = event.link
    ? {
        label:     event.ticket_info?.[0]?.source
          ? `Tickets on ${event.ticket_info[0].source}`
          : "View event",
        url:       event.ticket_info?.[0]?.link ?? event.link,
        affiliate: false as const,
      }
    : null;

  return {
    id:        hashString(`serper-${event.title}-${dateStr}`),
    type:      "event",
    title:     event.title.slice(0, 80),
    desc:      (event.description ?? event.venue?.name ?? location).slice(0, 200),
    longDesc:  event.description?.slice(0, 600) ?? event.title,
    time,
    date:      dateStr,
    startIso:  `${dateStr}T00:00:00`,
    location,
    lat:       undefined,
    lng:       undefined,
    source:    "Google Events",
    category,
    catColor:  mapCategoryColor(category),
    catDot:    mapCategoryDot(category),
    saves:     0,
    img:       mapCategoryEmoji(category),
    booking,
    tags:      buildEventTags(event),
    isCanceled: false,
    imageUrl:  event.thumbnail ?? undefined,
  };
}

// ─── Proxy URL ────────────────────────────────────────────────────────────────

// On web the relative path resolves against the same origin (nearbyandnow.com).
// On native there is no document origin — use the absolute production URL.
// SERPER_KEY must NEVER be called directly from client code.
const PROXY_BASE = Platform.OS === "web"
  ? ""
  : "https://www.nearbyandnow.com";

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Searches Google Events via SerpAPI (google_events engine) for local events.
 *
 * Always-on — runs in parallel with all other feed sources.
 * Returns the same structured events shown in Google's udm=54 tab.
 * Known aggregator sources (Ticketmaster, Meetup, etc.) are filtered out
 * so only long-tail sources reach the feed.
 *
 * 30-min cache per area. Free tier: 100 searches/month on SerpAPI.
 *
 * @param area   Human-readable area name e.g. "Lancaster, PA"
 * @param coords Optional — not used by the query but kept for API consistency
 */
export async function searchSerpEvents(
  area:    string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  const cacheKey = getCacheKey(area);
  const cached   = serpCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[SerpAPI] Cache hit for "${area}" — ${cached.data.length} events`);
    return cached.data;
  }

  const params = new URLSearchParams({ q: buildSearchQuery(area), gl: "us", hl: "en" });
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${PROXY_BASE}/api/serp-events?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[SerpAPI] Proxy returned ${res.status}`);
      return [];
    }

    const data: SerperResponse = await res.json();
    const events = data.events_results ?? [];

    if (events.length === 0) {
      console.info(`[SerpAPI] No events for "${area}"`);
      serpCache.set(cacheKey, { data: [], expiresAt: Date.now() + CACHE_TTL });
      return [];
    }

    const newOnly  = events.filter(e => !isKnownSource(e));
    const filtered = events.length - newOnly.length;
    console.log(
      `[SerpAPI] "${area}" — ${events.length} total, ` +
      `${filtered} from known sources filtered, ${newOnly.length} new`
    );

    const items = newOnly
      .map(e => mapSerpEvent(e, area))
      .filter((item): item is EventItem => item !== null);

    serpCache.set(cacheKey, { data: items, expiresAt: Date.now() + CACHE_TTL });
    return items;

  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.warn("[SerpAPI] Timed out after 8s");
    } else {
      console.warn("[SerpAPI] Fetch failed:", err.message);
    }
    return [];
  }
}

// ─── Keyword-based event search ────────────────────────────────────────────────
// Supplements searchSerpEvents() with a compound OR query for specific
// activity types (karaoke, trivia, yoga, DJ nights, rooftop, happy hour,
// festivals). Keyword list lives in src/config/keywordSearchConfig.ts.
//
// Threshold-gated — only fires in sparse areas (eventCount < threshold).
// 1-hour cache. Reuses mapSerpEvent() — no mapping duplication.

const serpKeywordCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const KEYWORD_CACHE_TTL = 60 * 60 * 1_000; // 1 hour

/**
 * Searches Google Events via Serper.dev for activity-keyword events using one
 * compound OR query: "(karaoke night OR live band OR ...) in {city}".
 *
 * @param area Human-readable area name e.g. "Lancaster, PA"
 */
export async function searchSerpKeywords(area: string): Promise<EventItem[]> {
  const cacheKey = `serper-kw-${area.toLowerCase().trim()}-${new Date().toISOString().split("T")[0]}`;
  const cached = serpKeywordCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Serper keywords] cache hit for "${area}" — ${cached.data.length} results`);
    return cached.data;
  }

  const city = area.replace(/,\s*/g, " ").trim();
  const q    = `(${SERP_KEYWORD_QUERY}) in ${city}`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${PROXY_BASE}/api/serper-search`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ q, gl: "us", hl: "en", num: 10 }),
      signal:  controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Serper keywords] proxy returned ${res.status}`);
      return [];
    }

    const data: SerperResponse = await res.json();
    const events = data.events ?? data.events_results ?? [];

    if (events.length > 0) {
      const items = events
        .map(e => mapSerpEvent(e, area))
        .filter((i): i is EventItem => i !== null);
      serpKeywordCache.set(cacheKey, { data: items, expiresAt: Date.now() + KEYWORD_CACHE_TTL });
      console.log(`[Serper keywords] ${items.length} structured events for "${area}"`);
      return items;
    }

    // Compound keyword queries rarely trigger an events panel — parse organic instead
    const organic = data.organic ?? [];
    const organicItems = organic
      .filter(r => isEventLike(r.title ?? "", r.snippet ?? ""))
      .map(r => mapSerperOrganic(r, area))
      .filter((i): i is EventItem => i !== null);

    serpKeywordCache.set(cacheKey, { data: organicItems, expiresAt: Date.now() + KEYWORD_CACHE_TTL });
    console.log(`[Serper keywords] ${organicItems.length} organic results for "${area}" (no events panel)`);
    return organicItems;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") console.warn("[Serper keywords] timed out after 8s");
    else console.warn("[Serper keywords] fetch failed:", err.message);
    return [];
  }
}
