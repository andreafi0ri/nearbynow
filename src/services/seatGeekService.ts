// SeatGeek Platform API — Live event discovery
// Covers concerts, sports, theater, comedy, festivals
// Complements Ticketmaster with SeatGeek-ticketed venues
// Partner program: avg $11 per sale generated
// API docs: https://seatgeek.github.io/
// Get client ID: https://seatgeek.com/build
//
// KEY API FACTS:
// Base URL: https://api.seatgeek.com/2
// Auth: client_id query param (no header needed)
// Events endpoint: GET /events
// Geo params: lat + lon + range (e.g. "20mi")
// Date filter: datetime_utc.gte + datetime_utc.lte
// No server-side proxy needed — client ID is public

import { EventItem } from "../data/mockEvents";

const BASE_URL = "https://api.seatgeek.com/2";

// ─── Types ────────────────────────────────────────────────────────────────────

type SGTaxonomy = {
  id:           number;
  name:         string;   // "sports", "concerts", "theater" etc
  parent_id?:   number;
  parent_name?: string;
};

type SGVenue = {
  id:           number;
  name:         string;
  address?:     string;
  city?:        string;
  state?:       string;
  country?:     string;
  location:     { lat: number; lon: number };
  postal_code?: string;
};

type SGPerformer = {
  id:         number;
  name:       string;
  type:       string;   // "band", "sports_team" etc
  image?:     string;   // performer image URL
  score:      number;   // popularity 0-1
  taxonomies: SGTaxonomy[];
};

type SGStats = {
  average_price?:         number;
  lowest_price?:          number;
  highest_price?:         number;
  median_price?:          number;
  listing_count?:         number;
  visible_listing_count?: number;
};

type SGEvent = {
  id:                number;
  title:             string;
  short_title?:      string;
  datetime_local:    string;   // "2026-06-14T19:00:00"
  datetime_utc:      string;
  visible_until_utc?: string;
  announce_date?:    string;
  score:             number;
  url:               string;   // seatgeek.com event URL
  type:              string;
  status?:           string;   // "normal", "cancelled" etc
  performers:        SGPerformer[];
  venue:             SGVenue;
  taxonomies:        SGTaxonomy[];
  stats:             SGStats;
};

type SGResponse = { events?: SGEvent[] };

// ─── Cache ────────────────────────────────────────────────────────────────────

const sgCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1_000; // 30 minutes

