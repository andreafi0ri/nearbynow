// src/config/structuredDataSources.ts
//
// Sources whose event pages publish openly-available schema.org Event JSON-LD.
// The parser (structuredDataService.ts) reads ONLY normally-loading pages and
// skips anything bot-protected — it never bypasses protection.
//
// Adding a venue later is a one-line entry here (confirm it publishes JSON-LD
// via scripts/discoverStructuredData.mjs first).

export type StructuredSource = {
  url:         string;   // page that embeds the JSON-LD
  name:        string;   // internal name
  area:        string;   // lowercase area keyword (matches feedService gating)
  sourceLabel: string;   // shown as the source pill / used by feedSections + SOURCE_COLORS
  tags:        string[];
  // Optional anchor coords for radius matching (see rssDiscovery AREA_COORDS pattern).
  lat?:        number;
  lng?:        number;
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
  // Step 1 re-probe (2026-06) found no other Lancaster venue publishing usable
  // JSON-LD — the rest were bot-protected (skipped), dead domains, or JS-rendered.
];
