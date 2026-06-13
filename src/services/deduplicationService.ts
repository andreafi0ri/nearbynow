// src/services/deduplicationService.ts
// Canonical deduplication for events fetched from multiple sources.
//
// MERGE STRATEGY
//   Hard merge  (confidence 100): normalised title + date + start time
//     within the same 30-minute bucket → auto-merge into one card
//   Fuzzy match (log only):  title similarity >80% + same date
//     → console.log candidate pair, never auto-merge
//   Location guard: events with different normalised locations are NEVER
//     hard-merged, even if title and date match exactly.

import { EventItem } from "../data/mockEvents";
import type {
  MultiSourceEvent,
  SourceLink,
  DeduplicationResult,
  DeduplicationStats,
} from "../types/deduplication";

// Re-export for callers that still import from this module
export type { MultiSourceEvent, SourceLink, DeduplicationResult, DeduplicationStats };

// ─── Internal type ─────────────────────────────────────────────────────────────

type NormalisedItem = EventItem & {
  /** Title lower-cased, punctuation stripped, stop words removed. */
  normalisedTitle: string;
  /** Location lower-cased, punctuation stripped, first segment only. */
  normalisedLocation: string;
  /** Minutes since midnight (null when no time can be parsed). */
  startMinutes: number | null;
};

// ─── Text normalisation ────────────────────────────────────────────────────────

