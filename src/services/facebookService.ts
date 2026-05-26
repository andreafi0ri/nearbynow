// src/services/facebookService.ts
// Facebook Graph API — Public Events only
// Scope: name, description, start_time, end_time,
//        place, cover (NO attendees, NO RSVPs, NO personal data)
//
// Meta requires app review before this API can be used with real users.
// During development it works with test users only.
// Submit for review at: https://developers.facebook.com/docs/app-review
// Required permissions: pages_read_engagement, public_profile
//
// WARNING: In production, the App Secret token exchange should happen
// on your backend server, not in the client app, to protect your App Secret.
// For MVP this is acceptable but MUST be moved server-side before public launch.
//
// Rate limits: 200 calls/hour per app token — responses are cached 30 minutes.
// Monitor: https://developers.facebook.com/docs/graph-api/changelog
//   for policy changes — Meta has historically tightened access without warning.
// IMPORTANT: Monitor that URL regularly; the Events API surface has changed
//   multiple times. Adapt quickly if endpoints are deprecated.

import { EventItem } from "../data/mockEvents";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── API status ───────────────────────────────────────────────────────────────
//
// ✅  FACEBOOK APP REVIEW APPROVED — service is live.
//
// Approved permission: pages_read_engagement
// Enabled endpoint:    /search?type=event
//
// Note: /search?type=place remains permanently deprecated in Graph API v8.0+
// (Error code 12) — place-based discovery is handled via the Mapbox geocoder
// fallback already built into this service.
//
// Rate limits: 200 calls/hour per app token — responses are cached 30 min.
// Monitor: https://developers.facebook.com/docs/graph-api/changelog
//
const APP_REVIEW_APPROVED = true;

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const MAPBOX_KEY = process.env.EXPO_PUBLIC_MAPBOX_KEY ?? "";
const APP_ID     = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID     ?? "";
const APP_SECRET = process.env.EXPO_PUBLIC_FACEBOOK_APP_SECRET ?? "";

const FETCH_TIMEOUT_MS  = 5_000;
const CACHE_RESULT_MS   = 30 * 60 * 1_000;  // 30 minutes
const CACHE_TOKEN_MS    = 23 * 60 * 60 * 1_000; // 23 hours (token valid 60 days)

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

interface GraphEventSearchResponse {
  data: FacebookEvent[];
  paging?: { next?: string };
}

interface GraphPlaceResult {
  id: string;
  events?: { data: FacebookEvent[] };
}

interface GraphPlaceSearchResponse {
  data: GraphPlaceResult[];
}

// ─── App access token cache ───────────────────────────────────────────────────

const tokenCache: { token: string | null; expiresAt: number } = {
  token: null,
  expiresAt: 0,
};

/**
 * Obtain (or return cached) a Facebook app access token.
 * Token is valid for 60 days; we refresh after 23 hours to be conservative.
 *
 * WARNING: In production, move this exchange to your backend server
 * to avoid exposing APP_SECRET in the client bundle.
 */
async function getAppAccessToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const url =
    `${GRAPH_BASE}/oauth/access_token` +
    `?client_id=${encodeURIComponent(APP_ID)}` +
    `&client_secret=${encodeURIComponent(APP_SECRET)}` +
    `&grant_type=client_credentials`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`[Facebook] Token fetch failed: ${res.status}`);

  const data: { access_token: string } = await res.json();
  tokenCache.token     = data.access_token;
  tokenCache.expiresAt = Date.now() + CACHE_TOKEN_MS;
  return data.access_token;
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
 * Fetch public Facebook events for an area.
 *
 * Two search strategies run in parallel:
 *   1. Text search — `?type=event&q={area}`
 *   2. Location search — `?type=place&center={lat},{lng}` (when coords supplied)
 *
 * Results are geo-matched via Mapbox, filtered, and returned as EventItems.
 *
 * GDPR scope: only name, description, start_time, end_time, place, cover.
 * No attendee data, no RSVP counts, no personal information.
 *
 * @param area    Human-readable area name, e.g. "Lancaster, Pennsylvania"
 * @param coords  Optional coordinates for location-based search
 */
