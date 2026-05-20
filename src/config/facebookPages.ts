// src/config/facebookPages.ts
// Registry of Facebook Pages to pull public events from.
// Used by facebookService.ts once App Review is approved.
//
// To activate: set APP_REVIEW_APPROVED = true in facebookService.ts
// after Facebook approves the pages_read_engagement permission.
//
// Fields:
//   pageId   - Facebook page username or numeric ID
//   name     - Human-readable display name
//   area     - Lowercase keyword matched against the active area string
//   category - Hearby category label shown on the event card

export type FacebookPageEntry = {
  pageId: string;
  name: string;
  area: string;
  category: string;
};

export const FACEBOOK_PAGES: FacebookPageEntry[] = [

  // ─── Brooklyn / NYC ───────────────────────────────────────────────────────────
  {
    pageId:   "DUMBOArtsDistrict",
    name:     "DUMBO Arts",
    area:     "brooklyn",
    category: "Culture",
  },
  {
    pageId:   "ProspectParkAlliance",
    name:     "Prospect Park",
    area:     "brooklyn",
    category: "Events",
  },
  {
    pageId:   "BrooklynMuseum",
    name:     "Brooklyn Museum",
    area:     "brooklyn",
    category: "Culture",
  },
  {
    pageId:   "BrooklynBowl",
    name:     "Brooklyn Bowl",
    area:     "brooklyn",
    category: "Music",
  },
  {
    pageId:   "SmorgasburgMarkets",
    name:     "Smorgasburg",
    area:     "brooklyn",
    category: "Food & Drink",
  },
  {
    pageId:   "barcadenyc",
    name:     "Barcade",
    area:     "brooklyn",
    category: "Events",
  },

  // ─── Lancaster, PA ────────────────────────────────────────────────────────────
  {
    pageId:   "DiscoverLancasterPA",
    name:     "Discover Lancaster",
    area:     "lancaster",
    category: "Events",
  },
  {
    pageId:   "LancasterCityPA",
    name:     "Lancaster City",
    area:     "lancaster",
    category: "Community",
  },
];

/**
 * Returns Facebook page entries whose area keyword matches the given area string.
 * Case-insensitive substring match.
 *
 * @param area - Human-readable area name e.g. "Brooklyn, New York"
 */
export function getFacebookPagesForArea(area: string): FacebookPageEntry[] {
  const lower = area.toLowerCase();
  return FACEBOOK_PAGES.filter(p => lower.includes(p.area));
}
