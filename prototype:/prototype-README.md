# Nearby & Now — Prototype

This folder contains the high-fidelity, clickable React prototype for **Nearby & Now**. Open `Nearby Now App.html` in any modern browser to interact with it. Everything in this folder is the design source of truth for the production port — see `../CLAUDE_CODE_HANDOFF.md` for the implementation spec.

## What's here

```
prototype/
├── Nearby Now App.html       ← entry; loads everything below
├── nn/
│   ├── palette.js            ← PaletteFor(mode) — light + dark tokens
│   ├── data.js               ← NN_DATA — sample feed, categories, user
│   ├── components.jsx        ← Pin, Wordmark, BrandBar, BottomNav, FeedCard…
│   ├── icons.jsx             ← Custom mono-line icon set (NN_ICONS + CategoryIcon)
│   ├── bottom-sheet.jsx      ← Slide-up modal primitive
│   ├── filter-bar.jsx        ← DATE | FILTERS | SOURCES compact bar + sheets
│   ├── screen-home.jsx       ← Location onboarding (hero pin + halo)
│   ├── screen-email.jsx      ← Magic-link email opt-in
│   ├── screen-feed.jsx       ← Card stream + calendar sheet
│   ├── screen-map.jsx        ← SVG map with category markers
│   ├── screen-saved.jsx      ← Saved items + empty state
│   ├── screen-profile.jsx    ← Avatar, areas, theme, notifications
│   ├── app.jsx               ← App shell, router, PhoneShell wrapper
│   └── tweaks-panel.jsx      ← Internal: dev-only tweak controls
```

## How to run

Open `Nearby Now App.html` directly in a browser (Chrome / Safari / Firefox all fine). No build step. Scripts load from unpkg CDN.

## How to navigate

- Landing screen → **Use my location** → Email opt-in → **Skip for now** or enter an email → Feed
- Use the bottom nav (Feed / Map / Saved / Profile) once you're past onboarding
- Profile → tap **Dark** to flip the whole app dark
- The dev-only Tweaks panel (bottom-right) lets you jump to any screen, swap emoji ↔ mono-line icons, toggle the phone bezel, and resize

## What to use it for

- Visual reference: exact colors, spacing, typography, halo gradients, card accents
- Interaction reference: bottom-sheet animations, filter UX, calendar flow, theme switch
- Copy reference: every microcopy line in the prototype is the production string

## What NOT to do

- Don't reach for the inline-style implementation as a stylesheet pattern — the production app should use CSS custom properties on `data-theme="light|dark"`. The inline styles are just for prototype portability.
- Don't generalize the `Tweaks` panel into a user-facing settings screen. It's dev tooling only.
- Don't replace the italic gold `&` in the wordmark with a plain ampersand. It's the brand signature.

## When in doubt

Read `../CLAUDE_CODE_HANDOFF.md` — it's the implementation spec, the brand rules, the acceptance checklist, and the favicon / PWA spec all in one.
