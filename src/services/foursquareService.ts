// Foursquare Places — Top Nearby Spots
// 100M+ verified POIs. New FSQ OS Places API (v3 deprecated 15 May 2026).
//
// Pro tier (free) fields only: fsq_place_id, name, categories, location,
// latitude, longitude, distance, website, tel, link.
// NOT used (Premium, $18.75/1k): popularity, description, photos, tips,
// hours, rating, price, stats.
//
// Free: 500 Pro calls/month + $200 dev credits. 24-hour cache keeps usage
// at ~1 call per city per day. Monitor: foursquare.com/developer/console
//
// Key lives server-side in the /api/foursquare-search Vercel proxy
// (Authorization: Bearer) — never in the client bundle.

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

// Web resolves the relative path against the same origin; native has no
// document origin so it uses the absolute production URL.
const PROXY_BASE = Platform.OS === "web" ? "" : "https://www.nearbyandnow.com";

// ─── Types (new 2025 API shape) ────────────────────────────────────────────────

type FSQCategory = {
  id:    number;
  name:  string;
  icon?: { prefix: string; suffix: string };
};

type FSQLocation = {
  address?:   string;
  locality?:  string;   // city
  region?:    string;   // state
  postcode?:  string;
  country?:   string;
};

type FSQVenue = {
  fsq_place_id: string;
  name:         string;
  categories:   FSQCategory[];
  location:     FSQLocation;
  latitude?:    number;   // top-level in the new API (was geocodes.main)
  longitude?:   number;
  distance?:    number;   // metres from search point
  website?:     string;
  tel?:         string;
  link?:        string;   // API path for this place
};

type FSQResponse = { results?: FSQVenue[] };

// ─── Cache — 24 hours ───────────────────────────────────────────────────────────

const fsqCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1_000; // 24 hours

function getCacheKey(lat: number, lng: number): string {
  // Round to ~1km precision so nearby users share one cached call.
  return `fsq-${lat.toFixed(2)}-${lng.toFixed(2)}`;
}

// ─── Category / emoji / colour mapping ──────────────────────────────────────────

function mapFSQCategory(categories: FSQCategory[]): string {
  const name = (categories?.[0]?.name ?? "").toLowerCase();
  if (/restaurant|food|dining|cafe|coffee/.test(name)) return "Food & Drink";
  if (/bar|pub|brewery|nightlife|cocktail/.test(name)) return "Nightlife";
  if (/park|outdoor|nature|garden/.test(name))         return "Outdoors";
  if (/museum|art|gallery|theater|culture/.test(name)) return "Culture";
  if (/gym|fitness|yoga|sport|wellness|spa/.test(name)) return "Wellness";
  if (/shop|store|retail|market/.test(name))           return "Events";
  return "Nearby";
}

function mapFSQCatColor(category: string): string {
  const map: Record<string, string> = {
    "Food & Drink": "#D43030",
    "Nightlife":    "#4A1570",
    "Outdoors":     "#2D7A3A",
    "Culture":      "#B8920A",
    "Wellness":     "#C25F8F",
    "Events":       "#2860C8",
    "Nearby":       "#2860C8",
  };
  return map[category] ?? "#2860C8";
}

function mapFSQCatDot(category: string): string {
  const map: Record<string, string> = {
    "Food & Drink": "#FF6B6B",
    "Nightlife":    "#9B59B6",
    "Outdoors":     "#4AAD5C",
    "Culture":      "#D4A80C",
    "Wellness":     "#E88AB4",
    "Events":       "#5A90F8",
    "Nearby":       "#5A90F8",
  };
  return map[category] ?? "#5A90F8";
}

