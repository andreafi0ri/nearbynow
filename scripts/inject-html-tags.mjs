// Post-build: inject <head> tags that Expo's static renderer drops.
// Run after `expo export -p web` via the Vercel buildCommand.
import { readFileSync, writeFileSync } from "fs";

const indexPath = "dist/index.html";
let html = readFileSync(indexPath, "utf8");

// Fix viewport: viewport-fit=cover enables safe-area-inset CSS vars on notched iPhones.
// interactive-widget=resizes-content makes Android/Chrome resize the layout viewport
// when the virtual keyboard opens, so React Native Web's flex layout adjusts correctly.
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />'
);

// Replace the theme-color Expo injects from app.json (gold) with the correct cream.
html = html.replace(/<meta name="theme-color"[^>]*>/, '<meta name="theme-color" content="#FAF7F3" />');

const tags = [
  `  <meta name="google-site-verification" content="m7iJAREJhSRrNVZ2UJbdNmzE9DXqijeOrqhEeXEsozI" />`,
  `  <link rel="manifest" href="/manifest.json" />`,
  `  <link rel="apple-touch-icon" href="/nearbynow-apple-icon.png" />`,
  `  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6ENK256D12"></script>`,
  `  <script>`,
  `    window.dataLayer = window.dataLayer || [];`,
  `    function gtag(){dataLayer.push(arguments);}`,
  `    gtag('js', new Date());`,
  `    gtag('config', 'G-6ENK256D12');`,
  `  </script>`,
  `  <script>if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));</script>`,
].join("\n");

if (html.includes("G-6ENK256D12")) {
  console.log("✓ Tags already present — skipping inject");
  writeFileSync(indexPath, html, "utf8");
  process.exit(0);
}

html = html.replace("</head>", `${tags}\n</head>`);
writeFileSync(indexPath, html, "utf8");
console.log("✓ Injected PWA manifest, Analytics, fixed viewport and theme-color into dist/index.html");