export async function searchFacebookEvents(
  area: string,
  coords?: { lat: number; lng: number }
): Promise<EventItem[]> {
  // Guard: both /search?type=event and /search?type=place are blocked until
  // Facebook App Review approves pages_read_engagement. Flip APP_REVIEW_APPROVED
  // to true once approval is granted.
  if (!APP_REVIEW_APPROVED) {
    console.warn(
      "[Facebook] Skipped — App Review required.\n" +
      "  • /search?type=event → HTTP 400, code 3 (capability blocked)\n" +
      "  • /search?type=place → deprecated in Graph API v8.0 (code 12)\n" +
      "  Submit at: https://developers.facebook.com/docs/app-review\n" +
      "  Then set APP_REVIEW_APPROVED = true in facebookService.ts"
    );
    return [];
  }

  // Cache check
  const cacheKey = `${area}-${coords?.lat ?? ""}-${coords?.lng ?? ""}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log("[Facebook] Cache hit for", cacheKey);
    return cached.data;
  }

  console.log("[Facebook] Cache miss for", cacheKey, "— fetching…");

  let token: string;
  try {
    token = await getAppAccessToken();
  } catch (err) {
    console.warn("[Facebook] Could not obtain app token:", err);
    return [];
  }

  // ── Parallel search requests ──────────────────────────────────────────────

  // GDPR scope: public event data only — fields chosen explicitly, no personal data
  const eventFields =
    "id,name,description,start_time,end_time,place,cover,is_canceled,ticket_uri";

  const textSearchUrl =
    `${GRAPH_BASE}/search` +
    `?type=event` +
    `&q=${encodeURIComponent(area)}` +
    `&fields=${eventFields}` +
    `&access_token=${encodeURIComponent(token)}` +
    `&limit=${SEARCH_CONFIG.FACEBOOK_EVENTS_MAX_RESULTS}`;

  const promises: Promise<FacebookEvent[]>[] = [
    fetchWithTimeout(textSearchUrl)
      .then(async r => {
        if (r.ok) return r.json();
        const err = await r.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
        console.warn(`[Facebook] Event search failed (HTTP ${r.status}):`, err.error?.message ?? err);
        return { data: [] };
      })
      .then((data: GraphEventSearchResponse) => data.data ?? [])
      .catch(err => { console.warn("[Facebook] Event search error:", err); return []; }),
  ];

  if (coords) {
    const placeFields = `id,events{${eventFields}}`;
    const locationSearchUrl =
      `${GRAPH_BASE}/search` +
      `?type=place` +
      `&center=${coords.lat},${coords.lng}` +
      `&distance=${SEARCH_CONFIG.FACEBOOK_EVENTS_RADIUS_METRES}` +
      `&fields=${placeFields}` +
      `&access_token=${encodeURIComponent(token)}` +
      `&limit=10`;

    promises.push(
      fetchWithTimeout(locationSearchUrl)
        .then(async r => {
          if (r.ok) return r.json();
          const err = await r.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
          console.warn(`[Facebook] Place search failed (HTTP ${r.status}):`, err.error?.message ?? err);
          return { data: [] };
        })
        .then((data: GraphPlaceSearchResponse) =>
          (data.data ?? []).flatMap(p => p.events?.data ?? [])
        )
        .catch(err => { console.warn("[Facebook] Place search error:", err); return []; })
    );
  }

  const [textEvents, locationEvents = []] = await Promise.all(promises);

  // ── Deduplicate by event ID ───────────────────────────────────────────────
  const seenIds = new Set<string>();
  const allRaw: FacebookEvent[] = [];
  for (const ev of [...textEvents, ...locationEvents]) {
    if (!seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      allRaw.push(ev);
    }
  }

  const now = Date.now();

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = allRaw.filter(ev => {
    if (!ev.name || !ev.start_time) return false;
    if (!ev.place?.name)             return false; // no useful location data
    if (new Date(ev.start_time).getTime() < now) return false; // already past
    // Cancelled events are kept — they're mapped with isCanceled: true and
    // displayed with a "CANCELLED" label so saved users are informed.
    return true;
  });

  // ── Geo-match and map ─────────────────────────────────────────────────────
  let geoMatchedCount = 0;
  const items: EventItem[] = [];

  for (const ev of filtered.slice(0, SEARCH_CONFIG.FACEBOOK_EVENTS_MAX_RESULTS)) {
    const geoResult = ev.place
      ? await geoMatchVenue(ev.place, area).catch(() => null)
      : null;
    if (geoResult) geoMatchedCount++;
    items.push(mapFacebookEvent(ev, geoResult));
  }

  // Sort by start_time ascending
  items.sort((a, b) => (a.startIso ?? "").localeCompare(b.startIso ?? ""));

  const filteredOutCount = allRaw.length - filtered.length;
  console.log(
    `[Facebook] Found ${allRaw.length} raw | ` +
    `${filteredOutCount} filtered out | ` +
    `${items.length} mapped | ` +
    `${geoMatchedCount} geo-matched | ` +
    `cache: miss`
  );

  // Cache result
  responseCache.set(cacheKey, { data: items, expiresAt: Date.now() + CACHE_RESULT_MS });

  return items;
}
