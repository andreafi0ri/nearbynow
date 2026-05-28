// src/services/parksService.ts
// On-demand Google Places fetch for parks, hiking areas, beaches, and outdoor venues.
//
// Trigger rules:
//   • Only fetches when the "Outdoors" filter is active in the feed or map.
//   • RSS outdoor events (Royal Parks, National Trust, NYC Parks, Prospect Park)
//     are already fetched by feedService → fetchRSSFeeds and surfaced via the
//     Outdoors matchFn in filterConfig. This service adds Google Places venues only
//     to avoid double-fetching RSS feeds.
//
// Cache: 1 hour — parks and outdoor venues change far less frequently than events.

import { EventItem } from "../data/mockEvents";
import { searchNearbyPlaces } from "./googlePlacesService";
import { SEARCH_CONFIG } from "../config/searchConfig";

const PARKS_TYPES = [
  "park",
  "national_park",
  "hiking_area",
  "botanical_garden",
  "dog_park",
  "campground",
  "marina",
  "beach",
  // "nature_reserve" — NOT a valid Google Places API (New) includedType; causes HTTP 400
  "playground",
  "sports_complex",
  "golf_course",
  "ski_resort",
];

const parksCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1_000; // 1 hour

/**
 * Fetches nearby parks and outdoor venues (parks, beaches, hiking areas, etc.)
 * using Google Places Nearby Search.
 *
 * RSS outdoor events are NOT fetched here — they come via feedService. This service
 * adds Google Places place recommendations only. Both are merged in the component.
 *
 * Results are cached per area/coords for 1 hour.
 *
 * @param area    Human-readable area string, used for cache key and logging
 * @param coords  Optional coordinates — falls back to DEFAULT_LAT/LNG from SEARCH_CONFIG
 */
export async function getParksAndOutdoors(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
    console.warn("[Parks] No Google Places key — skipping");
    return [];
  }

  const cacheKey = `parks-${area}-${coords?.lat?.toFixed(2)}-${coords?.lng?.toFixed(2)}`;
  const cached = parksCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Parks] Cache hit — ${cached.data.length} results`);
    return cached.data;
  }

  const lat = coords?.lat ?? SEARCH_CONFIG.DEFAULT_LAT;
  const lng = coords?.lng ?? SEARCH_CONFIG.DEFAULT_LNG;

  const results = await searchNearbyPlaces(
    lat,
    lng,
    SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
    PARKS_TYPES,
  ).catch(err => {
    console.warn("[Parks] Fetch failed:", err);
    return [];
  });

  // Override category and styling for consistent Outdoors presentation.
  // Use a distinct source name so FILTER_ONLY_SOURCE_MAP can exclude them from the
  // "All" feed while still surfacing them under the Outdoors filter.
  const parksItems: EventItem[] = results.map(item => ({
    ...item,
    source:   "Outdoor Places",
    category: "Outdoors",
    catColor: "#2D7A3A",   // forest green
    catDot:   "#4AAD5C",
    img:      mapParksEmoji(item),
    tags:     buildParksTags(item),
  }));

  // Only cache successful results — never store an empty array.
  // A stale empty-result cache (e.g. from a previous HTTP 400) would otherwise
  // block every retry for 1 hour, even after the underlying API issue is fixed.
  if (parksItems.length > 0) {
    parksCache.set(cacheKey, {
      data:      parksItems,
      expiresAt: Date.now() + CACHE_TTL,
    });
  }

  console.log(`[Parks & Outdoors] ${parksItems.length} Google Places venues for "${area}"`);
  return parksItems;
}

function mapParksEmoji(item: EventItem): string {
  const title = (item.title ?? "").toLowerCase();
  if (/beach|shore|coast/.test(title))   return "🏖️";
  if (/mountain|hill|peak/.test(title))  return "⛰️";
  if (/garden|botanical/.test(title))    return "🌸";
  if (/dog\s?park/.test(title))          return "🐕";
  if (/marina|harbor|boat/.test(title))  return "⛵";
  if (/golf/.test(title))                return "⛳";
  if (/trail|hike|hiking/.test(title))   return "🥾";
  if (/playground|play/.test(title))     return "🛝";
  if (/stadium|field|sport/.test(title)) return "🏟️";
  if (/ski|snow|winter/.test(title))     return "⛷️";
  return "🌿";
}

function buildParksTags(item: EventItem): string[] {
  return [
    "Outdoors",
    item.rating && item.rating >= 4.5 ? "Top rated" : null,
    item.tags?.[0] ?? null,
  ].filter(Boolean).slice(0, 3) as string[];
}
