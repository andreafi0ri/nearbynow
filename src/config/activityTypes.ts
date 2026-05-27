// src/config/activityTypes.ts
// Central config for all activity venue types used across Google Places.
// Each entry maps an activity concept to Google Places type strings and
// the emoji / tags that appear on EventItem cards.

export type ActivityType = {
  id: string;
  label: string;
  emoji: string;
  googleTypes: string[]; // Google Places API includedTypes strings
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
    googleTypes: ["miniature_golf_course"],
    tags: ["Mini Golf", "Outdoors", "Family"],
  },
  {
    id: "axe_throwing",
    label: "Axe Throwing",
    emoji: "🪓",
    googleTypes: ["adventure_sports_center"],
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
    googleTypes: ["amusement_park", "adventure_sports_center"],
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
  {
    id: "nightlife",
    label: "Nightlife",
    emoji: "🌙",
    googleTypes: [
      "night_club",
      "bar",
      "cocktail_bar",
      "wine_bar",
      "brewery",
      "pub",
      "jazz_club",
      "dance_hall",
    ],
    tags: ["Nightlife", "Bar", "Drinks"],
  },
  {
    id: "rooftop_bar",
    label: "Rooftop Bars",
    emoji: "🥂",
    googleTypes: ["bar", "cocktail_bar"],
    tags: ["Rooftop", "Cocktails", "Views"],
  },
  {
    id: "jazz_club",
    label: "Jazz & Blues",
    emoji: "🎷",
    googleTypes: ["jazz_club"],
    tags: ["Jazz", "Live Music", "Nightlife"],
  },
];

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
