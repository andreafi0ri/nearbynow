// src/services/facebookService.ts
// Facebook Events — client-side service.
//
// Architecture: all Graph API calls go through the Vercel serverless proxy
// at /api/facebook-events rather than hitting graph.facebook.com directly.
//
// WHY a proxy:
//   1. CORS — graph.facebook.com blocks XHR/fetch from browsers.
//   2. Security — App Secret must never appear in the client JS bundle.
//   3. Endpoint — /search?type=event is deprecated for all third-party
//      apps since ~2020. The proxy uses /{page-id}/events instead.
//
// Required Facebook feature: "Page Public Content Access"
//   Applied for via Meta Developer Console → App Review → Request a Feature.
//   Until it is approved the proxy returns [] and logs a clear message.
//
// Rate limits are managed server-side. Proxy caches responses for 30 minutes.

import { EventItem } from "../data/mockEvents";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAPBOX_KEY = process.env.EXPO_PUBLIC_MAPBOX_KEY ?? "";

const FETCH_TIMEOUT_MS = 10_000;              // 10 s — proxy may do multiple FB calls
const CACHE_RESULT_MS  = 30 * 60 * 1_000;   // 30 minutes (matches proxy cache)

// ─── Graph API types ──────────────────────────────────────────────────────────

interface FacebookPlace {
  id?: string;
  name?: string;
  location?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface FacebookEvent {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time?: string;
  place?: FacebookPlace;
  cover?: { source?: string };
  is_canceled?: boolean;
  ticket_uri?: string;
  // GDPR scope: attending_count is fetched but NEVER stored or displayed
  // attending_count?: number;   ← intentionally omitted per GDPR spec
}

// ─── Response cache ───────────────────────────────────────────────────────────

const responseCache = new Map<string, { data: EventItem[]; expiresAt: number }>();

// ─── Fetch with timeout ───────────────────────────────────────────────────────

function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

// ─── Geo-match cache ──────────────────────────────────────────────────────────

// Geo-matching cost: each unresolved venue = 1 Mapbox geocoding call.
// Mapbox free tier: 100,000 calls/month — monitor at https://account.mapbox.com/statistics
const geoCache = new Map<string, { lat: number; lng: number; resolvedAddress: string } | null>();

/**
 * Resolve a Facebook place object to lat/lng coordinates.
 * Uses the place's own coordinates when available; falls back to Mapbox geocoding.
 */
async function geoMatchVenue(
  place: FacebookPlace,
  fallbackArea: string
): Promise<{ lat: number; lng: number; resolvedAddress: string } | null> {
  const cacheKey = place.id ?? `${place.name}-${place.location?.city}`;

  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey)!;

  // 1. Use existing coordinates when the event already has them
  if (place.location?.latitude && place.location?.longitude) {
    const result = {
      lat: place.location.latitude,
      lng: place.location.longitude,
      resolvedAddress: buildLocationString(place),
    };
    geoCache.set(cacheKey, result);
    return result;
  }

  // 2. Forward geocode via Mapbox
  if (!place.name) {
    geoCache.set(cacheKey, null);
    return null;
  }

  const query = `${place.name}, ${place.location?.city || fallbackArea}`;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_KEY}` +
    `&types=poi,address,place` +
    `&limit=1`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) { geoCache.set(cacheKey, null); return null; }

    const data: { features: Array<{ center: [number, number]; place_name: string }> } =
      await res.json();

    if (!data.features[0]) { geoCache.set(cacheKey, null); return null; }

    const [lng, lat] = data.features[0].center;
    const result = { lat, lng, resolvedAddress: data.features[0].place_name };
    geoCache.set(cacheKey, result);
    return result;
  } catch {
    geoCache.set(cacheKey, null);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove HTML tags and decode basic entities. Handles null/undefined safely. */
function stripHTML(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a readable address string from a FacebookPlace, handling missing fields. */
function buildLocationString(place?: FacebookPlace): string {
  if (!place) return "Location TBC";
  const parts = [
    place.name,
    place.location?.street,
    place.location?.city,
  ].filter(Boolean);
  return parts.join(", ") || "Location TBC";
}

/** Parse ISO datetime to human-readable "Day H:MM AM/PM", optionally with end. */
function formatFacebookTime(start: string, end?: string): string {
  const startDate = new Date(start);
  const day = startDate.toLocaleDateString("en-GB", { weekday: "short" });
  const startTime = startDate.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (!end) return `${day} ${startTime}`;

  const endDate = new Date(end);
  // Only show end time if same calendar day
  if (
    endDate.toDateString() === startDate.toDateString()
  ) {
    const endTime = endDate.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${day} ${startTime} – ${endTime}`;
  }

  return `${day} ${startTime}`;
}

