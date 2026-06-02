// src/services/googlePlacesService.ts
//
// Google Places API (New) — Text Search + Nearby Search.
// Enable "Places API (New)" in Google Cloud Console (NOT the legacy "Places API").
// Get a key at https://console.cloud.google.com → APIs & Services → Credentials.
// Add to .env: EXPO_PUBLIC_GOOGLE_PLACES_KEY=your_key_here
//
// Cost: $200/month free credit from Google.
// Nearby Search ≈ $0.032/call → ~6,200 free calls/month.
// Text Search   ≈ $0.032/call → ~6,200 free calls/month.

import { EventItem } from "../data/mockEvents";
import { SEARCH_CONFIG } from "../config/searchConfig";
import type { Coords } from "./recommendationsService";
import {
  ALL_ACTIVITY_GOOGLE_TYPES,
  getActivityTypeForGoogleType,
} from "../config/activityTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "https://places.googleapis.com/v1/places";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.location",
  "places.currentOpeningHours",
  "places.photos",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.editorialSummary",
].join(",");

// ─── API types ────────────────────────────────────────────────────────────────

type PriceLevel =
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE";

type GpPeriodPoint = { day: number; hour: number; minute: number };

type GpOpeningHours = {
  openNow?: boolean;
  periods?: { open?: GpPeriodPoint; close?: GpPeriodPoint }[];
  weekdayDescriptions?: string[];
};

type GpPhoto = { name: string; widthPx?: number; heightPx?: number };

