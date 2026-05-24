#!/usr/bin/env node
// Patches dist/index.html after Expo web export to fix mobile viewport settings
// and inject PWA meta tags that Expo's static shell template omits.
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "../dist/index.html");
let html = fs.readFileSync(htmlPath, "utf8");

// Fix viewport: add viewport-fit=cover (safe areas on notched iPhones)
// and interactive-widget=resizes-content (keyboard resizes layout on Android/Chrome)
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />'
);

// Inject PWA manifest and apple-touch-icon if not already present
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", '  <link rel="manifest" href="/manifest.json" />\n  </head>');
}
if (!html.includes("apple-touch-icon")) {
  html = html.replace("</head>", '  <link rel="apple-touch-icon" href="/nearbynow-apple-icon.png" />\n  </head>');
}

fs.writeFileSync(htmlPath, html, "utf8");
console.log("✓ dist/index.html patched for mobile web");
