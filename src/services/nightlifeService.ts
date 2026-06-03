// src/services/nightlifeService.ts
// On-demand Google Places fetch for bars, clubs, and nightlife venues.
//
// Trigger rules:
//   • Only fetches when the "Nightlife" filter is active in the feed or map.
//   • Never included in the All feed (items stay in component state only).
//
// Cache: 30 minutes — busy nights can change; cache keeps fast re-selects free.
//
// TODO: gate nightlife after 5pm — only show in All feed after 17:00 local time

import { EventItem } from "../data/mockEvents";
import { searchNearbyPlaces } from "./googlePlacesService";
import { SEARCH_CONFIG } from "../config/searchConfig";

// Only types confirmed valid for Google Places API (New) Nearby Search (Table 1).
// Any invalid type in the array causes the ENTIRE request to fail with HTTP 400.
const NIGHTLIFE_TYPES = [
  "night_club",
  "bar",
  "cocktail_bar",
  "wine_bar",
  "brewery",
  "pub",
  "karaoke",
  // Removed: "jazz_club"  — not in Places API (New) Table 1 → HTTP 400
  // Removed: "dance_hall" — not in Places API (New) Table 1 → HTTP 400
];

const nightlifeCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1_000;

/**
 * Fetches nearby nightlife venues (bars, clubs, cocktail lounges, jazz clubs, etc.)
 * using Google Places Nearby Search.
 *
 * Results are cached per area/coords for 30 minutes.
 *
 * @param area    Human-readable area string, used for cache key and logging
 * @param coords  Optional coordinates — falls back to DEFAULT_LAT/LNG from SEARCH_CONFIG
 */
export async function getNightlife(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
    console.warn("[Nightlife] No Google Places key — skipping");
    return [];
  }

  // No time-of-day gate: nightlife venues are tagged "Nightlife Places" and
  // hidden from the All feed by FILTER_ONLY_SOURCE_MAP — they only appear when
  // the user explicitly selects the Nightlife filter. A 5 pm gate here had no
  // separate on-demand fetch path, so it made the filter empty before 5 pm.

  const cacheKey = `nightlife-${area}-${coords?.lat?.toFixed(2)}-${coords?.lng?.toFixed(2)}`;
  const cached = nightlifeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Nightlife] Cache hit — ${cached.data.length} results`);
    return cached.data;
  }

  const lat = coords?.lat ?? SEARCH_CONFIG.DEFAULT_LAT;
  const lng = coords?.lng ?? SEARCH_CONFIG.DEFAULT_LNG;

  const results = await searchNearbyPlaces(
    lat,
    lng,
    SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
    NIGHTLIFE_TYPES,
  ).catch(err => {
    console.warn("[Nightlife] Fetch failed:", err);
    return [];
  });

  // Override category and styling — Google Places returns these as "Food & Drink".
  // Use a distinct source name so FILTER_ONLY_SOURCE_MAP can exclude them from the
  // "All" feed while still surfacing them under the Nightlife filter.
  const nightlifeItems: EventItem[] = results.map(item => ({
    ...item,
    source:   "Nightlife Places",
    category: "Nightlife",
    catColor: "#4A1570",   // deep purple
    catDot:   "#9B59B6",
    img:      mapNightlifeEmoji(item),
    tags:     buildNightlifeTags(item),
  }));

  // Best bars first
  nightlifeItems.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  // Only cache successful results — never store an empty array.
  // A stale empty-result cache (e.g. from a previous HTTP 400) would otherwise
  // block every retry for 30 minutes, even after the underlying API issue is fixed.
  if (nightlifeItems.length > 0) {
    nightlifeCache.set(cacheKey, {
      data:      nightlifeItems,
      expiresAt: Date.now() + CACHE_TTL,
    });
  }

  console.log(`[Nightlife] ${nightlifeItems.length} venues for "${area}"`);
  return nightlifeItems;
}

function mapNightlifeEmoji(item: EventItem): string {
  const text = ((item.location ?? "") + " " + (item.title ?? "")).toLowerCase();
  if (/jazz|blues/.test(text))         return "🎷";
  if (/rooftop|roof/.test(text))       return "🥂";
  if (/brewery|brew|beer/.test(text))  return "🍺";
  if (/wine/.test(text))               return "🍷";
  if (/cocktail|lounge/.test(text))    return "🍸";
  if (/karaoke/.test(text))            return "🎤";
  if (/club|dance/.test(text))         return "💃";
  if (/pub|tavern/.test(text))         return "🍻";
  return "🌙";
}

function buildNightlifeTags(item: EventItem): string[] {
  return [
    item.tags?.[0] ?? null,
    item.rating && item.rating >= 4.5 ? "Highly rated" : null,
    "Nightlife",
  ].filter(Boolean).slice(0, 3) as string[];
}
