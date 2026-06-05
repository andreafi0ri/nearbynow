// src/components/ui.tsx
import React from "react";
import {
  TouchableOpacity, Text, View, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Theme } from "../theme";

// ── GoldButton ─────────────────────────────────────────────────
type GoldButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  T: Theme;
};

export function GoldButton({ label, onPress, disabled, T }: GoldButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.goldBtn,
        {
          backgroundColor: disabled ? T.mutedL : T.text,
          borderColor:     disabled ? T.mutedL : T.text,
          shadowColor:     T.gold,
          shadowOpacity:   disabled ? 0 : 0.35,
        },
      ]}
    >
      <Text style={[styles.goldBtnText, { color: disabled ? T.muted : T.goldBri }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── GhostButton ────────────────────────────────────────────────
type GhostButtonProps = {
  label: string;
  onPress: () => void;
  T: Theme;
  style?: ViewStyle;
};

export function GhostButton({ label, onPress, T, style }: GhostButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.ghostBtn, { borderColor: T.borderSub }, style]}
    >
      <Text style={[styles.ghostBtnText, { color: T.textSub }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── SourcePill ─────────────────────────────────────────────────
type SourcePillProps = { source: string; colors: Record<string, string> };

export function SourcePill({ source, colors }: SourcePillProps) {
  const color = colors[source] || "#888";
  return (
    <View style={[styles.pill, { backgroundColor: color + "1A", borderColor: color + "50" }]}>
      <Text style={[styles.pillText, { color }]}>{source}</Text>
    </View>
  );
}

// ── Divider ────────────────────────────────────────────────────
export function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  goldBtn: {
    width: "100%",
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  } as ViewStyle,
  goldBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
    fontFamily: "Inter_700Bold",
  } as TextStyle,
  ghostBtn: {
    width: "100%",
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: "center",
  } as ViewStyle,
  ghostBtnText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  } as TextStyle,
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  } as ViewStyle,
  pillText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  } as TextStyle,
  divider: {
    height: 1.5,
    flex: 1,
  } as ViewStyle,
});
