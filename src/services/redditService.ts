import { EventItem } from "../data/mockEvents";
import { SEARCH_CONFIG } from "../config/searchConfig";

const REDDIT_COLOR = "#FF4500";
const REDDIT_DOT   = "#FF6B35";

// ─── Area → subreddits lookup ────────────────────────────────────────────────

type AreaEntry = { keywords: string[]; subreddits: string[] };

const AREA_TABLE: AreaEntry[] = [
  // London boroughs / neighbourhoods
  { keywords: ["brixton", "sw9", "sw2"],              subreddits: ["brixton", "lambeth", "london"] },
  { keywords: ["hackney", "e8", "e9", "dalston"],     subreddits: ["hackney", "london"] },
  { keywords: ["peckham", "se15"],                    subreddits: ["peckham", "southwark", "london"] },
  { keywords: ["southwark", "bermondsey", "se1"],     subreddits: ["southwark", "london"] },
  { keywords: ["islington", "n1", "angel"],           subreddits: ["islington", "london"] },
  { keywords: ["camden", "nw1", "kentish"],           subreddits: ["camden", "london"] },
  { keywords: ["shoreditch", "e1", "hoxton"],         subreddits: ["shoreditch", "hackney", "london"] },
  { keywords: ["clapham", "sw4"],                     subreddits: ["clapham", "lambeth", "london"] },
  { keywords: ["greenwich", "se10"],                  subreddits: ["greenwich", "london"] },
  { keywords: ["lewisham", "se13"],                   subreddits: ["lewisham", "london"] },
  { keywords: ["croydon"],                            subreddits: ["croydon", "london"] },
  { keywords: ["london"],                             subreddits: ["london", "londonsocialclub"] },
  // US cities
  { keywords: ["brooklyn", "williamsburg", "bushwick"], subreddits: ["brooklyn", "nyc"] },
  { keywords: ["manhattan", "lower east", "harlem"],    subreddits: ["manhattan", "nyc"] },
  { keywords: ["queens", "astoria", "flushing"],        subreddits: ["queens", "nyc"] },
  { keywords: ["new york", "nyc"],                      subreddits: ["nyc"] },
  { keywords: ["austin", "atx"],                        subreddits: ["austin"] },
  { keywords: ["nashville"],                            subreddits: ["nashville"] },
  { keywords: ["portland", "pdx"],                      subreddits: ["portland"] },
  { keywords: ["denver"],                               subreddits: ["denver"] },
  { keywords: ["seattle"],                              subreddits: ["seattle"] },
  { keywords: ["chicago"],                              subreddits: ["chicago"] },
  { keywords: ["los angeles", "la ", "silver lake", "echo park"], subreddits: ["losangeles"] },
  { keywords: ["san francisco", "sf ", "mission district"],       subreddits: ["sanfrancisco"] },
  { keywords: ["miami"],                                subreddits: ["miami"] },
  { keywords: ["boston"],                               subreddits: ["boston"] },
  { keywords: ["philadelphia", "philly"],               subreddits: ["philadelphia"] },
  // Australian cities
  { keywords: ["melbourne", "fitzroy", "collingwood"], subreddits: ["melbourne"] },
  { keywords: ["sydney", "surry hills", "newtown"],    subreddits: ["sydney"] },
];

export function getLocalSubreddits(area: string): string[] {
  const lower = area.toLowerCase();
  for (const entry of AREA_TABLE) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.subreddits;
    }
  }
  // Generic fallback: sanitise the first word of the area as a subreddit name
  const word = lower.split(/[\s,]+/)[0].replace(/[^a-z0-9]/g, "");
  return word ? [word] : [];
}

// ─── Reddit API types ────────────────────────────────────────────────────────

