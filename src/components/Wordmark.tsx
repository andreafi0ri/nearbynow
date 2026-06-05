// src/components/Wordmark.tsx
// Rebranded stacked wordmark (Brand Refresh):
//   Line 1 — "NEARBY &"  Inter italic 600, uppercase, 0.13em tracking, RED.
//   Line 2 — "NOW"       Inter 900, heavy hero, near-black ink.
// The italic-red kicker over the heavy NOW is the new brand signature.
// Accompanied by the Pin glyph in app headers.

import React from "react";
import { View, Text, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Theme } from "../theme";
import { BrandPin } from "./BrandPin";

type Props = {
  T: Theme;
  size?: "sm" | "md";
};

export function Wordmark({ T, size = "md" }: Props) {
  // NOW is the hero; the kicker is 0.4× its size (per rebrand spec).
  const nowSize    = size === "sm" ? 20 : 26;
  const kickerSize = Math.round(nowSize * 0.4);
  const pinSize    = size === "sm" ? 22 : 28;

  return (
    <View style={styles.row}>
      <BrandPin size={pinSize} pinColor={T.text} goldColor={T.gold} />
      <View style={styles.stack}>
        <Text
          style={[
            styles.kicker,
            { fontSize: kickerSize, color: T.gold, marginBottom: nowSize * 0.05 },
          ]}
          numberOfLines={1}
        >
          NEARBY &amp;
        </Text>
        <Text
          style={[styles.now, { fontSize: nowSize, color: T.text }]}
          numberOfLines={1}
        >
          NOW
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as ViewStyle,
  stack: {
    flexDirection: "column",
    alignItems: "flex-start",
  } as ViewStyle,
  kicker: {
    fontFamily: "Inter_600SemiBold_Italic",
    fontStyle: "italic",
    fontWeight: "600",
    letterSpacing: 1.2,          // ~0.13em at kicker size
    textTransform: "uppercase",
    paddingLeft: 1,              // optical align with tracked caps below
  } as TextStyle,
  now: {
    fontFamily: "Inter_900Black",
    fontWeight: "900",
    letterSpacing: 0.2,          // ~0.01em
    lineHeight: undefined,       // tight; RN handles single line
  } as TextStyle,
});