function getCacheKey(area: string, coords?: { lat: number; lng: number }): string {
  const today = new Date().toISOString().split("T")[0];
  return [
    area.toLowerCase().trim(),
    coords?.lat?.toFixed(2) ?? "no-lat",
    coords?.lng?.toFixed(2) ?? "no-lng",
    today,
  ].join("|");
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** SeatGeek IDs can exceed JS safe-int range — clamp into a stable positive int. */
function sgIdToNumber(sgId: number): number {
  return Math.abs(sgId) % 2_147_483_647;
}

function addHoursToIso(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();
}

function formatSGTime(datetime: string): string {
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return "See event";
  const day  = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} ${time}`;
}

function buildSGPriceStr(stats: SGStats): string | null {
  if (stats?.lowest_price)  return `From $${Math.round(stats.lowest_price)}`;
  if (stats?.average_price) return `Avg $${Math.round(stats.average_price)}`;
  return null;
}

function mapSGCategory(taxonomies: SGTaxonomy[]): string {
  const names = (taxonomies ?? []).map(t => t.name?.toLowerCase()).join(" ");
  if (/sports?/.test(names))                 return "Sport";
  if (/concert|music|festival/.test(names))  return "Music";
  if (/theater|broadway|comedy/.test(names)) return "Events";
  if (/family/.test(names))                  return "Community";
  return "Events";
}

function mapSGCatColor(category: string): string {
  const map: Record<string, string> = {
    "Sport":     "#1A9E98",
    "Music":     "#7B5CE0",
    "Events":    "#2860C8",
    "Community": "#2860C8",
  };
  return map[category] ?? "#2860C8";
}

function mapSGCatDot(category: string): string {
  const map: Record<string, string> = {
    "Sport":     "#3ABFB8",
    "Music":     "#A688FF",
    "Events":    "#5A90F8",
    "Community": "#5A90F8",
  };
  return map[category] ?? "#5A90F8";
}

function mapSGEmoji(taxonomies: SGTaxonomy[]): string {
  const names = (taxonomies ?? []).map(t => t.name?.toLowerCase()).join(" ");
  if (/baseball/.test(names))         return "⚾";
  if (/basketball/.test(names))       return "🏀";
  if (/football/.test(names))         return "🏈";
  if (/hockey/.test(names))           return "🏒";
  if (/soccer/.test(names))           return "⚽";
  if (/tennis/.test(names))           return "🎾";
  if (/golf/.test(names))             return "⛳";
  if (/boxing|mma/.test(names))       return "🥊";
  if (/concert|music/.test(names))    return "🎵";
  if (/comedy/.test(names))           return "😂";
  if (/theater|broadway/.test(names)) return "🎭";
  if (/family/.test(names))           return "👨‍👩‍👧";
  return "🎟️";
}

function buildSGDesc(event: SGEvent, priceStr: string | null): string {
  return [
    event.performers?.[0]?.name ?? event.type,
    event.venue.name,
    event.venue.city,
    priceStr,
  ].filter(Boolean).join(" · ").slice(0, 200);
}

function buildSGLongDesc(event: SGEvent, priceStr: string | null): string {
  return [
    event.title,
    event.venue.name ? `at ${event.venue.name}` : null,
    event.venue.address ? `${event.venue.address}, ${event.venue.city}` : event.venue.city,
    priceStr ? `Tickets ${priceStr}` : null,
    event.stats?.listing_count ? `${event.stats.listing_count} tickets available` : null,
  ].filter(Boolean).join(". ").slice(0, 600);
}

function buildSGTags(event: SGEvent, priceStr: string | null): string[] {
  return [
    event.taxonomies?.[0]?.name ?? null,
    priceStr ?? null,
    event.performers?.[0]?.name && event.performers[0].name !== event.title
      ? event.performers[0].name
      : null,
  ].filter((t): t is string => Boolean(t)).slice(0, 3);
}

// ─── Event mapper ────────────────────────────────────────────────────────────

function mapSGEvent(event: SGEvent): EventItem | null {
  if (!event.title || !event.datetime_local) return null;
  if (event.status === "cancelled") return null;

  const venue     = event.venue;
  const performer = event.performers?.[0];
  const location  = [venue.name, venue.address, venue.city, venue.state]
    .filter(Boolean).join(", ");
  const category  = mapSGCategory(event.taxonomies);
  const priceStr  = buildSGPriceStr(event.stats);

  return {
    id:        sgIdToNumber(event.id),
    type:      "event",
    title:     event.title.slice(0, 80),
    desc:      buildSGDesc(event, priceStr),
    longDesc:  buildSGLongDesc(event, priceStr),
    time:      formatSGTime(event.datetime_local),
    date:      event.datetime_local.split("T")[0],
    startIso:  event.datetime_local,
    endIso:    addHoursToIso(event.datetime_local, 3),
    location,
    lat:       venue.location?.lat ?? undefined,
    lng:       venue.location?.lon ?? undefined,
    source:    "SeatGeek",
    category,
    catColor:  mapSGCatColor(category),
    catDot:    mapSGCatDot(category),
    saves:     0,
    img:       mapSGEmoji(event.taxonomies),
    imageUrl:  performer?.image ?? undefined,
    booking: {
      // TODO: append tracking_id param to event.url after partner-program
      // approval (seatgeek.com/build#partners) to earn the ~$11/sale commission.
      label:     priceStr ? `Buy Tickets · ${priceStr}` : "Buy Tickets on SeatGeek",
      url:       event.url,
      affiliate: true,
    },
    tags:       buildSGTags(event, priceStr),
    isCanceled: false,
  };
}

// ─── Main export ────────────────────────────────────────────────────────────

/**
 * Searches the SeatGeek Platform API for upcoming events near the given area
 * (concerts, sports, theater, comedy, festivals) in the next 30 days.
 *
 * Prefers coordinate search (lat/lon + 20mi range); falls back to city/state.
 * Client ID is a public token — called directly, no proxy. Results cached
 * 30 minutes per area/coords. Returns [] on any failure so the feed renders.
 *
 * @param area   Human-readable area name e.g. "Lancaster, PA"
 * @param coords Optional coordinates — enables accurate radius search
 */
export async function searchSeatGeekEvents(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  const clientId = process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID;
  if (!clientId) {
    console.warn("[SeatGeek] no client ID in .env — skipping. Get one free at https://seatgeek.com/build");
    return [];
  }

  const key = getCacheKey(area, coords);
  const cached = sgCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[SeatGeek] cache hit for "${area}" — ${cached.data.length} events`);
    return cached.data;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    per_page:  "20",
    sort:      "score.desc",
    "datetime_utc.gte": new Date().toISOString(),
    "datetime_utc.lte": (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30); // next 30 days
      return d.toISOString();
    })(),
  });

  if (coords?.lat != null && coords?.lng != null) {
    params.set("lat",   String(coords.lat));
    params.set("lon",   String(coords.lng));
    params.set("range", "20mi");
  } else {
    const city = area.split(",")[0].trim();
    params.set("venue.city", city);
    if (area.includes(",")) params.set("venue.state", area.split(",")[1].trim());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${BASE_URL}/events?${params}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[SeatGeek] API returned ${res.status}`);
      return [];
    }

    const data: SGResponse = await res.json();
    const events = data?.events ?? [];

    if (events.length === 0) {
      console.info(`[SeatGeek] no events found for "${area}"`);
      sgCache.set(key, { data: [], expiresAt: Date.now() + CACHE_TTL });
      return [];
    }

    const items = events
      .map(mapSGEvent)
      .filter((i): i is EventItem => i !== null);

    sgCache.set(key, { data: items, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[SeatGeek] ${items.length} events for "${area}"`);
    return items;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") console.warn("[SeatGeek] request timed out after 8s");
    else console.warn("[SeatGeek] fetch failed —", err.message);
    return [];
  }
}
