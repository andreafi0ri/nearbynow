// Post-build: inject <head> tags that Expo's static renderer drops.
// Run after `expo export -p web` via the Vercel buildCommand.
import { readFileSync, writeFileSync } from "fs";

const indexPath = "dist/index.html";
let html = readFileSync(indexPath, "utf8");

// Guard — idempotent: skip if SEO tags already injected
if (html.includes("og:type")) {
  console.log("✓ Tags already present — skipping inject");
  writeFileSync(indexPath, html, "utf8");
  process.exit(0);
}

// ── Fixes ───────────────────────────────────────────────────────────────────
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />'
);
html = html.replace(
  /<meta name="theme-color"[^>]*>/,
  '<meta name="theme-color" content="#F5F0E6" />'
);

// ── Title ───────────────────────────────────────────────────────────────────
html = html.replace(
  /<title>[^<]*<\/title>/,
  "<title>Nearby &amp; Now — What’s Happening Near You | Local Events Pennsylvania</title>"
);

// ── Replace bare Expo description with full SEO version ─────────────────────
html = html.replace(
  /<meta name="description"[^>]*>/,
  '<meta name="description" content="Discover local events, meetups, concerts, library programs and community happenings near you. Nearby &amp; Now pulls from 15+ sources into one free feed — no sign-up needed. Covering Pennsylvania and expanding." />'
);

// ── All injected head tags ───────────────────────────────────────────────────
const tags = `
  <!-- Primary SEO -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

  <!-- Open Graph -->
  <meta property="og:type"         content="website" />
  <meta property="og:url"          content="https://nearbyandnow.com/" />
  <meta property="og:title"        content="Nearby &amp; Now — What’s Happening Near You" />
  <meta property="og:description"  content="Local events, news and recommendations from across the web — all in one feed. Free, no sign-up required." />
  <meta property="og:image"        content="https://nearbyandnow.com/og-image.png" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt"    content="Nearby &amp; Now — What’s happening near you" />
  <meta property="og:locale"       content="en_US" />
  <meta property="og:site_name"    content="Nearby &amp; Now" />

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="Nearby &amp; Now — What’s Happening Near You" />
  <meta name="twitter:description" content="Local events, news and recommendations from across the web — all in one free feed." />
  <meta name="twitter:image"       content="https://nearbyandnow.com/og-image.png" />

  <!-- Canonical + geo -->
  <link rel="canonical" href="https://nearbyandnow.com/" />
  <meta name="geo.region"    content="US-PA" />
  <meta name="geo.placename" content="Pennsylvania" />
  <meta name="ICBM"          content="40.9967,-77.6088" />

  <!-- GSC + PWA -->
  <meta name="google-site-verification" content="m7iJAREJhSRrNVZ2UJbdNmzE9DXqijeOrqhEeXEsozI" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/nearbynow-icon.svg" />
  <link rel="icon" type="image/png" sizes="192x192" href="/nearbynow-icon-192.png" />
  <link rel="apple-touch-icon" href="/nearbynow-apple-icon.png" />

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6ENK256D12"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-6ENK256D12');
  </script>

  <!-- Service Worker -->
  <script>if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));</script>

  <!-- Schema.org: WebApplication -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": ["WebApplication","SoftwareApplication"],
    "name": "Nearby & Now",
    "alternateName": "NearbyAndNow",
    "url": "https://nearbyandnow.com",
    "description": "Nearby & Now is a free hyperlocal event discovery app that pulls events, meetups, concerts, library programs, live music, trivia nights, community activities and local news from 15+ sources into one location-aware feed. No download or sign-up required. Available across Pennsylvania.",
    "applicationCategory": "LifestyleApplication",
    "applicationSubCategory": "EventsApplication",
    "operatingSystem": "Web, iOS, Android",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "featureList": [
      "Local event discovery",
      "Events from 15+ sources in one feed",
      "No sign-up required",
      "Installable as home screen app (PWA)",
      "Library events",
      "Concerts and ticketed events",
      "Community meetups",
      "Push notifications for local events"
    ],
    "screenshot": "https://nearbyandnow.com/og-image.png",
    "author": { "@type": "Organization", "name": "Andronikos Consulting LLC" },
    "areaServed": { "@type": "State", "name": "Pennsylvania", "addressCountry": "US" }
  }
  </script>

  <!-- Schema.org: Organization -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Nearby & Now",
    "url": "https://nearbyandnow.com",
    "logo": "https://nearbyandnow.com/icons/icon-512x512.png",
    "description": "Nearby & Now aggregates local events, news and recommendations from across the web into one free location-aware feed — covering Pennsylvania and expanding.",
    "foundingDate": "2024",
    "areaServed": "Pennsylvania, United States",
    "knowsAbout": ["Local events","Community meetups","Live music","Library events","Things to do near me"]
  }
  </script>

  <!-- Schema.org: FAQPage -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Nearby & Now?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Nearby & Now (nearbyandnow.com) is a free local event discovery app that pulls events from 15+ sources — Ticketmaster, Meetup, local venue calendars, public library branches, Reddit, RSS feeds, and Google Events — into one location-aware feed. No download or sign-up required. Available across Pennsylvania."
        }
      },
      {
        "@type": "Question",
        "name": "How do I find events near me?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Open nearbyandnow.com on your phone, enter your city, and see events happening near you this week — concerts, meetups, library programs, trivia nights, live music, farmers markets, and more. Free, no account required."
        }
      },
      {
        "@type": "Question",
        "name": "What events are happening near me this weekend?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Nearby & Now shows events near you this weekend from Ticketmaster, SeatGeek, Meetup, local venue calendars, community Reddit posts, and library event pages — all in one feed. Visit nearbyandnow.com and enter your location."
        }
      },
      {
        "@type": "Question",
        "name": "Is Nearby & Now free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Completely free. Open nearbyandnow.com — no download, no account. Optionally sign up to save events and get push notifications."
        }
      },
      {
        "@type": "Question",
        "name": "What cities does Nearby & Now cover?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Nearby & Now currently covers Pennsylvania including Lancaster, York, Harrisburg, Philadelphia, and Pittsburgh, with expansion to more US cities in progress. Enter any city at nearbyandnow.com."
        }
      },
      {
        "@type": "Question",
        "name": "What event sources does Nearby & Now pull from?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Nearby & Now aggregates from 15+ sources: Ticketmaster, SeatGeek, Meetup, local venue calendars (American Music Theatre, Tellús360, FIG Lancaster), Lancaster County library branches, Reddit, RSS feeds, Foursquare, Viator, and Google Events — deduplicated into one feed."
        }
      }
    ]
  }
  </script>`;

html = html.replace("</head>", `${tags}\n</head>`);
writeFileSync(indexPath, html, "utf8");
console.log("✓ Injected SEO meta, schema.org JSON-LD, PWA tags, and Analytics into dist/index.html");
