// src/theme/index.ts
// Design tokens. Existing keys preserved for backward compat; new keys match
// the prototype palette.js exactly (see prototype:/nn/palette.js).

export const LIGHT = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:        "#F5F0E6",   // p.bg (warm cream — rebrand)
  bgSub:     "#EDE7DA",   // p.bg2
  bgCard:    "#FFFFFF",   // p.surface / p.cardBg
  bgCardHi:  "#E4DCCB",   // p.bg3
  surface:   "#FFFFFF",   // p.surface (explicit alias)
  // ── Borders ───────────────────────────────────────────────────────────────
  border:    "#E6DDCC",   // p.border
  borderSub: "#EFE9DB",   // p.borderSoft
  // ── Text ──────────────────────────────────────────────────────────────────
  text:      "#1A140C",   // p.ink (near-black — rebrand)
  textSub:   "#423B32",   // p.soft
  muted:     "#867F72",   // p.mute
  mutedL:    "#ABA498",   // p.dim
  // ── Accent (legacy "gold*" keys — values are now signature RED #E0392A) ────
  gold:      "#E0392A",   // p.gold — signature red
  goldBri:   "#C32A1D",   // p.goldDeep
  goldLight: "#F2B6AC",   // p.goldSoft
  goldGlow:  "rgba(224,57,42,0.12)",  // p.haloOut
  goldDim:   "#C32A1D",   // deep red (no separate light goldDim in rebrand)
  // ── Halo (home + email hero) ───────────────────────────────────────────────
  haloIn:    "rgba(224,57,42,0.26)",
  haloOut:   "rgba(224,57,42,0.12)",
  // ── Semantic ──────────────────────────────────────────────────────────────
  red:       "#E0392A",
  green:     "#2EA864",
  purple:    "#7B5BD8",   // p.music
  teal:      "#1F8A5B",   // p.sport
  // ── Tone colours (category accents, from p[tone]) ─────────────────────────
  toneRed:   "#E0392A",
  toneMusic: "#7B5BD8",
  toneFood:  "#E07A2A",
  toneNews:  "#C77B00",
  toneArts:  "#D63A7E",
  toneSport: "#1F8A5B",
  // ── Map colours ───────────────────────────────────────────────────────────
  mapStreets:     "#DCD3C1",
  mapStreetsLine: "#CABFA9",
  mapBlocks:      "#E9E1CD",
  mapWater:       "#DCE6EC",
  mapDots:        "#DAD1BF",
};

export const DARK = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:        "#0E0C0A",
  bgSub:     "#16130F",   // p.bg2
  bgCard:    "#16130F",   // p.surface
  bgCardHi:  "#1A1611",   // p.bg3
  surface:   "#16130F",
  // ── Borders ───────────────────────────────────────────────────────────────
  border:    "#2C2720",   // p.border
  borderSub: "#201C16",   // p.borderSoft
  // ── Text ──────────────────────────────────────────────────────────────────
  text:      "#F4EFE6",   // p.ink
  textSub:   "#C4BDB0",   // p.soft
  muted:     "#8A8175",   // p.mute
  mutedL:    "#56504A",   // p.dim
  // ── Accent (legacy "gold*" keys — values are now RED in dark) ─────────────
  gold:      "#FF6F62",   // p.gold (warm red in dark)
  goldBri:   "#FF9C92",   // p.goldSoft
  goldLight: "rgba(255,111,98,0.14)",
  goldGlow:  "rgba(255,111,98,0.16)",  // p.haloOut
  goldDim:   "#9B3B33",   // p.goldDim
  // ── Halo ──────────────────────────────────────────────────────────────────
  haloIn:    "rgba(255,111,98,0.34)",
  haloOut:   "rgba(255,111,98,0.16)",
  // ── Semantic ──────────────────────────────────────────────────────────────
  red:       "#FF6B5E",
  green:     "#3DBE7A",
  purple:    "#B49AFF",   // p.music
  teal:      "#7BE0B8",   // p.sport
  // ── Tone colours ──────────────────────────────────────────────────────────
  toneRed:   "#FF6B5E",
  toneMusic: "#B49AFF",
  toneFood:  "#FFA866",
  toneNews:  "#FFC061",
  toneArts:  "#FF85B8",
  toneSport: "#7BE0B8",
  // ── Map colours ───────────────────────────────────────────────────────────
  mapStreets:     "#211C16",
  mapStreetsLine: "#2E2820",
  mapBlocks:      "#1A1611",
  mapWater:       "#14161A",
  mapDots:        "#1C1812",
};

export type Theme = typeof LIGHT;

export const DEFAULT_PREFERENCE = "system";
export type ThemePreference = "light" | "dark" | "system";

// ─── Source badge colours ──────────────────────────────────────────────────────
// Used by EventCard and any component that renders a source pill/badge.
// Extend as new sources are added.
export const SOURCE_COLORS: Record<string, string> = {
  "Facebook Events": "#1877F2",
  "Instagram":       "#E1306C",
  "r/Brooklyn":      "#FF4500",
  "r/nyc":           "#FF4500",
  "Google Places":   "#4285F4",
  "Eventbrite":      "#F05537",
  "Meetup":          "#ED1C40",
  "Ticketmaster":    "#026CDF",
  "Showtimes":       "#7B5CE0",
  "Food Places":     "#F5A623",
};
