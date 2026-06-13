// src/services/lancasterLibrariesService.ts
//
// Lancaster Public Library system event calendar.
// Source: calendar.lancasterlibraries.org/events/list
// Platform: Drupal 11 with custom lc_calendar module.
//
// No structured JSON API is exposed — events are server-rendered HTML.
// We parse <article> elements and filter to the four audience groups
// the user wants: Teens, Adults, Seniors, Everyone.
// Children / Babies / Toddlers / Tweens are excluded.
//
// The page returns 24 events per page. We fetch MAX_PAGES pages in parallel
// to cover the full 60-day horizon (the library has ~20 events/day across
// all 12 branches, so a single page captures only the next ~few hours).
// Fetched through the server-side fetch-page proxy (no CORS header on the site).

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

const PROXY_BASE = Platform.OS === "web" ? "" : "https://www.nearbyandnow.com";
const LIST_URL   = "https://calendar.lancasterlibraries.org/events/list";
const MAX_PAGES  = 10; // 10 pages × ~8 adult events/page ≈ 80 events

// Age groups to include (matched against CSS class on each card)
const ALLOWED_AGE_GROUPS = new Set(["teens", "adults", "seniors", "everyone"]);

// Branch name → coordinates (substring match on location string)
// Lancaster Public Library system has 12 branches across Lancaster County.
const BRANCH_COORDS: Array<{ key: string; lat: number; lng: number }> = [
  { key: "Lancaster",       lat: 40.0379, lng: -76.3055 }, // Central Lancaster
  { key: "Lititz",          lat: 40.1559, lng: -76.3018 },
  { key: "Manheim Township",lat: 40.0798, lng: -76.3701 },
  { key: "Manheim Community",lat: 40.1647, lng: -76.4131 },
  { key: "Mountville",      lat: 40.0336, lng: -76.4297 },
  { key: "Columbia",        lat: 40.0358, lng: -76.5016 },
  { key: "Ephrata",         lat: 40.1793, lng: -76.1791 },
  { key: "Adamstown",       lat: 40.2368, lng: -76.0482 },
  { key: "Quarryville",     lat: 39.8984, lng: -76.1636 },
  { key: "Strasburg",       lat: 39.9855, lng: -76.1838 },
  { key: "Milanof-Schock",  lat: 40.2334, lng: -76.1359 }, // Denver, PA
  { key: "Eastern Lancaster County", lat: 40.1018, lng: -76.0869 }, // New Holland area
];
const DEFAULT_LAT = 40.0379;
const DEFAULT_LNG = -76.3055;

function branchCoords(location: string): { lat: number; lng: number } {
  const lower = location.toLowerCase();
  const match = BRANCH_COORDS.find(b => lower.includes(b.key.toLowerCase()));
  return match ? { lat: match.lat, lng: match.lng } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

const CACHE_TTL = 30 * 60 * 1_000; // 30 min
let cache: { data: EventItem[]; expiresAt: number } | null = null;

// ─── HTML parser ────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ").replace(/&#8217;/g, "'").replace(/&#8211;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function stripTags(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// "06/06/2026 @ 8:00am to 06/13/2026 @ 8:00pm"  →  "2026-06-06"
// "Monday, June 15, 2026 at\n  9:00am - 11:00am" →  "2026-06-15"
function parseDate(raw: string): string | null {
  // MM/DD/YYYY format
  const mdyMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // "June 15, 2026" format
  const months: Record<string, string> = {
    january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",
    july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
  };
  const longMatch = raw.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (longMatch) {
    const [, month, d, y] = longMatch;
    const m = months[month.toLowerCase()];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }
  return null;
}

// "9:00am - 11:00am" or "8:00am to 06/13/2026 @ 8:00pm" → "Sat 9:00 AM"
function parseTime(raw: string, date: string): string {
  const timeMatch = raw.match(/(\d{1,2}:\d{2}(?:am|pm))/i);
  if (!timeMatch) return "See event";
  try {
    const d = new Date(`${date}T${timeMatch[1].toUpperCase().replace(/(AM|PM)/, " $1")}`);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });
    }
  } catch {}
  return timeMatch[1].toUpperCase();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

const TODAY = () => new Date().toISOString().split("T")[0];

