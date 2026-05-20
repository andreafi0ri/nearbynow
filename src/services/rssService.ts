// src/services/rssService.ts
// Fetches RSS feeds for an area using react-native-rss-parser.
// Sources are resolved via rssDiscovery → rssSources config.
//
// All fetches go through a CORS proxy chain (fetchWithProxy) that tries
// three public proxies in order — this fixes the silent failures that happen
// when news sites block direct cross-origin requests from React Native.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as rssParser from "react-native-rss-parser";
import type { RSSItem } from "react-native-rss-parser";
import { EventItem } from "../data/mockEvents";
import { getRSSSourcesForArea } from "./rssDiscovery";
import { parseRSSItem, scoreItem } from "./rssParser";
import { RSSSource } from "../config/rssSources";
import { SEARCH_CONFIG } from "../config/searchConfig";

// ─── Age filter ───────────────────────────────────────────────────────────────

/** Maximum age (in days) of an RSS item to include in the feed. */
const RSS_MAX_AGE_DAYS = 14;

function isRecentRSSItem(dateStr: string): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now() - RSS_MAX_AGE_DAYS * 86_400_000;
}

// ─── CORS proxy chain ─────────────────────────────────────────────────────────

/**
 * Ordered list of public CORS proxy services.
 * allorigins.win is tried first — most reliable on free tier.
 * Falls through to the next proxy on any error or invalid XML.
 */
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

/**
 * Fetches an RSS feed URL through a proxy chain.
 * Tries each proxy in order; moves to the next on failure or non-XML response.
 *
 * @throws Error when all proxies fail or return invalid XML.
 */
async function fetchWithProxy(url: string): Promise<string> {
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), {
        headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
        signal: AbortSignal.timeout(6_000),
      });

      if (!response.ok) continue;

      const text = await response.text();

      // Validate it looks like XML/RSS before accepting
      if (
        text.includes("<rss")    ||
        text.includes("<feed")   ||
        text.includes("<channel")
      ) {
        return text;
      }
      // Got a response but it wasn't XML — try next proxy
    } catch {
      // Network error or timeout — try next proxy
    }
  }
  throw new Error(`All proxies failed for: ${url}`);
}

// ─── Per-source fetch ─────────────────────────────────────────────────────────

async function fetchSource(source: RSSSource): Promise<EventItem[]> {
  try {
    const text = await fetchWithProxy(source.url);
    const feed = await rssParser.parse(text);
    return (feed.items ?? [])
      .map((item: RSSItem) => parseRSSItem(item, source))
      .filter((item): item is EventItem => item !== null);
  } catch {
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchRSSFeeds(area: string): Promise<EventItem[]> {
  // Only include "News" category sources when breaking local news is enabled.
  // Most of the new sources use "Events" / "Culture" / "Outdoors" and are
  // always included. This gate only affects legacy "News"-tagged sources.
  const breakingNewsEnabled =
    (await AsyncStorage.getItem("hearby_breaking_news")) === "true";

  const sources = getRSSSourcesForArea(area)
    .filter(s => s.category !== "News" || breakingNewsEnabled);

  if (sources.length === 0) return [];

  const results = await Promise.allSettled(sources.map(fetchSource));

  const all: EventItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Drop stale items, sort newest-first, deduplicate by URL / title
  const seen = new Set<string>();
  return all
    .filter(item => isRecentRSSItem(item.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(item => {
      const key = item.sourceUrl ?? item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SEARCH_CONFIG.RSS_MAX_RESULTS);
}

// ─── Feed health check (dev utility) ─────────────────────────────────────────

/**
 * Tests every RSS source for the given area and logs a diagnostic table
 * to the Metro bundler terminal.
 *
 * **Usage (dev only)**
 * - Tap the "🔧 Run RSS feed health check" button in the Profile screen
 *   (visible only when `__DEV__` is true).
 * - Or call it directly from a script:
 *   ```ts
 *   import { checkFeedHealth } from "../src/services/rssService";
 *   checkFeedHealth("brooklyn");
 *   ```
 *
 * Output columns:
 *   status | source name | events passing filter / total items | latency ms
 *
 * @param area - Human-readable area name, e.g. "Brooklyn, NY" or "London"
 */
export async function checkFeedHealth(area: string): Promise<void> {
  const sources = getRSSSourcesForArea(area);
  console.log(`\n━━━ RSS FEED HEALTH CHECK for "${area}" ━━━`);
  console.log(`Testing ${sources.length} sources...\n`);

  type HealthResult =
    | { name: string; url: string; status: string; totalItems: number; eventItems: number; ms: number }
    | { name: string; url: string; status: string; error: string; ms: number };

  const results = await Promise.allSettled<HealthResult>(
    sources.map(async (source): Promise<HealthResult> => {
      const start = Date.now();
      try {
        const xml  = await fetchWithProxy(source.url);
        const feed = await rssParser.parse(xml);
        const items = feed.items ?? [];
        const eventCount = items.filter((i: RSSItem) => scoreItem(i) >= 1).length;
        return {
          name:       source.name,
          url:        source.url,
          status:     "✅ OK",
          totalItems: items.length,
          eventItems: eventCount,
          ms:         Date.now() - start,
        };
      } catch (err) {
        return {
          name:   source.name,
          url:    source.url,
          status: "❌ FAILED",
          error:  String(err),
          ms:     Date.now() - start,
        };
      }
    })
  );

  // Print summary table
  for (const r of results) {
    const v = r.status === "fulfilled"
      ? r.value
      : { name: "unknown", url: "", status: "❌ PROMISE ERROR", error: String((r as PromiseRejectedResult).reason), ms: 0 };

    if ("eventItems" in v) {
      console.log(
        `${v.status} ${v.name.padEnd(28)} ` +
        `${String(v.eventItems).padStart(2)} events / ` +
        `${String(v.totalItems).padStart(3)} total  ` +
        `(${v.ms}ms)`
      );
    } else {
      console.log(
        `${v.status} ${v.name.padEnd(28)} ${(v as { error: string }).error}  (${v.ms}ms)`
      );
    }
  }

  const ok     = results.filter(r => r.status === "fulfilled" && "eventItems" in r.value).length;
  const failed = results.length - ok;
  console.log(`\nSummary: ${ok} OK / ${failed} failed`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}
