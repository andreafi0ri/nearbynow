// src/services/eventbriteService.ts
//
// NOTE: The Eventbrite public search API (/v3/events/search/) was sunset for
// new API keys in April 2023 — it returns 404 for all new registrations.
// This service has been repurposed to use Ticketmaster's TicketWeb source
// (source=ticketweb), which covers independent and boutique venues — exactly
// the local/indie event niche that Eventbrite historically served.
// Both this service and ticketmasterService share EXPO_PUBLIC_TICKETMASTER_KEY.

import { EventItem } from "../data/mockEvents";
import { geocodeArea } from "./recommendationsService";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── API types ────────────────────────────────────────────────────────────────

type TwClassification = {
  segment?: { name: string };
  genre?:   { name: string };
  subGenre?: { name: string };
};

type TwAddress = { line1?: string };
type TwLocation = { latitude?: string; longitude?: string };

type TwVenue = {
  name?:     string;
  address?:  TwAddress;
  location?: TwLocation;
  city?:     { name?: string };
};

type TwDateDetail = {
  localDate?: string;
  localTime?: string;
};

type TwEvent = {
  id:              string;
  name:            string;
  url:             string;
  info?:           string;
  pleaseNote?:     string;
  dates:           { start: TwDateDetail };
  classifications?: TwClassification[];
  _embedded?:      { venues?: TwVenue[] };
};

type TwResponse = {
  _embedded?: { events?: TwEvent[] };
  fault?:     { faultstring: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashId(str: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) n = ((n * 31) + str.charCodeAt(i)) >>> 0;
  return n % 2_147_483_647;
}

function formatDatetime(localDate?: string, localTime?: string): string {
  if (!localDate) return "See event";
  const [y, mo, d] = localDate.split("-").map(Number);
  const [h, mi]    = (localTime ?? "19:00:00").split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  return `${dt.toLocaleDateString("en-US", { weekday: "short" })} ${dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

function addHours(isoStr: string, hours: number): string {
  const d = new Date(isoStr);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

type CategoryMeta = { category: string; catColor: string; catDot: string; emoji: string };

const SEGMENT_MAP: Record<string, CategoryMeta> = {
  "Music":          { category: "Music",   catColor: "#7C5CBF", catDot: "#9B72CF", emoji: "🎵" },
  "Sports":         { category: "Sport",   catColor: "#1A9E98", catDot: "#3ABFB8", emoji: "🏟️" },
  "Arts & Theatre": { category: "Culture", catColor: "#2D8A6E", catDot: "#34A882", emoji: "🎭" },
  "Family":         { category: "Events",  catColor: "#E8A838", catDot: "#F0B429", emoji: "👨‍👩‍👧" },
};
const DEFAULT_CAT: CategoryMeta = { category: "Events", catColor: "#7C5CBF", catDot: "#9B72CF", emoji: "🎟️" };

function resolveCat(c?: TwClassification[]): CategoryMeta {
  const seg = c?.[0]?.segment?.name;
  return (seg ? SEGMENT_MAP[seg] : undefined) ?? DEFAULT_CAT;
}

function toEventItem(ev: TwEvent, area: string): EventItem {
  const cat      = resolveCat(ev.classifications);
  const venue    = ev._embedded?.venues?.[0];
  const start    = ev.dates.start;
  const date     = start.localDate ?? "";
  const time     = start.localTime ?? "19:00:00";
  const startIso = date ? `${date}T${time}` : "";
  const location = [venue?.name, venue?.address?.line1].filter(Boolean).join(", ") || area;
  const lat      = parseFloat(venue?.location?.latitude ?? "");
  const lng      = parseFloat(venue?.location?.longitude ?? "");
  const desc     = (ev.info ?? cat.category + " event at an independent venue").slice(0, 200);
  const tags     = [ev.classifications?.[0]?.genre?.name, ev.classifications?.[0]?.subGenre?.name]
                     .filter((v): v is string => Boolean(v));
  return {
    id:        hashId("tw-" + ev.id),
    type:      "event",
    title:     ev.name.slice(0, 80),
    desc,
    time:      formatDatetime(date, time),
    location,
    date,
    startIso:  startIso || undefined,
    endIso:    startIso ? addHours(startIso, 3) : undefined,
    source:    "Eventbrite",   // displayed as Eventbrite in the UI (same colour slot)
    sourceUrl: ev.url,
    category:  cat.category,
    catColor:  cat.catColor,
    catDot:    cat.catDot,
    saves:     0,
    img:       cat.emoji,
    lat:       isNaN(lat) ? undefined : lat,
    lng:       isNaN(lng) ? undefined : lng,
    booking:   { label: "Get Tickets", url: ev.url, affiliate: true },
    tags,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches independent/boutique venue events using Ticketmaster's TicketWeb
 * inventory (source=ticketweb). Geocodes the area for accurate lat/lon search.
 * Falls back to city-name search if geocoding fails.
 *
 * @param area - Human-readable area name e.g. "Nashville, Davidson County"
 * @returns Up to 10 EventItems, or [] on failure / missing key
 */
export async function searchEventbrite(area: string): Promise<EventItem[]> {
  const apiKey = process.env.EXPO_PUBLIC_TICKETMASTER_KEY;
  if (!apiKey) {
    console.warn("[TicketWeb] EXPO_PUBLIC_TICKETMASTER_KEY is not set — skipping.");
    return [];
  }

  try {
    const city   = area.split(",")[0].trim();
    const coords = await geocodeArea(area);

    const params = new URLSearchParams({
      apikey: apiKey,
      source: "ticketweb",
      size:   String(SEARCH_CONFIG.EVENTBRITE_MAX_RESULTS),
      sort:   "date,asc",
      radius: String(SEARCH_CONFIG.EVENTBRITE_RADIUS_KM),
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
    if (!res.ok) throw new Error(`TicketWeb ${res.status}`);

    const json: TwResponse = await res.json();
    if (json.fault) throw new Error(json.fault.faultstring);

    return (json._embedded?.events ?? []).slice(0, SEARCH_CONFIG.EVENTBRITE_MAX_RESULTS).map(ev => toEventItem(ev, area));
  } catch (err) {
    console.warn("[TicketWeb] fetch failed:", err);
    return [];
  }
}
