// src/hooks/useTheme.ts
// Re-exports from ThemeContext for backwards compatibility.
// All screens importing useTheme automatically get the
// context-based version with manual override support.
export { useTheme } from "../context/ThemeContext";
export type { Theme } from "../theme";
