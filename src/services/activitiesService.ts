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
import { searchNearbyActivities, searchNearbyPlaces } from "./googlePlacesService";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── Wellness helpers ─────────────────────────────────────────────────────────

/** Maps a venue title to a wellness-specific emoji. */
function mapWellnessEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/yoga|pilates/.test(t))              return "🧘";
  if (/nail|manicure|pedicure/.test(t))    return "💅";
  if (/hair|salon|barber/.test(t))         return "💇";
  if (/massage|therapy/.test(t))           return "💆";
  if (/gym|fitness|studio/.test(t))        return "🏋️";
  return "✨";
}

/** Builds up to 3 wellness-specific tags from an EventItem. */
function buildWellnessTags(item: EventItem): string[] {
  return [
    "Wellness",
    item.rating && item.rating >= 4.5 ? "Highly rated" : null,
    item.tags?.[0] ?? null,
  ].filter((t): t is string => t !== null).slice(0, 3);
}

const WELLNESS_TYPES = ["spa", "beauty_salon", "yoga_studio", "gym"];

/**
 * Fetches nearby wellness venues (spas, salons, yoga studios, gyms) using
 * Google Places, and remaps them to the Wellness category with rose/pink styling.
 *
 * Results are tagged with source "Wellness Places" so the FILTER_ONLY_SOURCE_MAP
 * can hide them from the All view and surface them only in the Wellness filter.
 *
 * @param area   Human-readable area string (used for logging)
 * @param coords Optional coordinates — falls back to DEFAULT_LAT/LNG
 */
export async function getWellnessVenues(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY) {
    console.warn("[Wellness] No Google Places key — skipping");
    return [];
  }

  const lat = coords?.lat ?? SEARCH_CONFIG.DEFAULT_LAT;
  const lng = coords?.lng ?? SEARCH_CONFIG.DEFAULT_LNG;

  const results = await searchNearbyPlaces(
    lat,
    lng,
    SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
    WELLNESS_TYPES,
  ).catch(err => {
    console.warn("[Wellness] Fetch failed:", err);
    return [];
  });

  console.log(
    `[Wellness] ${results.length} results via Google Places ` +
      `for "${area}" (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
  );

  return results
    .map(item => ({
      ...item,
      source:   "Wellness Places",
      category: "Wellness",
      catColor: "#C25F8F",
      catDot:   "#E88AB4",
      img:      mapWellnessEmoji(item.title),
      tags:     buildWellnessTags(item),
    }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 15);
}

// ─── Activity venues ──────────────────────────────────────────────────────────

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