type GpPlace = {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  types?: string[];
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: GpOpeningHours;
  photos?: GpPhoto[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  editorialSummary?: { text: string; languageCode?: string };
};

type GpResponse = {
  places?: GpPlace[];
  error?: { message: string; code: number };
};

// ─── Category / emoji mapping ─────────────────────────────────────────────────

/**
 * Maps Google place types to our internal category system.
 * Types are checked in priority order — first match wins.
 */
export function mapPlaceTypeToCategory(types: string[]): string {
  if (types.some(t => ["restaurant", "food", "meal_delivery", "meal_takeaway"].includes(t))) return "Food & Drink";
  if (types.some(t => ["bar", "night_club", "liquor_store"].includes(t))) return "Food & Drink";
  if (types.some(t => ["cafe", "bakery"].includes(t))) return "Food & Drink";
  if (types.includes("movie_theater")) return "Cinema";
  if (types.some(t => ["museum", "art_gallery", "library", "cultural_center"].includes(t))) return "Culture";
  if (types.some(t => ["tourist_attraction", "amusement_park", "zoo", "aquarium"].includes(t))) return "Culture";
  if (types.some(t => ["park", "natural_feature", "campground", "national_park"].includes(t))) return "Outdoors";
  if (types.some(t => ["gym", "stadium", "sports_complex", "bowling_alley"].includes(t))) return "Sport";
  if (types.some(t => ["spa", "beauty_salon", "hair_care"].includes(t))) return "Lifestyle";
  return "Nearby";
}

/** Maps Google place types to an emoji icon. */
export function mapPlaceTypeToEmoji(types: string[]): string {
  if (types.some(t => ["restaurant", "food", "meal_delivery", "meal_takeaway"].includes(t))) return "🍽️";
  if (types.some(t => ["bar", "night_club"].includes(t))) return "🍸";
  if (types.some(t => ["cafe", "bakery"].includes(t))) return "☕";
  if (types.includes("movie_theater")) return "🎬";
  if (types.some(t => ["museum", "art_gallery", "library"].includes(t))) return "🏛️";
  if (types.some(t => ["park", "natural_feature"].includes(t))) return "🌿";
  if (types.some(t => ["gym", "stadium"].includes(t))) return "🏋️";
  if (types.some(t => ["spa", "beauty_salon"].includes(t))) return "💆";
  if (types.some(t => ["tourist_attraction", "amusement_park"].includes(t))) return "⭐";
  return "📍";
}

// Category → [catColor, catDot]
const CAT_COLORS: Record<string, [string, string]> = {
  "Food & Drink": ["#D43030", "#FF6B6B"],
  "Cinema":       ["#7B5CE0", "#C4A0FF"],
  "Culture":      ["#2D8A6E", "#34A882"],
  "Outdoors":     ["#27AE60", "#5CDB95"],
  "Sport":        ["#1A9E98", "#3ABFB8"],
  "Lifestyle":    ["#E8A838", "#F0B429"],
  "Nearby":       ["#4285F4", "#6AA3F6"],
};

function catColors(category: string): [string, string] {
  return CAT_COLORS[category] ?? ["#4285F4", "#6AA3F6"];
}

// ─── Showtime generation ──────────────────────────────────────────────────────

/**
 * Derives plausible screening slots from a Google Places opening-hours object.
 *
 * Algorithm:
 *  - Reads today's open/close times from the periods array
 *  - First slot: 45 min after opening (lobby/trailers time)
 *  - Interval: every 2h 30m (typical feature length + trailers)
 *  - Last slot: must start at least 2h before closing (so the film fits)
 *
 * Returns [] when hours are unavailable or the cinema is closed today.
 */
export function generateShowtimes(hours?: GpOpeningHours): string[] {
  if (!hours?.periods?.length) return [];

  const todayDay = new Date().getDay(); // 0 = Sun … 6 = Sat
  const period   = hours.periods.find(p => p.open?.day === todayDay);
  if (!period?.open || !period?.close) return [];

  const openMins  = period.open.hour  * 60 + period.open.minute;
  const closeMins = period.close.hour * 60 + period.close.minute;

  const INTERVAL_MINS   = 150; // 2h 30m between slots
  const FIRST_OFFSET    = 45;  // first slot 45 min after doors open
  const LAST_MARGIN     = 120; // last slot must start ≥ 2h before closing

  const slots: string[] = [];
  let t = openMins + FIRST_OFFSET;

  while (t + LAST_MARGIN <= closeMins) {
    const h    = Math.floor(t / 60) % 24;
    const m    = t % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const mStr = String(m).padStart(2, "0");
    slots.push(`${h12}:${mStr} ${ampm}`);
    t += INTERVAL_MINS;
  }

  return slots;
}

// ─── Content helpers ──────────────────────────────────────────────────────────

const PRICE_LABELS: Record<PriceLevel, string> = {
  PRICE_LEVEL_FREE:           "free",
  PRICE_LEVEL_INEXPENSIVE:    "budget-friendly",
  PRICE_LEVEL_MODERATE:       "mid-range",
  PRICE_LEVEL_EXPENSIVE:      "upscale",
  PRICE_LEVEL_VERY_EXPENSIVE: "high-end",
};

/** Builds a natural-language description from place metadata when no editorial summary exists. */
export function buildAutoDesc(place: GpPlace): string {
  const name      = place.displayName?.text ?? "This place";
  const price     = place.priceLevel ? `${PRICE_LABELS[place.priceLevel]} ` : "";
  const typeLabel = (place.types?.[0] ?? "place").replace(/_/g, " ");
  const rating    = place.rating
    ? ` Rated ${place.rating}/5 by ${(place.userRatingCount ?? 0).toLocaleString()} visitors.`
    : "";
  return `${name} is a ${price}${typeLabel}.${rating}`.slice(0, 200);
}

/** Formats the current opening status into a human-readable string. */
export function buildOpeningTime(hours?: GpOpeningHours): string {
  if (!hours) return "Check opening hours";

  // Open 24h: a period with no close time
  if (hours.periods?.some(p => !p.close)) return "Open 24 hours";

  if (hours.openNow === true) {
    const todayDay = new Date().getDay();
    const todayPeriod = hours.periods?.find(p => p.open?.day === todayDay);
    if (todayPeriod?.close) {
      const { hour: h, minute: m } = todayPeriod.close;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const mStr = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
      return `Open until ${h12}${mStr} ${ampm}`;
    }
    return "Open now";
  }

  if (hours.openNow === false) {
    const now     = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let offset = 0; offset <= 6; offset++) {
      const day    = (now.getDay() + offset) % 7;
      const period = hours.periods?.find(p => p.open?.day === day);
      if (!period?.open) continue;
      const { hour: h, minute: m } = period.open;
      const openMins = h * 60 + m;
      if (offset > 0 || openMins > nowMins) {
        const ampm = h >= 12 ? "PM" : "AM";
        const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const mStr = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
        const prefix = offset === 0 ? "Opens at" : `Opens ${DAY_NAMES[day]}`;
        return `${prefix} ${h12}${mStr} ${ampm}`;
      }
    }
    return "Closed";
  }

  return "Check opening hours";
}

