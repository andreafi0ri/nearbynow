// src/services/viatorService.ts
//
// Viator Affiliate API — Tours, experiences & attractions
// Zero API cost — completely free to call
// Revenue: 8% commission on completed bookings
// Affiliate dashboard: https://www.viator.com/partner/reports
// API docs: https://docs.viator.com/partner-api/merchant/

import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViatorTag = {
  tagId?: number;
  tagName?: string;
  name?: string;
};

type ViatorDuration = {
  fixedDurationInMinutes?: number;
  variableDurationFromMinutes?: number;
  variableDurationToMinutes?: number;
};

type ViatorReviews = {
  combinedAverageRating?: number;
  totalReviews?: number;
};

type ViatorProduct = {
  productCode: string;
  title: string;
  description?: string;
  productUrl: string;
  duration?: ViatorDuration;
  reviews?: ViatorReviews;
  tags?: ViatorTag[];
  location?: {
    address?: string;
    coordinates?: { lat?: number; lng?: number };
  };
  destinations?: { name: string }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NATIVE_BASE = "https://api.viator.com/partner";

// On web requests go through dedicated Vercel proxy functions (CORS workaround).
function viatorURL(path: "search/freetext" | "products/search"): string {
  if (Platform.OS !== "web") return `${NATIVE_BASE}/${path}`;
  if (path === "search/freetext") return "/api/viator-search";
  return "/api/viator-products";
}

// Read lazily inside each function — module-level constants bake the value in at
// Metro bundle time. Reading inside the function ensures the live .env value is
// always used after an `expo start --clear`.
function getApiKey(): string {
  return process.env.EXPO_PUBLIC_VIATOR_API_KEY ?? "";
}

function buildHeaders(): Record<string, string> {
  if (Platform.OS === "web") {
    // On web, requests go through the /api/viator proxy which adds the API key
    // server-side. Sending it from the browser is unnecessary.
    return {
      "Content-Type": "application/json",
      "Accept":       "application/json;version=2.0",
    };
  }
  return {
    "exp-api-key":     getApiKey(),
    "Accept-Language": "en-US",
    "Content-Type":    "application/json",
    "Accept":          "application/json;version=2.0",
  };
}

// ─── Destination ID cache ─────────────────────────────────────────────────────

type CacheEntry = { destId: string; expiresAt: number };
const destIdCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Date helpers ─────────────────────────────────────────────────────────────

const fmt     = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// ─── Fetch with timeout ───────────────────────────────────────────────────────

async function viatorFetch(url: string, body: object): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: buildHeaders(),
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => "");
      throw new Error(`VIATOR_AUTH_FAILED: HTTP ${res.status} — API key rejected. Check https://www.viator.com/partner — raw: ${text}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Viator HTTP ${res.status}: ${text}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── HTML stripper ────────────────────────────────────────────────────────────

function stripHTML(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/\s+/g,    " ")
    .trim();
}

// ─── Destination ID resolution ────────────────────────────────────────────────

async function getDestinationId(area: string): Promise<number | null> {
  const key = area.toLowerCase().trim();

  // Return cached value if still fresh
  const cached = destIdCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Number(cached.destId);

  try {
    // Pagination must be nested inside searchTypes, not at the top level
    const data = await viatorFetch(viatorURL("search/freetext"), {
      searchTerm:  area,
      searchTypes: [{ searchType: "DESTINATIONS", pagination: { start: 1, count: 1 } }],
      currency:    "USD",
    }) as Record<string, unknown>;

    // Destination ID is at results[0].id (integer), not destination.ref
    const results = (data?.destinations as Record<string, unknown>)?.results as Record<string, unknown>[] | undefined;
    const id = results?.[0]?.id;

    if (!id) {
      console.warn(`[Viator] No destination id in response for "${area}". Keys:`, Object.keys(data ?? {}));
      return null;
    }

    const destId = Number(id);
    destIdCache.set(key, { destId: String(destId), expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(`[Viator] Resolved "${area}" → destId ${destId}`);
    return destId;
  } catch (err) {
    const msg = String(err);
    if (msg.includes("VIATOR_AUTH_FAILED")) {
      console.error("[Viator] ❌ API key rejected — update EXPO_PUBLIC_VIATOR_API_KEY in .env\n", msg);
    } else {
      console.warn("[Viator] getDestinationId failed:", err);
    }
    return null;
  }
}

// ─── Category helpers ─────────────────────────────────────────────────────────
// Note: Viator tags[] are integer IDs (e.g. [11938, 20757]) — no text names.
// We classify using the product title and description instead.

function classifyText(product: ViatorProduct): string {
  const text = `${product.title} ${product.description ?? ""}`.toLowerCase();
  if (/food|dining|culinary|cooking|drink|wine|beer|tasting|restaurant/.test(text))
    return "Food & Drink";
  if (/art|museum|gallery|theatre|theater|culture|history|heritage|architecture/.test(text))
    return "Culture";
  if (/outdoor|hiking|sport|bike|kayak|surf|active|fitness|sailing|kayaking/.test(text))
    return "Sport";
  if (/music|concert|show|performance|jazz|blues/.test(text))
    return "Music";
  return "Events";
}

function mapViatorCategory(product: ViatorProduct): string {
  return classifyText(product);
}

function mapViatorCatColor(product: ViatorProduct): string {
  switch (classifyText(product)) {
    case "Food & Drink": return "#D43030";
    case "Culture":      return "#B8920A";
    case "Sport":        return "#1A9E98";
    case "Music":        return "#7B5CE0";
    default:             return "#2860C8";
  }
}

function mapViatorCatDot(product: ViatorProduct): string {
  switch (classifyText(product)) {
    case "Food & Drink": return "#FF6B6B";
    case "Culture":      return "#D4A80C";
    case "Sport":        return "#3ABFB8";
    case "Music":        return "#A688FF";
    default:             return "#5A90F8";
  }
}

function mapViatorEmoji(product: ViatorProduct): string {
  const text = `${product.title} ${product.description ?? ""}`.toLowerCase();
  if (/food|dining|culinary|tasting/.test(text))        return "🍽️";
  if (/art|museum|gallery/.test(text))                  return "🎨";
  if (/boat|sail|cruise|water|kayak/.test(text))        return "🚤";
  if (/bike|cycling/.test(text))                        return "🚴";
  if (/outdoor|hiking|nature|park/.test(text))          return "🌿";
  if (/music|concert|jazz|blues/.test(text))            return "🎵";
  if (/history|heritage|gangster|crime|ghost/.test(text)) return "🗺️";
  if (/architecture|skyline|building/.test(text))       return "🏙️";
  if (/sport|active|fitness/.test(text))                return "🏃";
  return "⭐";
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function buildViatorTime(product: ViatorProduct): string {
  const mins     = product.duration?.fixedDurationInMinutes;
  const variable = product.duration?.variableDurationFromMinutes;

  if (mins) {
    if (mins < 60)   return `Activity · ~${mins} min`;
    if (mins < 120)  return "Activity · ~1 hour";
    if (mins < 480)  return `Activity · ~${Math.round(mins / 60)} hours`;
    if (mins < 1440) return "Activity · Half day";
    return "Activity · Full day";
  }
  if (variable) {
    const toMins = product.duration?.variableDurationToMinutes ?? variable * 2;
    return `Activity · ${Math.round(variable / 60)}–${Math.round(toMins / 60)} hours`;
  }
  return "Check availability";
}

// ─── Tags helper ──────────────────────────────────────────────────────────────

function buildViatorTags(product: ViatorProduct): string[] {
  const timeLabel = buildViatorTime(product);
  const price = (product as unknown as { pricing?: { summary?: { fromPrice?: number } } })
    .pricing?.summary?.fromPrice;
  return [
    timeLabel !== "Check availability" ? timeLabel.replace("Activity · ", "") : null,
    (product.reviews?.combinedAverageRating ?? 0) >= 4.8 ? "Top rated" : null,
    (product.reviews?.totalReviews ?? 0) > 1000 ? "1k+ reviews" : null,
    price != null ? `From $${Math.round(price)}` : null,
  ].filter((v): v is string => Boolean(v)).slice(0, 3);
}

// ─── Product → EventItem mapper ───────────────────────────────────────────────

function mapViatorProduct(product: ViatorProduct, area: string): EventItem {
  const now = new Date();
  return {
    id:       Math.abs(
      product.productCode.split("").reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)
    ) % 2_147_483_647,
    type:     "recommendation",
    title:    product.title.slice(0, 80),
    desc:     stripHTML(product.description)?.slice(0, 200) || product.productCode,
    longDesc: stripHTML(product.description)?.slice(0, 600),
    time:     buildViatorTime(product),
    date:     fmt(now),
    startIso: now.toISOString(),
    endIso:   undefined,
    location: product.location?.address
              ?? product.destinations?.[0]?.name
              ?? area,
    lat:      product.location?.coordinates?.lat ?? undefined,
    lng:      product.location?.coordinates?.lng ?? undefined,
    source:   "Viator",
    category: mapViatorCategory(product),
    catColor: mapViatorCatColor(product),
    catDot:   mapViatorCatDot(product),
    saves:    0,
    img:      mapViatorEmoji(product),
    booking:  {
      label:     "Book on Viator",
      url:       `${product.productUrl}?mcid=${getApiKey()}`,
      affiliate: true,
    },
    rating:    product.reviews?.combinedAverageRating ?? undefined,
    reviews:   product.reviews?.totalReviews ?? undefined,
    tags:      buildViatorTags(product),
    showTimes: undefined,
    isCanceled: false,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches highly-rated tours and experiences from the Viator Affiliate API.
 *
 * **When it fires:**
 * This function is only called from feedService when the live event count
 * falls below GOOGLE_PLACES_THRESHOLD (default 5) — the same condition that
 * triggers Google Places. It never runs on every feed load, keeping API usage
 * and latency minimal.
 *
 * **Revenue:**
 * Each booking made via the "Book on Viator" deep-link earns an 8% affiliate
 * commission. The `mcid` query parameter appended to every `productUrl` is what
 * attributes the conversion back to this affiliate account.
 *
 * **Errors:**
 * All failures are caught and return [] so the feed always renders, even if
 * Viator is unreachable.
 *
 * @param area   Human-readable area name e.g. "Chicago, IL" or "Brooklyn, NYC"
 * @param coords Optional coordinates (unused today — destination-ID lookup is
 *               text-based, but kept for future geo-search support)
 */
export async function searchViatorExperiences(
  area: string,
  _coords?: { lat: number; lng: number },
): Promise<EventItem[]> {
  if (Platform.OS === "web") {
    // Web: API calls route through the /api/viator proxy (auth is handled server-side).
    // The EXPO_PUBLIC_VIATOR_API_KEY env var is not needed in the client bundle.
    console.log(`[Viator] searchViatorExperiences called for "${area}" — via server proxy`);
  } else {
    const apiKey = getApiKey();
    console.log(`[Viator] searchViatorExperiences called for "${area}" — key: ${apiKey ? apiKey.slice(0, 8) + "…" : "MISSING"}`);
    if (!apiKey) {
      console.warn("[Viator] ❌ No API key — set EXPO_PUBLIC_VIATOR_API_KEY in .env and restart Metro with --clear");
      return [];
    }
  }

  // Step 1 — Resolve area to a Viator destination ID
  const destId = await getDestinationId(area);
  if (!destId) {
    console.warn(`[Viator] No destination found for "${area}"`);
    return [];
  }

  // Step 2 — Search experiences
  try {
    const data = await viatorFetch(viatorURL("products/search"), {
      filtering: {
        destination: String(destId),
        rating:      { from: 3 },
      },
      sorting: {
        sort:  "TRAVELER_RATING",
        order: "DESCENDING",
      },
      pagination: { start: 1, count: 12 },
      currency: "USD",
    }) as Record<string, unknown>;

    // Viator wraps results in products.results[] — handle both array and object shapes
    const raw = data?.products;
    const products: ViatorProduct[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.results)
        ? (raw as Record<string, unknown>).results as ViatorProduct[]
        : [];

    if (products.length === 0) {
      console.warn(
        `[Viator] Zero products returned for destId ${destId}. ` +
        `Response keys: ${Object.keys(data ?? {}).join(", ")}`
      );
    }

    // Step 3–4 — Map and filter
    const results = products
      .map(p => mapViatorProduct(p, area))
      .filter(item => item.title && item.booking?.url);

    console.log(`[Viator] ${results.length} experiences for "${area}" (destId: ${destId})`);
    return results.slice(0, 12);
  } catch (err) {
    console.warn("[Viator] Search failed:", err);
    return [];
  }
}