const STOP_WORDS = /\b(the|a|an|at|in|on|of|and|&)\b/g;

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(STOP_WORDS, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseLocation(location: string): string {
  return location
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .split(",")[0]
    .trim();
}

// ─── Time parsing ──────────────────────────────────────────────────────────────

/** Returns minutes since midnight, or null if no time can be parsed. */
function parseStartMinutes(item: EventItem): number | null {
  // Prefer ISO datetime e.g. "2026-05-20T19:30:00"
  if (item.startIso) {
    const timePart = item.startIso.split("T")[1];
    if (timePart) {
      const [h, m] = timePart.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
    }
  }
  // Fall back to display string e.g. "Fri 7:30 PM", "Sat 9:00 AM"
  const match = (item.time ?? "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins  = parseInt(match[2], 10);
    const ampm  = match[3].toUpperCase();
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours  = 0;
    return hours * 60 + mins;
  }
  return null;
}

// ─── Normalise ─────────────────────────────────────────────────────────────────

function normaliseItem(item: EventItem): NormalisedItem {
  return {
    ...item,
    normalisedTitle:    normaliseTitle(item.title),
    normalisedLocation: normaliseLocation(item.location),
    startMinutes:       parseStartMinutes(item),
  };
}

// ─── Merge key ─────────────────────────────────────────────────────────────────

/**
 * Builds a string key that groups identical events.
 * Two events sharing the same key → hard merge candidates.
 *
 * titleKey    = first 30 chars of normalised title
 * dateKey     = YYYY-MM-DD
 * locationKey = first 20 chars of normalised location (venue guard)
 *
 * Time is intentionally NOT part of the key: the same event at different
 * start times (e.g. matinee + evening) should collapse into ONE card with
 * showTimes listing all slots.  Different venues on the same date are kept
 * separate via the locationKey guard.
 */
function mergeKey(item: NormalisedItem): string {
  const titleKey    = item.normalisedTitle.slice(0, 30);
  const dateKey     = item.date ?? "";
  const locationKey = item.normalisedLocation.slice(0, 20);
  return `${titleKey}|${dateKey}|${locationKey}`;
}

// ─── Levenshtein similarity ────────────────────────────────────────────────────

/**
 * Returns a value between 0 (completely different) and 1 (identical).
 * Uses standard Levenshtein dynamic programming — no external libraries.
 * Includes a fast-exit optimisation for obviously different strings.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  // Fast exit: length difference alone makes >80% similarity impossible
  if (Math.abs(a.length - b.length) / maxLen > 0.4) return 0;

  const m  = a.length;
  const n  = b.length;
  // Space-optimised: rolling single row instead of full 2D matrix
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }

  return 1 - dp[n] / maxLen;
}

// ─── Source link builder ───────────────────────────────────────────────────────

/**
 * Derives a canonical SourceLink from a raw EventItem.
 * Falls back to the booking URL where available.
 */
function buildSourceLink(item: EventItem): SourceLink {
  const bookingUrl = item.booking?.url;
  switch (item.source) {
    case "Facebook Events":
      return {
        platform: "Facebook Events",
        url:   bookingUrl
          ?? `https://www.facebook.com/search/events/?q=${encodeURIComponent(item.title)}`,
        label: "View on Facebook",
      };
    case "Eventbrite":
      return {
        platform: "Eventbrite",
        url:   bookingUrl ?? "https://www.eventbrite.com",
        label: "RSVP on Eventbrite",
      };
    case "Meetup":
      return {
        platform: "Meetup",
        url:   bookingUrl ?? "https://www.meetup.com",
        label: "RSVP on Meetup",
      };
    case "Ticketmaster":
      return {
        platform: "Ticketmaster",
        url:   bookingUrl ?? "https://www.ticketmaster.com",
        label: "Buy Tickets",
      };
    case "Google Places":
      return {
        platform: "Google Places",
        url:   bookingUrl
          ?? `https://www.google.com/maps/search/${encodeURIComponent(item.title)}`,
        label: "View on Google Maps",
      };
    default:
      if (item.source.startsWith("r/"))
        return {
          platform: item.source,
          url:   bookingUrl
            ?? `https://www.reddit.com/search/?q=${encodeURIComponent(item.title)}`,
          label: "View on Reddit",
        };
      return {
        platform: item.source,
        url:   bookingUrl ?? "#",
        label: "View source",
      };
  }
}

/** Collect deduplicated SourceLinks from all items in a merge group. */
function buildAllSourceLinks(items: EventItem[]): SourceLink[] {
  const seen  = new Set<string>();
  const links: SourceLink[] = [];

  for (const item of items) {
    // Prefer pre-built links already on the item (mock data / prior merge)
    if (item.sourceLinks?.length) {
      for (const link of item.sourceLinks) {
        if (!seen.has(link.platform)) {
          seen.add(link.platform);
          links.push(link);
        }
      }
    } else {
      const link = buildSourceLink(item);
      if (!seen.has(link.platform)) {
        seen.add(link.platform);
        links.push(link);
      }
    }
  }

  return links;
}

// ─── Richness scorer ───────────────────────────────────────────────────────────

/** Score how many useful fields an item carries. Highest score = canonical base. */
function scoreItem(item: EventItem): number {
  let score = 0;
  const check = (v: unknown) => { if (v != null && v !== "") score++; };
  check(item.title);
  check(item.desc);
  check(item.time);
  check(item.location);
  check(item.sourceUrl);
  check(item.rating);
  check(item.reviews);
  check(item.startIso);
  check(item.endIso);
  if (item.longDesc)                        score += 3;
  if (item.lat != null && item.lng != null) score += 2;
  if (item.booking)                         score += 2;
  if (item.tags?.length)                    score += 1;
  return score;
}

// ─── Merge group ───────────────────────────────────────────────────────────────

// Sources that own the physical venue and should always be the canonical
// when present in a merge group — their URL goes directly to the venue's
// own ticketing page, not a third-party platform.
const VENUE_DIRECT_SOURCES = new Set(["American Music Theatre"]);

/**
 * Merges 2+ items sharing the same merge key into one canonical MultiSourceEvent.
 * The richest item (highest score) is used as the base; remaining items donate
 * their best fields. Venue-direct sources (VENUE_DIRECT_SOURCES) always win
 * the canonical slot and the booking URL so the card links to the venue's
 * own site, not a third-party aggregator.
 */
function mergeGroup(items: EventItem[]): MultiSourceEvent {
  // Venue-direct sources take the canonical slot unconditionally.
  const venueItem = items.find(i => VENUE_DIRECT_SOURCES.has(i.source ?? ""));
  const canonical = venueItem ?? [...items].sort((a, b) => scoreItem(b) - scoreItem(a))[0];

  // Best description = longest non-empty string
  const bestDesc = items
    .map(i => i.desc)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? canonical.desc;

  const bestLongDesc = items
    .map(i => i.longDesc)
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => b.length - a.length)[0];

  // Coordinates: first non-null across all items
  const lat = items.find(i => i.lat != null)?.lat;
  const lng = items.find(i => i.lng != null)?.lng;

  // Booking: venue-direct sources own the link (their URL goes to the
  // venue's own ticketing page). Affiliate links are only used as fallback.
  const booking =
    items.find(i => VENUE_DIRECT_SOURCES.has(i.source ?? ""))?.booking ??
    items.find(i => i.booking?.affiliate)?.booking ??
    items.find(i => i.booking)?.booking ??
    null;

  // Tags: union, deduplicated
  const tags = [...new Set(items.flatMap(i => i.tags ?? []))];

  // Saves: sum total interest across all sources
  const saves = items.reduce((sum, i) => sum + (i.saves ?? 0), 0);

  // Show times: chronological unique strings (for multi-session events)
  const sortedByTime = [...items].sort((a, b) =>
    (a.startIso ?? "").localeCompare(b.startIso ?? "")
  );
  const seenTimes = new Set<string>();
  const showTimes: string[] = [];
  for (const item of sortedByTime) {
    if (item.time && !seenTimes.has(item.time)) {
      seenTimes.add(item.time);
      showTimes.push(item.time);
    }
  }

  return {
    ...canonical,
    desc:      bestDesc,
    longDesc:  bestLongDesc,
    lat,
    lng,
    booking,
    tags:      tags.length > 0 ? tags : undefined,
    saves,
    showTimes: showTimes.length > 1 ? showTimes : undefined,
    time:      showTimes.length > 0 ? showTimes[0] : canonical.time,
    sourceLinks:     buildAllSourceLinks(items),
    isMerged:        true,
    confidenceScore: 100,
    mergedFrom:      items.map(i => i.source),
  };
}

