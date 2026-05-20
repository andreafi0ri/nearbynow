// src/theme/index.ts
// All design tokens for Hearby. Light is default; dark applies via useColorScheme.

export const LIGHT = {
  bg:        "#FAF7F2",
  bgSub:     "#F2EDE4",
  bgCard:    "#FAF7F2",
  bgCardHi:  "#F5F0E8",
  border:    "#1A1A1A",
  borderSub: "#D0C8BC",
  text:      "#111111",
  textSub:   "#444444",
  muted:     "#777788",
  mutedL:    "#AAAABC",
  gold:      "#B8920A",
  goldBri:   "#D4A80C",
  goldLight: "#FDF3D0",
  goldGlow:  "rgba(184,146,10,0.15)",
  goldDim:   "#8A6E00",
  red:       "#D94040",
  green:     "#2EA864",
  purple:    "#7B5CE0",
  teal:      "#1AADA8",
};

export const DARK = {
  bg:        "#0E0E10",
  bgSub:     "#18181C",
  bgCard:    "#18181C",
  bgCardHi:  "#1F1F26",
  border:    "#C9A84C",
  borderSub: "#2A2A38",
  text:      "#F4F4F6",
  textSub:   "#CCCCDD",
  muted:     "#7A7A90",
  mutedL:    "#4A4A5C",
  gold:      "#C9A84C",
  goldBri:   "#F0C96A",
  goldLight: "rgba(201,168,76,0.12)",
  goldGlow:  "rgba(201,168,76,0.20)",
  goldDim:   "#8A6E2F",
  red:       "#E05555",
  green:     "#3DBE7A",
  purple:    "#9B6FE8",
  teal:      "#3ABFB8",
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
