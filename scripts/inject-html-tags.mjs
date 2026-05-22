// Post-build: inject <head> tags that Expo's static renderer drops.
// Run after `expo export -p web` via the Vercel buildCommand.
import { readFileSync, writeFileSync } from "fs";

const indexPath = "dist/index.html";
let html = readFileSync(indexPath, "utf8");

const tags = [
  `  <meta name="google-site-verification" content="m7iJAREJhSRrNVZ2UJbdNmzE9DXqijeOrqhEeXEsozI" />`,
  `  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6ENK256D12"></script>`,
  `  <script>`,
  `    window.dataLayer = window.dataLayer || [];`,
  `    function gtag(){dataLayer.push(arguments);}`,
  `    gtag('js', new Date());`,
  `    gtag('config', 'G-6ENK256D12');`,
  `  </script>`,
].join("\n");

if (html.includes("G-6ENK256D12")) {
  console.log("✓ Tags already present — skipping inject");
  process.exit(0);
}

html = html.replace("</head>", `${tags}\n</head>`);
writeFileSync(indexPath, html, "utf8");
console.log("✓ Injected Google verification + Analytics into dist/index.html");
