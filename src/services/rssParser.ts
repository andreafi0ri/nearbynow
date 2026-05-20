// src/services/rssParser.ts
// Converts a react-native-rss-parser item + RSSSource metadata into an EventItem.
// scoreItem() is exported so rssService can use it in checkFeedHealth().

import { EventItem } from "../data/mockEvents";
import { RSSSource } from "../config/rssSources";

// ─── Event scoring keyword lists ──────────────────────────────────────────────

/** Strong positive signals — almost certainly an event. +3 each */
const EVENT_KEYWORDS_HIGH = [
  // UK-style
  "festival", "market", "concert", "exhibition",
  "workshop", "open day", "free entry", "tickets",
  "screening", "performance", "gig", "live music",
  "fundraiser", "charity walk", "fun run", "fair",
  "carnival", "parade", "ceremony", "launch event",
  "community event", "open mic", "quiz night",
  "pop-up", "pop up", "art show", "comedy night",
  // US-style
  "grand opening", "block party", "street fair",
  "farmers market", "farmer's market", "open house",
  "ribbon cutting", "free concert", "street festival",
  "neighborhood festival", "community festival",
  "trunk-or-treat", "holiday market", "winter market",
  "summer concert", "outdoor concert", "live performance",
];

/** Medium positive signals — likely an event. +1 each */
const EVENT_KEYWORDS_MEDIUM = [
  // UK-style
  "tonight", "this weekend", "this saturday", "this sunday",
  "join us", "come along", "doors open", "booking",
  "reserve", "register", "sign up", "free admission",
  "limited tickets", "rsvp", "all welcome",
  "happening", "taking place", "hosted by",
  // US-style community/event language
  "opening", "opens this", "grand open",
  "returns this", "returns for", "is back this",
  "kicks off", "kicking off",
  "open to the public", "open to all", "free to attend",
  "you're invited", "you are invited",
  "come join", "come celebrate", "join us for",
  "presented by", "in celebration of",
  "free and open", "no admission",
  "admission is free", "no cover",
  "drop in", "drop-in", "walk-in welcome",
  "limited space", "limited spots", "reserve your spot",
];

/** Hard-exclude patterns — clearly not an event. Returns -100 immediately */
const NON_EVENT_KEYWORDS = [
  "stabbing", "murder", "arrested", "police", "crime",
  "planning application", "planning permission",
  "obituary", "died", "death", "funeral",
  "road closure notice", "traffic update",
  "council meeting agenda", "election results",
  "weather warning", "flood alert",
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Scores an RSS item for event relevance.
 *  >= 3  → strong event signal  (type: "event")
 *   1–2  → weak event signal    (type: "recommendation")
 *  <= 0  → not an event, discard
 * -100   → hard-excluded (crime, deaths, planning notices etc.)
 *
 * Never throws — returns 0 on any error.
 */
export function scoreItem(item: {
  title?: string;
  description?: string;
  content?: string;
}): number {
  try {
    const title = (item.title ?? "").toLowerCase();
    const desc  = (item.description ?? item.content ?? "").toLowerCase();
    const text  = `${title} ${desc}`;

    // Hard-exclude non-events immediately
    for (const kw of NON_EVENT_KEYWORDS) {
      if (text.includes(kw)) return -100;
    }

    let score = 0;

    for (const kw of EVENT_KEYWORDS_HIGH)   { if (text.includes(kw)) score += 3; }
    for (const kw of EVENT_KEYWORDS_MEDIUM) { if (text.includes(kw)) score += 1; }

    // Bonus: day-of-week + date number  e.g. "Sat 14"
    if (/\b(mon|tue|wed|thu|fri|sat|sun)\w*\s+\d/i.test(text))   score += 2;
    // Bonus: ordinal date + month name  e.g. "14th July"
    if (/\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text)) score += 2;
    // Bonus: time pattern  e.g. "7:30pm"
    if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(text)) score += 2;
    // Bonus: free event
    if (/\bfree\b/i.test(text)) score += 1;

    return score;
  } catch {
    return 0;
  }
}

// ─── Category classification ──────────────────────────────────────────────────

const CATEGORY_MAP: [RegExp, string, string, string][] = [
  [/food|eat|restaur|café|cafe|coffee|drink|pub|bar|market|feast|dine/i,  "Food & Drink", "🍽️", "#D43030"],
  [/music|gig|concert|band|festival|jazz|folk|rap|hip.?hop|DJ|live.act/i, "Music",        "🎸", "#7B5CE0"],
  [/sport|run|marathon|cycle|football|cricket|swim|yoga|fitness|gym/i,    "Sport",        "🏃", "#1A9E98"],
  [/art|exhib|gallery|museum|theatre|theater|film|cinema|dance|ballet/i,  "Arts",         "🎨", "#2D8A6E"],
  [/crime|police|warn|alert|safety|antisocial|incident/i,                 "Alert",        "⚠️", "#C0392B"],
  [/council|planning|develop|housing|consult|gov|policy/i,                "Local Gov",    "🏛️", "#2860C8"],
  [/health|nhs|hospital|clinic|mental|wellbeing/i,                        "Health",       "🏥", "#27AE60"],
  [/school|educat|college|universit|lecture|workshop/i,                   "Education",    "🎓", "#8E44AD"],
  [/communit|volunteer|charity|fundrais|social club/i,                    "Community",    "🤝", "#E67E22"],
  [/transport|bus|tube|train|road|traffic|cycling.route/i,                "Transport",    "🚌", "#7F8C8D"],
  [/outdoor|park|nature|green|garden|hike|walk|trail/i,                   "Outdoors",     "🌳", "#27AE60"],
  [/free\b|freebie|gratis|no.?charge|free.?entry|free.?event/i,           "Free",         "🆓", "#2ECC71"],
];

