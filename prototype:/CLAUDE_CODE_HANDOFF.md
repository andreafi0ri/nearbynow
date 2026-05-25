# Claude Code — Nearby & Now production handoff

## 0 · Getting the prototype to Claude Code

Claude Code runs against your local filesystem — it cannot reach this design project directly. Pick **one** of these before kicking off the implementation:

**Option A — Download the prototype and drop it into your repo (recommended).**
In this project, click the project menu → **Download** → save the zip. Unzip it into a `prototype/` folder at the root of your production repo, commit it, and reference it from Claude Code as `prototype/Nearby Now App.html` and `prototype/nn/*`. This gives Claude Code a stable, browsable copy it can read at any time. Delete the folder once the port is done.

**Option B — Paste files inline as you go.**
Open `Nearby Now App.html`, `nn/palette.js`, `nn/data.js`, `nn/components.jsx`, `nn/icons.jsx`, `nn/bottom-sheet.jsx`, `nn/filter-bar.jsx`, and each `nn/screen-*.jsx` in this project, copy their contents, and paste them into your Claude Code conversation when prompted. Slower but works if you don't want extra files in the repo.

**Option C — Share a public URL.**
Use the project's share feature to publish the prototype, then give Claude Code the URL. It can fetch the HTML but not the linked `.jsx` files individually, so this is the weakest option — only use it if the others are blocked.

Whichever path you choose, point Claude Code at this `CLAUDE_CODE_HANDOFF.md` file too — it's the spec.

---

## 1 · Source of truth

The prototype is split into:

| File | What's in it |
|---|---|
| `Nearby Now App.html` | Entry — loads scripts in order, mounts `<App>` |
| `nn/palette.js` | `PaletteFor(mode)` → light + dark palette tokens (background, ink, gold, red, music/food/news tones, map colors, halo gradients) |
| `nn/data.js` | `NN_DATA` — area, categories, sample feed items, pinned map markers, user |
| `nn/components.jsx` | `Pin`, `Wordmark`, `BrandBar`, `StatusBar`, `BottomNav`, `MapBackground`, `IconButton`, `Heart`, `Bell`, `Search`, `PrimaryBtn`, `SecondaryBtn`, `FeedCard`, `ClockIcon`, `PinDot` |
| `nn/icons.jsx` | `NN_ICONS` mono-line set + `CategoryIcon` wrapper. **Prototype defaults to emoji; keep emoji as production default** — the mono-line set is available behind a toggle. |
| `nn/bottom-sheet.jsx` | `BottomSheet` — slide-up modal with backdrop, drag handle, optional title |
| `nn/filter-bar.jsx` | `FilterBar` (compact DATE \| FILTERS \| SOURCES pills) + three sheets (date presets, category grid with Free toggle, source list) |
| `nn/screen-home.jsx` | Location onboarding — hero pin with halo, map bg, wordmark, emoji chip cluster, CTAs |
| `nn/screen-email.jsx` | Magic-link email opt-in — envelope hero, live validation, "Send magic link" / "Skip for now" |
| `nn/screen-feed.jsx` | Feed — area header, filter bar, card stream, calendar bottom sheet |
| `nn/screen-map.jsx` | Map — SVG map with colored category markers, compact result list |
| `nn/screen-saved.jsx` | Saved items list with empty state |
| `nn/screen-profile.jsx` | Avatar, areas, theme switcher (Light/Auto/Dark), notification toggles, account links |
| `nn/app.jsx` | App shell — state, router, `PhoneShell` wrapper |

**Read every prototype file before writing production code.** Match exact color values, spacing, typography. The prototype IS the spec.

## 2 · Production stack expectations

Use whatever framework matches the existing production repo (Next.js, Vite + React, SvelteKit — adapt accordingly). The prototype is written in React 18 with inline styles for portability; production should:

