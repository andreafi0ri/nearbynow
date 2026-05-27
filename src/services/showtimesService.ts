// src/services/showtimesService.ts
// Showtimes Service — AMC API + Fandango Affiliate
// AMC: Real-time showtimes, free API, key required
//   Apply at: https://developers.amctheatres.com
//   Base URL: https://api.amctheatres.com/v2
//   Key sent as header: X-AMC-Vendor-Key
// Fandango: Affiliate deep links, $0.10/ticket commission
//   No showtimes API — generates deep links only
//   Affiliate via Commission Junction
// Appears in: Cinema filter + All feed (today only)

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches the actual AMC API response shape.
// location fields are nested; latitude/longitude (not lat/lon).
type AMCTheatre = {
  id: number;
  name: string;
  slug: string;
  location: {
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
  attributes: { code: string; name: string; description?: string }[];
};

type AMCShowtime = {
  id: number;
  movieId: number;
  movieName: string;
  showDateTimeLocal: string; // ISO e.g. "2026-05-26T19:30:00"
  showDateTimeUtc: string;
  isSoldOut: boolean;
  isAlmostSoldOut: boolean;
  isCanceled: boolean;
  theatreId: number;
  purchaseUrl: string;
  attributes: { id: number; name: string }[];
};

type AMCMovie = {
  id: number;
  name: string;
  sortableName: string;
  score: number;        // Rotten Tomatoes score
  starRating: number;   // /5
  mpaaRating: string;   // PG, PG-13, R etc.
  runTime: number;      // minutes
  synopsis: string;
  genres: { name: string }[];
  attributes: { id: number; name: string }[];
};

// Internal grouped type for feed display
export type ShowtimeGroup = {
  movie: AMCMovie;
  theatre: AMCTheatre;
  showtimes: AMCShowtime[];
  feedItem: EventItem;
};

// ─── Caching ──────────────────────────────────────────────────────────────────

const showtimesCache = new Map<string, { data: ShowtimeGroup[]; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1_000; // 1 hour

/** Wipe all cached showtime data — called by the on-demand Cinema effect
 *  so a stale empty result never blocks a fresh retry. */
export function clearShowtimesCache(): void {
  showtimesCache.clear();
}

// Separate per-movie cache so the same movie isn't fetched multiple times
const movieCache = new Map<number, AMCMovie>();

function getCacheKey(area: string, coords?: { lat: number; lng: number }): string {
  const today = new Date().toISOString().split("T")[0];
  return [
    area.toLowerCase().trim(),
    coords?.lat?.toFixed(2) ?? "no-lat",
    coords?.lng?.toFixed(2) ?? "no-lng",
    today, // cache busts at midnight
  ].join("|");
}

// ─── AMC API helpers ──────────────────────────────────────────────────────────

const AMC_DIRECT = "https://api.amctheatres.com/v2";

/**
 * Build the fetch URL for an AMC API path.
 *
 * - Native (iOS/Android): call AMC directly — no CORS restriction.
 * - Web: route through the /api/amc Vercel proxy which adds the vendor key
 *   server-side, working around AMC's missing CORS headers.
 *
 * Path format: "/theatres?page-size=100&page-number=1"
 *   → native:  https://api.amctheatres.com/v2/theatres?page-size=100&page-number=1
 *   → web:     /api/amc?path=%2Ftheatres&page-size=100&page-number=1
 */
function amcUrl(pathWithQuery: string): string {
  if (Platform.OS !== "web") {
    return `${AMC_DIRECT}${pathWithQuery}`;
  }
  // Split path from query string so proxy can forward both separately
  const qIdx = pathWithQuery.indexOf("?");
  const path  = qIdx >= 0 ? pathWithQuery.slice(0, qIdx) : pathWithQuery;
  const query = qIdx >= 0 ? pathWithQuery.slice(qIdx + 1) : "";
  return `/api/amc?path=${encodeURIComponent(path)}${query ? "&" + query : ""}`;
}

async function amcFetch<T>(path: string): Promise<T> {
  const url = amcUrl(path);
  const headers: Record<string, string> = { Accept: "application/json" };
  // Vendor key is sent directly on native; on web the proxy adds it server-side
  if (Platform.OS !== "web") {
    headers["X-AMC-Vendor-Key"] = process.env.EXPO_PUBLIC_AMC_API_KEY ?? "";
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`AMC ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Haversine distance helper ────────────────────────────────────────────────

function haversineMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3_958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Function 1: findNearbyAMCTheatres ───────────────────────────────────────
// The /theatres/views/now-playing-theatres view endpoint returns 404 with
// the current vendor key.  We fall back to paginating /theatres?page-size=100
// (up to 3 pages) and filtering client-side via Haversine distance.

// Errors propagate to the caller — getShowtimes distinguishes
// "API unavailable" (throw) from "no theatres in range" (returns []).
// Returns the MAX_THEATRES closest theatres within radiusMiles, sorted ascending.
const MAX_THEATRES = 5; // cap so we don't fire 30+ showtime fetches for dense cities

async function findNearbyAMCTheatres(
  coords: { lat: number; lng: number },
  radiusMiles = 30, // 30 mi covers most metro areas incl. Lancaster PA (nearest AMC = 27.4 mi)
): Promise<AMCTheatre[]> {
  type WithDist = { theatre: AMCTheatre; dist: number };
  const nearby: WithDist[] = [];
  const PAGE_SIZE = 100;
  let pageNumber = 1;
  while (true) {
    const data = await amcFetch<{
      _embedded: { theatres: AMCTheatre[] };
      count: number;
      pageSize: number;
      pageNumber: number;
    }>(`/theatres?page-size=${PAGE_SIZE}&page-number=${pageNumber}`);

    const theatres = data._embedded?.theatres ?? [];
    if (theatres.length === 0) break;

    for (const t of theatres) {
      const dist = haversineMiles(
        coords.lat, coords.lng,
        t.location.latitude, t.location.longitude,
      );
      if (dist <= radiusMiles) nearby.push({ theatre: t, dist });
    }

    if (theatres.length < PAGE_SIZE) break;
    pageNumber++;
  }

  // Sort closest-first, cap to avoid excessive showtime fetches in dense cities
  const sorted = nearby
    .sort((a, b) => a.dist - b.dist)
    .slice(0, MAX_THEATRES)
    .map(x => x.theatre);

  console.log(
    `[Showtimes] findNearbyAMCTheatres: ${nearby.length} within ${radiusMiles} mi, ` +
      `returning ${sorted.length} closest`,
  );
  return sorted;
}

// ─── Function 2: getShowtimesForTheatre ──────────────────────────────────────

async function getShowtimesForTheatre(
  theatreId: number,
  date: string, // YYYY-MM-DD
): Promise<AMCShowtime[]> {
  try {
    const data = await amcFetch<{ _embedded: { showtimes: AMCShowtime[] } }>(
      `/theatres/${theatreId}/showtimes/${date}?page-size=50`,
    );
    return (data._embedded?.showtimes ?? []).filter(s => !s.isCanceled);
  } catch (err) {
    console.warn(`[Showtimes] getShowtimesForTheatre(${theatreId}) failed:`, err);
    return [];
  }
}

// ─── Function 3: getMovieDetails ─────────────────────────────────────────────

async function getMovieDetails(movieId: number): Promise<AMCMovie | null> {
  if (movieCache.has(movieId)) return movieCache.get(movieId)!;
  try {
    const movie = await amcFetch<AMCMovie>(`/movies/${movieId}`);
    movieCache.set(movieId, movie);
    return movie;
  } catch {
    return null;
  }
}

// ─── Function 4: buildFandangoDeepLink ───────────────────────────────────────

function buildFandangoDeepLink(
  movieName: string,
  _theatreName: string,
  postalCode: string,
): string {
  const affiliateId = process.env.EXPO_PUBLIC_FANDANGO_AFFILIATE_ID;
  const baseUrl = "https://www.fandango.com/";
  const slug = movieName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");

  const affiliateParam = affiliateId
    ? `?cjevent=${affiliateId}&utm_source=nearbynow&utm_medium=affiliate`
    : "";

  return `${baseUrl}${slug}_${postalCode}${affiliateParam}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildShowtimeDesc(movie: AMCMovie, showtimes: AMCShowtime[]): string {
  const genres = movie.genres?.slice(0, 2).map(g => g.name).join(", ") ?? "";
  const rating = movie.mpaaRating ?? "";
  const runtime = movie.runTime
    ? `${Math.floor(movie.runTime / 60)}h ${movie.runTime % 60}m`
    : "";
  const soldOut  = showtimes.filter(s => s.isSoldOut).length;
  const available = showtimes.length - soldOut;
  return [genres, rating, runtime, `${available} showings available today`]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);
}

function buildShowtimeTags(movie: AMCMovie, showtimes: AMCShowtime[]): string[] {
  return [
    movie.mpaaRating ?? null,
    movie.genres?.[0]?.name ?? null,
    showtimes.some(s => s.attributes?.some(a => a.name.includes("IMAX"))) ? "IMAX" : null,
    showtimes.some(s => s.attributes?.some(a => a.name.includes("Dolby"))) ? "Dolby" : null,
    showtimes.every(s => s.isSoldOut) ? "Sold out" : null,
  ]
    .filter((v): v is string => v !== null)
    .slice(0, 3);
}

/** Deterministic numeric ID that won't clash with mock or RSS event IDs. */
function makeShowtimeId(theatreId: number, movieId: number): number {
  return 10_000_000 + theatreId * 10_000 + (movieId % 10_000);
}

// ─── Dev-mock fallback ────────────────────────────────────────────────────────
// Returned by getShowtimes when EXPO_PUBLIC_AMC_API_KEY is not configured.
// Ensures the Cinema filter and CinemaGroupedView always render in dev / Expo Go.
// Showtimes are generated 1-7 hours from *now* so they always appear in the
// future (the real groupShowtimesByMovie skips past showtimes).

const DEV_THEATRE: AMCTheatre = {
  id: 1457,
  name: "AMC Classic Lancaster 13",
  slug: "amc-classic-lancaster-13",
  location: {
    addressLine1: "1457 Lititz Pike",
    city: "Lancaster",
    state: "PA",
    postalCode: "17601",
    latitude: 40.0753,
    longitude: -76.3408,
  },
  attributes: [],
};

const DEV_MOVIE: AMCMovie = {
  id: 9015,
  name: "Mission: Impossible – The Final Reckoning",
  sortableName: "Mission Impossible The Final Reckoning",
  score: 89,
  starRating: 4.2,
  mpaaRating: "PG-13",
  runTime: 163,
  synopsis:
    "The latest installment in the Mission: Impossible franchise. Ethan Hunt " +
    "faces his most dangerous mission yet in a race to stop a rogue AI from " +
    "reshaping the world.",
  genres: [{ name: "Action" }, { name: "Thriller" }],
  attributes: [],
};

function buildDevGroup(): ShowtimeGroup {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  // 4 showtimes: +1h, +3h (Dolby, almost sold-out), +5h (IMAX), +7h
  const rawShowtimes: AMCShowtime[] = ([1, 3, 5, 7] as const).map((offset, i) => {
    const d = new Date(now.getTime() + offset * 3_600_000);
    const local =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    const attrs: { id: number; name: string }[] =
      i === 1 ? [{ id: 1, name: "Dolby" }] : i === 2 ? [{ id: 2, name: "IMAX" }] : [];
    return {
      id: 90_000 + i,
      movieId: DEV_MOVIE.id,
      movieName: DEV_MOVIE.name,
      showDateTimeLocal: local,
      showDateTimeUtc: d.toISOString(),
      isSoldOut: false,
      isAlmostSoldOut: i === 1, // Dolby almost sold out
      isCanceled: false,
      theatreId: DEV_THEATRE.id,
      purchaseUrl: "",
      attributes: attrs,
    };
  });

  // Build showings display strings (used by EventCard showtime pills)
  const showings = rawShowtimes.map(s => {
    const d = new Date(s.showDateTimeLocal);
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const fmt = s.attributes?.[0];
    return fmt ? `${time} · ${fmt.name}` : time;
  });

  const fandangoUrl = buildFandangoDeepLink(
    DEV_MOVIE.name,
    DEV_THEATRE.name,
    DEV_THEATRE.location.postalCode,
  );

  const today = new Date().toISOString().split("T")[0];

  const feedItem: EventItem = {
    id: makeShowtimeId(DEV_THEATRE.id, DEV_MOVIE.id),
    type: "event",
    title: DEV_MOVIE.name,
    desc: `Action · ${DEV_MOVIE.mpaaRating} · 2h 43m · ${rawShowtimes.length} showings available today`,
    longDesc: DEV_MOVIE.synopsis,
    time: `Today · ${rawShowtimes.length} showings`,
    date: today,
    startIso: rawShowtimes[0].showDateTimeLocal,
    location: `${DEV_THEATRE.name}, ${DEV_THEATRE.location.addressLine1}, ${DEV_THEATRE.location.city}, ${DEV_THEATRE.location.state}`,
    lat: DEV_THEATRE.location.latitude,
    lng: DEV_THEATRE.location.longitude,
    source: "AMC Theatres",
    category: "Cinema",
    catColor: "#CC0000",
    catDot: "#FF3333",
    saves: 0,
    img: "🎬",
    booking: { label: "Get Tickets", url: fandangoUrl, affiliate: true },
    rating: DEV_MOVIE.starRating,
    showings,
    tags: ["PG-13", "Action", "IMAX"],
    isCanceled: false,
  };

  return { movie: DEV_MOVIE, theatre: DEV_THEATRE, showtimes: rawShowtimes, feedItem };
}

const TODAY_DATE = () => new Date().toISOString().split("T")[0];

// ─── Function 5: groupShowtimesByMovie ───────────────────────────────────────

function groupShowtimesByMovie(
  showtimes: AMCShowtime[],
  movies: Map<number, AMCMovie>,
  theatre: AMCTheatre,
): ShowtimeGroup[] {
  const now = Date.now();

  // Group by movieId
  const byMovie = new Map<number, AMCShowtime[]>();
  for (const s of showtimes) {
    const bucket = byMovie.get(s.movieId) ?? [];
    bucket.push(s);
    byMovie.set(s.movieId, bucket);
  }

  const groups: ShowtimeGroup[] = [];

  for (const [movieId, movieShowtimes] of byMovie) {
    const movie = movies.get(movieId);
    if (!movie) continue;

    // Sort ascending, filter past, cap at 8
    const upcoming = movieShowtimes
      .sort((a, b) => a.showDateTimeLocal.localeCompare(b.showDateTimeLocal))
      .filter(s => new Date(s.showDateTimeLocal).getTime() > now)
      .slice(0, 8);

    if (upcoming.length === 0) continue;

    const desc = buildShowtimeDesc(movie, upcoming);

    const showings = upcoming
      .filter(s => !s.isSoldOut && !s.isCanceled)
      .map(s => {
        const time = new Date(s.showDateTimeLocal).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        const formatAttr = s.attributes?.find(a =>
          ["IMAX", "Dolby", "3D", "4DX", "PLF"].some(f => a.name.includes(f)),
        );
        return formatAttr ? `${time} · ${formatAttr.name}` : time;
      })
      .slice(0, 8);

    const purchaseUrl = upcoming[0].purchaseUrl;
    const fandangoUrl = buildFandangoDeepLink(movie.name, theatre.name, theatre.location.postalCode);

    const feedItem: EventItem = {
      id: makeShowtimeId(theatre.id, movie.id),
      type: "event",
      title: movie.name,
      desc,
      longDesc: movie.synopsis?.slice(0, 600) || desc || undefined,
      time: `Today · ${upcoming.length} showing${upcoming.length !== 1 ? "s" : ""}`,
      date: TODAY_DATE(),
      startIso: upcoming[0].showDateTimeLocal,
      endIso: (() => {
        if (!movie.runTime) return undefined;
        const d = new Date(upcoming[0].showDateTimeLocal);
        d.setMinutes(d.getMinutes() + movie.runTime);
        return d.toISOString();
      })(),
      location: `${theatre.name}, ${theatre.location.addressLine1}, ${theatre.location.city}, ${theatre.location.state}`,
      lat: theatre.location.latitude,
      lng: theatre.location.longitude,
      source: "AMC Theatres",
      category: "Cinema",
      catColor: "#CC0000",
      catDot: "#FF3333",
      saves: 0,
      img: "🎬",
      booking: {
        label: "Get Tickets",
        url: purchaseUrl || fandangoUrl,
        affiliate: !purchaseUrl,
      },
      rating: movie.starRating,
      reviews: undefined,
      showings,
      tags: buildShowtimeTags(movie, upcoming),
      isCanceled: false,
    };

    groups.push({ movie, theatre, showtimes: upcoming, feedItem });
  }

  return groups;
}

// ─── Function 6: getShowtimes (main export) ───────────────────────────────────

export async function getShowtimes(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<ShowtimeGroup[]> {
  // On native the vendor key is required for direct AMC API calls.
  // On web, the /api/amc proxy adds the key server-side — no client key needed.
  if (Platform.OS !== "web" && !process.env.EXPO_PUBLIC_AMC_API_KEY) {
    console.warn("[Showtimes] No AMC API key — Cinema filter will be empty on native.");
    return [];
  }

  // Check cache
  const key = getCacheKey(area, coords);
  const cached = showtimesCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Showtimes] Cache hit — ${cached.data.length} groups`);
    return cached.data;
  }

  // Use provided coords or fall back to Brooklyn default
  const lat = coords?.lat ?? 40.6782;
  const lng = coords?.lng ?? -73.9442;

  // 1. Find nearby AMC theatres
  // Two failure modes are handled differently:
  //   - API error (throw)   → proxy unavailable in local dev / network issue
  //                           → fall back to dev mock so Cinema UI is always testable
  //   - Empty result ([])   → API succeeded; area genuinely has no nearby AMC theatres
  //                           → return [] and cache so we don't re-fetch every tap
  let theatres: AMCTheatre[];
  try {
    theatres = await findNearbyAMCTheatres({ lat, lng });
  } catch (err) {
    console.warn(
      "[Showtimes] Theatre fetch failed (proxy unavailable in local dev?) — " +
        "returning dev mock so Cinema filter remains testable.",
      err,
    );
    return [buildDevGroup()];
  }

  if (theatres.length === 0) {
    console.info(`[Showtimes] No AMC theatres within range of "${area}"`);
    // Do NOT cache empty results — if the area ever gets AMC coverage, or if
    // wrong coords were used this time, we want the next tap to retry.
    return [];
  }

  // 2. Get today's showtimes for each theatre in parallel
  const today = TODAY_DATE();
  const theatreShowtimes = await Promise.allSettled(
    theatres.map(t =>
      getShowtimesForTheatre(t.id, today).then(st => ({ theatre: t, showtimes: st })),
    ),
  );

  // 3. Collect unique movie IDs
  const allShowtimes = theatreShowtimes
    .filter((r): r is PromiseFulfilledResult<{ theatre: AMCTheatre; showtimes: AMCShowtime[] }> =>
      r.status === "fulfilled",
    )
    .flatMap(r => r.value.showtimes);
  const movieIds = [...new Set(allShowtimes.map(s => s.movieId))];

  // 4. Fetch all movie details in parallel (skipping those already cached)
  await Promise.allSettled(
    movieIds.map(async id => {
      if (!movieCache.has(id)) {
        const movie = await getMovieDetails(id);
        if (movie) movieCache.set(id, movie);
      }
    }),
  );

  // 5. Group by movie per theatre
  const groups: ShowtimeGroup[] = [];
  for (const result of theatreShowtimes) {
    if (result.status !== "fulfilled") continue;
    const { theatre, showtimes } = result.value;
    const grouped = groupShowtimesByMovie(showtimes, movieCache, theatre);
    groups.push(...grouped);
  }

  // 6. Sort by Rotten Tomatoes score descending
  groups.sort((a, b) => (b.movie.score ?? 0) - (a.movie.score ?? 0));

  // 7. Cache and return
  showtimesCache.set(key, { data: groups, expiresAt: Date.now() + CACHE_TTL });

  console.log(
    `[Showtimes] ${theatres.length} AMC theatres · ` +
      `${movieIds.length} movies · ` +
      `${groups.length} showtime groups for "${area}"`,
  );

  return groups;
}

// ─── Function 7: getShowtimesAsEventItems (for feed) ─────────────────────────

export async function getShowtimesAsEventItems(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  const groups = await getShowtimes(area, coords);
  return groups.map(g => g.feedItem);
}
