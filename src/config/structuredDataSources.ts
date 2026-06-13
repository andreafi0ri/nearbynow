// src/config/structuredDataSources.ts
//
// Sources for schema.org Event JSON-LD pages and The Events Calendar REST API.
// The parser (structuredDataService.ts) reads ONLY normally-loading pages/endpoints
// and skips anything bot-protected — it never bypasses protection.
//
// parser: "json-ld"  (default) — HTML page with embedded schema.org Event JSON-LD.
// parser: "tec-rest"           — The Events Calendar /wp-json/tribe/events/v1/events JSON.

export type StructuredSource = {
  url:         string;   // HTML page (json-ld) or REST endpoint URL (tec-rest)
  name:        string;   // internal name
  area:        string;   // lowercase area keyword (matches feedService gating)
  sourceLabel: string;   // shown as the source pill / used by feedSections + SOURCE_COLORS
  tags:        string[];
  // Optional anchor coords for radius matching (see rssDiscovery AREA_COORDS pattern).
  lat?:        number;
  lng?:        number;
  // "json-ld"  (default): parse schema.org Event JSON-LD from the HTML response.
  // "tec-rest": parse The Events Calendar REST API JSON response.
  parser?:     "json-ld" | "tec-rest";
};

export const STRUCTURED_SOURCES: StructuredSource[] = [
  {
    url:         "https://www.tellus360.com/events/",
    name:        "Tellus360",
    area:        "lancaster",
    sourceLabel: "Tellús360",
    tags:        ["Lancaster", "Live Music"],
    lat: 40.0379, lng: -76.3055,
  },
  // Phase 2 scan (2026-06, 111 US-city candidates via discoverStructuredData.mjs):
  // only these two passed (status OK + jsonld > 0) through the public CORS proxies.
  {
    url:         "https://www.tabernacleatl.com/shows",
    name:        "Tabernacle",
    area:        "atlanta",
    sourceLabel: "Tabernacle ATL",
    tags:        ["Atlanta", "Live Music"],
    lat: 33.7624, lng: -84.3930,
  },
  {
    url:         "https://www.kaseyacenter.com/events",
    name:        "Kaseya Center",
    area:        "miami",
    sourceLabel: "Kaseya Center",
    tags:        ["Miami", "Arena"],
    lat: 25.7814, lng: -80.1870,
  },
  {
    url:         "https://discovercolumbia.com/events/",
    name:        "Discover Columbia",
    area:        "columbia",
    sourceLabel: "Discover Columbia",
    tags:        ["Columbia", "Lancaster County"],
    lat: 40.0340, lng: -76.5039,  // Columbia, PA — ~10mi from Lancaster, fires via radius too
  },
  // Phase 3 scan (2026-06, Lancaster r/sidebar venues via discoverEventsCalendar.mjs):
  // AMT confirmed TEC REST with 130 upcoming events. Fetched through fetch-page proxy
  // so CORS is irrelevant; body is JSON parsed in mapTECEvent().
  {
    url:         "https://amtshows.com/wp-json/tribe/events/v1/events?per_page=50",
    name:        "AMT",
    area:        "lancaster",
    sourceLabel: "American Music Theatre",
    tags:        ["Lancaster", "Live Music", "Theater"],
    lat: 40.0345, lng: -76.2484,
    parser:      "tec-rest",
  },
];