/** Add hours to an ISO string; returns a new ISO string. */
function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/**
 * Keyword-based category detection from event name and description.
 * Falls back to "Events" when no category can be inferred.
 */
function detectCategory(name: string, desc?: string): string {
  const text = `${name} ${desc ?? ""}`.toLowerCase();
  if (/music|gig|concert|band|\bdj\b|live act|open mic/.test(text))            return "Music";
  if (/food|eat|drink|\bbar\b|restaurant|market|feast|brunch|dinner/.test(text)) return "Food & Drink";
  if (/art|exhibition|gallery|theatre|theater|film|cinema|opera|ballet/.test(text)) return "Culture";
  if (/sport|run|race|\bmatch\b|tournament|fitness|yoga|cycling|football/.test(text)) return "Sport";
  if (/community|meeting|volunteer|charity|fundrais|neighbourhood/.test(text))  return "Community";
  return "Events";
}

/** Derive catColor and catDot from category string. */
function categoryColors(cat: string): { catColor: string; catDot: string } {
  const map: Record<string, { catColor: string; catDot: string }> = {
    "Music":       { catColor: "#7B5CE0", catDot: "#A688FF" },
    "Food & Drink":{ catColor: "#D43030", catDot: "#FF6B6B" },
    "Culture":     { catColor: "#B8920A", catDot: "#D4A80C" },
    "Sport":       { catColor: "#1A9E98", catDot: "#3ABFB8" },
    "Community":   { catColor: "#2860C8", catDot: "#5A90F8" },
    "Events":      { catColor: "#B8920A", catDot: "#D4A80C" },
  };
  return map[cat] ?? { catColor: "#B8920A", catDot: "#D4A80C" };
}

/** Map category to a representative emoji. */
function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    "Music":       "🎸",
    "Food & Drink":"🍽️",
    "Culture":     "🎭",
    "Sport":       "🏃",
    "Community":   "🏛️",
    "Events":      "🎟️",
  };
  return map[cat] ?? "📅";
}

/**
 * Extract up to 3 meaningful tags from event name and description.
 * Tags are capitalised for display.
 */
function extractTags(name: string, desc?: string): string[] {
  const text = `${name} ${desc ?? ""}`.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/\bfree\b/,        "Free"],
    [/ticket/,          "Ticketed"],
    [/outdoor|outside/, "Outdoors"],
    [/family|kids|children/, "Family"],
    [/18\+|over 18/,    "18+"],
    [/all ages/,        "All ages"],
    [/live music/,      "Live music"],
    [/network/,         "Networking"],
    [/charity|fundrais/,"Charity"],
  ];
  return candidates
    .filter(([rx]) => rx.test(text))
    .map(([, label]) => label)
    .slice(0, 3);
}

// ─── ID counter for numeric IDs ───────────────────────────────────────────────

let fbIdCounter = 9_000_000; // High range to avoid clashing with mock event IDs

/**
 * Map a raw FacebookEvent to the app's EventItem shape.
 * GDPR scope: public event data only — no attendees, no personal data.
 */
function mapFacebookEvent(
  event: FacebookEvent,
  geoResult: { lat: number; lng: number; resolvedAddress: string } | null
): EventItem {
  const category = detectCategory(event.name, event.description);
  const { catColor, catDot } = categoryColors(category);
  const cleanDesc = stripHTML(event.description);

  return {
    id: ++fbIdCounter,
    type: "event",
    title: event.name.slice(0, 80),
    desc: cleanDesc
      ? cleanDesc.slice(0, 200)
      : `${event.name} — Facebook Event`,
    longDesc: cleanDesc.slice(0, 600) || undefined,
    time: formatFacebookTime(event.start_time, event.end_time),
    date: event.start_time.split("T")[0],
    startIso: event.start_time,
    endIso: event.end_time ?? addHours(event.start_time, 2),
    location: geoResult?.resolvedAddress ?? buildLocationString(event.place) ?? "Location TBC",
    lat: geoResult?.lat,
    lng: geoResult?.lng,
    source: "Facebook Events",
    category,
    catColor,
    catDot,
    saves: 0,
    img: categoryEmoji(category),
    booking: event.ticket_uri
      ? { label: "Get Tickets",       url: event.ticket_uri,                              affiliate: false }
      : { label: "View on Facebook",  url: `https://facebook.com/events/${event.id}`,    affiliate: false },
    tags: extractTags(event.name, event.description),
    isCanceled: event.is_canceled ?? false,
  };
}

