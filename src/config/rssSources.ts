// src/config/rssSources.ts
// Static registry of RSS feeds organised by primary area keyword.
//
// area   — single lowercase keyword used by getRSSSourcesForArea() scoring:
//           exact token match → 3 pts, contained match → 2 pts, "global" → 1 pt
// type   — "event" | "recommendation" | "auto"
//           "auto" defers to scoreItem() — score ≥ 3 → event, else recommendation
// catColor / catDot / img — override rssParser defaults when set

export type RSSSource = {
  url:       string;
  name:      string;
  area:      string;          // lowercase keyword, or "global"
  category:  string;
  catColor?: string;
  catDot?:   string;
  img?:      string;
  type?:     "event" | "recommendation" | "auto";
  color?:    string;          // legacy tint (kept for backward compat)
  tags?:     string[];
};

export const RSS_SOURCES: RSSSource[] = [

  // ─── Brixton / Lambeth hyperlocal ─────────────────────────────────────────
  {
    url:      "https://www.brixtonbuzz.com/feed/",
    name:     "Brixton Buzz",
    area:     "brixton",
    category: "Events",
    catColor: "#E84545", catDot: "#FF6060",
    img:      "📰", type: "auto",
    tags:     ["Brixton", "Local"],
  },
  {
    url:      "https://brixtonblog.com/feed/",
    name:     "Brixton Blog",
    area:     "brixton",
    category: "Events",
    catColor: "#C04040", catDot: "#E06060",
    img:      "📰", type: "auto",
    tags:     ["Brixton", "Community"],
  },
  {
    url:      "https://brixtonvillage.com/feed/",
    name:     "Brixton Village",
    area:     "brixton",
    category: "Food & Drink",
    catColor: "#D4A80C", catDot: "#F0C96A",
    img:      "🍽️", type: "recommendation",
    tags:     ["Brixton", "Food"],
  },

  // ─── London-wide events ───────────────────────────────────────────────────
  {
    url:      "https://www.timeout.com/london/rss",
    name:     "Time Out London",
    area:     "london",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
    tags:     ["London", "Events"],
  },
  {
    url:      "https://londonist.com/feed",
    name:     "Londonist",
    area:     "london",
    category: "Events",
    catColor: "#C04040", catDot: "#E06060",
    img:      "🎟️", type: "auto",
    tags:     ["London"],
  },
  {
    url:      "https://www.mylondon.news/whats-on/?service=rss",
    name:     "MyLondon What's On",
    area:     "london",
    category: "Events",
    catColor: "#CC0000", catDot: "#FF4444",
    img:      "📰", type: "auto",
    tags:     ["London", "What's On"],
  },
  {
    url:      "https://secretldn.com/feed/",
    name:     "Secret London",
    area:     "london",
    category: "Events",
    catColor: "#2D4A8A", catDot: "#5A80CC",
    img:      "🎟️", type: "auto",
    tags:     ["London", "Events", "Hidden"],
  },

  // ─── Official London ──────────────────────────────────────────────────────
  {
    url:      "https://www.london.gov.uk/sites/default/files/news_rss.xml",
    name:     "Mayor of London",
    area:     "london",
    category: "Community",
    catColor: "#003F8F", catDot: "#0070FF",
    img:      "🏛️", type: "auto",
    tags:     ["London", "Official"],
  },
  {
    url:      "https://www.visitlondon.com/rss",
    name:     "Visit London",
    area:     "london",
    category: "Events",
    catColor: "#0066CC", catDot: "#4499FF",
    img:      "🎟️", type: "event",
    tags:     ["London", "Tourism"],
  },

  // ─── London arts & culture ────────────────────────────────────────────────
  {
    url:      "https://www.southbankcentre.co.uk/rss",
    name:     "Southbank Centre",
    area:     "london",
    category: "Culture",
    catColor: "#FF5733", catDot: "#FF8055",
    img:      "🎭", type: "event",
    tags:     ["Arts", "Culture", "London"],
  },
  {
    url:      "https://www.barbican.org.uk/rss/whats-on",
    name:     "Barbican",
    area:     "london",
    category: "Culture",
    catColor: "#8B0000", catDot: "#CC2222",
    img:      "🎭", type: "event",
    tags:     ["Arts", "Culture", "London"],
  },
  {
    url:      "https://www.bfi.org.uk/rss",
    name:     "BFI",
    area:     "london",
    category: "Culture",
    catColor: "#7B5CE0", catDot: "#C4A0FF",
    img:      "🎬", type: "event",
    tags:     ["Film", "Cinema", "London"],
  },

  // ─── London parks & outdoors ──────────────────────────────────────────────
  {
    url:      "https://www.royalparks.org.uk/rss",
    name:     "Royal Parks",
    area:     "london",
    category: "Outdoors",
    catColor: "#2D7A3A", catDot: "#4AAD5C",
    img:      "🌿", type: "event",
    tags:     ["Outdoors", "Parks", "London"],
  },
  {
    url:      "https://www.nationaltrust.org.uk/rss/whats-on",
    name:     "National Trust",
    area:     "london",      // UK-only — do not serve to non-UK areas
    category: "Outdoors",
    catColor: "#6B8E23", catDot: "#9BBF40",
    img:      "🌿", type: "event",
    tags:     ["Outdoors", "Heritage"],
  },

  // ─── Brooklyn / NYC hyperlocal ────────────────────────────────────────────
  {
    url:      "https://bklyner.com/feed/",
    name:     "Bklyner",
    area:     "brooklyn",
    category: "Events",
    img: "📰", type: "auto",
    tags:     ["Brooklyn", "Local"],
  },
  {
    url:      "https://www.brownstoner.com/feed/",
    name:     "Brownstoner",
    area:     "brooklyn",
    category: "Events",
    img: "📰", type: "auto",
    tags:     ["Brooklyn"],
  },
  {
    url:      "https://www.timeout.com/newyork/rss",
    name:     "Time Out NYC",
    area:     "nyc",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
    tags:     ["NYC", "Events"],
  },
  {
    url:      "https://gothamist.com/feed",
    name:     "Gothamist",
    area:     "nyc",
    category: "Events",
    img: "📰", type: "auto",
    tags:     ["NYC"],
  },
  {
    url:      "https://secretnyc.co/feed/",
    name:     "Secret NYC",
    area:     "nyc",
    category: "Events",
    img: "🎟️", type: "auto",
    tags:     ["NYC", "Hidden"],
  },
  {
    url:      "https://www.nycgovparks.org/feeds/events",
    name:     "NYC Parks Events",
    area:     "nyc",
    category: "Events",
    catColor: "#2D7A3A", catDot: "#4AAD5C",
    img:      "🌿", type: "event",
    tags:     ["NYC", "Parks", "Outdoors"],
  },
  {
    url:      "https://www.brooklynmuseum.org/rss/events",
    name:     "Brooklyn Museum",
    area:     "brooklyn",
    category: "Culture",
    catColor: "#CC0000", catDot: "#FF4444",
    img:      "🎨", type: "event",
    tags:     ["Brooklyn", "Culture"],
  },
  {
    url:      "https://www.prospectpark.org/rss",
    name:     "Prospect Park",
    area:     "brooklyn",
    category: "Outdoors",
    catColor: "#2D8A6E", catDot: "#34A882",
    img:      "🌿", type: "event",
    tags:     ["Brooklyn", "Parks"],
  },
  {
    url:      "https://www.prospectpark.org/news-events/rss/",
    name:     "Prospect Park Events",
    area:     "brooklyn",
    category: "Outdoors",
    catColor: "#2D8A6E", catDot: "#34A882",
    img:      "🌿", type: "event",
    tags:     ["Free", "Outdoors", "Brooklyn"],
  },
  {
    url:      "https://www.brooklynmuseum.org/opencollection/api/v1/rss",
    name:     "Brooklyn Museum Collection",
    area:     "brooklyn",
    category: "Culture",
    catColor: "#B8920A", catDot: "#D4A80C",
    img:      "🏛️", type: "event",
    tags:     ["Free", "Art", "Brooklyn"],
  },
  {
    url:      "https://www.brooklynartscouncil.org/feed/",
    name:     "Brooklyn Arts Council",
    area:     "brooklyn",
    category: "Culture",
    catColor: "#7B5CE0", catDot: "#A688FF",
    img:      "🎨", type: "event",
    tags:     ["Arts", "Brooklyn"],
  },
  {
    url:      "https://www.nycgovparks.org/feeds/events/all.rss",
    name:     "NYC Parks All Events",
    area:     "nyc",
    category: "Events",
    catColor: "#2D7A3A", catDot: "#4AAD5C",
    img:      "🌿", type: "event",
    tags:     ["Free", "Outdoors", "NYC"],
  },
  {
    url:      "https://www.eventbrite.com/d/ny--new-york/events/rss/",
    name:     "Eventbrite NYC",
    area:     "nyc",
    category: "Events",
    catColor: "#F05537", catDot: "#FF8066",
    img:      "🎟️", type: "event",
    tags:     ["NYC", "Events"],
  },

  // ─── Chicago ─────────────────────────────────────────────────────────────
  {
    url:      "https://blockclubchicago.org/feed/",
    name:     "Block Club Chicago",
    area:     "chicago",
    category: "Events",
    img:      "📰", type: "auto",
    tags:     ["Chicago", "Local"],
  },
  {
    url:      "https://www.timeout.com/chicago/rss",
    name:     "Time Out Chicago",
    area:     "chicago",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
    tags:     ["Chicago", "Events"],
  },
  {
    url:      "https://secretchicago.com/feed/",
    name:     "Secret Chicago",
    area:     "chicago",
    category: "Events",
    img:      "🎟️", type: "auto",
    tags:     ["Chicago", "Hidden"],
  },
  {
    url:      "https://chicagoreader.com/feed/",
    name:     "Chicago Reader",
    area:     "chicago",
    category: "Events",
    img:      "📰", type: "auto",
    tags:     ["Chicago", "Arts"],
  },
  {
    url:      "https://www.chicagoparkdistrict.com/about-us/news/rss.xml",
    name:     "Chicago Parks",
    area:     "chicago",
    category: "Outdoors",
    catColor: "#2D7A3A", catDot: "#4AAD5C",
    img:      "🌿", type: "event",
    tags:     ["Chicago", "Parks", "Outdoors"],
  },

  // ─── Los Angeles ──────────────────────────────────────────────────────────
  {
    url:      "https://laist.com/feed",
    name:     "LAist",
    area:     "los angeles",
    category: "Events", img: "📰", type: "auto",
    tags:     ["LA"],
  },
  {
    url:      "https://www.timeout.com/los-angeles/rss",
    name:     "Time Out LA",
    area:     "los angeles",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
    tags:     ["LA", "Events"],
  },
  {
    url:      "https://secretlosangeles.com/feed/",
    name:     "Secret LA",
    area:     "los angeles",
    category: "Events", img: "🎟️", type: "auto",
    tags:     ["LA", "Hidden"],
  },

  // ─── Portland ─────────────────────────────────────────────────────────────
  {
    url:      "https://www.wweek.com/feed/",
    name:     "Willamette Week",
    area:     "portland",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/portland/rss",
    name:     "Time Out Portland",
    area:     "portland",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── Seattle ──────────────────────────────────────────────────────────────
  {
    url:      "https://crosscut.com/feed",
    name:     "Crosscut",
    area:     "seattle",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/seattle/rss",
    name:     "Time Out Seattle",
    area:     "seattle",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── San Francisco ────────────────────────────────────────────────────────
  {
    url:      "https://sfstandard.com/feed/",
    name:     "SF Standard",
    area:     "san francisco",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/san-francisco/rss",
    name:     "Time Out SF",
    area:     "san francisco",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },
  {
    url:      "https://secretsanfrancisco.com/feed/",
    name:     "Secret SF",
    area:     "san francisco",
    category: "Events", img: "🎟️", type: "auto",
  },

  // ─── Denver ───────────────────────────────────────────────────────────────
  {
    url:      "https://denverite.com/feed/",
    name:     "Denverite",
    area:     "denver",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/denver/rss",
    name:     "Time Out Denver",
    area:     "denver",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── Austin ───────────────────────────────────────────────────────────────
  {
    url:      "https://austinmonitor.com/feed/",
    name:     "Austin Monitor",
    area:     "austin",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.austinchronicle.com/gyrobase/RSSFeed?category=arts",
    name:     "Austin Chronicle",
    area:     "austin",
    category: "Events",
    img:      "🎟️", type: "auto",
    tags:     ["Austin", "Arts"],
  },

  // ─── Nashville ────────────────────────────────────────────────────────────
  {
    url:      "https://nashvillepost.com/feed/",
    name:     "Nashville Post",
    area:     "nashville",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/nashville/rss",
    name:     "Time Out Nashville",
    area:     "nashville",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── Boston ───────────────────────────────────────────────────────────────
  {
    url:      "https://wbur.org/rss/news",
    name:     "WBUR Boston",
    area:     "boston",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/boston/rss",
    name:     "Time Out Boston",
    area:     "boston",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },
  {
    url:      "https://secretboston.com/feed/",
    name:     "Secret Boston",
    area:     "boston",
    category: "Events", img: "🎟️", type: "auto",
  },

  // ─── Philadelphia ─────────────────────────────────────────────────────────
  {
    url:      "https://billypenn.com/feed/",
    name:     "Billy Penn",
    area:     "philadelphia",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/philadelphia/rss",
    name:     "Time Out Philly",
    area:     "philadelphia",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── Miami ────────────────────────────────────────────────────────────────
  {
    url:      "https://miamiherald.com/news/?service=rss",
    name:     "Miami Herald",
    area:     "miami",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/miami/rss",
    name:     "Time Out Miami",
    area:     "miami",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── Washington DC ────────────────────────────────────────────────────────
  {
    url:      "https://dcist.com/feed",
    name:     "DCist",
    area:     "washington",
    category: "Events", img: "📰", type: "auto",
  },
  {
    url:      "https://www.timeout.com/washington-dc/rss",
    name:     "Time Out DC",
    area:     "washington",
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
  },

  // ─── Lancaster, PA ────────────────────────────────────────────────────────
  // Note: visitlancastercity.com/events/ is scraped directly by visitLancasterService.ts
  // Verified working (via codetabs proxy) as of 2026-06:
  //   ✅ LancasterPA.com         — 100 items, 28 events
  //   ✅ LancasterHistory.org    — 10 items, 10 events
  // Removed:
  //   ❌ WITF Public Radio — 90% news/politics, only 2-3 real events per 50 items,
  //                          no events-only category feed available
  {
    url:      "https://www.lancasterpa.com/feed/",
    name:     "LancasterPA.com",
    area:     "lancaster",
    category: "Events",
    img:      "📰", type: "auto",
    tags:     ["Lancaster"],
  },
  {
    url:      "https://www.lancasterhistory.org/feed/",
    name:     "LancasterHistory.org",
    area:     "lancaster",
    category: "Culture",
    catColor: "#8B2131", catDot: "#BF3050",
    img:      "🏛️", type: "auto",
    tags:     ["Lancaster", "Heritage", "History"],
  },

  // ─── Global fallback — always included ───────────────────────────────────
  // Removed (2026-06): Consequence of Sound — scored 4/15 items but all 4 were
  // music industry news / celebrity stories, zero genuine local events.
  {
    url:      "https://www.timeout.com/uk/rss",
    name:     "Time Out UK",
    area:     "london",      // UK-only — do not serve to non-UK areas
    category: "Events",
    catColor: "#000000", catDot: "#444444",
    img:      "🎟️", type: "auto",
    tags:     ["UK", "Events"],
  },
];