function parseEvents(html: string): EventItem[] {
  const horizon = new Date(Date.now() + 60 * 86_400_000).toISOString().split("T")[0];
  const articles = html.split("<article ");
  const items: EventItem[] = [];

  for (const art of articles.slice(1)) {
    // Age group from CSS class — skip if not in allowed set
    const ageGroupMatch = art.match(/lc-event__color-indicator--(\w+)\s/);
    const ageGroup = ageGroupMatch?.[1]?.toLowerCase() ?? "";
    if (!ALLOWED_AGE_GROUPS.has(ageGroup)) continue;

    // Title + URL
    const linkMatch = art.match(/class="lc-event__link"[^>]*href="([^"]+)"[^>]*>([^<]+)/);
    if (!linkMatch) continue;
    const [, href, rawTitle] = linkMatch;
    const title = decodeEntities(rawTitle).trim().slice(0, 80);
    if (!title) continue;

    const url = href.startsWith("http") ? href : `https://calendar.lancasterlibraries.org${href}`;

    // Date (first date from the date field)
    const dateFieldMatch = art.match(/lc-list-event-info-item--date[^>]*>\s*([^<]+)/);
    const rawDate = dateFieldMatch?.[1]?.trim() ?? "";
    const date = parseDate(rawDate);
    if (!date || date < TODAY() || date > horizon) continue;

    // Time
    const time = parseTime(rawDate, date);

    // Location
    const locMatch = art.match(/lc-list-event-location[^>]*>\s*([^<]+)/);
    const location = decodeEntities(locMatch?.[1]?.trim() ?? "Lancaster Library");

    // Branch coordinates
    const coords = branchCoords(location);

    // Description
    const descMatch = art.match(/lc-list-event-description[\s\S]{0,50}?<p[^>]*>([\s\S]{0,400}?)<\/p>/);
    const desc = stripTags(decodeEntities(descMatch?.[1] ?? "")).slice(0, 200)
      || `${ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)} event at ${location}`;

    // Audience label for tags
    const audienceLabel = ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1);

    items.push({
      id:         hashString(`lib-${title}-${date}`),
      type:       "event",
      title,
      desc,
      time,
      date,
      startIso:   `${date}T00:00:00`,
      location,
      lat:        coords.lat,
      lng:        coords.lng,
      source:     "Lancaster Libraries",
      sourceUrl:  url,
      category:   "Events",
      catColor:   "#2860C8",
      catDot:     "#5A90F8",
      saves:      0,
      img:        "📚",
      booking:    { label: "View event", url, affiliate: false },
      tags:       ["Lancaster", audienceLabel].slice(0, 3),
      isCanceled: false,
    });
  }

  return items;
}

// ─── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchPage(pageIndex: number): Promise<EventItem[]> {
  const url = pageIndex === 0
    ? LIST_URL
    : `${LIST_URL}?page=${pageIndex}`;
  try {
    const res = await fetch(
      `${PROXY_BASE}/api/fetch-page?url=${encodeURIComponent(url)}`,
      { headers: { Accept: "text/html,*/*" }, signal: AbortSignal.timeout(12_000) }
    );
    if (!res.ok) return [];
    const html = await res.text();
    if (!html || html.length < 200) return [];
    return parseEvents(html);
  } catch {
    return [];
  }
}

export async function fetchLancasterLibrariesEvents(): Promise<EventItem[]> {
  if (cache && cache.expiresAt > Date.now()) {
    console.log(`[LancasterLibraries] cache hit — ${cache.data.length} events`);
    return cache.data;
  }

  try {
    // Fetch all pages in parallel
    const pageResults = await Promise.all(
      Array.from({ length: MAX_PAGES }, (_, i) => fetchPage(i))
    );

    // Merge and deduplicate by ID (same event can appear on adjacent pages
    // if events were added between fetches)
    const seen = new Set<number>();
    const items: EventItem[] = [];
    for (const page of pageResults) {
      for (const item of page) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }

    // Sort by date ascending
    items.sort((a, b) => a.date.localeCompare(b.date));

    cache = { data: items, expiresAt: Date.now() + CACHE_TTL };
    console.log(`[LancasterLibraries] ${items.length} events from ${MAX_PAGES} pages (teens/adults/seniors/everyone)`);
    return items;
  } catch (err: any) {
    console.warn("[LancasterLibraries] error:", err?.message);
    return [];
  }
}