// ─── Staleness check ──────────────────────────────────────────────────────────

/**
 * Batch-check up to 50 Facebook event IDs for cancellation or deletion.
 * Intended to run every 6 hours for upcoming events — not on every feed load.
 * Run this check every 6 hours for upcoming events as per the plan spec.
 * Cancelled events should show a "Cancelled" label, not be silently removed.
 *
 * @param eventIds  Raw Facebook event IDs (without "fb-" prefix)
 * @param token     App access token from getAppAccessToken()
 */
export async function checkStaleness(
  eventIds: string[],
  token: string
): Promise<{ id: string; isCanceled: boolean; isDeleted: boolean }[]> {
  if (eventIds.length === 0) return [];

  const batch = eventIds.slice(0, 50).join(",");
  const url =
    `${GRAPH_BASE}?ids=${encodeURIComponent(batch)}` +
    `&fields=id,is_canceled` +
    `&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];

    const data: Record<string, { id: string; is_canceled?: boolean }> = await res.json();

    return eventIds.map(id => ({
      id,
      isCanceled: data[id]?.is_canceled ?? false,
      isDeleted:  !(id in data),
    }));
  } catch (err) {
    console.warn("[Facebook] checkStaleness error:", err);
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch public Facebook events for an area via the Vercel serverless proxy.
 *
 * The proxy at /api/facebook-events handles:
 *   • App access token exchange (server-side, secret never in client bundle)
 *   • /{page-id}/events calls for all registered pages matching the area
 *   • 30-minute server-side response caching
 *
 * This client layer adds:
 *   • Local response cache (avoids redundant proxy calls within the same session)
 *   • Mapbox geo-matching for venue coordinates (when FB place lacks lat/lng)
 *   • Mapping raw FB events to EventItem shape
 *
 * GDPR scope: public event data only — no attendees, no personal information.
 *
 * @param area   Human-readable area name, e.g. "Lancaster, Pennsylvania"
 * @param coords Optional — not used by the proxy but kept for API compatibility
 */
export async function searchFacebookEvents(
  area: string,
  _coords?: { lat: number; lng: number }   // reserved for future proximity filtering
): Promise<EventItem[]> {
  console.info(
    "Facebook Events: disabled — Meta requires Business app type " +
    "and additional permissions not available to this app. " +
    "Skipping. All other sources unaffected."
  );
  return [];

  // Client-side cache check (proxy has its own 30-min cache server-side)
  const cacheKey = `proxy-${area.toLowerCase()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log("[Facebook] Client cache hit for", area);
    return cached.data;
  }

  console.log("[Facebook] Fetching via proxy for", area);

  let rawEvents: FacebookEvent[];
  try {
    const res = await fetchWithTimeout(
      `/api/facebook-events?area=${encodeURIComponent(area)}`,
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) {
      console.warn("[Facebook] Proxy returned HTTP", res.status);
      return [];
    }
    const json: { events: FacebookEvent[] } = await res.json();
    rawEvents = json.events ?? [];
  } catch (err) {
    console.warn("[Facebook] Proxy fetch error:", err);
    return [];
  }

  if (rawEvents.length === 0) {
    console.log("[Facebook] No events returned by proxy for", area);
    return [];
  }

  const now = Date.now();

  // Filter out events that have already started (proxy uses `since` but
  // server clocks can differ slightly; belt-and-suspenders check)
  const filtered = rawEvents.filter(ev => {
    if (!ev.name || !ev.start_time) return false;
    if (new Date(ev.start_time).getTime() < now) return false;
    // Cancelled events kept — displayed with "CANCELLED" label
    return true;
  });

  // Geo-match venues and map to EventItem
  let geoMatchedCount = 0;
  const items: EventItem[] = [];

  for (const ev of filtered.slice(0, SEARCH_CONFIG.FACEBOOK_EVENTS_MAX_RESULTS)) {
    const geoResult = ev.place
      ? await geoMatchVenue(ev.place, area).catch(() => null)
      : null;
    if (geoResult) geoMatchedCount++;
    items.push(mapFacebookEvent(ev, geoResult));
  }

  // Sort ascending by start_time (proxy also sorts, but keeps order stable after geo-match)
  items.sort((a, b) => (a.startIso ?? "").localeCompare(b.startIso ?? ""));

  console.log(
    `[Facebook] area="${area}" proxy_raw=${rawEvents.length} | ` +
    `filtered=${filtered.length} | mapped=${items.length} | ` +
    `geo-matched=${geoMatchedCount}`
  );

  responseCache.set(cacheKey, { data: items, expiresAt: Date.now() + CACHE_RESULT_MS });
  return items;
}
