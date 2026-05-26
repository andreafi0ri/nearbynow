// src/data/mockEvents.ts

const today = new Date();
const fmt = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

// Calculate next occurrence of a given weekday (0=Sun ... 6=Sat)
const nextWeekday = (target: number) => {
  const offset = (target - today.getDay() + 7) % 7 || 7;
  return fmt(addDays(today, offset));
};

/** A link to an external platform where this event also appears. */
export type SourceLink = {
  platform: string; // "Facebook Events", "Eventbrite", "Reddit" etc.
  url: string;      // Direct link to the event on that platform
  label: string;    // "View on Facebook", "RSVP on Eventbrite" etc.
};

export type EventItem = {
  id: number;
  type: "event" | "recommendation";
  title: string;
  desc: string;
  longDesc?: string;       // Extended description (up to 600 chars)
  time: string;
  location: string;
  date: string;
  source: string;
  sourceUrl?: string;
  category: string;
  catColor: string;
  catDot: string;
  saves: number;
  img: string;
  booking: { label: string; url: string; affiliate: boolean } | null;
  rating?: number;
  reviews?: number;
  showings?: string[];
  tags?: string[];
  startIso?: string;
  endIso?: string;
  lat?: number;
  lng?: number;
  isCanceled?: boolean;    // Set true when Meta confirms cancellation
  showTimes?: string[];    // Multiple show times for recurring/multi-session events
  // Multi-source merge fields (populated by deduplicationService)
  sourceLinks?: SourceLink[];
  isMerged?: boolean;
  confidenceScore?: number;
};

