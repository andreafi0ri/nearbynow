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
  // Venue / arts events
  "opening night", "opening reception", "preview night",
  "late night", "family day", "drop in", "drop-in",
  "come along", "join us", "doors open", "doors at",
  "starts at", "begins at", "admission", "free admission",
  "tickets available", "book now", "book tickets", "reserve your",
  "limited spaces", "last few tickets",
  "panel", "talk", "lecture", "symposium",
  "hackathon", "popup", "residency",
  "season opening", "closing night", "final week",
  "all welcome", "everyone welcome",
  "kids welcome", "child friendly", "family friendly",
  "guided tour", "walking tour", "bike tour",
  "tasting", "wine tasting", "beer tasting",
  "open studio", "studio sale", "art sale",
  "charity event", "fundraiser", "gala",
  "awards", "graduation",
  "street party", "trunk show", "sample sale", "flash sale",
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

// ─── Hard-exclude keyword lists ───────────────────────────────────────────────

/**
 * Always-excluded regardless of source type.
 * These unambiguously signal non-event content involving death or crime.
 */
const NON_EVENT_CRITICAL = [
  "stabbing", "murder", "shooting", "robbery", "assault", "arrested",
  "obituary", "died", "funeral",
];

/**
 * Excluded for auto sources only.
 * Curated arts/events sites almost never publish these, so we omit the
 * check to avoid false positives on edge cases (e.g. "open house" vs
 * "planning application" on an arts site).
 */
