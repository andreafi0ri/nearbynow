// Prototype-exact teardrop pin — nn/components.jsx `Pin` copied verbatim.
// Ink body, gold dot, dark inner dot. Used on Home hero and BrandBar.
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { Theme } from "../theme";

type Props = {
  size?: number;
  T: Theme;
};

export function Pin({ size = 44, T }: Props) {
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 100 115" fill="none">
      <Path
        d="M50 14 C32 14 18 28 18 46 C18 70 50 104 50 104 C50 104 82 70 82 46 C82 28 68 14 50 14 Z"
        fill={T.text}
      />
      <Circle cx="50" cy="44" r="14" fill={T.gold} />
      <Circle cx="50" cy="44" r="5"  fill={T.text} />
    </Svg>
  );
}