export const MOCK_EVENTS: EventItem[] = [
  {
    id: 1, type: "event",
    title: "Brixton Farmers Market",
    desc: "Fresh local produce, artisan bread, street food and live folk music every Saturday morning.",
    longDesc: "Every Saturday morning, Brixton Station Road transforms into one of South London's best food markets. Browse stalls from local growers, artisan bakers, and street food vendors. Live folk music from 10am. Free entry — bring a bag!",
    time: "Sat 9:00 AM – 1:00 PM", location: "Brixton Station Road, SW9",
    date: nextWeekday(6),
    startIso: nextWeekday(6) + "T09:00:00",
    endIso:   nextWeekday(6) + "T13:00:00",
    source: "Facebook Events", category: "Food & Drink",
    catColor: "#D43030", catDot: "#FF6B6B", saves: 34, img: "🥦", booking: null,
    lat: 51.4613, lng: -0.1156,
    tags: ["free", "market", "food"],
    // Multi-source mock — lets the EventCard sourceLinks UI render in development
    sourceLinks: [
      { platform: "Facebook Events", url: "https://facebook.com/events/123456789", label: "View on Facebook" },
      { platform: "Eventbrite",      url: "https://eventbrite.com",               label: "RSVP on Eventbrite" },
    ],
    isMerged: true,
    confidenceScore: 100,
  },
  {
    id: 2, type: "event",
    title: "Open Mic Night @ The Hootananny",
    desc: "Fancy your chances? Sign up on the door from 7pm. All genres welcome, 5 min slots.",
    time: "Fri 7:30 PM", location: "Hootananny, 95 Effra Rd",
    date: nextWeekday(5),
    startIso: nextWeekday(5) + "T19:30:00",
    endIso:   nextWeekday(5) + "T23:00:00",
    source: "Instagram", category: "Music",
    catColor: "#7B5CE0", catDot: "#A688FF", saves: 21, img: "🎸", booking: null,
    lat: 51.4586, lng: -0.1124,
    tags: ["free", "music", "open mic"],
  },
  {
    id: 3, type: "event",
    title: "Lambeth Planning Meeting",
    desc: "Council meeting discussing the proposed mixed-use development on Coldharbour Lane. Public welcome.",
    time: "Mon 6:00 PM", location: "Lambeth Town Hall",
    date: nextWeekday(1),
    source: "r/brixton", category: "Community",
    catColor: "#2860C8", catDot: "#5A90F8", saves: 8, img: "🏛️", booking: null,
    lat: 51.4617, lng: -0.1235,
  },
  {
    id: 4, type: "recommendation",
    title: "Nanban",
    desc: "Japanese soul food in the heart of Brixton. Ramen, katsu, and natural wines in a buzzing space.",
    time: "Open until 10:30 PM", location: "426 Coldharbour Lane",
    date: fmt(today),
    source: "Google Places", category: "Restaurant",
    catColor: "#B8920A", catDot: "#D4A80C", saves: 112, img: "🍜",
    booking: { label: "Reserve on OpenTable", url: "https://www.opentable.com", affiliate: true },
    rating: 4.7, reviews: 843,
    lat: 51.4627, lng: -0.1148,
  },
  {
    id: 5, type: "event",
    title: "5km Brockwell Parkrun",
    desc: "Free weekly timed 5k. All paces welcome — register once at parkrun.org.uk.",
    time: "Sat 9:00 AM", location: "Brockwell Park, SE24",
    date: nextWeekday(6),
    startIso: nextWeekday(6) + "T09:00:00",
    endIso:   nextWeekday(6) + "T10:00:00",
    source: "Eventbrite", category: "Sport",
    catColor: "#1A9E98", catDot: "#3ABFB8", saves: 67, img: "🏃", booking: null,
    lat: 51.4531, lng: -0.1037,
  },
  {
    id: 6, type: "recommendation",
    title: "BFI Southbank",
    desc: "Now showing: Wim Wenders retrospective. 4 screens, café bar, and a members' library.",
    time: "Multiple showings today", location: "Belvedere Rd, South Bank",
    date: fmt(today),
    source: "Google Places", category: "Cinema",
    catColor: "#7B5CE0", catDot: "#C4A0FF", saves: 29, img: "🎬",
    booking: { label: "Get Tickets", url: "https://bfi.org.uk", affiliate: false },
    showings: ["11:15", "14:00", "17:30", "20:45"],
    lat: 51.5054, lng: -0.1132,
  },
  {
    id: 7, type: "recommendation",
    title: "Black Cultural Archives",
    desc: "Permanent collection exploring the history of African and Caribbean people in Britain. Free entry.",
    time: "Open 10am – 6pm", location: "1 Windrush Square, SW2",
    date: fmt(addDays(today, 1)),
    source: "Google Places", category: "Culture",
    catColor: "#B8920A", catDot: "#D4A80C", saves: 44, img: "🏛️", booking: null,
    rating: 4.8, reviews: 521,
    lat: 51.4622, lng: -0.1151,
  },

  // ── Viator mock — dev testing for affiliate card UI ───────────────────────
  {
    id: 10, type: "recommendation",
    title: "Brooklyn Bridge & DUMBO Walking Tour",
    desc: "Guided 2-hour walking tour of Brooklyn Bridge and the DUMBO neighborhood with a local historian.",
    longDesc: "One of Brooklyn's most popular guided walks. Your local expert guide will take you across the Brooklyn Bridge with stories of its construction, then through the DUMBO cobblestone streets, the best photo spots, and hidden gems most tourists miss.",
    time: "Activity · ~2 hours",
    location: "DUMBO, Brooklyn, NY",
    lat: 40.7033, lng: -73.9881,
    date: fmt(today),
    startIso: fmt(today) + "T10:00:00",
    source: "Viator", category: "Events",
    catColor: "#2860C8", catDot: "#5A90F8",
    saves: 247, img: "🗺️",
    booking: {
      label: "Book on Viator",
      url: "https://www.viator.com/tours/New-York-City/Brooklyn-Bridge-Tour",
      affiliate: true,
    },
    rating: 4.9, reviews: 2341,
    tags: ["~2 hours", "Top rated", "Outdoors"],
  },

  // ── Deduplication test data ────────────────────────────────────────────────
  // id:8 should merge with id:1 (hard merge — same event, two sources)
  // id:9 should NOT merge with id:2 (fuzzy match — different location string)
  // Remove these once real API data is flowing

  {
    id: 8, type: "event",
    title: "Brixton Farmers Market",
    desc: "Weekly farmers market with fresh produce and street food.",
    time: "Sat 9:00 AM",
    location: "Brixton Station Road, SW9",
    date: nextWeekday(6),
    startIso: nextWeekday(6) + "T09:00:00",
    endIso:   nextWeekday(6) + "T13:00:00",
    source: "Eventbrite", category: "Food & Drink",
    catColor: "#D43030", catDot: "#FF6B6B", saves: 12, img: "🥦",
    booking: { label: "Register Free", url: "https://eventbrite.com", affiliate: false },
  },
  {
    id: 9, type: "event",
    title: "Open Mic Night at The Hootananny",
    desc: "Open mic at the famous Brixton venue. Sign up from 7pm.",
    time: "Fri 7:30 PM",
    location: "The Hootananny, Effra Road",
    date: nextWeekday(5),
    startIso: nextWeekday(5) + "T19:30:00",
    source: "Reddit", category: "Music",
    catColor: "#7B5CE0", catDot: "#A688FF", saves: 5, img: "🎸", booking: null,
  },
];

export const CATEGORY_FILTERS = [
  "All", "Events", "Food & Drink", "Music", "Community", "Sport", "Nearby",
];

export const DATE_PRESETS = [
  "Today", "Tomorrow", "This Weekend", "This Week",
];

export const SOURCE_COLORS: Record<string, string> = {
  "Viator":             "#00A651",
  "Instagram":          "#E1306C",
  "r/brixton":          "#FF4500",
  "Google Places":      "#4285F4",
  "Eventbrite":         "#F05537",
  "Meetup":             "#ED1C40",
  "Ticketmaster":       "#026CDF",
  "Showtimes":          "#7B5CE0",
  "Brixton Buzz":       "#E8A838",
  "East London Lines":  "#2860C8",
  "Southwark News":     "#2D8A6E",
  "MyLondon":           "#C0392B",
  "Gothamist":          "#1A9E98",
  "Block Club Chicago": "#27AE60",
  "LAist":              "#8E44AD",
  "DCist":              "#2C3E50",
  "Bklyner":            "#E67E22",
  "WBUR Boston":        "#16A085",
  "Billy Penn":         "#D35400",
  "SF Standard":        "#2980B9",
  "Denverite":          "#8E44AD",
  "Nashville Post":     "#1ABC9C",
};