function classifyText(text: string): { category: string; emoji: string; catColor: string } {
  const lower = text.toLowerCase();
  for (const [re, category, emoji, catColor] of CATEGORY_MAP) {
    if (re.test(lower)) return { category, emoji, catColor };
  }
  return { category: "News", emoji: "📰", catColor: "#2860C8" };
}

// ─── HTML stripping ───────────────────────────────────────────────────────────

export function stripHTML(s: string): string {
  if (!s) return "";
  const decoded = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, "");
  return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function extractEventDate(published: string): string {
  if (!published) return new Date().toISOString().split("T")[0];
  try {
    const d = new Date(published);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function formatDisplayDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch {
    return dateStr;
  }
}

// ─── Venue extraction ─────────────────────────────────────────────────────────

export function extractVenue(description: string, fallback: string): string {
  const match = description.match(/(?:at|@|venue:|location:|held at)\s+([A-Z][^.,\n<]{2,40})/);
  return match ? match[1].trim() : fallback;
}

// ─── Stable numeric ID ────────────────────────────────────────────────────────

function stableId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export type RSSParsedItem = {
  title?: string;
  links?: { url?: string; rel?: string }[];
  id?: string;
  imageUrl?: string;
  description?: string;
  content?: string;
  categories?: { name?: string }[];
  published?: string;
  enclosures?: { url?: string; mimeType?: string }[];
};

/**
 * Converts a raw RSS item + source metadata into an EventItem.
 *
 * Returns null when the item is not event-like enough (score < 1),
 * so callers must filter: .filter((x): x is EventItem => x !== null)
 */
export function parseRSSItem(item: RSSParsedItem, source: RSSSource): EventItem | null {
  // ── Score first — discard non-events ──────────────────────────────────────
  const score = scoreItem(item);

  // Curated sources (type: "event" | "recommendation") bypass the score gate —
  // the publisher is trusted to only produce relevant content.
  // "auto" sources (local news sites) still require score >= 1 so that pure
  // news articles (crime, planning, weather) are filtered out.
  const isCurated = source.type === "event" || source.type === "recommendation";
  if (!isCurated && score < 1) return null;

  // Hard-excluded items (-100) are always dropped regardless of source type.
  if (score <= -50) return null;

  // ── Extract raw fields ────────────────────────────────────────────────────
  const title   = stripHTML(item.title ?? "Untitled");
  const rawDesc = item.description ?? item.content ?? "";
  const rawStripped = stripHTML(rawDesc).slice(0, 300);
  // Some feeds set description to the article URL — clear it if so
  const desc    = /^https?:\/\/\S{10,}$/.test(rawStripped.trim()) ? "" : rawStripped;
  const url     = item.links?.[0]?.url ?? "";
  const date    = extractEventDate(item.published ?? "");
  const catName = item.categories?.[0]?.name ?? "";

  // ── Category & colour — source overrides take precedence ─────────────────
  const classified = classifyText(`${title} ${desc} ${catName}`);
  const category = classified.category;
  const catColor = source.catColor ?? classified.catColor;
  const catDot   = source.catDot   ?? (catColor + "BB");

  // ── Emoji — source override takes precedence ──────────────────────────────
  const imgFromEnclosure = item.enclosures?.find(e => e.mimeType?.startsWith("image/"))?.url;
  const img = source.img ?? item.imageUrl ?? imgFromEnclosure ?? classified.emoji;

  // ── Event type — source.type "auto" defers to score ──────────────────────
  const eventType: EventItem["type"] =
    source.type === "event"          ? "event"
    : source.type === "recommendation" ? "recommendation"
    : score >= 3                       ? "event"
    :                                    "recommendation";

  const tags = [catName, source.category !== "News" ? source.category : ""]
    .filter((v): v is string => Boolean(v) && v !== category)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);

  return {
    id:        stableId("rss-" + (url || item.id || title)),
    type:      eventType,
    title,
    desc,
    time:      formatDisplayDate(date),
    location:  extractVenue(desc, source.name),
    date,
    source:    source.name,
    sourceUrl: url || undefined,
    category,
    catColor,
    catDot,
    saves:     0,
    img,
    booking:   url ? { label: "Read more", url, affiliate: false } : null,
    tags:      tags.length > 0 ? tags : undefined,
  };
}
