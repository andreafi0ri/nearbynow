// src/services/recommendationEngine.ts
// Provides Google Places recommendations with adaptive radius retry.
// The threshold decision (whether to fetch at all) is made in feedService.ts
// via shouldFetchGooglePlaces() — do not add threshold checks here.

import { EventItem } from "../data/mockEvents";
import type { MultiSourceEvent } from "../types/deduplication";
import { getGooglePlacesRecommendations, searchNearbyPlaces } from "./googlePlacesService";
import { SEARCH_CONFIG } from "../config/searchConfig";
import type { Coords } from "./recommendationsService";

/** Category identifiers used to identify recommendation cards in filters. */
export const RECOMMENDATION_CATEGORIES = [
  "restaurants", "bars", "cafes",
  "cinemas", "museums", "parks",
  "tourist_attractions",
] as const;

export type FeedResult = {
  /** Deduplicated, sorted events ready for display. */
  items: MultiSourceEvent[];
  /** True when Google Places recommendations were fetched (eventCount < threshold). */
  showingRecommendations: boolean;
  /** Total live events found from all non-Places sources. */
  eventCount: number;
  /** Number of Google Places recommendations included in the feed. */
  recommendationCount: number;
  /** The GOOGLE_PLACES_THRESHOLD value used for this feed load. */
  thresholdUsed: number;
};

/**
 * Fetches Google Places recommendations for an area with adaptive radius retry.
 *
 * When coords are available: runs a Nearby Search at GOOGLE_PLACES_RADIUS_METRES.
 * If fewer than 3 results are returned, widens to SPARSE_FALLBACK_RADIUS_METRES.
 * When no coords: falls back to Text Search using the area name.
 *
 * Note: the decision of whether to call this at all is made upstream in
 * feedService.ts via shouldFetchGooglePlaces(). Do not add threshold checks here.
 *
 * @param area    Human-readable area name (used for text search fallback)
 * @param coords  Optional lat/lng for Nearby Search (more accurate than text)
 * @returns EventItems of type "recommendation", sorted by rating descending
 */
export async function getRecommendations(
  area: string,
  coords?: Coords,
): Promise<EventItem[]> {
  if (coords) {
    let results = await searchNearbyPlaces(
      coords.lat,
      coords.lng,
      SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
    ).catch(() => []);

    if (results.length < 3) {
      console.log(
        `[GooglePlaces] Only ${results.length} results at ` +
        `${SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES}m, ` +
        `widening to ${SEARCH_CONFIG.SPARSE_FALLBACK_RADIUS_METRES}m`
      );
      results = await searchNearbyPlaces(
        coords.lat,
        coords.lng,
        SEARCH_CONFIG.SPARSE_FALLBACK_RADIUS_METRES,
      ).catch(() => []);
    }

    return results;
  }

  // No coords — fall back to text search
  return getGooglePlacesRecommendations(area, undefined);
}
