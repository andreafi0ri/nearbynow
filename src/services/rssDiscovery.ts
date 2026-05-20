// src/services/rssDiscovery.ts
// Matches the active area string to RSS sources with a scoring system,
// and supports runtime source additions.

import { RSS_SOURCES, RSSSource } from "../config/rssSources";

// ─── Area token expansion ─────────────────────────────────────────────────────

type TokenMap = { keywords: string[]; tokens: string[] };

/**
 * Maps known sub-areas to their parent geography tokens.
 * Order matters: most-specific entries come first so a specific match
 * sets the right parent chain (e.g. "brixton" → london, not just "global").
 */
const AREA_TOKEN_TABLE: TokenMap[] = [

  // ── London boroughs / neighbourhoods ──────────────────────────────────────
  { keywords: ["brixton", "sw9", "sw2"],          tokens: ["brixton", "lambeth",   "london"] },
  { keywords: ["lambeth", "stockwell", "streatham"], tokens: ["lambeth",            "london"] },
  { keywords: ["hackney", "e8", "e9", "dalston"], tokens: ["hackney",              "london"] },
  { keywords: ["shoreditch", "e1", "hoxton"],     tokens: ["shoreditch", "hackney","london"] },
  { keywords: ["peckham", "se15"],                tokens: ["peckham",  "southwark","london"] },
  { keywords: ["southwark", "bermondsey", "se1"], tokens: ["southwark",            "london"] },
  { keywords: ["islington", "n1", "angel"],       tokens: ["islington",            "london"] },
  { keywords: ["camden", "nw1", "kentish"],       tokens: ["camden",               "london"] },
  { keywords: ["clapham", "sw4"],                 tokens: ["clapham",  "lambeth",  "london"] },
  { keywords: ["greenwich", "se10"],              tokens: ["greenwich",            "london"] },
  { keywords: ["lewisham", "se13"],               tokens: ["lewisham",             "london"] },
  { keywords: ["croydon"],                        tokens: ["croydon",              "london"] },
  { keywords: ["london"],                         tokens: ["london"] },

  // ── UK cities ─────────────────────────────────────────────────────────────
  { keywords: ["manchester", "salford"],          tokens: ["manchester"] },
  { keywords: ["birmingham", "brum"],             tokens: ["birmingham"] },
  { keywords: ["bristol"],                        tokens: ["bristol"] },
  { keywords: ["leeds", "yorkshire"],             tokens: ["leeds"] },
  { keywords: ["sheffield"],                      tokens: ["sheffield"] },
  { keywords: ["liverpool", "merseyside"],        tokens: ["liverpool"] },
  { keywords: ["edinburgh"],                      tokens: ["edinburgh", "scotland"] },
  { keywords: ["glasgow"],                        tokens: ["glasgow",   "scotland"] },
  { keywords: ["cardiff", "wales"],               tokens: ["cardiff",   "wales"] },
  { keywords: ["brighton", "hove"],               tokens: ["brighton"] },
  { keywords: ["oxford"],                         tokens: ["oxford"] },
  { keywords: ["cambridge"],                      tokens: ["cambridge"] },
  { keywords: ["nottingham"],                     tokens: ["nottingham"] },

  // ── Brooklyn sub-neighbourhoods ───────────────────────────────────────────
  { keywords: ["dumbo"],                          tokens: ["dumbo",       "brooklyn", "nyc"] },
  { keywords: ["williamsburg"],                   tokens: ["williamsburg","brooklyn", "nyc"] },
  { keywords: ["park slope"],                     tokens: ["park slope",  "brooklyn", "nyc"] },
  { keywords: ["greenpoint"],                     tokens: ["greenpoint",  "brooklyn", "nyc"] },
  { keywords: ["bushwick"],                       tokens: ["bushwick",    "brooklyn", "nyc"] },
  { keywords: ["bed-stuy", "bedford-stuyvesant"], tokens: ["bed-stuy",   "brooklyn", "nyc"] },
  { keywords: ["crown heights"],                  tokens: ["crown heights","brooklyn","nyc"] },
  { keywords: ["flatbush"],                       tokens: ["flatbush",    "brooklyn", "nyc"] },
  { keywords: ["sunset park"],                    tokens: ["sunset park", "brooklyn", "nyc"] },
  { keywords: ["fort greene"],                    tokens: ["fort greene", "brooklyn", "nyc"] },
  { keywords: ["cobble hill"],                    tokens: ["cobble hill", "brooklyn", "nyc"] },
  { keywords: ["carroll gardens"],                tokens: ["carroll gardens","brooklyn","nyc"] },
  { keywords: ["prospect heights"],               tokens: ["prospect heights","brooklyn","nyc"] },
  { keywords: ["brooklyn"],                       tokens: ["brooklyn",    "nyc"] },

  // ── Manhattan sub-neighbourhoods ──────────────────────────────────────────
  { keywords: ["lower east", "les"],              tokens: ["lower east",  "manhattan","nyc"] },
  { keywords: ["upper east", "ues"],              tokens: ["upper east",  "manhattan","nyc"] },
  { keywords: ["upper west", "uws"],              tokens: ["upper west",  "manhattan","nyc"] },
  { keywords: ["harlem"],                         tokens: ["harlem",      "manhattan","nyc"] },
  { keywords: ["tribeca"],                        tokens: ["tribeca",     "manhattan","nyc"] },
  { keywords: ["soho"],                           tokens: ["soho",        "manhattan","nyc"] },
  { keywords: ["chelsea"],                        tokens: ["chelsea",     "manhattan","nyc"] },
  { keywords: ["hell's kitchen", "hells kitchen"],tokens: ["hells kitchen","manhattan","nyc"] },
  { keywords: ["manhattan"],                      tokens: ["manhattan",   "nyc"] },

  // ── Other NYC boroughs ────────────────────────────────────────────────────
  { keywords: ["astoria"],                        tokens: ["astoria",     "queens",   "nyc"] },
  { keywords: ["flushing"],                       tokens: ["flushing",    "queens",   "nyc"] },
  { keywords: ["long island city", "lic"],        tokens: ["long island city","queens","nyc"] },
  { keywords: ["queens"],                         tokens: ["queens",      "nyc"] },
  { keywords: ["fordham"],                        tokens: ["fordham",     "bronx",    "nyc"] },
  { keywords: ["bronx"],                          tokens: ["bronx",       "nyc"] },
  { keywords: ["new york", "nyc"],                tokens: ["brooklyn", "manhattan", "queens", "bronx", "nyc"] },

  // ── Lancaster PA sub-areas ────────────────────────────────────────────────
  { keywords: ["lititz"],                         tokens: ["lititz",   "lancaster", "lancaster pa"] },
  { keywords: ["ephrata"],                        tokens: ["ephrata",  "lancaster", "lancaster pa"] },
  { keywords: ["strasburg"],                      tokens: ["strasburg","lancaster", "lancaster pa"] },
  { keywords: ["lancaster"],                      tokens: ["lancaster","lancaster pa","pennsylvania","pa"] },

  // ── Other US cities ───────────────────────────────────────────────────────
  { keywords: ["austin", "atx"],                  tokens: ["austin"] },
  { keywords: ["nashville"],                      tokens: ["nashville"] },
  { keywords: ["portland", "pdx"],               tokens: ["portland"] },
  { keywords: ["denver"],                         tokens: ["denver"] },
  { keywords: ["seattle"],                        tokens: ["seattle"] },
  { keywords: ["chicago"],                        tokens: ["chicago"] },
  { keywords: ["los angeles", "silver lake", "echo park"], tokens: ["los angeles"] },
  { keywords: ["san francisco", "sf "],           tokens: ["san francisco"] },
  { keywords: ["miami"],                          tokens: ["miami"] },
  { keywords: ["boston"],                         tokens: ["boston"] },
  { keywords: ["philadelphia", "philly"],         tokens: ["philadelphia"] },
  { keywords: ["washington", "dc"],               tokens: ["washington"] },
];

