// src/components/Wordmark.tsx
// Compact brand mark used at the top of every screen.
// Renders the BrandPin SVG logo followed by the split-colour wordmark:
//   "Nearby" (muted) + "& Now" (gold).

import React from "react";
import { View, Text, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Theme } from "../theme";
import { BrandPin } from "./BrandPin";

type Props = {
  T: Theme;
  size?: "sm" | "md";
};

export function Wordmark({ T, size = "md" }: Props) {
  const fontSize = size === "sm" ? 14 : 17;
  const pinSize  = size === "sm" ? 22 : 28;

  return (
    <View style={styles.row}>
      <BrandPin size={pinSize} pinColor={T.text} goldColor={T.gold} />
      <Text style={[styles.wordmark, { fontSize }]}>
        <Text style={{ color: T.textSub }}>Nearby </Text>
        <Text style={{ color: T.gold }}>&amp; Now</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  wordmark: {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontWeight: "800",
    letterSpacing: -0.5,
  } as TextStyle,
});
