import { EventItem } from "../data/mockEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
};

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
};

export type Coords = { lat: number; lng: number };

// ─── Geocode cache ────────────────────────────────────────────────────────────

const _cache = new Map<string, { coords: Coords; ts: number }>();
const CACHE_TTL = 10 * 60_000; // 10 min

export async function geocodeArea(area: string): Promise<Coords | null> {
  const key = area.toLowerCase().trim();
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.coords;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=json&limit=1`,
      { headers: { "User-Agent": "hearby-app/1.0", "Accept-Language": "en" } }
    );
    const json = await res.json();
    if (!json[0]) return null;
    const coords: Coords = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    _cache.set(key, { coords, ts: Date.now() });
    return coords;
  } catch {
    return null;
  }
}

// ─── Overpass: nearby places ──────────────────────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

async function fetchOverpassPlaces(lat: number, lng: number, radius = 3000): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"~"^(restaurant|cafe|bar|pub|fast_food)$"](around:${radius},${lat},${lng});
      way["amenity"~"^(restaurant|cafe|bar|pub|fast_food)$"](around:${radius},${lat},${lng});
      node["tourism"="museum"](around:${radius},${lat},${lng});
      way["tourism"="museum"](around:${radius},${lat},${lng});
      node["amenity"="cinema"](around:${radius},${lat},${lng});
      way["amenity"="cinema"](around:${radius},${lat},${lng});
      node["amenity"="theatre"](around:${radius},${lat},${lng});
      way["amenity"="theatre"](around:${radius},${lat},${lng});
      node["leisure"="arts_centre"](around:${radius},${lat},${lng});
      way["leisure"="arts_centre"](around:${radius},${lat},${lng});
    );
    out center 40;
  `;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  return (json.elements ?? []).filter((e: OverpassElement) => e.tags?.name);
}

function placeToEventItem(el: OverpassElement, area: string): EventItem | null {
  const tags = el.tags;
  const name = tags.name;
  if (!name) return null;

  // Coordinates: node has lat/lon directly, way has center
  const elLat = el.lat ?? el.center?.lat;
  const elLng = el.lon ?? el.center?.lon;

  const amenity = tags.amenity ?? "";
  const tourism = tags.tourism ?? "";
  const leisure = tags.leisure ?? "";
  const cuisine = tags.cuisine ? ` · ${tags.cuisine.replace(/;/g, ", ")}` : "";
  const website = tags.website ?? tags["contact:website"] ?? "";
  const address = [tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean).join(" ") || area;

  let emoji    = "📍";
  let category = "Community";
  let desc     = "";

  if (amenity === "cinema") {
    emoji    = "🎬";
    category = "Events";
    desc     = `Cinema in ${area}. Check their website for current show times.`;
  } else if (amenity === "theatre") {
    emoji    = "🎭";
    category = "Events";
    desc     = `Theatre in ${area}. Check their website for current productions.`;
  } else if (tourism === "museum") {
    emoji    = "🏛️";
    category = "Culture";
    desc     = `Museum in ${area}${tags.opening_hours ? ` · Open: ${tags.opening_hours}` : ""}.`;
  } else if (leisure === "arts_centre") {
    emoji    = "🎨";
    category = "Culture";
    desc     = `Arts centre in ${area}${tags.opening_hours ? ` · ${tags.opening_hours}` : ""}.`;
  } else if (["restaurant", "cafe", "bar", "pub", "fast_food"].includes(amenity)) {
    emoji    = amenity === "bar" || amenity === "pub" ? "🍺" : "🍽️";
    category = "Food & Drink";
    desc     = `${amenity.charAt(0).toUpperCase() + amenity.slice(1)} in ${area}${cuisine}${tags.opening_hours ? ` · ${tags.opening_hours}` : ""}.`;
  } else {
    return null;
  }

  return {
    id:        el.id % 2_147_483_647,
    type:      "recommendation",
    title:     name,
    desc,
    time:      "Nearby",
    location:  address,
    date:      new Date().toISOString().split("T")[0],
    source:    "OpenStreetMap",
    sourceUrl: website || `https://www.openstreetmap.org/node/${el.id}`,
    category,
    catColor:  category === "Food & Drink" ? "#E8A838" : category === "Events" ? "#7C5CBF" : "#2D8A6E",
    catDot:    category === "Food & Drink" ? "#F0B429" : category === "Events" ? "#9B72CF" : "#34A882",
    saves:     0,
    img:       emoji,
    lat:       elLat,
    lng:       elLng,
    booking:   website
      ? { label: "Visit website", url: website, affiliate: false }
      : null,
    tags:      [amenity || tourism || leisure],
  };
}

