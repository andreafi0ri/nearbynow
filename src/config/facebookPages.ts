// src/config/facebookPages.ts
// Registry of Facebook Pages to pull public events from.
//
// App Review status: ✅ Approved — pages_read_engagement granted.
//
// Token: uses a permanent Page Access Token stored in env vars.
//   EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN must be set in .env.local and Vercel.
//   Generate a never-expiring token at:
//     https://developers.facebook.com/tools/explorer/
//   → Select your app → Generate User Token → Exchange for Page Token
//     → tick "never expire"
//
// Fields:
//   pageId   - Facebook page username or numeric ID
//   name     - Human-readable display name
//   area     - Lowercase keyword matched against the active area string
//   category - Nearby category label shown on the event card

export type FacebookPageEntry = {
  pageId:   string;
  name:     string;
  area:     string;
  category: string;
};

// ─── Token helper ─────────────────────────────────────────────────────────────

/**
 * Returns the Facebook Page Access Token from environment variables.
 * Intended for server-side usage (Vercel functions) only.
 * Do not call this from client-side code — the token should stay server-side.
 *
 * Generate a permanent (never-expiring) token at:
 *   https://developers.facebook.com/tools/explorer/
 * then add it as EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN in Vercel environment variables.
 */
export function getPageToken(): string {
  const token = process.env.EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN;
  if (!token) {
    console.warn(
      "Facebook: no page token in .env — " +
      "add EXPO_PUBLIC_FACEBOOK_PAGE_TOKEN. " +
      "Generate at: developers.facebook.com/tools/explorer"
    );
  }
  return token ?? "";
}

// ─── NYC borough keywords ─────────────────────────────────────────────────────
// Pages with area: "nyc" match any NYC borough, not just "nyc" literally.

const NYC_KEYWORDS = [
  "brooklyn", "new york", "manhattan",
  "queens", "bronx", "staten island", "nyc",
];

// ─── Pages registry ───────────────────────────────────────────────────────────

export const FACEBOOK_PAGES: FacebookPageEntry[] = [

  // ── Brooklyn venues ──────────────────────────────────────────────────────────
  { pageId: "barcadenyc",             name: "Barcade Brooklyn",          area: "brooklyn",  category: "Events"       },
  { pageId: "brooklynbowl",           name: "Brooklyn Bowl",             area: "brooklyn",  category: "Music"        },
  { pageId: "knittingfactory",        name: "Knitting Factory Brooklyn", area: "brooklyn",  category: "Music"        },
  { pageId: "BrooklynMuseum",         name: "Brooklyn Museum",           area: "brooklyn",  category: "Culture"      },
  { pageId: "ProspectParkAlliance",   name: "Prospect Park",             area: "brooklyn",  category: "Events"       },
  { pageId: "SmorgasburgMarkets",     name: "Smorgasburg",               area: "brooklyn",  category: "Food & Drink" },
  { pageId: "BrooklynNightBazaar",    name: "Brooklyn Night Bazaar",     area: "brooklyn",  category: "Events"       },
  { pageId: "BrooklynArmyTerminal",   name: "Brooklyn Army Terminal",    area: "brooklyn",  category: "Events"       },
  { pageId: "theBellhouseny",         name: "The Bell House",            area: "brooklyn",  category: "Music"        },
  { pageId: "babysallrightny",        name: "Baby's All Right",          area: "brooklyn",  category: "Music"        },

  // ── NYC-wide ──────────────────────────────────────────────────────────────────
  { pageId: "nycparks",               name: "NYC Parks",                 area: "nyc",       category: "Events"       },
  { pageId: "TimeOutNewYork",         name: "Time Out New York",         area: "nyc",       category: "Events"       },
  { pageId: "secretnyc",              name: "Secret NYC",                area: "nyc",       category: "Events"       },

  // ── Lancaster, PA ─────────────────────────────────────────────────────────────
  { pageId: "DiscoverLancasterPA",    name: "Discover Lancaster",        area: "lancaster", category: "Events"       },
  { pageId: "LancasterCityPA",        name: "Lancaster City",            area: "lancaster", category: "Community"    },
  { pageId: "LancasterFarmersMarket", name: "Lancaster Central Market",  area: "lancaster", category: "Food & Drink" },

];

// ─── Area matching ────────────────────────────────────────────────────────────

/**
 * Returns Facebook page entries whose area keyword matches the given area string.
 * Case-insensitive substring match.
 *
 * Pages with area "nyc" are included for any NYC borough:
 * Brooklyn, Manhattan, Queens, Bronx, Staten Island.
 *
 * @param area - Human-readable area name e.g. "Brooklyn, New York"
 */
export function getFacebookPagesForArea(area: string): FacebookPageEntry[] {
  const lower = area.toLowerCase();
  return FACEBOOK_PAGES.filter(p => {
    if (p.area === "nyc") return NYC_KEYWORDS.some(kw => lower.includes(kw));
    return lower.includes(p.area);
  });
}
