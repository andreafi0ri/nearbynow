// SVG map backdrop — matches prototype nn/components.jsx MapBackground exactly.
// Uses react-native-svg so it renders on both native and web.
import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Pattern, Circle, Rect, G, Path } from "react-native-svg";
import { Theme } from "../theme";

type Props = {
  T: Theme;
  isDark: boolean;
  opacity?: number;
  includeWater?: boolean;
};

export function MapBackground({ T, isDark, opacity = 1, includeWater = true }: Props) {
  // Unique IDs per theme so gradient refs don't collide if both render
  const suffix  = isDark ? "dk" : "lt";
  const fadeId  = `mapfade-${suffix}`;
  const dotsId  = `mapdots-${suffix}`;
  const blockOp = isDark ? 0.9 : 0.55;
  const streetOp = isDark ? 0.85 : 0.55;
  const waterOp  = isDark ? 0.5  : 0.55;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 390 800"
      preserveAspectRatio="xMidYMid slice"
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <Defs>
        <LinearGradient id={fadeId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%"   stopColor={T.bg} stopOpacity={0}    />
          <Stop offset="50%"  stopColor={T.bg} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={T.bg} stopOpacity={1}    />
        </LinearGradient>
        <Pattern id={dotsId} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <Circle cx="2" cy="2" r="1" fill={T.mapDots} />
        </Pattern>
      </Defs>

      {/* dot grid */}
      <Rect width="390" height="800" fill={`url(#${dotsId})`} opacity={0.55} />

      {/* city blocks */}
      <G fill={T.mapBlocks} opacity={blockOp}>
        <Rect x="130" y="240" width="120" height="60"  rx="3" />
        <Rect x="20"  y="290" width="60"  height="100" rx="3" />
        <Rect x="135" y="330" width="70"  height="90"  rx="3" />
        <Rect x="230" y="350" width="60"  height="120" rx="3" />
        <Rect x="300" y="180" width="80"  height="60"  rx="3" />
        <Rect x="40"  y="610" width="90"  height="70"  rx="3" />
        <Rect x="260" y="630" width="100" height="80"  rx="3" />
      </G>

      {/* river */}
      {includeWater && (
        <Path
          d="M -20 540 Q 100 480 220 560 T 410 540"
          stroke={T.mapWater} strokeWidth="32" fill="none" opacity={waterOp}
        />
      )}

      {/* streets — thick fill */}
      <G stroke={T.mapStreets} strokeWidth="14" fill="none" opacity={streetOp}>
        <Path d="M-20 180 L 240 220 L 420 180" />
        <Path d="M 90 -20 L 110 260 L 60 520 L 120 820" />
        <Path d="M 260 -20 L 280 320 L 220 560 L 300 820" />
        <Path d="M -20 420 Q 200 400 420 460" />
        <Path d="M -20 660 L 240 700 L 420 670" />
      </G>

      {/* streets — thin centre line */}
      <G stroke={T.mapStreetsLine} strokeWidth="1.5" fill="none" opacity={0.8}>
        <Path d="M-20 180 L 240 220 L 420 180" />
        <Path d="M 90 -20 L 110 260 L 60 520 L 120 820" />
        <Path d="M 260 -20 L 280 320 L 220 560 L 300 820" />
        <Path d="M -20 420 Q 200 400 420 460" />
        <Path d="M -20 660 L 240 700 L 420 670" />
      </G>

      {/* bottom fade — draws the bg over the map so content reads cleanly */}
      <Rect width="390" height="800" fill={`url(#${fadeId})`} />
    </Svg>
  );
}
