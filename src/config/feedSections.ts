// src/config/feedSections.ts
//
// Single source of truth for which event source belongs in which feed section.
// Adding a new source = one line change here; feed.tsx needs no edits.

export type FeedSection =
  | "happening"       // Happening near you  (Meetup)
  | "community"       // From the community  (RSS, Reddit, Google Events, etc.)
  | "ticketed"        // Ticketed events     (Ticketmaster, AMC, Viator, Eventbrite)
  | "recommendation"; // Google Places recs  — stays in existing footer, never sectioned

export const SOURCE_SECTION: Record<string, FeedSection> = {
  // ── Happening near you ────────────────────────────────────────────────
  "Meetup":           "happening",

  // ── Ticketed events ───────────────────────────────────────────────────
  "Ticketmaster":     "ticketed",
  "AMC Theatres":     "ticketed",
  "Showtimes":        "ticketed",
  "Viator":           "ticketed",
  "Eventbrite":       "ticketed",
  "TicketWeb":        "ticketed",
  "Fever":            "ticketed",
  "StubHub":          "ticketed",

  // ── Google Places recs (footer only) ─────────────────────────────────
  "Google Places":    "recommendation",
  "Activity Places":  "recommendation",
  "Wellness Places":  "recommendation",
};

/**
 * Returns the feed section for a given item.
 *
 * - type === "recommendation" always maps to "recommendation"
 *   regardless of source (stays in footer, never in sectioned list).
 * - Sources explicitly listed above use that mapping.
 * - Everything else (Reddit r/*, RSS sources, Google Events, Visit Lancaster,
 *   future sources) defaults to "community" so new sources automatically
 *   appear in the right bucket with no code change.
 */
export function getSectionForItem(item: {
  source?: string;
  type?: string;
}): FeedSection {
  if (item.type === "recommendation") return "recommendation";
  return SOURCE_SECTION[item.source ?? ""] ?? "community";
}

export type SectionConfig = {
  key:   FeedSection;
  label: string;
  emoji: string;
};

export const FEED_SECTION_CONFIG: SectionConfig[] = [
  { key: "happening",  label: "Happening near you",  emoji: "📍" },
  { key: "community",  label: "From the community",  emoji: "🤝" },
  { key: "ticketed",   label: "Ticketed events",     emoji: "🎟️" },
];
