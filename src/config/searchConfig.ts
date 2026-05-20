// src/config/searchConfig.ts
// ─────────────────────────────────────────────────────
// HEARBY — SEARCH RADIUS CONFIG
// ─────────────────────────────────────────────────────
// All distances stored in METRES internally.
// Helper functions convert to km or miles as needed.
// Change values here — they flow through to every service.
//
// GUIDE:
//   Dense city centre (Manhattan, Central London): 2,000–3,000m
//   Normal city / large town:                      5,000–8,000m ← default
//   Suburban / smaller town:                       10,000–15,000m
//   Rural area:                                    20,000–30,000m
// ─────────────────────────────────────────────────────

export const SEARCH_CONFIG = {

  // ── Default radius ───────────────────────────────────
  // 16km ≈ 10 miles
  DEFAULT_RADIUS_METRES: 16000,

  // ── Per-service radius overrides ────────────────────
  GOOGLE_PLACES_RADIUS_METRES: 5000,    // ~3 miles — intentionally narrower (place density)
  FACEBOOK_EVENTS_RADIUS_METRES: 16000, // ~10 miles
  EVENTBRITE_RADIUS_KM: 16,             // ~10 miles
  MEETUP_RADIUS_KM: 16,                 // ~10 miles
  TICKETMASTER_RADIUS_KM: 16,           // ~10 miles

  // ── Google Places threshold ──────────────────────────
  // Google Places results are ONLY fetched and shown
  // when the total number of live events from ALL other
  // sources (Reddit, Eventbrite, Meetup, Ticketmaster,
  // Facebook, RSS) combined is LESS THAN this number.
  // If event count >= GOOGLE_PLACES_THRESHOLD → skip
  // Google Places entirely, do not fetch, do not show.
  GOOGLE_PLACES_THRESHOLD: 5,

  // ── Sparse area radius expansion ────────────────────
  // When Google Places IS triggered (events < 5),
  // if the first Places call returns fewer than 3 results,
  // automatically widen to this fallback radius.
  SPARSE_FALLBACK_RADIUS_METRES: 15000, // ~9 miles

  // ── Result limits per service ───────────────────────
  GOOGLE_PLACES_MAX_RESULTS: 15,
  FACEBOOK_EVENTS_MAX_RESULTS: 20,
  EVENTBRITE_MAX_RESULTS: 15,
  MEETUP_MAX_RESULTS: 15,
  TICKETMASTER_MAX_RESULTS: 15,
  REDDIT_MAX_RESULTS: 25,
  RSS_MAX_RESULTS: 40,

  // ── Coordinate defaults ──────────────────────────────
  // Used when GPS not available — central Brooklyn, NYC
  DEFAULT_LAT: 40.6782,
  DEFAULT_LNG: -73.9442,
} as const;

// ── Conversion helpers ───────────────────────────────

/** Convert metres to kilometres (1 decimal place). */
export const metresToKm = (m: number): number =>
  Math.round((m / 1000) * 10) / 10;

/** Convert metres to miles (1 decimal place). */
export const metresToMiles = (m: number): number =>
  Math.round((m / 1609.34) * 10) / 10;

/** Convert kilometres to metres. */
export const kmToMetres = (km: number): number =>
  Math.round(km * 1000);

/**
 * Returns a human-readable radius label for UI display.
 * e.g. "5 miles (8km)"
 */
export const getRadiusLabel = (metres: number): string => {
  const miles = metresToMiles(metres);
  const km    = metresToKm(metres);
  return `${miles} miles (${km}km)`;
};

/**
 * Determines whether Google Places should be fetched based on how many live
 * events were found from other sources.
 *
 * Rule: ONLY fetch Google Places if eventCount < GOOGLE_PLACES_THRESHOLD (5).
 * This check happens BEFORE the API call — if events ≥ 5, the API is never
 * called, saving quota and improving load speed.
 *
 * @param eventCount - total live events found from all non-Places sources
 * @returns true if Google Places should be fetched, false if not
 */
export const shouldFetchGooglePlaces = (eventCount: number): boolean => {
  const should = eventCount < SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD;
  console.log(
    `[GooglePlaces] ${should ? "FETCHING" : "SKIPPED"} ` +
    `(${eventCount} events found, threshold is ${SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD})`
  );
  return should;
};
