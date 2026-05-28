// src/services/ticketmasterService.ts
//
// Ticketmaster Discovery API — free API key required (5,000 calls/day on free tier).
// Sign up at https://developer.ticketmaster.com
// Add your key to .env as: EXPO_PUBLIC_TICKETMASTER_KEY=your_key_here
//
// Affiliate note: Ticketmaster tickets are part of the affiliate plan ($0.30/ticket).
// Set booking.affiliate = true so the UI can surface this correctly.

import { EventItem } from "../data/mockEvents";
import { geocodeArea } from "./recommendationsService";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── API types ────────────────────────────────────────────────────────────────

type TmClassification = {
  segment?: { name: string };
  genre?: { name: string };
  subGenre?: { name: string };
};

type TmAddress = { line1?: string };
type TmLocation = { latitude?: string; longitude?: string };

type TmVenue = {
  name?: string;
  address?: TmAddress;
  location?: TmLocation;
};

type TmDateDetail = {
  localDate?: string;
  localTime?: string;
};

type TmEvent = {
  id: string;
  name: string;
  url: string;
  info?: string;
  pleaseNote?: string;
  dates: { start: TmDateDetail };
  classifications?: TmClassification[];
  _embedded?: { venues?: TmVenue[] };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
};

type TmResponse = {
  _embedded?: { events?: TmEvent[] };
  fault?: { faultstring: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashId(str: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    n = ((n * 31) + str.charCodeAt(i)) >>> 0;
  }
  return n % 2_147_483_647;
}

function formatDatetime(localDate?: string, localTime?: string): string {
  if (!localDate) return "See event";
  const timeStr = localTime ?? "19:00:00";
  const [y, mo, d]  = localDate.split("-").map(Number);
  const [h, mi]     = timeStr.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
  const time    = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday} ${time}`;
}

function addHours(isoStr: string, hours: number): string {
  const d = new Date(isoStr);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

type CategoryMeta = { category: string; catColor: string; catDot: string; emoji: string };

// Ticketmaster segment name → our category system
const SEGMENT_MAP: Record<string, CategoryMeta> = {
  "Music":          { category: "Music",        catColor: "#7C5CBF", catDot: "#9B72CF", emoji: "🎵" },
  "Sports":         { category: "Sport",        catColor: "#1A9E98", catDot: "#3ABFB8", emoji: "🏟️" },
  "Arts & Theatre": { category: "Culture",      catColor: "#2D8A6E", catDot: "#34A882", emoji: "🎭" },
  "Family":         { category: "Events",       catColor: "#E8A838", catDot: "#F0B429", emoji: "👨‍👩‍👧" },
};

const DEFAULT_CAT: CategoryMeta = { category: "Events", catColor: "#7C5CBF", catDot: "#9B72CF", emoji: "🎟️" };

function resolveCat(classifications?: TmClassification[]): CategoryMeta {
  const segment = classifications?.[0]?.segment?.name;
  return (segment ? SEGMENT_MAP[segment] : undefined) ?? DEFAULT_CAT;
}

function toEventItem(ev: TmEvent, area: string): EventItem {
  const cat         = resolveCat(ev.classifications);
  const venue       = ev._embedded?.venues?.[0];
  const start       = ev.dates.start;
  const localDate   = start.localDate ?? "";
  const localTime   = start.localTime ?? "19:00:00";
  const startIso    = localDate ? `${localDate}T${localTime}` : "";
  const location    = [venue?.name, venue?.address?.line1].filter(Boolean).join(", ") || area;
  const lat         = parseFloat(venue?.location?.latitude ?? "");
  const lng         = parseFloat(venue?.location?.longitude ?? "");
  const desc        = (ev.info ?? ev.classifications?.[0]?.segment?.name ?? cat.category) + " event";

  const tags: string[] = [
    ev.classifications?.[0]?.genre?.name,
    ev.classifications?.[0]?.subGenre?.name,
  ].filter((v): v is string => Boolean(v));

  return {
    id:        hashId("tm-" + ev.id),
    type:      "event",
    title:     ev.name.slice(0, 80),
    desc:      desc.slice(0, 200),
    time:      formatDatetime(localDate, localTime),
    location,
    date:      localDate,
    startIso:  startIso || undefined,
    endIso:    startIso ? addHours(startIso, 3) : undefined,
    source:    "Ticketmaster",
    sourceUrl: ev.url,
    category:  cat.category,
    catColor:  cat.catColor,
    catDot:    cat.catDot,
    saves:     0,
    img:       cat.emoji,
    lat:       isNaN(lat) ? undefined : lat,
    lng:       isNaN(lng) ? undefined : lng,
    booking:   { label: "Buy Tickets", url: ev.url, affiliate: true },
    tags,
  };
}

// ─── Sports-specific helpers ──────────────────────────────────────────────────

/** Maps a Ticketmaster genre name to a sport-specific emoji. */
function mapSportsEmoji(genre?: string): string {
  if (!genre) return "🏟️";
  const g = genre.toLowerCase();
  if (g.includes("baseball") || g === "mlb") return "⚾";
  if (g.includes("basketball") || g === "nba") return "🏀";
  if (g.includes("football") || g === "nfl") return "🏈";
  if (g.includes("hockey") || g === "nhl") return "🏒";
  if (g.includes("soccer") || g === "mls") return "⚽";
  if (g.includes("tennis")) return "🎾";
  if (g.includes("golf")) return "⛳";
  if (g.includes("boxing") || g.includes("fight") || g.includes("ufc") || g.includes("mma")) return "🥊";
  if (g.includes("racing") || g.includes("auto") || g.includes("nascar")) return "🏎️";
  return "🏟️";
}

/** Builds tags for a sports event, including genre, sub-genre, and price. */
function buildSportsTags(ev: TmEvent, priceMin?: number): string[] {
  const tags: string[] = [];
  const cls = ev.classifications?.[0];
  if (cls?.genre?.name)   tags.push(cls.genre.name);    // "MLB", "NBA", etc.
  if (cls?.subGenre?.name && cls.subGenre.name !== cls.genre?.name)
    tags.push(cls.subGenre.name);
  if (priceMin != null)   tags.push(`From $${Math.round(priceMin)}`);
  tags.push("Sports");
  return tags;
}

const SPORTS_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const sportsCache = new Map<string, { data: EventItem[]; expiresAt: number }>();

/** Same as formatDatetime — a named alias for use in the sports mapper. */
function formatTMTime(localDate?: string, localTime?: string): string {
  return formatDatetime(localDate, localTime);
}

/** Same as addHours — a named alias for use in the sports mapper. */
function addHoursToIso(isoStr: string, hours: number): string {
  return addHours(isoStr, hours);
}

/** Maps a TmEvent to an EventItem specifically for sports (uses sport emoji + price tag). */
function mapTMEventInline(ev: TmEvent, area: string): EventItem {
  const venue     = ev._embedded?.venues?.[0];
  const start     = ev.dates.start;
  const localDate = start.localDate ?? "";
  const localTime = start.localTime ?? "19:00:00";
  const startIso  = localDate ? `${localDate}T${localTime}` : "";
  const location  = [venue?.name, venue?.address?.line1].filter(Boolean).join(", ") || area;
  const lat       = parseFloat(venue?.location?.latitude ?? "");
  const lng       = parseFloat(venue?.location?.longitude ?? "");
  const genre     = ev.classifications?.[0]?.genre?.name;
  const priceMin  = ev.priceRanges?.[0]?.min;
  const tags      = buildSportsTags(ev, priceMin);

  const bookingLabel = priceMin != null
    ? `From $${Math.round(priceMin)}`
    : "Buy Tickets";

  return {
    id:        hashId("tm-" + ev.id),
    type:      "event",
    title:     ev.name.slice(0, 80),
    desc:      `${genre ?? "Sports"} · ${location}`,
    time:      formatTMTime(localDate, localTime),
    location,
    date:      localDate,
    startIso:  startIso || undefined,
    endIso:    startIso ? addHoursToIso(startIso, 3) : undefined,
    source:    "Ticketmaster",
    sourceUrl: ev.url,
    category:  "Sport",
    catColor:  "#1A9E98",
    catDot:    "#3ABFB8",
    saves:     0,
    img:       mapSportsEmoji(genre),
    lat:       isNaN(lat) ? undefined : lat,
    lng:       isNaN(lng) ? undefined : lng,
    booking:   { label: bookingLabel, url: ev.url, affiliate: true },
    tags,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Searches the Ticketmaster Discovery API for events near the given area.
 * Requires EXPO_PUBLIC_TICKETMASTER_KEY in the environment.
 * Affiliate bookings: $0.30/ticket commission applies.
 *
 * @param area - Human-readable area name e.g. "Nashville"
 * @returns Up to 10 EventItems, or [] on failure / missing key
 */
export async function searchTicketmaster(area: string): Promise<EventItem[]> {
  const apiKey = process.env.EXPO_PUBLIC_TICKETMASTER_KEY;
  if (!apiKey) {
    console.warn("[Ticketmaster] EXPO_PUBLIC_TICKETMASTER_KEY is not set — skipping. Get a free key at https://developer.ticketmaster.com");
    return [];
  }

  try {
    const city   = area.split(",")[0].trim();
    const coords = await geocodeArea(area);

    // Prefer lat/lon (more accurate for borough/neighbourhood names);
    // fall back to city string for areas that don't geocode.
    const params = new URLSearchParams({
      apikey: apiKey,
      size:   String(SEARCH_CONFIG.TICKETMASTER_MAX_RESULTS),
      sort:   "date,asc",
      radius: String(SEARCH_CONFIG.TICKETMASTER_RADIUS_KM),
      unit:   "km",
    });

    if (coords) {
      params.set("geoPoint", `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`);
    } else {
      params.set("city", city);
    }

    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);

    const json: TmResponse = await res.json();

    if (json.fault) throw new Error(json.fault.faultstring);

    const events = json._embedded?.events ?? [];
    return events.slice(0, SEARCH_CONFIG.TICKETMASTER_MAX_RESULTS).map(ev => toEventItem(ev, area));
  } catch (err) {
    console.warn("[Ticketmaster] fetch failed:", err);
    return [];
  }
}

/**
 * Fetches sports-only events from Ticketmaster near the given area.
 * Uses a wider 25-mile radius and the Sports segment filter (segmentId=KZFzniwnSyZfZ7v7nE).
 * Results are cached for 1 hour.
 *
 * DO NOT replace or remove searchTicketmaster() — this is additive.
 * Deduplication handles any overlap between the two fetches automatically.
 *
 * @param area   Human-readable area name e.g. "Brooklyn, NY"
 * @param coords Optional coordinates — preferred over city name for accuracy
 * @returns Up to 20 Sport EventItems, or [] on failure / missing key
 */
export async function searchTicketmasterSports(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  const apiKey = process.env.EXPO_PUBLIC_TICKETMASTER_KEY;
  if (!apiKey) {
    console.warn("[Ticketmaster Sports] EXPO_PUBLIC_TICKETMASTER_KEY not set — skipping. Get a free key at https://developer.ticketmaster.com");
    return [];
  }

  const cacheKey = `sports:${area}`;
  const cached = sportsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const params = new URLSearchParams({
      apikey:    apiKey,
      segmentId: "KZFzniwnSyZfZ7v7nE", // Ticketmaster Sports segment
      size:      "20",
      sort:      "date,asc",
      radius:    "25",
      unit:      "miles",
    });

    if (coords) {
      params.set("geoPoint", `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`);
    } else {
      params.set("city", area.split(",")[0].trim());
    }

    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`,
      { headers: { Accept: "application/json" } },
    );

    if (!res.ok) throw new Error(`Ticketmaster Sports ${res.status}`);

    const json: TmResponse = await res.json();
    if (json.fault) throw new Error(json.fault.faultstring);

    const events = json._embedded?.events ?? [];
    const items  = events.slice(0, 20).map(ev => mapTMEventInline(ev, area));

    if (items.length > 0) {
      sportsCache.set(cacheKey, { data: items, expiresAt: Date.now() + SPORTS_CACHE_TTL });
    }

    return items;
  } catch (err) {
    console.warn("[Ticketmaster Sports] fetch failed:", err);
    return [];
  }
}
