import { EventItem } from "../data/mockEvents";

const REDDIT_COLOR = "#FF4500";
const REDDIT_DOT   = "#FF6B35";

// Stable numeric id from a Reddit post id string (base-36 → number, clamped to safe int range)
function toNumericId(redditId: string): number {
  return parseInt(redditId, 36) % 2_147_483_647;
}

function formatRelativeTime(utcSeconds: number): string {
  const diffMs  = Date.now() - utcSeconds * 1000;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)   return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr  < 24)   return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function isoDate(utcSeconds: number): string {
  return new Date(utcSeconds * 1000).toISOString().split("T")[0];
}

function pickEmoji(title: string, flair: string | null): string {
  const t = (title + " " + (flair ?? "")).toLowerCase();
  if (/food|eat|restaur|café|cafe|coffee|drink|pub|bar/.test(t))  return "🍽️";
  if (/music|gig|concert|band|live/.test(t))                       return "🎸";
  if (/sport|run|park|walk|cycle|bike/.test(t))                    return "🏃";
  if (/market|shop|fair|craft/.test(t))                            return "🛍️";
  if (/art|exhib|gallery|museum|culture/.test(t))                  return "🎨";
  if (/news|council|plan|development|build/.test(t))               return "🏛️";
  if (/warn|alert|safet|crime|police/.test(t))                     return "⚠️";
  return "📣";
}

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

export async function fetchRedditPosts(subreddit: string, limit = 25): Promise<EventItem[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}.json?limit=${limit}&raw_json=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "hearby-app/1.0" },
  });
  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);
  const json = await res.json();

  const posts: RedditPost[] = json.data.children.map((c: any) => c.data);

  return posts
    .filter(p => !p.title.toLowerCase().startsWith("[meta]"))
    .map(p => {
      const desc = p.is_self
        ? (p.selftext.slice(0, 280) || p.title)
        : p.url;

      return {
        id:        toNumericId(p.id),
        type:      "event" as const,
        title:     p.title,
        desc,
        time:      formatRelativeTime(p.created_utc),
        location:  `r/${subreddit}`,
        date:      isoDate(p.created_utc),
        source:    `r/${subreddit}`,
        sourceUrl: `https://reddit.com${p.permalink}`,
        category:  "Community",
        catColor:  REDDIT_COLOR,
        catDot:    REDDIT_DOT,
        saves:     p.score,
        img:       pickEmoji(p.title, p.link_flair_text),
        booking:   p.is_self ? null : {
          label: "View on Reddit",
          url:   `https://reddit.com${p.permalink}`,
          affiliate: false,
        },
      };
    });
}
