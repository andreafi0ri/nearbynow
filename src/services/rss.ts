import { EventItem } from "../data/mockEvents";

// Example local news RSS feeds to pass in:
//   "https://www.brixtonbuzz.com/feed/"
//   "https://southwarknews.co.uk/feed/"
//   "https://www.mylondon.news/news/?service=rss"

const RSS_COLOR = "#2860C8";
const RSS_DOT   = "#5A90F8";

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? stripCdata(m[1]).replace(/<[^>]+>/g, "").trim() : "";
}

function parseItems(xml: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title:       extractTag(block, "title"),
      description: extractTag(block, "description"),
      link:        extractTag(block, "link") || extractTag(block, "guid"),
      pubDate:     extractTag(block, "pubDate"),
      category:    extractTag(block, "category"),
    });
  }
  return items;
}

function pubDateToIso(pubDate: string): string {
  try {
    return new Date(pubDate).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function formatPubDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return pubDate;
  }
}

function stableId(link: string): number {
  let h = 0;
  for (let i = 0; i < link.length; i++) {
    h = (Math.imul(31, h) + link.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2_147_483_647;
}

function pickEmoji(title: string, category: string): string {
  const t = (title + " " + category).toLowerCase();
  if (/food|eat|restaur|café|cafe|coffee|drink/.test(t))  return "🍽️";
  if (/music|gig|concert|band/.test(t))                   return "🎸";
  if (/sport|run|park|cycle/.test(t))                     return "🏃";
  if (/market|shop|fair/.test(t))                         return "🛍️";
  if (/art|exhib|gallery|museum/.test(t))                 return "🎨";
  if (/crime|police|warn|alert/.test(t))                  return "⚠️";
  if (/plan|council|develop|build/.test(t))               return "🏛️";
  return "📰";
}

export async function fetchRssItems(feedUrl: string, limit = 20): Promise<EventItem[]> {
  const res = await fetch(feedUrl, {
    headers: { "Accept": "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`RSS fetch error: ${res.status}`);
  const xml = await res.text();

  const rawItems = parseItems(xml);
  const domain = new URL(feedUrl).hostname.replace(/^www\./, "");

  return rawItems.slice(0, limit).map(p => ({
    id:        stableId(p.link || p.title),
    type:      "event" as const,
    title:     p.title || "Untitled",
    desc:      p.description.slice(0, 280),
    time:      formatPubDate(p.pubDate),
    location:  domain,
    date:      pubDateToIso(p.pubDate),
    source:    domain,
    sourceUrl: p.link,
    category:  p.category || "News",
    catColor:  RSS_COLOR,
    catDot:    RSS_DOT,
    saves:     0,
    img:       pickEmoji(p.title, p.category),
    booking:   p.link ? { label: "Read article", url: p.link, affiliate: false } : null,
  }));
}
