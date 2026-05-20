declare module "react-native-rss-parser" {
  export interface RSSLink {
    url: string;
    rel?: string;
  }

  export interface RSSCategory {
    name: string;
  }

  export interface RSSEnclosure {
    url: string;
    length?: string;
    mimeType?: string;
  }

  export interface RSSItem {
    id?: string;
    title?: string;
    description?: string;
    content?: string;
    links: RSSLink[];
    imageUrl?: string;
    published?: string;
    categories: RSSCategory[];
    enclosures: RSSEnclosure[];
    authors: { name?: string }[];
  }

  export interface RSSChannel {
    type: string;
    title?: string;
    description?: string;
    links: RSSLink[];
    image?: { url?: string };
    items: RSSItem[];
  }

  export function parse(feed: string): Promise<RSSChannel>;
}