// ─── TMDB: movies now playing ─────────────────────────────────────────────────

async function fetchNowPlayingMovies(area: string): Promise<EventItem[]> {
  const apiKey = process.env.EXPO_PUBLIC_TMDB_KEY;
  if (!apiKey) return [];

  const lower = area.toLowerCase();
  const region =
    /\b(london|manchester|bristol|leeds|edinburgh|birmingham|liverpool|glasgow)\b/.test(lower) ? "GB" :
    /\b(sydney|melbourne|brisbane|perth|adelaide)\b/.test(lower) ? "AU" : "US";

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=en-US&region=${region}&page=1`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? [] as TmdbMovie[]).slice(0, 6).map((m: TmdbMovie): EventItem => ({
      id:        m.id % 2_147_483_647,
      type:      "event",
      title:     `🎬 Now Playing: ${m.title}`,
      desc:      m.overview.slice(0, 280) || m.title,
      time:      "In cinemas",
      location:  area,
      date:      m.release_date || new Date().toISOString().split("T")[0],
      source:    "TMDB",
      sourceUrl: `https://www.themoviedb.org/movie/${m.id}`,
      category:  "Events",
      catColor:  "#7C5CBF",
      catDot:    "#9B72CF",
      saves:     Math.round(m.vote_average * 100),
      img:       "🎬",
      booking:   { label: "Find tickets", url: `https://www.themoviedb.org/movie/${m.id}`, affiliate: false },
      tags:      ["movie", "cinema", "film"],
    }));
  } catch {
    return [];
  }
}

// ─── Shared place-capping logic ───────────────────────────────────────────────

const CAP: Record<string, number> = { "Food & Drink": 5, "Events": 4, "Culture": 4 };

function capPlaces(elements: OverpassElement[], area: string): EventItem[] {
  const counts: Record<string, number> = {};
  const items: EventItem[] = [];
  for (const el of elements) {
    const item = placeToEventItem(el, area);
    if (!item) continue;
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    if ((counts[item.category] ?? 0) <= (CAP[item.category] ?? 3)) items.push(item);
  }
  return items;
}

/**
 * Fetch nearby Overpass places for explicit coords + radius.
 * Used by the map zoom handler — skips geocoding and TMDB.
 */
export async function fetchNearbyPlaces(lat: number, lng: number, area: string, radius: number): Promise<EventItem[]> {
  try {
    const elements = await fetchOverpassPlaces(lat, lng, radius);
    return capPlaces(elements, area);
  } catch {
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch nearby places and (optionally) now-playing movies.
 * Pass `coords` if you already have them to skip geocoding — avoids Nominatim rate limits.
 */
export async function getRecommendations(area: string, coords?: Coords): Promise<EventItem[]> {
  const loc = coords ?? await geocodeArea(area);
  if (!loc) return [];

  const [places, movies] = await Promise.allSettled([
    fetchOverpassPlaces(loc.lat, loc.lng),
    fetchNowPlayingMovies(area),
  ]);

  const items: EventItem[] = [];

  if (movies.status === "fulfilled") items.push(...movies.value);

  if (places.status === "fulfilled") {
    items.push(...capPlaces(places.value, area));
  }

  return items;
}
