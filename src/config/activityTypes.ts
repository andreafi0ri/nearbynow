// src/config/activityTypes.ts
// Central config for all activity venue types used across Google Places.
// Each entry maps an activity concept to Google Places type strings and
// the emoji / tags that appear on EventItem cards.
//
// IMPORTANT: every string in googleTypes must be a confirmed valid type in
// Google Places API (New) Table 1 (https://developers.google.com/maps/documentation/places/web-service/place-types).
// A single invalid type causes the ENTIRE searchNearby request to return HTTP 400,
// silently returning [] for ALL activities.
//
// Confirmed invalid (legacy API only) — DO NOT add back:
//   "jazz_club"           — not in Table 1
//   "dance_hall"          — not in Table 1
//   "nature_reserve"      — not in Table 1
//   "miniature_golf_course" — not in Table 1
//   "adventure_sports_center" — not in Table 1

export type ActivityType = {
  id: string;
  label: string;
  emoji: string;
  googleTypes: string[]; // Google Places API (New) Table 1 includedTypes strings
  tags: string[];        // default tags for feed cards
};

export const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: "bowling",
    label: "Bowling",
    emoji: "🎳",
    googleTypes: ["bowling_alley"],
    tags: ["Bowling", "Fun", "Groups"],
  },
  {
    id: "escape_room",
    label: "Escape Rooms",
    emoji: "🔐",
    googleTypes: ["amusement_center"],
    tags: ["Escape Room", "Groups", "Adventure"],
  },
  {
    id: "arcade",
    label: "Arcades",
    emoji: "🕹️",
    googleTypes: ["amusement_center"],
    tags: ["Arcade", "Games", "Fun"],
  },
  {
    id: "mini_golf",
    label: "Mini Golf",
    emoji: "⛳",
    // "miniature_golf_course" is NOT in Places API (New) Table 1 → used amusement_center + golf_course
    googleTypes: ["amusement_center", "golf_course"],
    tags: ["Mini Golf", "Outdoors", "Family"],
  },
  {
    id: "axe_throwing",
    label: "Axe Throwing",
    emoji: "🪓",
    // "adventure_sports_center" is NOT in Places API (New) Table 1 → sports_activity_location
    googleTypes: ["sports_activity_location"],
    tags: ["Axe Throwing", "Adventure", "Groups"],
  },
  {
    id: "laser_tag",
    label: "Laser Tag",
    emoji: "🎯",
    googleTypes: ["amusement_center"],
    tags: ["Laser Tag", "Family", "Groups"],
  },
  {
    id: "comedy",
    label: "Comedy",
    emoji: "😂",
    googleTypes: ["comedy_club"],
    tags: ["Comedy", "Live Show", "Nightlife"],
  },
  {
    id: "karaoke",
    label: "Karaoke",
    emoji: "🎤",
    googleTypes: ["karaoke"],
    tags: ["Karaoke", "Fun", "Nightlife"],
  },
  {
    id: "trampoline",
    label: "Trampoline Parks",
    emoji: "🤸",
    googleTypes: ["amusement_center"],
    tags: ["Trampoline", "Active", "Family"],
  },
  {
    id: "go_karts",
    label: "Go-Karts",
    emoji: "🏎️",
    // "adventure_sports_center" removed — not in Table 1
    googleTypes: ["amusement_park", "sports_activity_location"],
    tags: ["Go-Karts", "Racing", "Fun"],
  },
  {
    id: "vr",
    label: "VR & Gaming",
    emoji: "🥽",
    googleTypes: ["amusement_center"],
    tags: ["VR", "Gaming", "Tech"],
  },
  {
    id: "pool_billiards",
    label: "Pool & Billiards",
    emoji: "🎱",
    googleTypes: ["sports_activity_location"],
    tags: ["Pool", "Billiards", "Nightlife"],
  },
  {
    id: "climbing",
    label: "Rock Climbing",
    emoji: "🧗",
    googleTypes: ["sports_complex"],
    tags: ["Climbing", "Active", "Sport"],
  },
];
// Removed from ACTIVITY_TYPES (belong to the Nightlife filter, not Activities):
//   "nightlife"   — bar, night_club, cocktail_bar, wine_bar, brewery, pub, karaoke
//   "rooftop_bar" — bar, cocktail_bar
//   "jazz_club"   — night_club
// These types dominated the 20-result cap in smaller cities, crowding out
// bowling alleys, arcades, escape rooms, etc.

/** All unique Google Places types across every activity — used for a single broad search. */
export const ALL_ACTIVITY_GOOGLE_TYPES: string[] = [
  ...new Set(ACTIVITY_TYPES.flatMap(a => a.googleTypes)),
];

/**
 * Maps a Google place type string back to its ActivityType entry.
 * Returns undefined when the type doesn't match any known activity.
 */
export function getActivityTypeForGoogleType(type: string): ActivityType | undefined {
  return ACTIVITY_TYPES.find(a => a.googleTypes.includes(type));
}
