// app/(tabs)/_layout.tsx
// Floating translucent pill nav per design spec §5:
//   ~64px tall · border-radius 32px · backdrop-filter blur(14px)
//   Translucent surface (light: white @86%, dark: #16140F @82%)
//   Four tabs: Feed · Map · Saved · Profile — active = gold, inactive = muted
//   Floats over content; each screen reserves ~110px bottom padding.

import React from "react";
import { Tabs } from "expo-router";
import {
  View, Text, TouchableOpacity, Platform,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../../src/hooks/useTheme";

// ── Nav icons (mono-line SVG as emoji approximations) ──────────────────────────
// On web React Native renders SVG well; on native we use text glyphs.
function NavIcon({ kind, active, color }: { kind: string; active: boolean; color: string }) {
  const size = 22;
  if (Platform.OS === "web") {
    // SVG icons matching the design spec exactly
    if (kind === "feed") return React.createElement("svg" as any, { width: size, height: size, viewBox: "0 0 22 22", fill: "none" },
      React.createElement("rect" as any, { x: 2, y: 2, width: 8, height: 8, rx: 1.5, stroke: color, strokeWidth: 1.6 }),
      React.createElement("rect" as any, { x: 12, y: 2, width: 8, height: 8, rx: 1.5, stroke: color, strokeWidth: 1.6 }),
      React.createElement("rect" as any, { x: 2, y: 12, width: 8, height: 8, rx: 1.5, stroke: color, strokeWidth: 1.6 }),
      React.createElement("rect" as any, { x: 12, y: 12, width: 8, height: 8, rx: 1.5, stroke: color, strokeWidth: 1.6 }),
    );
    if (kind === "map") return React.createElement("svg" as any, { width: size, height: size, viewBox: "0 0 22 22", fill: "none" },
      React.createElement("circle" as any, { cx: 11, cy: 11, r: 9, stroke: color, strokeWidth: 1.6 }),
      React.createElement("circle" as any, { cx: 11, cy: 11, r: 2.4, fill: color }),
    );
    if (kind === "saved") return React.createElement("svg" as any, { width: size, height: size, viewBox: "0 0 22 22", fill: active ? color : "none" },
      React.createElement("path" as any, { d: "M11 19s-7-4.4-7-9.6C4 6.4 6 4.5 8.4 4.5c1.4 0 2.6.8 2.6 2.2 0-1.4 1.2-2.2 2.6-2.2 2.3 0 4.4 1.9 4.4 4.9 0 5.2-7 9.6-7 9.6z", stroke: color, strokeWidth: 1.6, strokeLinejoin: "round" }),
    );
    // profile
    return React.createElement("svg" as any, { width: size, height: size, viewBox: "0 0 22 22", fill: "none" },
      React.createElement("circle" as any, { cx: 11, cy: 11, r: 9, stroke: color, strokeWidth: 1.6 }),
      active && React.createElement("circle" as any, { cx: 11, cy: 11, r: 4, fill: color }),
    );
  }
  // Native fallback: emoji glyphs
  const glyphs: Record<string, string> = { feed: "⊞", map: "⊙", saved: "♡", profile: "◉" };
  return <Text style={{ fontSize: 20, color }}>{glyphs[kind] ?? "●"}</Text>;
}

// ── Floating pill tab bar ──────────────────────────────────────────────────────
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme: T, isDark } = useTheme();

  const tabOrder = ["feed", "map", "search", "profile"];
  const icons    = ["feed", "map", "saved", "profile"];
  const labels   = ["Feed", "Map", "Saved", "Profile"];

  const pillBg = isDark ? "rgba(22,20,15,0.82)" : "rgba(255,255,255,0.86)";

  return (
    <View style={s.outer} pointerEvents="box-none">
      <View style={[
        s.pill,
        {
          backgroundColor: pillBg,
          borderColor: T.border,
          // blur on web via CSS; ignored on native (no expo-blur)
          ...(Platform.OS === "web"
            ? { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as any
            : {}),
        },
      ]}>
        {state.routes.map((route, i) => {
          const isFocused = state.index === i;
          const color     = isFocused ? T.gold : T.mutedL;
          const iconKind  = icons[tabOrder.indexOf(route.name)] ?? "feed";
          const label     = labels[tabOrder.indexOf(route.name)] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={s.tab}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <NavIcon kind={iconKind} active={isFocused} color={color} />
              <Text style={[s.label, { color, fontWeight: isFocused ? "600" : "500" }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 96,
    alignItems: "center",
    justifyContent: "flex-start",
    pointerEvents: "box-none" as any,
    zIndex: 30,
  } as ViewStyle,
  pill: {
    marginTop: 20,
    marginHorizontal: 16,
    flex: 1,
    maxWidth: 380,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
  } as ViewStyle,
  tab: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  } as ViewStyle,
  label: {
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: "DMSans_700Bold",
    textTransform: "uppercase",
  } as TextStyle,
});

// ── Tab layout ────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { theme: T } = useTheme();
  return (
    <Tabs
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="feed"    options={{ title: "Feed" }} />
      <Tabs.Screen name="map"     options={{ title: "Map" }} />
      <Tabs.Screen name="search"  options={{ title: "Saved" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
