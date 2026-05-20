// src/services/index.ts
// Barrel file — clean import path for the deduplication system.
//
// Usage:
//   import { deduplicateFeed, MultiSourceEvent, SourceLink } from "../services";

export { deduplicateFeed } from "./deduplicationService";
export type {
  MultiSourceEvent,
  SourceLink,
  DeduplicationResult,
  DeduplicationStats,
} from "./deduplicationService";
