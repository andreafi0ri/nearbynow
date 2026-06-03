// src/config/keywordSearchConfig.ts
//
// Single source of truth for keyword-based event discovery. Add new keyword
// types or variants HERE ONLY — service files import from this config and
// never hardcode keywords.

export const EVENT_KEYWORDS = {
  karaoke: [
    "karaoke", "karaoke night", "karaoke bar",
    "sing along", "open mic karaoke",
  ],
  live_band: [
    "live band", "live music", "live performance",
    "local band", "band tonight", "playing live",
    "acoustic set", "live show",
  ],
  yoga: [
    "yoga", "yoga class", "yoga session",
    "outdoor yoga", "yoga flow", "pilates",
    "yoga in the park", "morning yoga",
  ],
  dj_night: [
    "DJ night", "DJ set", "club night",
    "dance night", "dj", "spinning",
    "dance party", "EDM night",
  ],
  rooftop: [
    "rooftop", "rooftop bar", "rooftop event",
    "rooftop party", "rooftop drinks",
    "roof deck", "skyline views",
  ],
  happy_hour: [
    "happy hour", "drink specials",
    "half price drinks", "HH specials",
    "after work drinks", "ladies night",
  ],
  trivia: [
    "trivia night", "pub quiz", "bar trivia",
    "quiz night", "trivia", "general knowledge",
    "team trivia", "bar quiz",
  ],
  festival: [
    "festival", "fest", "outdoor festival",
    "music festival", "food festival",
    "street fair", "block party", "carnival",
    "summer festival", "arts festival",
    "cultural festival", "food fest",
  ],
} as const;

// Flat array of all keywords — used to validate that a result actually
// mentions one of the target activities.
export const ALL_KEYWORDS_FLAT: string[] = Object.values(EVENT_KEYWORDS).flat();

// Compact OR string for SerpAPI — top variants only, to avoid URL bloat.
export const SERP_KEYWORD_QUERY: string = [
  "karaoke night",
  "live band",
  "yoga class",
  "DJ night",
  "rooftop bar",
  "happy hour",
  "trivia night",
  "festival OR fest",
].join(" OR ");

// Reddit search uses shorter terms for better recall.
export const REDDIT_KEYWORD_QUERY: string = [
  "karaoke",
  "live band",
  "yoga",
  "DJ",
  "rooftop",
  "happy hour",
  "trivia",
  "festival",
  "fest",
].join(" OR ");
