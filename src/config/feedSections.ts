// src/config/feedSections.ts
//
// Single source of truth for which event source belongs in which feed section.
// Adding a new source = one line change here; feed.tsx needs no edits.

export type FeedSection =
  | "happening"       // Meetups              (Meetup)
  | "venues"          // Happening near you   (Tellús360, FIG Lancaster, AMT)
  | "community"       // From the community   (RSS, Reddit, Google Events, etc.)
  | "library"         // At your library      (Lancaster Libraries)
  | "ticketed"        // Ticketed events      (Ticketmaster, AMC, Viator, Eventbrite)
  | "spots"           // Top nearby spots     (Foursquare venues)
  | "recommendation"; // Google Places recs   — stays in footer, never sectioned

export const SOURCE_SECTION: Record<string, FeedSection> = {
  // ── Meetups ───────────────────────────────────────────────────────────────
  "Meetup":                 "happening",

  // ── Local venues (carousel) ───────────────────────────────────────────────
  "Tellús360":              "venues",
  "FIG Lancaster":          "venues",
  "American Music Theatre": "venues",

  // ── At your library ──────────────────────────────────────────────────────
  "Lancaster Libraries":    "library",

  // ── Ticketed events ───────────────────────────────────────────────────────
  "Ticketmaster":           "ticketed",
  "SeatGeek":               "ticketed",
  "AMC Theatres":           "ticketed",
  "Showtimes":              "ticketed",
  "Viator":                 "ticketed",
  "Eventbrite":             "ticketed",
  "TicketWeb":              "ticketed",
  "Fever":                  "ticketed",
  "StubHub":                "ticketed",

  // ── Top nearby spots ──────────────────────────────────────────────────────
  "Foursquare":             "spots",

  // ── Google Places recs (footer only) ─────────────────────────────────────
  "Google Places":          "recommendation",
  "Activity Places":        "recommendation",
  "Wellness Places":        "recommendation",
};

/**
 * Returns the feed section for a given item.
 *
 * - Sources explicitly listed above use that mapping.
 * - Unknown recommendation-type items (e.g. GP recs) go to footer.
 * - Everything else (Reddit r/*, RSS sources, Google Events, etc.)
 *   defaults to "community" so new sources appear in the right bucket
 *   automatically with no code change.
 */
export function getSectionForItem(item: {
  source?: string;
  type?: string;
}): FeedSection {
  const mapped = SOURCE_SECTION[item.source ?? ""];
  if (mapped) return mapped;
  if (item.type === "recommendation") return "recommendation";
  return "community";
}

export type SectionConfig = {
  key:   FeedSection;
  label: string;
  emoji: string;
};

export const FEED_SECTION_CONFIG: SectionConfig[] = [
  { key: "happening", label: "Meetups",              emoji: "📍" },
  { key: "venues",    label: "Happening near you",   emoji: "🌆" },
  { key: "community", label: "From the community",   emoji: "🤝" },
  { key: "library",   label: "At your library",      emoji: "🏛️" },
  { key: "ticketed",  label: "Ticketed events",      emoji: "🎟️" },
  { key: "spots",     label: "Top nearby spots",     emoji: "⭐" },
];