/**
 * Returns a booking link with affiliate flag.
 * Priority: restaurants/bars → OpenTable affiliate, then website.
 */
export function buildBookingLink(place: GpPlace): EventItem["booking"] {
  const isFood = place.types?.some(t =>
    ["restaurant", "bar", "cafe", "food", "meal_delivery", "meal_takeaway", "bakery"].includes(t)
  );
  if (isFood) {
    const term = encodeURIComponent(place.displayName?.text ?? "");
    return {
      label: "Book on OpenTable",
      url: `https://www.opentable.com/s/?term=${term}&covers=2`,
      affiliate: true,
    };
  }
  if (place.websiteUri) {
    return { label: "Visit website", url: place.websiteUri, affiliate: false };
  }
  return null;
}

const SKIP_TAGS = new Set([
  "point_of_interest", "establishment", "premise", "political",
  "locality", "sublocality", "sublocality_level_1", "administrative_area_level_1",
]);

const TAG_LABELS: Record<string, string> = {
  restaurant: "Restaurant", bar: "Bar", cafe: "Café", bakery: "Bakery",
  night_club: "Nightlife", museum: "Museum", art_gallery: "Art",
  movie_theater: "Cinema", park: "Park", gym: "Fitness", spa: "Spa",
  tourist_attraction: "Attraction", hotel: "Hotel", stadium: "Stadium",
  library: "Library", aquarium: "Aquarium", zoo: "Zoo",
  amusement_park: "Amusement Park", campground: "Camping", bowling_alley: "Bowling",
};

/** Extracts up to 3 human-readable tags from place types, filtering generic ones. */
export function buildTags(place: GpPlace): string[] {
  return (place.types ?? [])
    .filter(t => !SKIP_TAGS.has(t))
    .map(t => TAG_LABELS[t] ?? t.replace(/_/g, " "))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);
}

// ─── Stable numeric ID ────────────────────────────────────────────────────────

function stableId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

// ─── Place → EventItem ────────────────────────────────────────────────────────

