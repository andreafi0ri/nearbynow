// src/services/meetupService.ts
//
// Meetup GraphQL API — no API key required for public event data.
// Docs: https://www.meetup.com/api/guide

import { EventItem } from "../data/mockEvents";
import { geocodeArea } from "./recommendationsService";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── API types ────────────────────────────────────────────────────────────────

type MuVenue = {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
};

type MuGroup = {
  name: string;
  urlname: string;
};

type MuEvent = {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  endTime: string | null;
  venue: MuVenue | null;
  group: MuGroup;
  eventUrl: string;
  isOnline: boolean;
  going: number | null;
};

type MuEdge = {
  node: {
    result: MuEvent | Record<string, unknown>;
  };
};

type MuResponse = {
  data?: {
    results?: {
      edges: MuEdge[];
    };
  };
  errors?: Array<{ message: string }>;
};

// ─── GraphQL query ────────────────────────────────────────────────────────────

const MEETUP_QUERY = `
  query($lat: Float!, $lon: Float!, $radius: Float!) {
    results: keywordSearch(
      filter: { lat: $lat, lon: $lon, radius: $radius }
      input: { first: ${SEARCH_CONFIG.MEETUP_MAX_RESULTS} }
    ) {
      edges {
        node {
          result {
            ... on Event {
              id
              title
              description
              dateTime
              endTime
              venue { name address city lat lng }
              group { name urlname }
              eventUrl
              isOnline
              going
            }
          }
        }
      }
    }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashId(str: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    n = ((n * 31) + str.charCodeAt(i)) >>> 0;
  }
  return n % 2_147_483_647;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatIso(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const time    = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday} ${time}`;
}

function isoToDate(isoStr: string): string {
  return isoStr.split("T")[0];
}

function isMuEvent(result: MuEvent | Record<string, unknown>): result is MuEvent {
  return typeof (result as MuEvent).id === "string" && typeof (result as MuEvent).title === "string";
}

function toEventItem(ev: MuEvent, area: string): EventItem {
  const desc     = stripHtml(ev.description);
  const location = ev.isOnline
    ? "Online"
    : ev.venue
      ? [ev.venue.name, ev.venue.address, ev.venue.city].filter(Boolean).join(", ")
      : area;

  return {
    id:        hashId("mu-" + ev.id),
    type:      "event",
    title:     ev.title.slice(0, 80),
    desc:      desc.slice(0, 200) || ev.title,
    time:      formatIso(ev.dateTime),
    location,
    date:      isoToDate(ev.dateTime),
    startIso:  ev.dateTime,
    endIso:    ev.endTime ?? undefined,
    source:    "Meetup",
    sourceUrl: ev.eventUrl,
    category:  "Community",
    catColor:  "#2860C8",
    catDot:    "#5A90F8",
    saves:     ev.going ?? 0,
    img:       "🤝",
    lat:       ev.venue?.lat,
    lng:       ev.venue?.lng,
    booking:   { label: "RSVP on Meetup", url: ev.eventUrl, affiliate: false },
    tags:      [ev.group.name],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

// Default fallback coords (central Brooklyn, NYC) used when geocoding fails
const DEFAULT_LAT = SEARCH_CONFIG.DEFAULT_LAT;  // 40.6782
const DEFAULT_LON = SEARCH_CONFIG.DEFAULT_LNG;  // -73.9442

/**
 * Searches Meetup for in-person public events near the given area string.
 * No API key required — uses the Meetup public GraphQL endpoint.
 * Online-only events are excluded.
 *
 * @param area - Human-readable area name e.g. "Brixton, London"
 * @returns Up to 10 EventItems, or [] on failure
 */
export async function searchMeetup(area: string): Promise<EventItem[]> {
  try {
    // Geocode the area to get lat/lon for the GraphQL query
    const coords = await geocodeArea(area);
    const lat    = coords?.lat ?? DEFAULT_LAT;
    const lon    = coords?.lng ?? DEFAULT_LON;

    const res = await fetch("https://api.meetup.com/gql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: MEETUP_QUERY,
        variables: { lat, lon, radius: SEARCH_CONFIG.MEETUP_RADIUS_KM },
      }),
    });

    if (!res.ok) throw new Error(`Meetup ${res.status}`);

    const json: MuResponse = await res.json();

    if (json.errors?.length) {
      throw new Error(json.errors[0].message);
    }

    const edges = json.data?.results?.edges ?? [];
    const items: EventItem[] = [];

    for (const edge of edges) {
      const result = edge.node.result;
      if (!isMuEvent(result)) continue;
      if (result.isOnline) continue;          // local events only
      if (!result.title?.trim()) continue;
      items.push(toEventItem(result, area));
      if (items.length >= SEARCH_CONFIG.MEETUP_MAX_RESULTS) break;
    }

    return items;
  } catch (err) {
    console.warn("[Meetup] fetch failed:", err);
    return [];
  }
}
