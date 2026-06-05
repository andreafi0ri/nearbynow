// scripts/gen-icons.mjs
// Generates the rebranded Nearby & Now app/PWA icons from an SVG master,
// rendered with the bundled Inter fonts via @resvg/resvg-js.
//
// Rebrand icon (per brand-refresh handoff): squircle, "NOW" hero in cream,
// small italic-red "NEARBY &" kicker above. Dark surface (default variant).
//
// Run: npm i -D @resvg/resvg-js && node scripts/gen-icons.mjs
// (resvg is not kept as a dependency — it's a native binary only needed to
//  regenerate these icons; the generated PNGs are committed.)

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const INTER_BLACK  = "node_modules/@expo-google-fonts/inter/900Black/Inter_900Black.ttf";
const INTER_ITALIC = "node_modules/@expo-google-fonts/inter/600SemiBold_Italic/Inter_600SemiBold_Italic.ttf";

// Brand tokens
const INK   = "#0E0C0A";   // dark surface
const CREAM = "#F5F0E6";   // NOW
const RED   = "#E0392A";   // kicker / accent

/**
 * Build the icon SVG at a given pixel size.
 * @param size       output square size
 * @param variant    "dark" | "light" | "accent"
 * @param maskable   true → extra safe-area padding (smaller glyph) for Android
 */
function iconSVG(size, variant = "dark", maskable = false) {
  const radius = Math.round(size * 0.225);            // squircle-ish
  const bg     = variant === "light" ? CREAM : variant === "accent" ? RED : INK;
  const nowCol = variant === "light" ? INK   : variant === "accent" ? "#FFFFFF" : CREAM;
  const kickCol= variant === "accent" ? "rgba(255,255,255,0.85)" : RED;

  // "NOW" in Inter Black is wide (~2.5em). Keep it within the safe zone:
  // maskable → smaller (Android adaptive crops ~20%); standard → larger.
  const nowSize  = Math.round(size * (maskable ? 0.22 : 0.26));
  const kickSize = Math.round(nowSize * 0.28);
  const cx = size / 2;
  const cy = size / 2;
  // Center the stacked lockup; NOW baseline below center, kicker above its cap.
  const nowY  = cy + Math.round(nowSize * 0.34);
  const kickY = nowY - Math.round(nowSize * 0.88);

  const hairline = variant === "light"
    ? `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${radius}" fill="none" stroke="#E6DDCC" stroke-width="2"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
  ${hairline}
  <text x="${cx}" y="${kickY}" text-anchor="middle"
        font-family="Inter" font-weight="600" font-style="italic"
        font-size="${kickSize}" letter-spacing="${kickSize * 0.12}" fill="${kickCol}">NEARBY &amp;</text>
  <text x="${cx}" y="${nowY}" text-anchor="middle"
        font-family="Inter" font-weight="900"
        font-size="${nowSize}" letter-spacing="${nowSize * 0.01}" fill="${nowCol}">NOW</text>
</svg>`;
}

function render(svg, size) {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: {
      fontFiles: [INTER_BLACK, INTER_ITALIC],
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
  });
  return r.render().asPng();
}

const OUT = "public";
const targets = [
  { file: "nearbynow-icon-192.png",  size: 192,  variant: "dark" },
  { file: "nearbynow-icon-512.png",  size: 512,  variant: "dark" },
  { file: "nearbynow-icon-1024.png", size: 1024, variant: "dark" },
  { file: "nearbynow-apple-icon.png", size: 180, variant: "dark" },
  { file: "nearbynow-app-icon.png",  size: 1024, variant: "dark" },
];

for (const t of targets) {
  const svg = iconSVG(t.size, t.variant, false);
  const png = render(svg, t.size);
  fs.writeFileSync(path.join(OUT, t.file), png);
  console.log(`✓ ${t.file} (${t.size}px ${t.variant})`);
}

// app.json references assets/nearbynow-app-icon.png too — keep it in sync.
fs.copyFileSync(path.join(OUT, "nearbynow-app-icon.png"), "assets/nearbynow-app-icon.png");
console.log("✓ assets/nearbynow-app-icon.png (synced)");

// SVG favicon (crisp at any size, dark variant)
fs.writeFileSync(path.join(OUT, "nearbynow-icon.svg"), iconSVG(512, "dark", false));
console.log("✓ nearbynow-icon.svg");
