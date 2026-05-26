// src/services/activitiesService.ts
// Thin orchestration layer for nearby activity venues.
// Source: Google Places only (bowling, escape rooms, arcades, comedy clubs, etc.)
//
// Trigger rules:
//   • Always fetches when the "Activities" filter is active in the feed or map
//   • Also included in the All feed when eventCount < SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD
//
// The 30-minute cache inside searchNearbyActivities means the Activities filter
// and the All-feed sparse trigger share the same cached result — no double API calls.

import { EventItem } from "../data/mockEvents";
import { searchNearbyActivities } from "./googlePlacesService";
import { SEARCH_CONFIG } from "../config/searchConfig";

/**
 * Fetches nearby activity venues (bowling, escape rooms, arcades, comedy clubs,
 * karaoke, go-karts, climbing gyms, pool halls, and more) using Google Places.
 *
 * Trigger rules:
 *   - Always call when the "Activities" filter is active — shows results
 *     regardless of how many events were found from other sources.
 *   - Also called inside the Google Places threshold block in feedService.ts
 *     so activities appear in the All feed when event count is sparse (< 5).
 *
 * Results are cached for 30 minutes per lat/lng. Calling this function twice
 * for the same area (e.g. threshold block + filter on-demand) hits the cache
 * on the second call — no extra API quota is consumed.
 *
 * @param area   Human-readable area string, used for logging only
 * @param coords Optional coordinates — falls back to DEFAULT_LAT/LNG from SEARCH_CONFIG
 */
export async function getNearbyActivities(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
    console.warn("[Activities] No Google Places key — skipping");
    return [];
  }

  const lat = coords?.lat ?? SEARCH_CONFIG.DEFAULT_LAT;
  const lng = coords?.lng ?? SEARCH_CONFIG.DEFAULT_LNG;

  const results = await searchNearbyActivities(lat, lng).catch(err => {
    console.warn("[Activities] Fetch failed:", err);
    return [];
  });

  console.log(
    `[Activities] ${results.length} results via Google Places ` +
      `for "${area}" (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
  );

  return results;
}
