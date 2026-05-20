// src/services/visitLancasterService.ts
// Scrapes visitlancastercity.com/events/ to surface Lancaster City special
// events that are not distributed via RSS or ticket platforms.
//
// Strategy:
//   1. Fetch the events listing page and extract all /events/[slug]/ hrefs.
//   2. Skip known evergreen/series pages (First Friday, Music Friday, etc.).
//   3. Fetch each event detail page concurrently (max 8, 5 s timeout each).
//   4. Parse title, date, time, location, and description via regex.
//   5. Drop any page that has no parseable YYYY date → it's a series, not an event.

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

const BASE_URL = "https://visitlancastercity.com";
const LISTING  = `${BASE_URL}/events/`;

// Evergreen / series slugs — not specific dated events
const SKIP_SLUGS = new Set([
  "first-friday",
  "music-friday",
  "ewell-plaza-binns-park",
  "indie-retail-week",     // multi-day range, handled separately if needed
]);

// 5-minute in-memory cache
let cachedItems: EventItem[] | null = null;
let cacheExpiry = 0;

function corsUrl(url: string): string {
  if (Platform.OS !== "web") return url;
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

async function getText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(corsUrl(url), { signal: controller.signal });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Stable numeric ID from a string (same algorithm as rssParser). */
function stableId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

/** Strip HTML tags and decode common entities. */
function stripHTML(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/&#\d+;/g, "").replace(/&[a-z]+;/gi, "")
    .replace(/\s+/g, " ").trim();
}

/** Extract unique event-detail hrefs from the listing page HTML. */
function extractEventSlugs(html: string): string[] {
  const re = /href="(\/events\/([a-z0-9-]+)\/?)"/gi;
  const seen = new Set<string>();
  const slugs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const path = m[1].endsWith("/") ? m[1] : m[1] + "/";
    const slug = m[2];
    if (!seen.has(slug) && !SKIP_SLUGS.has(slug)) {
      seen.add(slug);
      slugs.push(path);
    }
  }
  return slugs;
}

const MONTH_NAMES = "january|february|march|april|may|june|july|august|september|october|november|december";
const MONTHS = MONTH_NAMES.split("|");