const NON_EVENT_AUTO = [
  "police", "crime", "death",
  "planning application", "planning permission",
  "road closure notice", "traffic update",
  "council meeting agenda", "election results",
  "weather warning", "flood alert",
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Scores an RSS item for event relevance.
 *  >= 3  → strong event signal  (type: "event")
 *   1–2  → weak event signal    (type: "recommendation")
 *  <= 0  → not an event, discard (auto sources)
 *  >= -1 → passes for curated sources (one free miss)
 * -100   → hard-excluded
 *
 * @param item      RSS item with title/description/content fields
 * @param isCurated True for sources with type "event" or "recommendation"
 *                  — skips the auto-only excludes and lowers the pass threshold
 *
 * Never throws — returns 0 on any error.
 */
export function scoreItem(
  item: { title?: string; description?: string; content?: string },
  isCurated = false
): number {
  try {
    const title = (item.title ?? "").toLowerCase();
    const desc  = (item.description ?? item.content ?? "").toLowerCase();
    const text  = `${title} ${desc}`;

    // Critical hard-excludes always apply (crime / death)
    for (const kw of NON_EVENT_CRITICAL) {
      if (text.includes(kw)) return -100;
    }

    // Auto-source-only hard-excludes (planning, traffic, elections etc.)
    if (!isCurated) {
      for (const kw of NON_EVENT_AUTO) {
        if (text.includes(kw)) return -100;
      }
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

// ─── Date extraction helpers ──────────────────────────────────────────────────

const MONTH_ABBRS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const DAY_ABBRS   = ["sun","mon","tue","wed","thu","fri","sat"];

/** Returns 0–11 for a month name (full or abbreviated), -1 if not recognised. */
function parseMonthName(s: string): number {
  return MONTH_ABBRS.indexOf(s.slice(0, 3).toLowerCase());
}

/** Returns 0–6 (Sun–Sat) for a day name (full or abbreviated), -1 if not recognised. */
function parseDayName(s: string): number {
  return DAY_ABBRS.indexOf(s.slice(0, 3).toLowerCase());
}

/** Next occurrence of a given weekday. Same day of week → returns next week. */
function upcomingDay(targetDay: number): Date {
  const d = new Date();
  const diff = (targetDay - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** The occurrence of a weekday in the week AFTER the next one ("next Friday"). */
function nextWeekDay(targetDay: number): Date {
  const d = upcomingDay(targetDay);
  d.setDate(d.getDate() + 7);
  return d;
}

function toYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Shared regex fragments
const M = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const W = "(?:sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)";
const O = "(?:st|nd|rd|th)?";   // ordinal suffix

// ─── Event date extraction ────────────────────────────────────────────────────

/**
 * Attempts to extract the actual event date from title + description text,
 * falling back to pubDate only if no date pattern is found.
 *
 * // Date extraction priority: article body > title > pubDate
 * // pubDate is when the article was published, not when
 * // the event happens — these are often weeks apart.
 *
 * Extracted dates are discarded when:
 *   - More than 90 days in the future  (likely a different context / year)
 *   - More than 14 days in the past    (stale event reference)
 *
 * @param title       RSS item title (already HTML-stripped)
 * @param description RSS item description (already HTML-stripped)
 * @param pubDate     RSS pubDate string — used as fallback only
 */
export function extractEventDate(
  title: string,
  description: string,
  pubDate: string
): string {
  const text = `${title} ${description}`;
  const today = new Date();
  const now   = today.getTime();
  const MAX_FUTURE_MS = 90  * 86_400_000;
  const MAX_PAST_MS   = 14  * 86_400_000;

  /** Returns YYYY-MM-DD if d is within the valid window, else null. */
  function validate(d: Date): string | null {
    if (isNaN(d.getTime())) return null;
    const t = d.getTime();
    if (t > now + MAX_FUTURE_MS) return null;
    if (t < now - MAX_PAST_MS)   return null;
    return toYMD(d);
  }

  let m: RegExpExecArray | null;

  // 1. "Saturday, July 12, 2026"  or  "Saturday July 12"
  m = new RegExp(`${W}[,\\s]+(${M})\\s+(\\d{1,2})${O}(?:[,\\s]+(\\d{4}))?`, "i").exec(text);
  if (m) {
    const mon  = parseMonthName(m[1]);
    const day  = parseInt(m[2]);
    const year = m[3] ? parseInt(m[3]) : today.getFullYear();
    const r = validate(new Date(year, mon, day));
    if (r) return r;
  }

  // 2. "July 12, 2026"  or  "July 12th, 2026"
  m = new RegExp(`(${M})\\s+(\\d{1,2})${O}[,\\s]+(\\d{4})`, "i").exec(text);
  if (m) {
    const mon  = parseMonthName(m[1]);
    const day  = parseInt(m[2]);
    const year = parseInt(m[3]);
    const r = validate(new Date(year, mon, day));
    if (r) return r;
  }

  // 3. "12 July 2026"  or  "12th July 2026"
  m = new RegExp(`(\\d{1,2})${O}\\s+(${M})\\s+(\\d{4})`, "i").exec(text);
  if (m) {
    const day  = parseInt(m[1]);
    const mon  = parseMonthName(m[2]);
    const year = parseInt(m[3]);
    const r = validate(new Date(year, mon, day));
    if (r) return r;
  }

  // 4. MM/DD/YYYY  or  MM/DD/YY
  m = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/.exec(text);
  if (m) {
    const mon  = parseInt(m[1]) - 1;
    const day  = parseInt(m[2]);
    let   year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const r = validate(new Date(year, mon, day));
    if (r) return r;
  }

  // 5. "July 12"  or  "July 12th"  (no year — roll to next year if past)
  m = new RegExp(`(${M})\\s+(\\d{1,2})${O}`, "i").exec(text);
  if (m) {
    const mon = parseMonthName(m[1]);
    const day = parseInt(m[2]);
    let d     = new Date(today.getFullYear(), mon, day);
    if (d.getTime() < now - 86_400_000) d = new Date(today.getFullYear() + 1, mon, day);
    const r = validate(d);
    if (r) return r;
  }

  // 6. "12 July"  or  "12th July"  (no year — roll to next year if past)
  m = new RegExp(`(\\d{1,2})${O}\\s+(${M})`, "i").exec(text);
  if (m) {
    const day = parseInt(m[1]);
    const mon = parseMonthName(m[2]);
    let d     = new Date(today.getFullYear(), mon, day);
    if (d.getTime() < now - 86_400_000) d = new Date(today.getFullYear() + 1, mon, day);
    const r = validate(d);
    if (r) return r;
  }

  // 7. "this Saturday"  (within current week, or today if same day)
  m = new RegExp(`\\bthis\\s+(${W})`, "i").exec(text);
  if (m) {
    const dayIdx = parseDayName(m[1]);
    if (dayIdx >= 0) {
      const d    = new Date(today);
      const diff = (dayIdx - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + diff);
      const r = validate(d);
      if (r) return r;
    }
  }

  // 8. "next Friday"  (the occurrence in the following week)
  m = new RegExp(`\\bnext\\s+(${W})`, "i").exec(text);
  if (m) {
    const dayIdx = parseDayName(m[1]);
    if (dayIdx >= 0) {
      const r = validate(nextWeekDay(dayIdx));
      if (r) return r;
    }
  }

  // 9. "tomorrow"
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    const r = validate(d);
    if (r) return r;
  }

  // 10. "tonight"
  if (/\btonight\b/i.test(text)) {
    const r = validate(new Date(today));
    if (r) return r;
  }

  // 11. Bare weekday: "Saturday" or "Friday night"  (last resort, most ambiguous)
  m = new RegExp(`\\b(${W})(?:\\s+(?:night|evening|morning|afternoon))?\\b`, "i").exec(text);
  if (m) {
    const dayIdx = parseDayName(m[1]);
    if (dayIdx >= 0) {
      const r = validate(upcomingDay(dayIdx));
      if (r) return r;
    }
  }

  // Fallback: pubDate
  if (!pubDate) return toYMD(today);
  try {
    const d = new Date(pubDate);
    return isNaN(d.getTime()) ? toYMD(today) : toYMD(d);
  } catch {
    return toYMD(today);
  }
}

// ─── Display date formatter ───────────────────────────────────────────────────

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

/**
 * City/neighbourhood fallback when no venue pattern matches.
 * Never exposes the source name (e.g. "Bklyner") as a location.
 */
const AREA_TO_CITY: Record<string, string> = {
  brooklyn:   "Brooklyn, NY",
  nyc:        "New York, NY",
  manhattan:  "New York, NY",
  queens:     "Queens, NY",
  bronx:      "The Bronx, NY",
  lancaster:  "Lancaster, PA",
  london:     "London, UK",
  brixton:    "Brixton, London",
  lambeth:    "Lambeth, London",
  hackney:    "Hackney, London",
  southwark:  "Southwark, London",
  camden:     "Camden, London",
  islington:  "Islington, London",
  chicago:    "Chicago, IL",
  "los angeles": "Los Angeles, CA",
  "san francisco": "San Francisco, CA",
  nashville:  "Nashville, TN",
  austin:     "Austin, TX",
  boston:     "Boston, MA",
  seattle:    "Seattle, WA",
  denver:     "Denver, CO",
  miami:      "Miami, FL",
  washington: "Washington, DC",
  philadelphia: "Philadelphia, PA",
  portland:   "Portland, OR",
};

/**
 * Extracts a venue or location from RSS item description.
 *
 * Priority:
 *   1. Explicit "at …" / "venue: …" / "held at …" pattern in text
 *   2. Street address pattern
 *   3. City from AREA_TO_CITY map for the source area
 *   4. Source area keyword (last resort — never source.name)
 */
export function extractVenue(description: string, sourceArea: string): string {
  const patterns: RegExp[] = [
    /\bat\s+(?:the\s+)?([A-Z][^,.!?\n]{3,40})/,
    /\bvenue[:\s]+([A-Z][^,.!?\n]{3,40})/i,
    /\blocation[:\s]+([A-Z][^,.!?\n]{3,40})/i,
    /\btaking place at\s+([A-Z][^,.!?\n]{3,40})/i,
    /\bheld at\s+(?:the\s+)?([A-Z][^,.!?\n]{3,40})/i,
    /\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Blvd|Lane|Dr|Pl|Way|Pkwy))\b/,
  ];

  for (const re of patterns) {
    const m = description.match(re);
    if (m?.[1]) return m[1].trim();
  }

  return AREA_TO_CITY[sourceArea.toLowerCase()] ?? sourceArea;
}

// ─── RSS image extraction ─────────────────────────────────────────────────────

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) ||
    url.includes("/image/") ||
    url.includes("/photo/") ||
    url.includes("/img/");
}

/**
 * Extracts the first usable image URL from an RSS item.
 * Checks (in order): enclosure, imageUrl field, first <img> in description HTML.
 */
function extractRSSImage(item: RSSParsedItem): string | undefined {
  // Enclosure (e.g. <enclosure url="..." type="image/jpeg"/>)
  const enc = item.enclosures?.find(e => e.mimeType?.startsWith("image/"))?.url;
  if (enc && isImageUrl(enc)) return enc;

  // imageUrl field (react-native-rss-parser extracts <media:content> here)
  if (item.imageUrl && isImageUrl(item.imageUrl)) return item.imageUrl;

  // First <img src="..."> in the description HTML
  const raw = typeof item.description === "string" ? item.description : "";
  const m = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m?.[1] && isImageUrl(m[1])) return m[1];

  return undefined;
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
 * Returns null when the item is not event-like enough:
 *   - Auto sources: score < 1
 *   - Curated sources (type "event" | "recommendation"): score < -1
 *   - Any source: score <= -50 (hard-excluded crime / death content)
 *
 * Callers must filter: .filter((x): x is EventItem => x !== null)
 */
export function parseRSSItem(item: RSSParsedItem, source: RSSSource): EventItem | null {
  const isCurated = source.type === "event" || source.type === "recommendation";

  // ── Score — discard non-events ────────────────────────────────────────────
  const score = scoreItem(item, isCurated);

  // Hard-excluded items (-100) are always dropped
  if (score <= -50) return null;

  // Curated sources: allow score >= -1 (one free miss before discard)
  // Auto sources: require score >= 1
  if (isCurated  && score < -1) return null;
  if (!isCurated && score < 1)  return null;

  // ── Extract raw fields ────────────────────────────────────────────────────
  const title      = stripHTML(item.title ?? "Untitled");
  const rawDesc    = item.description ?? item.content ?? "";
  const rawStripped = stripHTML(rawDesc).slice(0, 300);
  // Some feeds set description to the article URL — clear it if so
  const desc       = /^https?:\/\/\S{10,}$/.test(rawStripped.trim()) ? "" : rawStripped;
  const url        = item.links?.[0]?.url ?? "";
  const catName    = item.categories?.[0]?.name ?? "";

  // Date extraction priority: article body > title > pubDate
  // pubDate is when the article was published, not when
  // the event happens — these are often weeks apart.
  const date = extractEventDate(title, rawStripped, item.published ?? "");

  // ── Category & colour — source overrides take precedence ─────────────────
  const classified = classifyText(`${title} ${desc} ${catName}`);
  const category   = classified.category;
  const catColor   = source.catColor ?? classified.catColor;
  const catDot     = source.catDot   ?? (catColor + "BB");

  // ── Emoji — source override takes precedence ──────────────────────────────
  const imgFromEnclosure = item.enclosures?.find(e => e.mimeType?.startsWith("image/"))?.url;
  const img = source.img ?? item.imageUrl ?? imgFromEnclosure ?? classified.emoji;

  // ── Event type — source.type "auto" defers to score ──────────────────────
  const eventType: EventItem["type"] =
    source.type === "event"           ? "event"
    : source.type === "recommendation" ? "recommendation"
    : score >= 3                        ? "event"
    :                                     "recommendation";

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
    location:  extractVenue(desc, source.area),
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
    imageUrl:  extractRSSImage(item),
  };
}
