// src/components/BrandPin.tsx
// SVG map-pin logo mark: black pin with gold eye circle, surrounded by a thin gold ring.
// Used in Wordmark (headers) and standalone on the location / splash screens.

import React from "react";
import Svg, { Circle, Polygon } from "react-native-svg";

type Props = {
  /** Height in dp. Width is derived from the 5:7 aspect ratio. */
  size?: number;
  /** Colour of the pin body and centre dot — typically T.text so it adapts to dark mode. */
  pinColor?: string;
  /** Colour of the outer ring and eye circle — typically T.gold. */
  goldColor?: string;
};

export function BrandPin({ size = 32, pinColor = "#111111", goldColor = "#C9A84C" }: Props) {
  // viewBox: 40 wide × 56 tall → 1 px padding so strokes aren't clipped
  const w = Math.round((size * 40) / 56);
  return (
    <Svg width={w} height={size} viewBox="0 0 40 56">
      {/* Outer thin gold ring — frames the pin head */}
      <Circle cx="20" cy="20" r="19" stroke={goldColor} strokeWidth="1.5" fill="none" />

      {/* Pin body: filled circle (head) + triangle (tail) in one layer */}
      <Circle cx="20" cy="20" r="14" fill={pinColor} />
      <Polygon points="7,26 20,54 33,26" fill={pinColor} />

      {/* Gold eye circle */}
      <Circle cx="20" cy="20" r="7" fill={goldColor} />

      {/* Centre dot */}
      <Circle cx="20" cy="20" r="3.5" fill={pinColor} />
    </Svg>
  );
}