/** Parse an already-extracted date substring like "June 6, 2026" → "2026-06-06". */
function parseDate(raw: string): string | null {
  const m = raw.match(new RegExp(`(${MONTH_NAMES})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (!m) return null;
  const monthIdx = MONTHS.indexOf(m[1].toLowerCase());
  if (monthIdx < 0) return null;
  return `${m[3]}-${String(monthIdx + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/**
 * Extract the START date from raw HTML. Handles:
 *   • "June 6, 2026"                    — single date
 *   • "November 27–December 31, 2026"   — cross-month range (year only at end)
 *   • "December 4–11, 2026"             — same-month range
 *
 * Critically: searches only from the <h1> element onwards. The site's nav menu
 * lists every event with its date (in DOM order BEFORE the h1), so searching
 * from the beginning of the document always picks up the wrong event's date.
 * The range pattern is tried first; standard "Month DD, YYYY" is the fallback.
 */
function extractStartDate(html: string): string | null {
  // Anchor to the <h1> so nav-menu dates (which precede it) are skipped.
  const h1Idx = html.search(/<h1[^>]*>/i);
  const searchFrom = h1Idx >= 0 ? html.slice(h1Idx) : html;

  // Pattern 1 — range: "Month DD–[Month DD,] YYYY"
  // Captures start month (1), start day (2), and year (3) from the end of the range.
  const rangeRe = new RegExp(
    `(${MONTH_NAMES})\\s+(\\d{1,2})[\\u2013\\-](?:(?:${MONTH_NAMES})\\s+\\d{1,2},?\\s*)?(\\d{4})`,
    "i"
  );

  // Pattern 2 — standard: "Month DD, YYYY"
  const stdRe = new RegExp(`(${MONTH_NAMES})\\s+\\d{1,2},?\\s+\\d{4}`, "i");

  const rangeMatch = rangeRe.exec(searchFrom);
  const stdMatch   = stdRe.exec(searchFrom);

  // Use whichever appears first in the document — the event's own date sits
  // immediately inside the <h1> while content-body ranges (e.g. a tournament
  // schedule) appear hundreds of chars later.
  if (rangeMatch && (!stdMatch || rangeMatch.index < stdMatch.index)) {
    const monthIdx = MONTHS.indexOf(rangeMatch[1].toLowerCase());
    if (monthIdx >= 0) {
      return `${rangeMatch[3]}-${String(monthIdx + 1).padStart(2, "0")}-${rangeMatch[2].padStart(2, "0")}`;
    }
  }

  return stdMatch ? parseDate(stdMatch[0]) : null;
}

/** Parse a time string like "8:00 a.m." or "6:00 PM – 11:00 PM". */
function parseTime(html: string): string {
  // Match "HH:MM a.m./p.m." or "H:MM AM/PM" patterns
  const re = /\b(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|AM|PM))\s*(?:[–\-]\s*(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|AM|PM)))?/i;
  const m = stripHTML(html).match(re);
  if (!m) return "";
  // Normalise a.m./p.m. → AM/PM
  const norm = (t: string) =>
    t.replace(/a\.m\./i, "AM").replace(/p\.m\./i, "PM").trim();
  return m[2] ? `${norm(m[1])} – ${norm(m[2])}` : norm(m[1]);
}

/** Classify an event into a category based on title + description text. */
function classify(text: string): { category: string; catColor: string; img: string } {
  const lower = text.toLowerCase();
  if (/jazz|music|concert|festival|band|dj|folk|blues/i.test(lower))
    return { category: "Music",        catColor: "#7B5CE0", img: "🎸" };
  if (/run|race|marathon|5k|10k|sport|soccer|football|athletic/i.test(lower))
    return { category: "Sport",        catColor: "#1A9E98", img: "🏃" };
  if (/art|exhib|gallery|theatre|theater|dance|cultural/i.test(lower))
    return { category: "Arts",         catColor: "#2D8A6E", img: "🎨" };
  if (/food|eat|restaur|market|beer|brew|culinar/i.test(lower))
    return { category: "Food & Drink", catColor: "#D43030", img: "🍽️" };
  if (/communit|heritage|celebrat|pride|festival|juneteenth/i.test(lower))
    return { category: "Community",    catColor: "#E67E22", img: "🤝" };
  if (/free\b/i.test(lower))
    return { category: "Free",         catColor: "#2ECC71", img: "🆓" };
  return   { category: "Events",       catColor: "#2860C8", img: "🎟️" };
}

/** Fetch one event detail page and map it to an EventItem. Returns null when
 *  no parseable date is found (i.e. the page is a recurring series, not a
 *  specific upcoming event). */
async function fetchEventDetail(path: string): Promise<EventItem | null> {
  const url  = `${BASE_URL}${path}`;
  const html = await getText(url);
  if (!html) return null;

  // --- Title: prefer <h1>, fall back to <title>
  const h1Match    = html.match(/<h1[^>]*>([^<]{4,120})<\/h1>/i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle   = h1Match ? stripHTML(h1Match[1]) : titleMatch ? stripHTML(titleMatch[1].split("|")[0]) : "";
  if (!rawTitle) return null;

  // --- Date: extract start date, handling single dates and range formats
  const dateISO = extractStartDate(html);
  if (!dateISO) return null;   // No specific date → skip series pages

  // Drop past events (more than 1 day ago)
  const eventTs = new Date(dateISO).getTime();
  if (eventTs < Date.now() - 86_400_000) return null;

  // --- Time
  const time = parseTime(html) || dateISO;

  // --- Location: scan for known Lancaster venues or paragraph text near "at "
  let location = "Downtown Lancaster, PA";
  if (/Ewell Plaza|Binns Park/i.test(html))
    location = "Ewell Plaza & Binns Park, Lancaster, PA";
  else if (/Penn Medicine Park/i.test(html))
    location = "Penn Medicine Park, Lancaster, PA";
  else {
    const atMatch = stripHTML(html).match(/\bat\s+([A-Z][^.]{4,50}(?:Park|Plaza|Center|Hall|Arena|Field|Stadium))/);
    if (atMatch) location = atMatch[1].trim() + ", Lancaster, PA";
  }

  // --- Description: first substantial <p> block (≥ 40 chars) after the h1
  const afterH1 = h1Match ? html.slice(html.indexOf(h1Match[0])) : html;
  const paras   = [...afterH1.matchAll(/<p[^>]*>([\s\S]{40,600}?)<\/p>/gi)];
  const desc    = paras.length > 0 ? stripHTML(paras[0][1]).slice(0, 280) : "";

  // --- Booking URL
  const regMatch = html.match(/href="(https?:\/\/[^"]+(?:runsignup|ticketmaster|eventbrite|store\.visit)[^"]*)"/i);
  const bookingUrl = regMatch ? regMatch[1] : url;

  const { category, catColor, img } = classify(`${rawTitle} ${desc}`);

  return {
    id:        stableId(`vlc-${path}`),
    type:      "event" as const,
    title:     rawTitle,
    desc:      desc || `Event in Lancaster City on ${dateISO}.`,
    time,
    location,
    date:      dateISO,
    source:    "Visit Lancaster",
    sourceUrl: url,
    category,
    catColor,
    catDot:    catColor + "BB",
    saves:     0,
    img,
    booking:   { label: "Event details", url: bookingUrl, affiliate: false },
    tags:      ["lancaster", "visit lancaster", category.toLowerCase()],
    startIso:  `${dateISO}T00:00:00`,
  };
}

/** Fetch all current Visit Lancaster City special events. */
export async function fetchVisitLancasterEvents(): Promise<EventItem[]> {
  if (cachedItems && Date.now() < cacheExpiry) return cachedItems;

  const listingHtml = await getText(LISTING);
  if (!listingHtml) return [];

  const slugPaths = extractEventSlugs(listingHtml).slice(0, 12);
  if (slugPaths.length === 0) return [];

  // Fetch detail pages in batches of 4 to avoid hammering the server
  const results: EventItem[] = [];
  for (let i = 0; i < slugPaths.length; i += 4) {
    const batch = slugPaths.slice(i, i + 4);
    const settled = await Promise.allSettled(batch.map(fetchEventDetail));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  cachedItems  = results;
  cacheExpiry  = Date.now() + 5 * 60 * 1_000; // 5-minute cache
  return results;
}
