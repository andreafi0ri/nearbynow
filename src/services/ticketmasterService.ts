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