/** Wrap a single non-merged item as a MultiSourceEvent. */
function wrapAsMultiSourceEvent(item: EventItem): MultiSourceEvent {
  return {
    ...item,
    sourceLinks:     item.sourceLinks     ?? [buildSourceLink(item)],
    isMerged:        item.isMerged        ?? false,
    confidenceScore: item.confidenceScore ?? 100,
    mergedFrom:      [item.source],
  };
}

// ─── Fuzzy skip reason ─────────────────────────────────────────────────────────

/**
 * Human-readable explanation of why two title-similar events were NOT merged.
 * Used in the fuzzy-match console log.
 */
function getFuzzySkipReason(a: NormalisedItem, b: NormalisedItem): string {
  if (a.normalisedLocation !== b.normalisedLocation) {
    return `Different locations: "${a.location}" vs "${b.location}"`;
  }
  return "Title similarity below hard merge threshold";
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Deduplicates a flat list of EventItems from all sources into a sorted,
 * merged list of MultiSourceEvents.
 *
 * Hard merge:   normalised title + date + start time in the same 30-min
 *   bucket → one canonical card with all source links combined.
 * Fuzzy match:  title similarity >80% + same date → log only, keep separate.
 * Location guard: different normalised venues → never merged.
 *
 * The function never throws — any internal error causes a graceful fallback
 * that returns all items unmerged with zeroed stats.
 *
 * @param items  Raw EventItems from all sources
 * @returns      DeduplicationResult with merged events and diagnostic stats
 */
export function deduplicateFeed(items: EventItem[]): DeduplicationResult {
  try {
    return _deduplicateFeed(items);
  } catch (err) {
    console.error("[Dedup] Engine failed — returning items unmerged:", err);
    const sourceBreakdown: Record<string, number> = {};
    for (const item of items) {
      sourceBreakdown[item.source] = (sourceBreakdown[item.source] ?? 0) + 1;
    }
    return {
      events: items.map(wrapAsMultiSourceEvent),
      stats: {
        inputCount:     items.length,
        outputCount:    items.length,
        hardMergeCount: 0,
        fuzzyMatchCount: 0,
        sourceBreakdown,
      },
    };
  }
}

function _deduplicateFeed(items: EventItem[]): DeduplicationResult {
  // ── Step 1: Normalise all items ────────────────────────────────────────────
  const normalised = items.map(normaliseItem);

  // ── Step 2: Build merge groups keyed by (titlePrefix | date | timeBucket) ──
  const groups = new Map<string, NormalisedItem[]>();
  for (const item of normalised) {
    const key = mergeKey(item);
    const grp = groups.get(key);
    if (grp) {
      grp.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  // ── Step 3 & 4: Hard-merge groups; wrap singletons ────────────────────────
  const events: MultiSourceEvent[] = [];
  let hardMergeCount = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      events.push(wrapAsMultiSourceEvent(group[0]));
    } else {
      events.push(mergeGroup(group));
      hardMergeCount++;
    }
  }

  // ── Step 5: Fuzzy match detection (log only, never merge) ─────────────────
  let fuzzyMatchCount = 0;

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.date !== b.date) continue;

      const na = normaliseItem(a);
      const nb = normaliseItem(b);

      // Skip pairs already unified into the same merge key
      if (mergeKey(na) === mergeKey(nb)) continue;

      const similarity = levenshteinSimilarity(na.normalisedTitle, nb.normalisedTitle);
      if (similarity > 0.8) {
        const reason = getFuzzySkipReason(na, nb);
        console.log(
          `[Dedup] Fuzzy match candidate — NOT merged:\n` +
          `  "${a.title}" (${a.source})\n` +
          `  "${b.title}" (${b.source})\n` +
          `  Similarity: ${Math.round(similarity * 100)}%\n` +
          `  Reason not merged: ${reason}`
        );
        // Annotate both cards with the near-match title for UI display
        if (!events[i].fuzzyMatchCandidates) {
          events[i] = { ...events[i], fuzzyMatchCandidates: [] };
        }
        if (!events[j].fuzzyMatchCandidates) {
          events[j] = { ...events[j], fuzzyMatchCandidates: [] };
        }
        events[i].fuzzyMatchCandidates!.push(b.title);
        events[j].fuzzyMatchCandidates!.push(a.title);
        fuzzyMatchCount++;
      }
    }
  }

  // ── Step 6: Sort — events before recommendations, date ↑, time ↑ ──────────
  events.sort((a, b) => {
    if (a.type !== b.type) return a.type === "event" ? -1 : 1;
    const dateCmp = (a.date ?? "").localeCompare(b.date ?? "");
    if (dateCmp !== 0) return dateCmp;
    const aMin = parseStartMinutes(a) ?? Infinity;
    const bMin = parseStartMinutes(b) ?? Infinity;
    return aMin - bMin;
  });

  // ── Step 7: Build stats and return ─────────────────────────────────────────
  const sourceBreakdown: Record<string, number> = {};
  for (const item of items) {
    sourceBreakdown[item.source] = (sourceBreakdown[item.source] ?? 0) + 1;
  }

  return {
    events,
    stats: {
      inputCount:      items.length,
      outputCount:     events.length,
      hardMergeCount,
      fuzzyMatchCount,
      sourceBreakdown,
    },
  };
}
