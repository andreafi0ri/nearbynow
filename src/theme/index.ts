// src/theme/index.ts
// Design tokens. Existing keys preserved for backward compat; new keys match
// the prototype palette.js exactly (see prototype:/nn/palette.js).

export const LIGHT = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:        "#FAF7F3",   // p.bg (cream paper)
  bgSub:     "#F2EDE3",   // p.bg2
  bgCard:    "#FFFFFF",   // p.surface / p.cardBg
  bgCardHi:  "#F5F0E8",   // p.bg3 approx
  surface:   "#FFFFFF",   // p.surface (explicit alias)
  // ── Borders ───────────────────────────────────────────────────────────────
  border:    "#E5DECF",   // p.border (warm cream — NOT ink)
  borderSub: "#EFE9DA",   // p.borderSoft
  // ── Text ──────────────────────────────────────────────────────────────────
  text:      "#111111",   // p.ink
  textSub:   "#3A3633",   // p.soft
  muted:     "#7D786D",   // p.mute
  mutedL:    "#A8A298",   // p.dim
  // ── Gold ──────────────────────────────────────────────────────────────────
  gold:      "#B8920A",   // p.gold / p.goldDeep (same in light)
  goldBri:   "#B8920A",   // p.goldDeep
  goldLight: "#E2C997",   // p.goldSoft
  goldGlow:  "rgba(184,146,10,0.15)",  // p.haloOut
  goldDim:   "#CFB55C",   // p.goldDim
  // ── Halo (home + email hero) ───────────────────────────────────────────────
  haloIn:    "rgba(184,146,10,0.32)",
  haloOut:   "rgba(184,146,10,0.15)",
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
  mapStreets:     "#D7CFBE",
  mapStreetsLine: "#C6BDA8",
  mapBlocks:      "#E7DFC9",
  mapWater:       "#DDE6EC",
  mapDots:        "#D7CFBE",
};

export const DARK = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:        "#0E0E10",
  bgSub:     "#161617",   // p.bg2
  bgCard:    "#161617",   // p.surface
  bgCardHi:  "#1A1815",   // p.bg3
  surface:   "#161617",
  // ── Borders ───────────────────────────────────────────────────────────────
  border:    "#2A2823",   // p.border (dark charcoal — NOT gold)
  borderSub: "#1F1E1C",   // p.borderSoft
  // ── Text ──────────────────────────────────────────────────────────────────
  text:      "#F4F4F6",   // p.ink
  textSub:   "#BFBCB1",   // p.soft
  muted:     "#7E7B72",   // p.mute
  mutedL:    "#525049",   // p.dim
  // ── Gold ──────────────────────────────────────────────────────────────────
  gold:      "#E2C997",   // p.gold (light cream gold in dark)
  goldBri:   "#F0C96A",   // p.goldSoft
  goldLight: "rgba(206,156,0,0.12)",
  goldGlow:  "rgba(206,156,0,0.16)",  // p.haloOut
  goldDim:   "#8B6A00",   // p.goldDim
  // ── Halo ──────────────────────────────────────────────────────────────────
  haloIn:    "rgba(206,156,0,0.34)",
  haloOut:   "rgba(206,156,0,0.16)",
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
  mapStreets:     "#1F1E1C",
  mapStreetsLine: "#2D2A24",
  mapBlocks:      "#1A1815",
  mapWater:       "#13151A",
  mapDots:        "#1C1A16",
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
