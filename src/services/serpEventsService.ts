// SerpAPI Google Events Service
//
// Surfaces the "long tail" of local events that other sources miss —
// community calendars, local newspapers, library events, municipal
// parks, and small independent venues.
//
// Google Events aggregates from hundreds of sources simultaneously.
// We filter OUT sources we already aggregate directly so we only
// surface new content from the long tail.
//
// ONLY fires when eventCount < GOOGLE_PLACES_THRESHOLD — conserves
// the free tier quota (100 searches/month).
//
// 30-minute cache per area — all users in the same area share the
// same cached result, so 50 Lancaster users count as 1 API call.
//
// Free tier: 100 searches/month — enough for ~3–6 calls/day at MVP
// scale with caching. Monitor at serpapi.com/dashboard.
// Upgrade to $25/month plan when daily active users grow.
//
// IMPORTANT: Monitor monthly usage at https://serpapi.com/dashboard
// Free tier: 100 searches/month
// Upgrade trigger: when daily active users consistently exceed 50
// across 3+ cities.
//
// API key security: SERPAPI_KEY lives ONLY in the Vercel proxy
// (api/serp-events.js). It is never prefixed EXPO_PUBLIC_ and is
// never referenced in this file or any client code.

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
  date?:        SerpEventDate;
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

type SerpResponse = {
  events_results?:     SerpEvent[];
  search_information?: Record<string, unknown>;
};

// ─── Known-source filter ──────────────────────────────────────────────────────

// Sources we already aggregate directly.
// Filter these from SerpAPI results so we only surface content
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
  // Cache per area per day. All users in Lancaster share the same
  // cached result — this is the key free-tier conservation mechanism.
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

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parses SerpAPI's date.when string into YYYY-MM-DD.
 *
 * SerpAPI date formats:
 *   "Dec 7, 9:00 PM – Dec 30, 10:30 PM CST"
 *   "Sat, Jun 14, 7:30 PM"
 *   "Jun 14 – Jun 16"
 */
function parseEventDate(date?: SerpEventDate): string {
  const today = new Date().toISOString().split("T")[0];

  if (!date?.when && !date?.start_date) return today;

  const when = date.when ?? date.start_date ?? "";

  // Take start of range, strip day-of-week prefix, strip time
  const cleaned = when
    .split("–")[0]                    // start of range
    .replace(/\b(sun|mon|tue|wed|thu|fri|sat)\w*,?\s*/i, "") // strip "Sat, "
    .split(" at ")[0]                 // strip " at HH:MM PM"
    .replace(/\d{1,2}:\d{2}\s*(am|pm)/i, "")  // strip time
    .replace(/\s*(cst|est|pst|mst|edt|pdt|cdt|mdt)\s*/i, "")  // strip TZ
    .replace(/,\s*$/, "")            // trailing comma
    .trim();

  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      // Roll forward one year if date is in the past
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
  // Google Events works best with natural-language queries.
  // Strip trailing state/country suffixes for cleaner results.
  const clean = area.replace(/,\s*/g, " ").trim();
  return `Events in ${clean}`;
}

function mapSerpEvent(event: SerpEvent, area: string): EventItem | null {
  if (!event.title) return null;

  const dateStr  = parseEventDate(event.date);
  const location = event.address?.join(", ") ?? event.venue?.name ?? area;
  const time     = event.date?.when
    ? event.date.when.split("–")[0].trim()
    : "Check event for time";

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
    id:        hashString(`serp-${event.title}-${dateStr}`),
    type:      "event",
    title:     event.title.slice(0, 80),
    desc:      (event.description ?? event.venue?.name ?? location).slice(0, 200),
    longDesc:  event.description?.slice(0, 600) ?? event.title,
    time,
    date:      dateStr,
    startIso:  `${dateStr}T00:00:00`,
    location,
    lat:       undefined, // SerpAPI events have no coords — cards appear in feed
    lng:       undefined, // but not as map pins. Geocode later if needed.
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
// SERPAPI_KEY must NEVER be called directly from client code.
const PROXY_BASE = Platform.OS === "web"
  ? ""
  : "https://www.nearbyandnow.com";

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Searches Google Events via SerpAPI for local events in the given area.
 *
 * Only fires when the feed is sparse (eventCount < GOOGLE_PLACES_THRESHOLD).
 * Results from known aggregator sources (Ticketmaster, Meetup, etc.) are
 * filtered out so only long-tail sources reach the feed.
 *
 * Results are cached 30 minutes per area — all users in the same area share
 * one cached call, conserving the free-tier quota.
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

  const query  = buildSearchQuery(area);
  const params = new URLSearchParams({ q: query, gl: "us", hl: "en" });
  const url    = `${PROXY_BASE}/api/serp-events?${params}`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[SerpAPI] Proxy returned ${res.status}`);
      return [];
    }

    const data: SerpResponse = await res.json();
    const events = data.events_results ?? [];

    if (events.length === 0) {
      console.info(`[SerpAPI] No events for "${area}"`);
      serpCache.set(cacheKey, { data: [], expiresAt: Date.now() + CACHE_TTL });
      return [];
    }

    // Remove sources we already aggregate directly
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
// Supplements searchSerpEvents() with a single compound OR query for specific
// activity types (karaoke, trivia, yoga, DJ nights, rooftop, happy hour,
// festivals). Keyword list lives in src/config/keywordSearchConfig.ts.
//
// Quota: ONE extra SerpAPI credit per area per hour. Gate behind the same
// sparse-area threshold as searchSerpEvents (see feedService) so it never
// fires in event-rich cities. 1-hour cache — activity types don't change
// hourly. Reuses mapSerpEvent() — no mapping duplication.

const serpKeywordCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const KEYWORD_CACHE_TTL = 60 * 60 * 1_000; // 1 hour

/**
 * Searches Google Events via SerpAPI for activity-keyword events using one
 * compound OR query: "(karaoke night OR live band OR ...) in {city}".
 *
 * @param area Human-readable area name e.g. "Lancaster, PA"
 */
export async function searchSerpKeywords(area: string): Promise<EventItem[]> {
  const cacheKey = `serp-kw-${area.toLowerCase().trim()}-${new Date().toISOString().split("T")[0]}`;
  const cached = serpKeywordCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[SerpAPI keywords] cache hit for "${area}" — ${cached.data.length} results`);
    return cached.data;
  }

  const city   = area.replace(/,\s*/g, " ").trim();
  const q      = `(${SERP_KEYWORD_QUERY}) in ${city}`;
  const params = new URLSearchParams({ q, gl: "us", hl: "en" });
  const url    = `${PROXY_BASE}/api/serp-events?${params}`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[SerpAPI keywords] proxy returned ${res.status}`);
      return [];
    }

    const data: SerpResponse = await res.json();
    const events = data.events_results ?? [];

    const items = events
      .map(e => mapSerpEvent(e, area))
      .filter((i): i is EventItem => i !== null);

    serpKeywordCache.set(cacheKey, { data: items, expiresAt: Date.now() + KEYWORD_CACHE_TTL });
    console.log(`[SerpAPI keywords] ${items.length} results for "${area}" (compound query)`);
    return items;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") console.warn("[SerpAPI keywords] timed out after 8s");
    else console.warn("[SerpAPI keywords] fetch failed:", err.message);
    return [];
  }
}