function buildGpPhotoUrl(place: GpPlace): string | undefined {
  const photo = place.photos?.[0];
  if (!photo?.name) return undefined;
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  if (!key) return undefined;
  // GP Photos (New) URL — no extra API call, loads as a redirect to CDN
  return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${key}`;
}

function toEventItem(place: GpPlace): EventItem {
  const category = mapPlaceTypeToCategory(place.types ?? []);
  const [catColor, catDot] = catColors(category);
  const today = new Date().toISOString().split("T")[0];

  return {
    id:        stableId("gp-" + place.id),
    type:      "recommendation",
    title:     place.displayName?.text ?? "Unnamed place",
    desc:      (place.editorialSummary?.text ?? buildAutoDesc(place)).slice(0, 200),
    time:      buildOpeningTime(place.currentOpeningHours),
    date:      today,
    startIso:  `${today}T09:00`,
    endIso:    `${today}T23:00`,
    location:  place.formattedAddress ?? "",
    lat:       place.location?.latitude,
    lng:       place.location?.longitude,
    source:    "Google Places",
    sourceUrl: place.websiteUri,
    category,
    catColor,
    catDot,
    saves:     0,
    img:       mapPlaceTypeToEmoji(place.types ?? []),
    booking:   buildBookingLink(place),
    rating:    place.rating,
    reviews:   place.userRatingCount,
    tags:      buildTags(place),
    imageUrl:  buildGpPhotoUrl(place),
  };
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function gpFetch(endpoint: string, body: object): Promise<GpPlace[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  if (!apiKey) {
    console.warn("[GooglePlaces] EXPO_PUBLIC_GOOGLE_PLACES_KEY not set — skipping. Get a key at https://console.cloud.google.com");
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type":   "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({} as GpResponse));
      const msg  = (body as GpResponse).error?.message ?? `HTTP ${res.status}`;
      // Surface the full error so it's visible in the Metro console
      console.error(
        `[GooglePlaces] ❌ ${endpoint} → ${res.status}\n` +
        `  Message: ${msg}\n` +
        `  Tip: make sure "Places API (New)" (NOT the legacy Places API) is enabled\n` +
        `  at https://console.cloud.google.com/apis/library/places-backend.googleapis.com`
      );
      throw new Error(msg);
    }

    const data: GpResponse = await res.json();
    if (!data.places?.length) {
      console.warn(`[GooglePlaces] ${endpoint} → 200 OK but 0 places returned`);
    }
    return data.places ?? [];
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("HTTP "))) {
      // Only log non-HTTP errors here — HTTP errors already logged above
      console.warn(`[GooglePlaces] ${endpoint} failed:`, err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Nearby Search — finds popular places within a radius of given coordinates.
 * Uses POPULARITY ranking. Requires coords from geocoding or device GPS.
 *
 * @param lat     Latitude of the search centre
 * @param lng     Longitude of the search centre
 * @param radius  Search radius in metres (default: GOOGLE_PLACES_RADIUS_METRES)
 * @param types   Google place types to include
 */
export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  radius: number = SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
  types: string[] = ["restaurant", "bar", "cafe", "tourist_attraction", "movie_theater"],
): Promise<EventItem[]> {
  const places = await gpFetch(":searchNearby", {
    includedTypes: types,
    maxResultCount: SEARCH_CONFIG.GOOGLE_PLACES_MAX_RESULTS,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    rankPreference: "POPULARITY",
  });
  return places.map(toEventItem);
}

/**
 * Text Search — finds places matching a free-text query within an area.
 * Falls back when no coordinates are available.
 *
 * @param query  What to search for, e.g. "restaurants bars"
 * @param area   Human-readable area name, e.g. "Brixton, London"
 */
export async function searchPlacesByText(
  query: string,
  area: string,
): Promise<EventItem[]> {
  const places = await gpFetch(":searchText", {
    textQuery: `${query} in ${area}`,
    maxResultCount: 10,
    languageCode: "en",
  });
  return places.map(toEventItem);
}

// ─── Cinema-specific mapper & fetch ──────────────────────────────────────────

/** Builds a Google Movies showtimes search URL for a specific theater. */
function buildShowtimesUrl(place: GpPlace): string {
  const name = encodeURIComponent(place.displayName?.text ?? "cinema");
  const addr = encodeURIComponent(place.formattedAddress ?? "");
  return `https://www.google.com/search?q=showtimes+${name}+${addr}`;
}

/** Maps a raw GpPlace (movie_theater) into a Cinema EventItem with showTimes. */
function toCinemaItem(place: GpPlace): EventItem {
  const [catColor, catDot] = catColors("Cinema");
  const today    = new Date().toISOString().split("T")[0];
  const showTimes = generateShowtimes(place.currentOpeningHours);

  return {
    id:        stableId("gp-cinema-" + place.id),
    type:      "recommendation",
    title:     place.displayName?.text ?? "Cinema",
    desc:      (place.editorialSummary?.text ?? buildAutoDesc(place)).slice(0, 200),
    time:      buildOpeningTime(place.currentOpeningHours),
    date:      today,
    startIso:  `${today}T10:00`,
    endIso:    `${today}T23:59`,
    location:  place.formattedAddress ?? "",
    lat:       place.location?.latitude,
    lng:       place.location?.longitude,
    source:    "Showtimes",
    sourceUrl: place.websiteUri,
    category:  "Cinema",
    catColor,
    catDot,
    saves:     0,
    img:       "🎬",
    booking:   {
      label:     "Check Showtimes",
      url:       place.websiteUri ?? buildShowtimesUrl(place),
      affiliate: false,
    },
    rating:    place.rating,
    reviews:   place.userRatingCount,
    tags:      buildTags(place),
    showTimes: showTimes.length > 0 ? showTimes : undefined,
  };
}

/**
 * Fetches nearby movie theaters and returns them as Cinema recommendation cards,
 * each populated with plausible show times derived from Google Places opening hours.
 *
 * Always called regardless of the event-count threshold — ensures the Cinema filter
 * always has results. Capped at 8 theaters to keep API cost minimal.
 *
 * @param area    Human-readable area name (text-search fallback when no coords)
 * @param coords  Optional lat/lng for Nearby Search
 */
export async function fetchCinemas(area: string, coords?: Coords): Promise<EventItem[]> {
  const places = await (
    coords
      ? gpFetch(":searchNearby", {
          includedTypes:  ["movie_theater"],
          maxResultCount: 8,
          locationRestriction: {
            circle: {
              center: { latitude: coords.lat, longitude: coords.lng },
              radius: SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
            },
          },
          rankPreference: "POPULARITY",
        })
      : gpFetch(":searchText", {
          textQuery:      `movie theaters cinemas in ${area}`,
          maxResultCount: 8,
          languageCode:   "en",
        })
  );

  return places.map(toCinemaItem);
}

// ─── Activities search ────────────────────────────────────────────────────────

/** Maps a PriceLevel to a short $ indicator tag. */
function buildPriceTag(priceLevel: PriceLevel): string | null {
  const map: Record<PriceLevel, string> = {
    PRICE_LEVEL_FREE:           "Free",
    PRICE_LEVEL_INEXPENSIVE:    "$",
    PRICE_LEVEL_MODERATE:       "$$",
    PRICE_LEVEL_EXPENSIVE:      "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[priceLevel] ?? null;
}

/** In-memory cache for activity search results. TTL 30 minutes. */
const activitiesCache = new Map<string, { data: EventItem[]; expiresAt: number }>();
const ACTIVITIES_CACHE_TTL = 30 * 60_000;

/**
 * Nearby Search restricted to activity venue types (bowling, escape rooms,
 * arcades, comedy clubs, karaoke, go-karts, climbing, etc.).
 *
 * Results are mapped to EventItem with category "Activities" and the
 * appropriate per-type emoji.  Cached for 30 minutes per lat/lng/radius combo.
 *
 * @param lat    Latitude of the search centre
 * @param lng    Longitude of the search centre
 * @param radius Search radius in metres (default: GOOGLE_PLACES_RADIUS_METRES)
 */
export async function searchNearbyActivities(
  lat: number,
  lng: number,
  radius: number = SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
): Promise<EventItem[]> {
  const cacheKey = `activities-${lat.toFixed(2)}-${lng.toFixed(2)}-${radius}`;
  const cached = activitiesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Activities] Cache hit — ${cached.data.length} results`);
    return cached.data;
  }

  const places = await gpFetch(":searchNearby", {
    includedTypes:  ALL_ACTIVITY_GOOGLE_TYPES,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    rankPreference: "POPULARITY",
  });

  const today = new Date().toISOString().split("T")[0];

  // Exclude gyms and fitness centres: sports_complex in includedTypes can
  // pull in places like Planet Fitness that Google also tags as "gym" or
  // "fitness_center". Those belong in a Health/Fitness filter, not Activities.
  const GYM_TYPES = new Set(["gym", "fitness_center"]);
  const activityPlaces = places.filter(
    p => !p.types?.some(t => GYM_TYPES.has(t))
  );

  const items: EventItem[] = activityPlaces
    .map((place): EventItem => {
      // Detect which activity type this place is (try first two Google types)
      const primaryType   = place.types?.[0] ?? "";
      const secondaryType = place.types?.[1] ?? "";
      const activityType =
        getActivityTypeForGoogleType(primaryType) ||
        getActivityTypeForGoogleType(secondaryType);

      // Build tags from the activity type + optional price + rating bonus
      const activityTags = activityType?.tags ?? [];
      const priceTag     = place.priceLevel ? buildPriceTag(place.priceLevel) : null;
      const ratingTag    = (place.rating ?? 0) >= 4.5 ? "Highly rated" : null;
      const tags = [...activityTags, priceTag, ratingTag]
        .filter((t): t is string => t !== null)
        .slice(0, 3);

      return {
        id:        stableId("gp-act-" + place.id),
        type:      "recommendation",
        title:     place.displayName?.text ?? "Activity venue",
        desc:      (place.editorialSummary?.text ?? buildAutoDesc(place)).slice(0, 200),
        time:      buildOpeningTime(place.currentOpeningHours),
        date:      today,
        startIso:  `${today}T09:00`,
        endIso:    `${today}T23:00`,
        location:  place.formattedAddress ?? "",
        lat:       place.location?.latitude,
        lng:       place.location?.longitude,
        source:    "Activity Places",
        sourceUrl: place.websiteUri,
        category:  "Activities",
        catColor:  "#1A9E98",
        catDot:    "#3ABFB8",
        saves:     0,
        img:       activityType?.emoji ?? "🎯",
        booking:   place.websiteUri
          ? { label: "Visit website", url: place.websiteUri, affiliate: false }
          : null,
        rating:    place.rating,
        reviews:   place.userRatingCount,
        tags,
        imageUrl:  buildGpPhotoUrl(place),
      };
    })
    // Sort by rating descending, cap at 15
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 15);

  // Only cache successful results — never store an empty array.
  // A stale empty-result cache (e.g. from a previous HTTP 400) would otherwise
  // block every retry for 30 minutes, even after the underlying API issue is fixed.
  if (items.length > 0) {
    activitiesCache.set(cacheKey, { data: items, expiresAt: Date.now() + ACTIVITIES_CACHE_TTL });
  }
  return items;
}

/**
 * Main recommendations export. Runs food/drink and attractions searches in
 * parallel, then merges and sorts by rating.
 *
 * @param area    Human-readable area name (used for text search fallback)
 * @param coords  Optional lat/lng for Nearby Search (more accurate)
 * @returns Up to 15 recommendation EventItems sorted by rating descending
 */
export async function getGooglePlacesRecommendations(
  area: string,
  coords?: Coords,
): Promise<EventItem[]> {
  const [foodResult, attractionsResult] = await Promise.allSettled(
    coords
      ? [
          searchNearbyPlaces(coords.lat, coords.lng, SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES, ["restaurant", "bar", "cafe", "bakery"]),
          searchNearbyPlaces(coords.lat, coords.lng, SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES, ["tourist_attraction", "museum", "movie_theater", "park", "art_gallery"]),
        ]
      : [
          searchPlacesByText("restaurants bars cafes", area),
          searchPlacesByText("things to do museums parks attractions", area),
        ],
  );

  const food        = foodResult.status        === "fulfilled" ? foodResult.value        : [];
  const attractions = attractionsResult.status === "fulfilled" ? attractionsResult.value : [];

  // Deduplicate by numeric id, sort by rating desc, cap at GOOGLE_PLACES_MAX_RESULTS
  const seen = new Set<number>();
  const merged = [...food, ...attractions]
    .filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, SEARCH_CONFIG.GOOGLE_PLACES_MAX_RESULTS);

  // Debug logging
  const avg = merged.reduce((s, i) => s + (i.rating ?? 0), 0) / (merged.length || 1);
  const cats = merged.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1; return acc;
  }, {});
  console.log(`[GooglePlaces] ${merged.length} places fetched | avg rating: ${avg.toFixed(1)} | categories:`, cats);

  return merged;
}