function mapFSQEmoji(categories: FSQCategory[]): string {
  const name = (categories?.[0]?.name ?? "").toLowerCase();
  if (/coffee|cafe/.test(name))     return "☕";
  if (/pizza/.test(name))           return "🍕";
  if (/sushi|japanese/.test(name))  return "🍱";
  if (/burger/.test(name))          return "🍔";
  if (/cocktail/.test(name))        return "🍸";
  if (/wine/.test(name))            return "🍷";
  if (/bar|pub|brewery/.test(name)) return "🍺";
  if (/park|garden/.test(name))     return "🌿";
  if (/museum/.test(name))          return "🏛️";
  if (/gym|fitness/.test(name))     return "🏋️";
  if (/yoga/.test(name))            return "🧘";
  if (/spa/.test(name))             return "💆";
  if (/shop|store/.test(name))      return "🛍️";
  if (/hotel/.test(name))           return "🏨";
  if (/theater|cinema/.test(name))  return "🎭";
  return "📍";
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function stableId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

function buildFSQDesc(venue: FSQVenue): string {
  return [
    venue.categories?.[0]?.name ?? null,
    venue.location?.locality ?? null,
    venue.distance != null ? `${Math.round(venue.distance / 100) / 10}km away` : null,
  ].filter(Boolean).join(" · ").slice(0, 200);
}

/** Builds a Foursquare category-icon URL (Pro/free) — a flat pictogram.
 *  Format: {prefix}{size}{suffix}, e.g. .../plaza_120.png. Rendered centered
 *  on a tinted card background (it's an icon, not a venue photo). */
function buildFSQIconUrl(categories: FSQCategory[]): string | undefined {
  const icon = categories?.[0]?.icon;
  if (!icon?.prefix || !icon?.suffix) return undefined;
  return `${icon.prefix}120${icon.suffix}`;
}

function buildFSQTags(venue: FSQVenue): string[] {
  return [
    venue.categories?.[0]?.name ?? null,
    venue.location?.locality ?? null,
  ].filter((t): t is string => Boolean(t)).slice(0, 3);
}

// ─── Mapper ─────────────────────────────────────────────────────────────────────

function mapFSQVenue(venue: FSQVenue): EventItem | null {
  if (!venue.name) return null;

  const category = mapFSQCategory(venue.categories);
  const location = [venue.location?.address, venue.location?.locality, venue.location?.region]
    .filter(Boolean).join(", ") || "Nearby";
  const url = venue.website
    || (venue.fsq_place_id ? `https://foursquare.com/v/${venue.fsq_place_id}` : "https://foursquare.com");

  return {
    id:        stableId("fsq-" + venue.fsq_place_id),
    type:      "recommendation",
    title:     venue.name.slice(0, 80),
    desc:      buildFSQDesc(venue),
    longDesc:  buildFSQDesc(venue),
    time:      "Open nearby",
    date:      new Date().toISOString().split("T")[0],
    location,
    lat:       venue.latitude ?? undefined,
    lng:       venue.longitude ?? undefined,
    source:    "Foursquare",
    category,
    catColor:  mapFSQCatColor(category),
    catDot:    mapFSQCatDot(category),
    saves:     0,
    img:       mapFSQEmoji(venue.categories),
    imageUrl:  buildFSQIconUrl(venue.categories), // category pictogram — rendered contained, not cover
    booking:   { label: "View details", url, affiliate: false },
    rating:    undefined,  // Premium field — not requested
    reviews:   undefined,  // Premium field — not requested
    tags:      buildFSQTags(venue),
    isCanceled: false,
  };
}

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * Fetches popular nearby venues from the Foursquare Places API for the
 * "Top nearby spots for you" feed section. Requires coordinates (Foursquare
 * is geo-only). Pro-tier fields only — no premium billing. 24-hour cache per
 * ~1km cell. Returns [] on any failure so the feed always renders.
 *
 * @param area   Human-readable area name (logging only)
 * @param coords Required coordinates — skips if unavailable
 */
export async function searchFoursquareVenues(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  if (coords?.lat == null || coords?.lng == null) {
    console.info(`[Foursquare] no coords for "${area}" — skipping`);
    return [];
  }

  const cacheKey = getCacheKey(coords.lat, coords.lng);
  const cached = fsqCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Foursquare] cache hit for "${area}" — ${cached.data.length} venues`);
    return cached.data;
  }

  const params = new URLSearchParams({
    ll:     `${coords.lat},${coords.lng}`,
    radius: "8000",   // 8km / ~5mi
    limit:  "15",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${PROXY_BASE}/api/foursquare-search?${params}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Foursquare] proxy returned ${res.status}`);
      return [];
    }

    const data: FSQResponse = await res.json();
    const venues = data.results ?? [];

    if (venues.length === 0) {
      console.info(`[Foursquare] no venues for "${area}"`);
      fsqCache.set(cacheKey, { data: [], expiresAt: Date.now() + CACHE_TTL });
      return [];
    }

    const items = venues
      .map(mapFSQVenue)
      .filter((i): i is EventItem => i !== null);

    fsqCache.set(cacheKey, { data: items, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[Foursquare] ${items.length} venues for "${area}"`);
    return items;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") console.warn("[Foursquare] timed out after 8s");
    else console.warn("[Foursquare] fetch failed —", err.message);
    return [];
  }
}
