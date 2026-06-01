// src/services/meetupService.ts
//
// Meetup GraphQL API (gql2 endpoint)
// Docs:  https://www.meetup.com/api/guide
//
// The old /gql endpoint was deprecated — the current endpoint is /gql2.
// recommendedEvents replaces keywordSearch (which no longer exists on gql2).
//
// On native, add EXPO_PUBLIC_MEETUP_KEY to .env.local for authenticated queries.
// On web, requests route through /api/meetup-search (Vercel proxy) which calls
// Meetup server-side without auth — public event queries do not require OAuth.

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";
import { geocodeArea } from "./recommendationsService";
import { SEARCH_CONFIG } from "../config/searchConfig";

// Direct Meetup calls are blocked by CORS on web.
// Requests route through /api/meetup-search on web
// and call Meetup directly on native.
const MEETUP_ENDPOINT = Platform.OS === "web"
  ? "/api/meetup-search"           // Vercel proxy — no CORS restriction
  : "https://api.meetup.com/gql2"; // Direct on native (updated from /gql → /gql2)

// ─── API types ────────────────────────────────────────────────────────────────

type MuVenue = {
  name:    string;
  address: string;
  city:    string;
  lat:     number;
  lon:     number; // API uses "lon" not "lng"
};

type MuGroup = {
  name:    string;
  urlname: string;
};

type MuEvent = {
  id:          string;
  title:       string;
  description: string;
  dateTime:    string;
  endTime:     string | null;
  venue:       MuVenue | null;
  group:       MuGroup;
  eventUrl:    string;
  isOnline:    boolean;
};

type MuEdge = {
  node: MuEvent;
};

type MuResponse = {
  data?: {
    recommendedEvents?: {
      edges: MuEdge[];
    };
  };
  errors?: Array<{ message: string }>;
};

// ─── GraphQL query ────────────────────────────────────────────────────────────
// Uses recommendedEvents (replaces the deprecated keywordSearch field).
// - `first` is a top-level arg, not wrapped in `input: {}`
// - venue uses `lon` (not `lng`)
// - `going` is a connection type on gql2 — omitted to keep the query simple

const MEETUP_QUERY = `
  query($lat: Float!, $lon: Float!, $radius: Float!) {
    recommendedEvents(
      filter: { lat: $lat, lon: $lon, radius: $radius }
      first: ${SEARCH_CONFIG.MEETUP_MAX_RESULTS}
    ) {
      edges {
        node {
          id
          title
          description
          dateTime
          endTime
          venue { name address city lat lon }
          group { name urlname }
          eventUrl
          isOnline
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
    category:  "Events",
    catColor:  "#ED1C40",
    catDot:    "#FF4D6B",
    saves:     0,
    img:       "🤝",
    lat:       ev.venue?.lat,
    lng:       ev.venue?.lon, // API field is "lon", EventItem stores as "lng"
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
 * Uses the recommendedEvents field on the gql2 endpoint.
 * Online-only events are excluded.
 *
 * @param area - Human-readable area name e.g. "Brixton, London"
 * @returns Up to MEETUP_MAX_RESULTS EventItems, or [] on failure
 */
export async function searchMeetup(area: string): Promise<EventItem[]> {
  const apiKey = process.env.EXPO_PUBLIC_MEETUP_KEY;

  // On native, an OAuth Bearer token improves result quality.
  // On web, the /api/meetup-search proxy calls Meetup without auth
  // (recommendedEvents is publicly accessible on gql2).
  if (Platform.OS !== "web" && !apiKey) {
    console.warn("[Meetup] No EXPO_PUBLIC_MEETUP_KEY — results may be limited on native. See https://www.meetup.com/api/oauth/list/");
  }

  try {
    // Geocode the area to get lat/lon for the GraphQL query
    const coords = await geocodeArea(area);
    const lat    = coords?.lat ?? DEFAULT_LAT;
    const lon    = coords?.lng ?? DEFAULT_LON;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    // Include the Bearer token on native when available
    if (Platform.OS !== "web" && apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(MEETUP_ENDPOINT, {
      method: "POST",
      headers,
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

    // gql2/recommendedEvents: node IS the event (no "result" union wrapper)
    const edges = json.data?.recommendedEvents?.edges ?? [];
    const items: EventItem[] = [];

    for (const edge of edges) {
      const ev = edge.node;
      if (!ev?.id || !ev?.title?.trim()) continue;
      if (ev.isOnline) continue; // local events only
      items.push(toEventItem(ev, area));
      if (items.length >= SEARCH_CONFIG.MEETUP_MAX_RESULTS) break;
    }

    console.log(`[Meetup] ${items.length} events for "${area}"`);
    return items;
  } catch (err) {
    console.warn("[Meetup] fetch failed:", err);
    return [];
  }
}