/**
 * Expands a raw area string into canonical search tokens,
 * including the full parent-geography hierarchy.
 *
 * Examples:
 *   "Brixton, SW9"      → ["brixton", "lambeth", "london"]
 *   "Williamsburg, Brooklyn" → ["williamsburg", "brooklyn", "nyc"]
 *   "East Nashville"    → ["nashville"]
 *   "Lancaster, PA"     → ["lancaster", "lancaster pa", "pennsylvania", "pa"]
 *
 * Unknown areas return just the first comma-segment as-is.
 */
export function extractAreaTokens(area: string): string[] {
  const lower = area.toLowerCase()
    .replace(/\b[a-z]{1,2}\d[\d\s]*[a-z]?\b/gi, "") // strip postcodes
    .trim();

  const tokens = new Set<string>();

  for (const entry of AREA_TOKEN_TABLE) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      entry.tokens.forEach(t => tokens.add(t));
    }
  }

  // Always include the raw city segment (first comma-separated part)
  const city = lower.split(",")[0].trim();
  if (city) tokens.add(city);

  return Array.from(tokens);
}

// ─── Scored source matching ───────────────────────────────────────────────────

type ScoredSource = { source: RSSSource; score: number };

const extraSources: RSSSource[] = [];

/**
 * Returns up to 15 RSS sources for the given area, ranked by relevance.
 *
 * Scoring:
 *   3 — source.area exactly matches an expanded token
 *   2 — source.area is a substring of a token, or vice-versa
 *   1 — source.area === "global" (always included as fallback)
 *   0 — no match → excluded
 *
 * At least 3 "global" sources are always included even if other area
 * sources fill the top slots.
 */
export function getRSSSourcesForArea(area: string): RSSSource[] {
  const tokens = extractAreaTokens(area);

  const scored: ScoredSource[] = [...RSS_SOURCES, ...extraSources].map(source => {
    let score = 0;
    if (source.area === "global") {
      score = 1;
    } else if (tokens.includes(source.area)) {
      score = 3;
    } else if (tokens.some(t => t.includes(source.area) || source.area.includes(t))) {
      score = 2;
    }
    return { source, score };
  }).filter(s => s.score > 0);

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = scored.filter(s => {
    if (seen.has(s.source.url)) return false;
    seen.add(s.source.url);
    return true;
  });

  // Take top 15, always ensuring globals are present
  const top     = deduped.filter(s => s.score >= 2).slice(0, 12).map(s => s.source);
  const globals = deduped.filter(s => s.score === 1).slice(0, 3).map(s => s.source);

  return [...top, ...globals];
}

export function addRSSSource(source: RSSSource): void {
  if (!extraSources.some(s => s.url === source.url)) {
    extraSources.push(source);
  }
}

/** Returns matched sources for an area — useful for settings UI. */
export async function discoverRSSFeedsForArea(area: string): Promise<RSSSource[]> {
  return getRSSSourcesForArea(area);
}