- Convert inline styles to your chosen styling system (CSS modules, Tailwind, styled-components, etc.) without losing fidelity
- Keep the same component decomposition — every prototype component maps 1:1 to a production component
- Replace the runtime `PaletteFor(mode)` pattern with CSS custom properties on a `data-theme="light|dark"` attribute
- Pull `NN_DATA` into a real backend / API call layer (start with the same shape; mock the endpoints first if backend isn't ready)

## 3 · Brand specifics — do not improvise

- **Typography:** Playfair Display (700/800, italic 500) for the wordmark, headlines, italic emphasis words (Tennessee, happening, loop). Inter (400/500/600/700) for everything else. JetBrains Mono for source pills only.
- **Wordmark rule:** "Nearby" in ink, italic gold `&`, "Now" in gold. Always `white-space: nowrap`. The italic ampersand is the strongest brand signature — never replace it with a regular `&`.
- **Pin lockup:** simple location pin shape, ink body, gold dot center, dark inner. SVG path lives in `nn/components.jsx`'s `Pin` component — copy verbatim.
- **Halos:** the radial-gradient + dashed/solid concentric rings under the hero pin (Home), envelope (Email), and area chip (Profile) are a unifying motif. Use them anywhere you have a hero icon.
- **Card accent:** every feed card has a 3px tone-colored bar across the top (red for community, purple-ish for music, orange for food, etc.). Tone color comes from `palette[item.tone]`.
- **Filters live in sheets, not strips.** Top bar is **always** DATE \| FILTERS \| SOURCES. Do not regress to a horizontal chip strip.
- **Calendar button** on every feed card (next to the action button) opens the calendar bottom sheet with Google Calendar + Apple Calendar (iCal). Do not drop this.
- **Emoji default.** The category icons render as system emoji throughout. The mono-line set exists in `nn/icons.jsx` and should ship in production behind a user setting or remain dormant — do not force-replace emoji.

## 4 · Flow

```
Home (location) ──▶ Email opt-in ──▶ Feed ──┬──▶ Map
                                            ├──▶ Saved
                                            └──▶ Profile (Light/Auto/Dark switcher)
```

- "Skip for now" on Email goes directly to Feed (do not require an email).
- Email submission shows a sending state for ~1s then advances to Feed. In production: actually fire the magic-link request.
- Profile theme switcher must flip the whole app immediately; persist to `localStorage` and respect `prefers-color-scheme` when set to Auto.

## 5 · Sources

The Sources sheet lists eight aggregators. Each is a real integration the production code must support:

| Source | Emoji | Subtitle |
|---|---|---|
| Reddit | 👽 | r/nashville and local subs |
| Local news | 📰 | Nashville Scene · The Tennessean |
| Eventbrite | 🎟 | Ticketed events & workshops |
| Meetup | 👥 | Groups and gatherings |
| Ticketmaster | 🎫 | Concerts, sports, theater |
| Google Places | 📍 | Restaurants, venues, points of interest |
| Facebook | 📘 | Public events from local pages |
| Viator | 🗺 | Tours and experiences |

Default: all enabled. User can toggle individually. The pill on the filter bar shows the active count and lights up gold when fewer than 8 are enabled.

## 6 · Favicon + PWA install icons

Use the **Nearby & Now pin** as the source mark for every browser/OS surface. The pin SVG is in `nn/components.jsx` (component `Pin`) — extract the path, drop it on a brand-cream square background with generous padding.

Generate from a single 1024×1024 master:

- `favicon.ico` (16, 32, 48 multi-res)
- `favicon-16.png`, `favicon-32.png`
- `apple-touch-icon.png` (180×180, rounded by iOS automatically — use sharp corners and rely on iOS masking)
- `icon-192.png`, `icon-512.png` (PWA manifest icons, sharp corners)
- `icon-192-maskable.png`, `icon-512-maskable.png` (with at least 20% safe-area padding for Android adaptive icons)
- `og-image.png` (1200×630, wordmark + pin + tagline "What's happening near you")
- `splash` images for iOS (use `@apple-touch-startup-image` or a service like pwa-asset-generator)

### Master design

- **Background:** cream `#FAF7F3` for default, dark `#0E0E10` for dark-mode favicon variant (`<link rel="icon" media="(prefers-color-scheme: dark)">`)
- **Foreground:** the pin glyph, ink `#111111`, gold dot `#B8920A`
- **Padding:** 20% safe area on each side for maskable; 12–14% for standard
- **No wordmark inside the favicon** — the pin alone reads at 16×16. Use the wordmark only on `og-image.png` and the install splash.

### `manifest.webmanifest`

```json
{
  "name": "Nearby & Now",
  "short_name": "Nearby & Now",
  "description": "What's happening near you — local events, news, food, and recommendations in one quiet feed.",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#FAF7F3",
  "theme_color": "#FAF7F3",
  "orientation": "portrait",
  "categories": ["news", "lifestyle", "social"],
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

In `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#FAF7F3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E0E10" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Nearby & Now">
```

### Theme-color note

When users install to home screen and open in standalone mode, the iOS/Android status bar tint reads from `theme-color`. We want it to match the cream paper in light mode and warm black in dark mode — the media-query variants above handle this automatically.

## 7 · PWA shell

- Register a service worker for offline shell + asset caching. Cache: app shell HTML, JS bundles, fonts, the favicons, and the latest feed payload as stale-while-revalidate.
- The Email opt-in screen should pre-fill if the browser remembers the address.
- Save state (saved items, area, theme, sources filter, free toggle) in `localStorage` keyed under `nn:state:v1`.

## 8 · Accessibility

- All interactive elements need `aria-label`s where the visual is an icon only (Heart button, Bell, Calendar button, IconButton).
- Bottom-sheet `Escape` to close (the prototype already does this — preserve it).
- Color contrast: validate gold-on-cream and gold-on-dark for AA. The deep gold `#B8920A` passes AA against cream, but body copy uses ink — keep it that way.
- Tap targets: minimum 44×44 for nav, filter pills, and card actions.

## 9 · Acceptance checklist

Before opening the PR, verify against the prototype:

- [ ] Home: hero pin + halo, single-line wordmark, "WHAT'S HAPPENING NEAR YOU" eyebrow, body copy, 8 emoji chips, two CTAs, privacy line
- [ ] Email: envelope-in-circle hero, "Stay in the *loop*" italic-gold, email field validates live (red badge → gold check), magic-link button enables only when valid, Skip works
- [ ] Feed: brand bar with hearts/bell, "Nashville, *Tennessee*" with switch pill + radius subtitle, compact DATE \| FILTERS \| SOURCES bar, 38-results count, cards with red top accent, calendar button + View action
- [ ] Filters sheet: Free toggle, category grid with check badges, Reset + Show-N button
- [ ] Sources sheet: all 8 sources with correct emoji + subtitle, count reflects in pill
- [ ] Calendar sheet: event title in Playfair, Google + Apple options, Cancel
- [ ] Map: cream/dark map, colored markers, compact list, same filter bar
- [ ] Saved: 2 default items, empty state when cleared
- [ ] Profile: avatar with gold ring + pin badge, areas card with gold-bordered active row, theme switcher actually switches the app, notification toggles, account links (magic-link link in gold)
- [ ] Theme switching: instant, persists across reload, respects prefers-color-scheme on Auto
- [ ] Favicon: visible at 16×16 in the tab, sharp at all sizes, dark-mode variant works
- [ ] PWA install on iOS Safari and Android Chrome produces a pin icon on home screen
- [ ] Status bar tint matches the screen palette when launched in standalone mode

Open the PR with screenshots of every screen in both light and dark mode, plus an iOS/Android install screenshot showing the pin icon on the home screen.
