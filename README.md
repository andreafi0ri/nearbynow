# hearby 📍
Hyperlocal event and recommendation feed — MVP codebase.

---

## ✅ Step-by-step setup on Mac

### Step 1 — Install Node.js
1. Go to https://nodejs.org
2. Click **"Download Node.js (LTS)"**
3. Open the downloaded `.pkg` file and follow the installer
4. Open **Terminal** (press `Cmd + Space`, type "Terminal", hit Enter)
5. Verify it worked:
   ```
   node --version
   ```
   You should see something like `v20.x.x`

---

### Step 2 — Unzip and move the project
1. Double-click `hearby-mvp.zip` to unzip it
2. Move the `hearby` folder to a good location, e.g. your home folder or a Projects folder:
   ```
   mkdir ~/Projects
   mv ~/Downloads/hearby ~/Projects/hearby
   ```

---

### Step 3 — Install project dependencies
```bash
cd ~/Projects/hearby
npm install
```
This installs everything in `package.json` — takes 1–2 minutes.

---

### Step 4 — Install Expo Go on your iPhone
1. Open the App Store on your iPhone
2. Search **"Expo Go"** and install it

---

### Step 5 — Run the app
```bash
npx expo start
```
A QR code appears in Terminal. Open the Camera app on your iPhone and scan it. The app loads live on your phone. Any time you save a file, the app hot-reloads instantly.

Press `w` to open the app in your browser instead.

---

### Step 6 — Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

---

### Step 7 — Open the project in Claude Code
```bash
cd ~/Projects/hearby
claude
```

Claude Code opens in your Terminal with full awareness of every file in the project. You can now tell it to build features in plain English. Examples:

- *"Wire up real GPS location and reverse geocode it to a neighbourhood name"*
- *"Add Supabase auth with email magic link"*
- *"Build a Reddit API fetcher that pulls posts from a given subreddit and formats them as EventItems"*
- *"Replace the mock events with a real API call to the backend"*
- *"Fix the TypeScript error in EventCard.tsx"*
- *"Run the app and tell me what errors appear in the console"*

---

## 📁 Project structure

```
hearby/
├── app/                        # Expo Router screens (each file = one screen)
│   ├── _layout.tsx             # Root layout — loads fonts, status bar
│   ├── index.tsx               # Entry point — routes to location or feed
│   ├── location.tsx            # Location / area selection
│   ├── email.tsx               # Email capture
│   ├── feed.tsx                # Main event feed
│   ├── map.tsx                 # Map view with draw-area feature
│   ├── search.tsx              # Search screen
│   ├── profile.tsx             # Profile — username, avatar, notifications
│   └── (tabs)/_layout.tsx      # Tab navigator reference (for later)
├── src/
│   ├── components/
│   │   ├── EventCard.tsx       # Card + calendar modal (Google + iCal)
│   │   └── ui.tsx              # GoldButton, GhostButton, SourcePill
│   ├── data/
│   │   └── mockEvents.ts       # Mock events, types, constants
│   ├── hooks/
│   │   └── useTheme.ts         # Auto light/dark theme hook
│   └── theme/
│       └── index.ts            # LIGHT + DARK token objects
├── assets/                     # App icon + splash (replace with your own)
├── app.json                    # Expo config (name, bundle ID, permissions)
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

---

## 🔲 What to build next (Phase 1)

Tell Claude Code to tackle these one at a time:

1. **Real location** — `"Use expo-location to get GPS coords and reverse geocode to a neighbourhood name, replacing the hardcoded Brixton mock"`
2. **Supabase setup** — `"Set up Supabase with email magic link auth. Store user email, username, avatar, and area in a users table"`
3. **Reddit feed** — `"Build a service that fetches posts from a given subreddit using the Reddit JSON API and maps them to EventItem format"`
4. **RSS feed** — `"Add an RSS parser that fetches a local news RSS feed and formats items as EventItems"`
5. **Real map** — `"Replace the SVG demo map with a Mapbox map using react-native-maps or expo-maps"`
6. **Push notifications** — `"Set up Expo Notifications so users get alerted when new events are added in their area"`

---

## 🎨 Design tokens

All colours live in `src/theme/index.ts`. Light mode is default; dark mode switches automatically based on the device setting (`useColorScheme`). The gold system (`gold`, `goldBri`, `goldDim`, `goldLight`) is the primary brand accent used for CTAs, borders, and highlights.

---

## 🌐 Brand candidates
- **Hearby** → hearby.com (check availability at namecheap.com)
- **NowLocal** → nowlocal.app (check availability at namecheap.com)