type RedditPost = {
  id: string;
  title: string;
  selftext: string;
  url: string;
  score: number;
  created_utc: number;
  permalink: string;
  link_flair_text: string | null;
  is_self: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumericId(redditId: string): number {
  return parseInt(redditId, 36) % 2_147_483_647;
}

function formatRelativeTime(utcSeconds: number): string {
  const diffMs  = Date.now() - utcSeconds * 1_000;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr  < 24)  return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function isoDate(utcSeconds: number): string {
  return new Date(utcSeconds * 1_000).toISOString().split("T")[0];
}

function guessLocation(title: string, flair: string | null, subreddit: string): string {
  // Prefer flair if it looks like a location
  if (flair && /\b(ward|area|district|neighbourhood|road|st|street|lane|square)\b/i.test(flair)) {
    return flair;
  }
  // Capitalise subreddit name as a readable place name
  return subreddit.charAt(0).toUpperCase() + subreddit.slice(1);
}

function pickEmoji(title: string, flair: string | null): string {
  const t = (title + " " + (flair ?? "")).toLowerCase();
  if (/food|eat|restaur|café|cafe|coffee|drink|pub|bar/.test(t)) return "🍽️";
  if (/music|gig|concert|band|live/.test(t))                      return "🎸";
  if (/sport|run|park|walk|cycle|bike/.test(t))                   return "🏃";
  if (/market|shop|fair|craft/.test(t))                           return "🛍️";
  if (/art|exhib|gallery|museum|culture/.test(t))                 return "🎨";
  if (/news|council|plan|development|build/.test(t))              return "🏛️";
  if (/warn|alert|safet|crime|police/.test(t))                    return "⚠️";
  return "📣";
}

function pickCategory(title: string, flair: string | null): string {
  const t = (title + " " + (flair ?? "")).toLowerCase();
  if (/food|eat|restaur|café|cafe|coffee|drink|pub|bar/.test(t)) return "Food & Drink";
  if (/music|gig|concert|band|live/.test(t))                      return "Music";
  if (/sport|run|park|walk|cycle|bike/.test(t))                   return "Sport";
  if (/market|shop|fair|craft/.test(t))                           return "Food & Drink";
  if (/art|exhib|gallery|museum|culture/.test(t))                 return "Culture";
  return "Community";
}

// ─── Content matchers ────────────────────────────────────────────────────────

// Flair → event
const EVENT_FLAIR = /\b(happen(ing)?|event|events|festival|festivals|show|shows|gig|gigs|concert|concerts|market|markets|fair|fairs|exhibition|exhibitions|pop.?up|meetup|meetups|workshop|workshops|performance|performances|opening|openings|launch|launches|party|parties|screening|screenings|tour|tours|exhibit)\b/i;

// Flair → recommendation / place
const REC_FLAIR = /\b(recommend(ation)?s?|places|food|restaurant|bar|cafe|coffee|pub|shop|local business|review|hidden gem|discovery|tip|suggestion)\b/i;

// Title → event
const EVENT_TITLE = /\b(happening|what'?s on|things to do|event|events|festival|show|shows|gig|concert|market|fair|exhibition|pop.?up|meetup|workshop|performance|opening night|launch|party|screening|open.?mic|open day|open house|fundraiser|charity)\b/i;

// Title → recommendation / local discovery
const REC_TITLE = /\b(recommend|recommendation|best\s+\w+\s+in|where (to|can I)|good\s+(place|spot|restaurant|bar|cafe|coffee|pub|shop)|hidden gem|must.?try|underrated|worth (a )?visit|check out|just (opened|discovered|tried)|new (restaurant|bar|cafe|spot|place)|local (gem|favourite|favorite)|anyone (know|tried|been)|looking for (a |the )?(good|great|best)|tips for|places? to (eat|drink|go|visit|try))\b/i;

// Flairs that indicate off-topic / spam / mod content — always excluded
const SKIP_FLAIR = /\b(mod( approved| post)?|spam|meta|admin|announcement|automod|removed|locked)\b/i;

function isRelevantPost(p: RedditPost): boolean {
  const flair = p.link_flair_text ?? "";
  // Skip explicit mod/spam flairs
  if (flair && SKIP_FLAIR.test(flair)) return false;
  // If flair matches event or recommendation patterns → always include
  if (flair && (EVENT_FLAIR.test(flair) || REC_FLAIR.test(flair))) return true;
  // Generic local-subreddit flairs (Discussion, Help, Music, Images, etc.)
  // → include if title also looks like an event or recommendation
  if (flair) return EVENT_TITLE.test(p.title) || REC_TITLE.test(p.title);
  // No flair at all → same title filter
  return EVENT_TITLE.test(p.title) || REC_TITLE.test(p.title);
}

// ─── Age filter ──────────────────────────────────────────────────────────────

/** Maximum age of a Reddit post to include in the feed (days). */
const MAX_AGE_DAYS = 7;

/** Unix timestamp (seconds) below which posts are considered stale. Computed once per module load. */
function cutoffSecs(): number {
  return (Date.now() / 1_000) - MAX_AGE_DAYS * 86_400;
}

/** Returns true when a post was created within MAX_AGE_DAYS of now. */
function isRecent(p: RedditPost): boolean {
  return p.created_utc >= cutoffSecs();
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchPosts(url: string): Promise<RedditPost[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Reddit ${res.status}: ${url}`);
  const json = await res.json();
  return (json.data?.children ?? []).map((c: { data: RedditPost }) => c.data);
}

function toEventItem(p: RedditPost, subreddit: string): EventItem {
  const desc = p.is_self
    ? (p.selftext.trim().slice(0, 280) || p.title)
    : p.url;
  const isRec = REC_FLAIR.test(p.link_flair_text ?? "") || REC_TITLE.test(p.title);
  return {
    id:        toNumericId(p.id),
    type:      isRec ? "recommendation" : "event",
    title:     p.title,
    desc,
    time:      formatRelativeTime(p.created_utc),
    location:  guessLocation(p.title, p.link_flair_text, subreddit),
    date:      isoDate(p.created_utc),
    source:    `r/${subreddit}`,
    sourceUrl: `https://reddit.com${p.permalink}`,
    category:  pickCategory(p.title, p.link_flair_text),
    catColor:  REDDIT_COLOR,
    catDot:    REDDIT_DOT,
    saves:     p.score,
    img:       pickEmoji(p.title, p.link_flair_text),
    booking:   p.is_self
      ? null
      : { label: "View on Reddit", url: `https://reddit.com${p.permalink}`, affiliate: false },
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

const FLAIR_SEARCH_QUERY =
  // events
  "flair:happening OR flair:event OR flair:events OR flair:festival OR " +
  "flair:festivals OR flair:show OR flair:shows OR flair:gig OR flair:concert OR " +
  "flair:market OR flair:fair OR flair:exhibition OR flair:pop-up OR flair:meetup OR " +
  "flair:workshop OR flair:performance OR flair:opening OR flair:launch OR flair:party OR " +
  "flair:screening OR flair:tour OR flair:exhibit OR " +
  // recommendations
  "flair:recommendation OR flair:recommendations OR flair:places OR flair:food OR " +
  "flair:restaurant OR flair:bar OR flair:cafe OR flair:coffee OR flair:pub OR " +
  "flair:review OR flair:tip OR flair:tips OR flair:hidden OR flair:discovery";

export async function fetchRedditPosts(subreddit: string, limit = SEARCH_CONFIG.REDDIT_MAX_RESULTS): Promise<EventItem[]> {
  const sub = encodeURIComponent(subreddit);
  const base = `https://www.reddit.com/r/${sub}`;

  // Run both fetches in parallel:
  // 1. Flair-targeted search — finds posts with event flairs even if not on hot page
  // 2. Hot feed — filtered by title keywords for subreddits without flair systems
  const [searchPosts, hotPosts] = await Promise.allSettled([
    // sort=top&t=week — best-voted event-flaired posts in the past 7 days
    fetchPosts(
      `${base}/search.json?q=${encodeURIComponent(FLAIR_SEARCH_QUERY)}` +
      `&restrict_sr=1&sort=top&t=week&limit=${limit}&raw_json=1`
    ),
    fetchPosts(`${base}/hot.json?limit=${Math.ceil(limit * 1.5)}&raw_json=1`),
  ]);

  const seen = new Set<string>();
  const combined: RedditPost[] = [];

  const addPost = (p: RedditPost) => {
    if (seen.has(p.id)) return;
    if (!isRecent(p)) return;                         // drop posts older than 7 days
    if (p.title.toLowerCase().startsWith("[meta]")) return;
    if (!p.title.trim()) return;
    seen.add(p.id);
    combined.push(p);
  };

  // Search results: already age-bounded by t=week, but double-check with isRecent
  if (searchPosts.status === "fulfilled") {
    searchPosts.value.forEach(addPost);
  }

  // Hot posts: no server-side age limit — isRecent() is the only guard
  if (hotPosts.status === "fulfilled") {
    hotPosts.value.filter(isRelevantPost).forEach(addPost);
  }

  return combined.map(p => toEventItem(p, subreddit));
}
