// src/context/ThemeContext.tsx
// Global theme context with manual light / dark / system override.
// Replaces the stateless useColorScheme hook with a persisted preference
// stored in AsyncStorage under "hearby_theme_preference".

import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { LIGHT, DARK, Theme } from "../theme";

const STORAGE_KEY = "hearby_theme_preference";

/** The three choices available to the user. */
export type ThemePreference = "light" | "dark" | "system";

export type ThemeContextType = {
  /** The active design-token set — pass as `T` throughout the app. */
  theme: Theme;
  /** What the user has explicitly chosen (persists across restarts). */
  preference: ThemePreference;
  /** Convenience boolean — true when the active theme is dark. */
  isDark: boolean;
  /** Persist a new preference and re-render the whole tree immediately. */
  setPreference: (p: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT,
  preference: "system",
  isDark: false,
  setPreference: () => {},
});

/**
 * ThemeProvider — wrap the root layout with this so every screen
 * has access to the resolved theme and can change the preference.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Load the saved preference from AsyncStorage on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === "light" || val === "dark" || val === "system") {
        setPreferenceState(val);
      }
    });
  }, []);

  /** Update state and persist the choice so it survives restarts. */
  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p);
  };

  // Resolve the active dark/light decision:
  //   "dark"   → always dark
  //   "light"  → always light
  //   "system" → follow the OS colour scheme
  const isDark =
    preference === "dark"  ? true  :
    preference === "light" ? false :
    systemScheme === "dark";

  const theme = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ theme, preference, isDark, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme — the primary hook for accessing theme tokens.
 *
 * Usage in any screen:
 *   const { theme: T, isDark, preference, setPreference } = useTheme();
 *
 * For screens that only need the token set:
 *   const { theme: T } = useTheme();
 */
export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
