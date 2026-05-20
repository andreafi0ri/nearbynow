// src/types/deduplication.ts
// All types for the event deduplication system.
// Import from here for clean, single-source-of-truth type references.

import { EventItem } from "../data/mockEvents";

// Re-export so callers can import SourceLink from this module too
export type { SourceLink } from "../data/mockEvents";

// ─── Multi-source event ────────────────────────────────────────────────────────

/**
 * An EventItem that may have been merged from multiple sources.
 *
 * Fully backwards compatible — extends EventItem so all existing code that
 * accepts EventItem continues to work without modification.
 */
export type MultiSourceEvent = EventItem & {
  /** All platforms this event was found on. Always has at least one entry. */
  sourceLinks: NonNullable<EventItem["sourceLinks"]>;
  /** 0–100; 100 = certain hard merge, lower values reserved for future use. */
  confidenceScore: number;
  /** true when combined from two or more distinct source items. */
  isMerged: boolean;
  /** source names of every item that was merged into this card. */
  mergedFrom: string[];
  /** Titles of near-match events that were NOT merged (different venue / time). */
  fuzzyMatchCandidates?: string[];
};

// ─── Result types ──────────────────────────────────────────────────────────────

/** Returned by deduplicateFeed(). */
export type DeduplicationResult = {
  /** Deduplicated, sorted array of events ready for display. */
  events: MultiSourceEvent[];
  /** Diagnostic counters for logging / debugging. */
  stats: DeduplicationStats;
};

export type DeduplicationStats = {
  /** Total items passed in before deduplication. */
  inputCount: number;
  /** Total items after deduplication. */
  outputCount: number;
  /** Number of groups that were hard-merged (2+ sources → 1 card). */
  hardMergeCount: number;
  /** Number of near-match pairs logged but NOT merged. */
  fuzzyMatchCount: number;
  /** Raw item count per source name before deduplication. */
  sourceBreakdown: Record<string, number>;
};
