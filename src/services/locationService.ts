const MAPBOX_KEY = process.env.EXPO_PUBLIC_MAPBOX_KEY ?? "";
const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export type LocationSuggestion = {
  displayName: string;
  shortName: string;
  lat: number;
  lng: number;
  type: string;
};

type MapboxFeature = {
  place_name: string;
  text: string;
  place_type: string[];
  center: [number, number]; // [lng, lat]
  context?: Array<{ id: string; text: string }>;
};

type MapboxResponse = {
  features: MapboxFeature[];
};

function buildShortName(feature: MapboxFeature): string {
  const name = feature.text;
  const region = feature.context?.find(
    c => c.id.startsWith("region") || c.id.startsWith("place")
  )?.text;
  return region ? `${name}, ${region}` : name;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function searchLocations(query: string): Promise<LocationSuggestion[]> {
  return new Promise(resolve => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (query.trim().length < 2) {
      resolve([]);
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const url =
          `${BASE}/${encodeURIComponent(query)}.json` +
          `?access_token=${MAPBOX_KEY}&limit=5` +
          `&types=place,neighborhood,locality,district,postcode&language=en`;

        const res = await fetch(url);
        if (!res.ok) { resolve([]); return; }

        const data: MapboxResponse = await res.json();
        resolve(
          data.features.map(f => ({
            displayName: f.place_name,
            shortName:   buildShortName(f),
            lat:         f.center[1],
            lng:         f.center[0],
            type:        f.place_type[0] ?? "place",
          }))
        );
      } catch {
        resolve([]);
      }
    }, 400);
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url =
      `${BASE}/${lng},${lat}.json` +
      `?access_token=${MAPBOX_KEY}` +
      `&types=place,neighborhood,locality,district&language=en`;

    const res = await fetch(url);
    if (!res.ok) return "";

    const data: MapboxResponse = await res.json();
    const feature = data.features[0];
    return feature ? buildShortName(feature) : "";
  } catch {
    return "";
  }
}
