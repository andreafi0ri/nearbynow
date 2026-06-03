// src/services/lititzEventsService.ts
//
// Pulls community events from lititzpa.com (a Squarespace events collection)
// via the /api/lititz-events Vercel proxy. The proxy fetches the Squarespace
// ?format=json endpoint server-side (Squarespace sends no CORS headers and
// the public proxy chain receives an empty payload).
//
// Returns EventItem[] mapped from the upcoming[] events. Fires only for
// Lititz areas — wired in feedService behind an isLititz gate, mirroring
// the Visit Lancaster integration.

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

// Web resolves the relative path against the same origin; native has no
// document origin so it uses the absolute production URL.
const PROXY_BASE = Platform.OS === "web" ? "" : "https://www.nearbyandnow.com";

type LititzLocation = {
  addressTitle?: string;
  addressLine1?: string;
  addressLine2?: string;
  mapLat?: number;
  mapLng?: number;
};

type LititzEvent = {
  id:         string;
  title:      string;
  startDate:  number;   // ms timestamp
  endDate?:   number;
  fullUrl:    string;
  assetUrl?:  string;
  excerpt?:   string;
  tags?:      string[];
  categories?: string[];
  location?:  LititzLocation | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHTML(s: string): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

/** "Sat 2:00 PM" style label from a ms timestamp. */
function formatTime(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "See event";
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const time    = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday} ${time}`;
}

const fmtDate = (ms: number) => new Date(ms).toISOString().split("T")[0];

// Category classification from title + tags + categories text.
function classify(text: string): { category: string; catColor: string; catDot: string; img: string } {
  const t = text.toLowerCase();
  if (/music|concert|jazz|band|live|jam/.test(t))            return { category: "Music",        catColor: "#7B5CE0", catDot: "#A688FF", img: "🎸" };
  if (/food|taste|dinner|brunch|beer|wine|whiskey|sip/.test(t)) return { category: "Food & Drink", catColor: "#D43030", catDot: "#FF6B6B", img: "🍽️" };
  if (/art|gallery|craft|stitch|exhibit|paint/.test(t))      return { category: "Arts",         catColor: "#2D8A6E", catDot: "#34A882", img: "🎨" };
  if (/run|race|yoga|walk|hike|bike|sport|fitness/.test(t))  return { category: "Sport",        catColor: "#1A9E98", catDot: "#3ABFB8", img: "🏃" };
  if (/market|yard sale|festival|fair|pride|founders/.test(t)) return { category: "Community",    catColor: "#E67E22", catDot: "#F0913E", img: "🤝" };
  if (/story|kids|children|family/.test(t))                  return { category: "Community",    catColor: "#E67E22", catDot: "#F0913E", img: "👨‍👩‍👧" };
  return { category: "Events", catColor: "#2860C8", catDot: "#5A90F8", img: "📍" };
}

function mapEvent(ev: LititzEvent): EventItem | null {
  if (!ev.title || !ev.startDate) return null;

  const classified = classify(`${ev.title} ${(ev.tags ?? []).join(" ")} ${(ev.categories ?? []).join(" ")}`);
  const date     = fmtDate(ev.startDate);
  const url      = ev.fullUrl ? `https://lititzpa.com${ev.fullUrl}` : "https://lititzpa.com/events";
  const loc      = ev.location;
  const location = [loc?.addressTitle, loc?.addressLine1].filter(Boolean).join(", ") || "Lititz, PA";
  const desc     = stripHTML(ev.excerpt ?? "").slice(0, 200) || `${classified.category} in Lititz`;

  return {
    id:        stableId("lititz-" + ev.id),
    type:      "event",
    title:     ev.title.slice(0, 80),
    desc,
    time:      formatTime(ev.startDate),
    date,
    startIso:  new Date(ev.startDate).toISOString(),
    endIso:    ev.endDate ? new Date(ev.endDate).toISOString() : undefined,
    location,
    lat:       loc?.mapLat,
    lng:       loc?.mapLng,
    source:    "Lititz PA",
    sourceUrl: url,
    category:  classified.category,
    catColor:  classified.catColor,
    catDot:    classified.catDot,
    saves:     0,
    img:       classified.img,
    booking:   { label: "Event details", url, affiliate: false },
    tags:      (ev.tags ?? []).slice(0, 3),
    imageUrl:  ev.assetUrl || undefined,
    isCanceled: false,
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cached: EventItem[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 30 * 60 * 1_000; // 30 minutes

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches upcoming Lititz PA community events from lititzpa.com via the proxy.
 * Returns [] on any failure so the feed always renders.
 */
export async function fetchLititzEvents(): Promise<EventItem[]> {
  if (cached && cacheExpiry > Date.now()) {
    console.log(`[Lititz] cache hit — ${cached.length} events`);
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${PROXY_BASE}/api/lititz-events`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[Lititz] proxy returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const events: LititzEvent[] = data.events ?? [];

    const items = events
      .map(mapEvent)
      .filter((x): x is EventItem => x !== null);

    console.log(`[Lititz] ${items.length} events`);
    cached = items;
    cacheExpiry = Date.now() + CACHE_TTL;
    return items;
  } catch (err: any) {
    clearTimeout(timer);
    console.warn("[Lititz] fetch failed:", err.message);
    return [];
  }
}
