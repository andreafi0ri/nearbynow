// src/services/figLancasterService.ts
//
// FIG Lancaster (figlancaster.com) — the main Lancaster events aggregator,
// a WordPress site running The Events Calendar (TEC) plugin. TEC exposes a
// clean public REST API with full structured data (322+ events): title,
// start/end, venue, cost, image, categories.
//
// Endpoint: /wp-json/tribe/events/v1/events
// CORS: the server reflects our Origin, so the web client calls it directly —
// no Vercel proxy needed (native has no CORS restriction either).
//
// Wired behind the isLancaster gate in feedService (Lancaster areas only).

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

// figlancaster.com blocks cross-origin requests — route through Vercel proxy on web.
const ENDPOINT = Platform.OS === "web"
  ? "/api/fig-lancaster"
  : "https://figlancaster.com/wp-json/tribe/events/v1/events";

// ─── TEC REST types (subset we use) ─────────────────────────────────────────────

type TecImage = { url?: string } | string | null;

type TecVenue = {
  venue?:   string;
  address?: string;
  city?:    string;
  state?:   string;
  geo_lat?: number | string;
  geo_lng?: number | string;
};

type TecCategory = { name?: string };

type TecEvent = {
  id:          number;
  title:       string;
  start_date:  string;   // "2026-06-04 09:30:00" (local)
  end_date?:   string;
  url:         string;
  cost?:       string;
  excerpt?:    string;
  description?: string;
  image?:      TecImage;
  venue?:      TecVenue | TecVenue[];
  categories?: TecCategory[];
  status?:     string;
};

type TecResponse = { events?: TecEvent[]; total?: number };

// ─── Helpers ────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#0?38;|&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#0?34;|&quot;/gi, '"')
    .replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘")
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function stripHTML(s: string): string {
  return decodeEntities((s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function stableId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_147_483_647;
}

function formatTime(localDateTime: string): string {
  // "2026-06-04 09:30:00" → "Thu 9:30 AM"
  const d = new Date(localDateTime.replace(" ", "T"));
  if (isNaN(d.getTime())) return "See event";
  const day  = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day} ${time}`;
}

function imageUrlOf(image: TecImage | undefined): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image || undefined;
  return image.url || undefined;
}

function firstVenue(v: TecEvent["venue"]): TecVenue | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function classify(text: string): { category: string; catColor: string; catDot: string; img: string } {
  const t = text.toLowerCase();
  if (/music|concert|jazz|band|live|dj|karaoke/.test(t))        return { category: "Music",        catColor: "#7B5CE0", catDot: "#A688FF", img: "🎸" };
  if (/food|dining|tasting|beer|wine|brunch|market|maker/.test(t)) return { category: "Food & Drink", catColor: "#D43030", catDot: "#FF6B6B", img: "🍽️" };
  if (/art|gallery|exhibit|craft|paint|unframed|story/.test(t)) return { category: "Arts",         catColor: "#2D8A6E", catDot: "#34A882", img: "🎨" };
  if (/class|education|workshop|lecture|seminar|learn/.test(t)) return { category: "Education",    catColor: "#8E44AD", catDot: "#A569BD", img: "🎓" };
  if (/run|race|yoga|fitness|hike|bike|sport/.test(t))         return { category: "Sport",        catColor: "#1A9E98", catDot: "#3ABFB8", img: "🏃" };
  if (/festival|fair|fest|parade|celebration|pride/.test(t))   return { category: "Community",    catColor: "#E67E22", catDot: "#F0913E", img: "🎪" };
  return { category: "Events", catColor: "#2860C8", catDot: "#5A90F8", img: "📍" };
}

// ─── Mapper ─────────────────────────────────────────────────────────────────────

function mapTecEvent(ev: TecEvent): EventItem | null {
  if (!ev.title || !ev.start_date) return null;
  if (ev.status && ev.status !== "publish") return null;

  const title    = decodeEntities(ev.title).slice(0, 80);
  const venue    = firstVenue(ev.venue);
  const cats     = (ev.categories ?? []).map(c => decodeEntities(c.name ?? "")).filter(Boolean);
  const classified = classify(`${title} ${cats.join(" ")}`);

  const date     = ev.start_date.split(" ")[0];
  const location = [venue?.venue, venue?.address, venue?.city, venue?.state]
    .map(p => p ? decodeEntities(p) : "").filter(Boolean).join(", ") || "Lancaster, PA";

  const lat = venue?.geo_lat != null ? Number(venue.geo_lat) : undefined;
  const lng = venue?.geo_lng != null ? Number(venue.geo_lng) : undefined;

  const cost   = ev.cost ? decodeEntities(ev.cost) : "";
  const desc   = stripHTML(ev.excerpt || ev.description || "").slice(0, 200)
    || [classified.category, venue?.venue ? decodeEntities(venue.venue) : null, cost].filter(Boolean).join(" · ");

  const tags = [cats[0] || null, cost && /free/i.test(cost) ? "Free" : (cost || null)]
    .filter((t): t is string => Boolean(t)).slice(0, 3);

  return {
    id:        stableId("fig-" + ev.id),
    type:      "event",
    title,
    desc,
    time:      formatTime(ev.start_date),
    date,
    startIso:  ev.start_date.replace(" ", "T"),
    endIso:    ev.end_date ? ev.end_date.replace(" ", "T") : undefined,
    location,
    lat:       lat != null && !isNaN(lat) ? lat : undefined,
    lng:       lng != null && !isNaN(lng) ? lng : undefined,
    source:    "FIG Lancaster",
    sourceUrl: ev.url,
    category:  classified.category,
    catColor:  classified.catColor,
    catDot:    classified.catDot,
    saves:     0,
    img:       classified.img,
    booking:   { label: "Event details", url: ev.url, affiliate: false },
    tags:      tags.length > 0 ? tags : undefined,
    imageUrl:  imageUrlOf(ev.image),
    isCanceled: false,
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cached: EventItem[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 60 * 1_000; // 1 hour

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * Fetches upcoming Lancaster events from FIG Lancaster's The Events Calendar
 * REST API (directly — the endpoint allows CORS for our origin). Pulls the
 * next 30 days, up to 30 events. Returns [] on any failure so the feed renders.
 */
export async function fetchFigLancasterEvents(): Promise<EventItem[]> {
  if (cached && cacheExpiry > Date.now()) {
    console.log(`[FIG] cache hit — ${cached.length} events`);
    return cached;
  }

  const today = new Date().toISOString().split("T")[0];
  const end   = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];
  const params = new URLSearchParams({
    per_page:   "30",
    start_date: today,
    end_date:   end,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[FIG] API returned ${res.status}`);
      return [];
    }

    const data: TecResponse = await res.json();
    const items = (data.events ?? [])
      .map(mapTecEvent)
      .filter((x): x is EventItem => x !== null);

    console.log(`[FIG] ${items.length} events (of ${data.total ?? "?"} total)`);
    cached = items;
    cacheExpiry = Date.now() + CACHE_TTL;
    return items;
  } catch (err: any) {
    clearTimeout(timer);
    console.warn("[FIG] fetch failed:", err.message);
    return [];
  }
}
