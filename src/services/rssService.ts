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

// ─── Age / event-date filter ──────────────────────────────────────────────────

/**
 * Maximum age (in days) of an RSS article to include.
 * 60 days covers advance previews and season announcements published well
 * before the event itself.
 */
const ARTICLE_MAX_AGE_DAYS = 60;

/**
 * Passes items whose article date is within ARTICLE_MAX_AGE_DAYS AND whose
 * extracted event date (item.date, set by rssParser) has not yet passed.
 *
 * - Article age check (item.date ≤ 60 days old) keeps the source set fresh.
 * - Past-event check (item.date < yesterday) drops articles about events that
 *   have already happened, even if the article was published recently.
 *
 * Note: after Fix 1 in rssParser, item.date is the extracted event date when
 * one was found in the article body, or pubDate as a fallback. Items that had
 * a real future event date extracted will carry that date here, so both checks
 * serve their intended purpose.
 */
function shouldKeepRSSItem(dateStr: string): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const t = d.getTime();
  const now = Date.now();

  // Drop articles older than 60 days
  if (t < now - ARTICLE_MAX_AGE_DAYS * 86_400_000) return false;

  // Drop items whose event date has already passed (allow 1-day grace)
  const yesterday = now - 86_400_000;
  if (t < yesterday) return false;

  return true;
}

// ─── CORS proxy chain ─────────────────────────────────────────────────────────

/**
 * Ordered list of public CORS proxy services.
 * Tried in order — falls through on any error, timeout, or non-XML response.
 *
 * Verified status (2026-06):
 *   codetabs   ✅ working — tried first
 *   allorigins ⚠️ frequent timeouts — kept as fallback
 *   corsproxy  ❌ returning 403 on everything — removed
 *   thingproxy ✅ working — new fallback
 */
const CORS_PROXIES = [
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://api.allorigins.win/raw?url=",
  "https://thingproxy.freeboard.io/fetch/",
];

// ─── Proxy health cache ───────────────────────────────────────────────────────

interface ProxyHealth {
  healthy:     boolean;
  lastChecked: number;
  failCount:   number;
}

/** In-memory health state for each proxy URL. Survives warm invocations. */
const proxyHealth = new Map<string, ProxyHealth>();

/** How long a proxy health verdict stays valid before we retry it. */
const PROXY_HEALTH_TTL_MS = 5 * 60_000; // 5 minutes

function isProxyAvailable(proxy: string): boolean {
  const h = proxyHealth.get(proxy);
  if (!h) return true;                                      // untested → assume healthy
  if (Date.now() - h.lastChecked > PROXY_HEALTH_TTL_MS) return true; // stale → retry
  return h.healthy;
}

function markProxy(proxy: string, healthy: boolean): void {
  const existing = proxyHealth.get(proxy);
  proxyHealth.set(proxy, {
    healthy,
    lastChecked: Date.now(),
    failCount: healthy ? 0 : (existing?.failCount ?? 0) + 1,
  });
}

/**
 * Fetches an RSS feed URL through a proxy chain with health tracking.
 *
 * - Skips proxies known to be unhealthy (within the last 5 minutes).
 * - Falls back to trying ALL proxies if none are currently marked healthy.
 * - Marks each proxy healthy or unhealthy based on the result.
 *
 * @throws Error when all available proxies fail or return invalid XML.
 */
async function fetchWithProxy(url: string): Promise<string> {
  const available = CORS_PROXIES.filter(isProxyAvailable);
  const toTry = available.length > 0 ? available : CORS_PROXIES;

  for (const proxy of toTry) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), {
        headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
        signal: AbortSignal.timeout(6_000),
      });

      if (!response.ok) {
        markProxy(proxy, false);
        continue;
      }

      const text = await response.text();

      if (
        text.includes("<rss")    ||
        text.includes("<feed")   ||
        text.includes("<channel")
      ) {
        markProxy(proxy, true);
        return text;
      }

      // Got a 200 but the body is HTML not XML — likely a paywall, redirect,
      // or dead feed URL. Log it so dead sources are visible in console.
      console.warn(`[RSS] ${proxy.split("/")[2]} returned HTML not XML for: ${url}`);
      markProxy(proxy, false);
    } catch {
      // Network error or timeout
      markProxy(proxy, false);
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

export async function fetchRSSFeeds(
  area: string,
  coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  // Only include "News" category sources when breaking local news is enabled.
  // Most of the new sources use "Events" / "Culture" / "Outdoors" and are
  // always included. This gate only affects legacy "News"-tagged sources.
  const breakingNewsEnabled =
    (await AsyncStorage.getItem("hearby_breaking_news")) === "true";

  // Pass coords so nearby (within ~20mi) coord-anchored feeds are included,
  // not just exact name matches.
  const sources = getRSSSourcesForArea(area, coords)
    .filter(s => s.category !== "News" || breakingNewsEnabled);

  if (sources.length === 0) return [];

  const results = await Promise.allSettled(sources.map(fetchSource));

  const all: EventItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Drop stale / past items, sort newest-first, deduplicate by URL / title
  const seen = new Set<string>();
  return all
    .filter(item => shouldKeepRSSItem(item.date))
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
