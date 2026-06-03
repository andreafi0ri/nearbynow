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
  imageUrl?: string;       // Hero image URL when available — falls back to stripe+emoji
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
    imageUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80",
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
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
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
    imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
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
    showings: ["12:30", "3:00 · Dolby", "5:45", "8:15 · IMAX", "10:30"],
    tags: ["PG-13", "Drama", "IMAX"],
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

  // ── Activities mocks — dev testing for Activities filter and map pins ─────
  {
    id: 16, type: "recommendation",
    title: "Brooklyn Bowl",
    desc: "Bowling · Music Venue · Williamsburg · $$ · Highly rated",
    longDesc: "Brooklyn Bowl combines a 16-lane bowling alley, live music venue, and full restaurant in Williamsburg. One of the most unique and highly rated bowling alleys in NYC.",
    time: "Open until 2:00 AM",
    location: "61 Wythe Ave, Williamsburg, Brooklyn",
    lat: 40.7218, lng: -73.9573,
    date: fmt(today),
    source: "Google Places", category: "Activities",
    catColor: "#1A9E98", catDot: "#3ABFB8",
    saves: 312, img: "🎳",
    booking: { label: "View on Google Maps", url: "https://maps.google.com/?q=Brooklyn+Bowl", affiliate: false },
    rating: 4.5, reviews: 2891,
    tags: ["Bowling", "Live Music", "$$"],
  },
  {
    id: 17, type: "recommendation",
    title: "Escape the Room NYC",
    desc: "Escape Room · Midtown · Multiple themed rooms for groups.",
    longDesc: "One of New York's top-rated escape room experiences. Multiple fully immersive themed rooms for groups of 2–10. Great for team building or a unique night out.",
    time: "Open until 11:00 PM",
    location: "239 W 29th St, Midtown, New York",
    lat: 40.7478, lng: -73.9954,
    date: fmt(today),
    source: "Google Places", category: "Activities",
    catColor: "#1A9E98", catDot: "#3ABFB8",
    saves: 187, img: "🔐",
    booking: { label: "Book Now", url: "https://www.escapetheroomnyc.com", affiliate: false },
    rating: 4.7, reviews: 1432,
    tags: ["Escape Room", "Groups", "Adventure"],
  },
  {
    id: 18, type: "recommendation",
    title: "Barcade Brooklyn",
    desc: "Arcade Bar · Williamsburg · 50+ classic arcade games + craft beer.",
    longDesc: "The original Barcade in Williamsburg combines vintage arcade games from the 70s, 80s, and 90s with a great selection of draft craft beers.",
    time: "Open until 2:00 AM",
    location: "388 Union Ave, Williamsburg, Brooklyn",
    lat: 40.7147, lng: -73.9567,
    date: fmt(today),
    source: "Google Places", category: "Activities",
    catColor: "#1A9E98", catDot: "#3ABFB8",
    saves: 423, img: "🕹️",
    booking: { label: "View on Google Maps", url: "https://maps.google.com/?q=Barcade+Brooklyn", affiliate: false },
    rating: 4.4, reviews: 3211,
    tags: ["Arcade", "Bar", "Williamsburg"],
  },

  // ── Nightlife mock — dev testing for Nightlife filter ────────────────────
  {
    id: 19, type: "recommendation",
    title: "Slowly Shirley",
    desc: "Cocktail Bar · West Village · $$$ · Highly rated",
    longDesc: "A beloved basement cocktail den in the West Village known for inventive, seasonal cocktails and an intimate atmosphere. One of NYC's most celebrated hidden bars.",
    time: "Open until 2:00 AM",
    location: "121 W 10th St, West Village, New York",
    lat: 40.7335, lng: -74.0024,
    date: fmt(today),
    source: "Google Places", category: "Nightlife",
    catColor: "#4A1570", catDot: "#9B59B6",
    saves: 203, img: "🍸",
    booking: { label: "View on Google Maps", url: "https://maps.google.com/?q=Slowly+Shirley+NYC", affiliate: false },
    rating: 4.7, reviews: 1243,
    tags: ["Cocktails", "$$$", "Hidden bar"],
  },

  // ── Outdoors mock — dev testing for Parks & Outdoors filter ───────────────
  {
    id: 20, type: "recommendation",
    title: "Prospect Park",
    desc: "Brooklyn's beloved 526-acre park. Running trails, a boathouse, lake, and free events year-round.",
    longDesc: "Designed by Frederick Law Olmsted and Calvert Vaux, Prospect Park is Brooklyn's green heart. Features a 3.35-mile loop road, the Prospect Park Lake, Audubon Center, Long Meadow, and regular free community events.",
    time: "Open 5:00 AM – 1:00 AM",
    location: "Prospect Park, Brooklyn, NY",
    lat: 40.6579, lng: -73.9689,
    date: fmt(today),
    source: "Google Places", category: "Outdoors",
    catColor: "#2D7A3A", catDot: "#4AAD5C",
    saves: 891, img: "🌿",
    booking: { label: "View on Google Maps", url: "https://maps.google.com/?q=Prospect+Park+Brooklyn", affiliate: false },
    rating: 4.9, reviews: 12453,
    tags: ["Free", "Outdoors", "Brooklyn"],
  },

  // ── Sports Tickets mocks — dev testing for Sport filter and map pins ─────
  {
    id: 21, type: "event",
    title: "New York Mets vs. Philadelphia Phillies",
    desc: "MLB regular season game at Citi Field. Get your tickets before they sell out!",
    longDesc: "Catch the Mets take on division rivals the Philadelphia Phillies at Citi Field in Queens. Enjoy a classic ballpark experience with hot dogs, great views, and live MLB action.",
    time: "Sat 1:10 PM",
    location: "Citi Field, Queens, NY",
    lat: 40.7571, lng: -73.8458,
    date: nextWeekday(6),
    startIso: nextWeekday(6) + "T13:10:00",
    endIso:   nextWeekday(6) + "T16:30:00",
    source: "Ticketmaster", category: "Sport",
    catColor: "#1A9E98", catDot: "#3ABFB8",
    saves: 54, img: "⚾",
    booking: { label: "From $45", url: "https://www.ticketmaster.com", affiliate: true },
    tags: ["MLB", "Baseball", "From $45"],
  },
  {
    id: 22, type: "event",
    title: "Brooklyn Nets vs. Boston Celtics",
    desc: "NBA game at Barclays Center. Witness the rivalry live courtside.",
    longDesc: "The Brooklyn Nets host the Boston Celtics in this thrilling NBA matchup at Barclays Center. One of the most electric atmospheres in basketball.",
    time: "Wed 7:30 PM",
    location: "Barclays Center, Brooklyn, NY",
    lat: 40.6826, lng: -73.9754,
    date: nextWeekday(3),
    startIso: nextWeekday(3) + "T19:30:00",
    endIso:   nextWeekday(3) + "T22:00:00",
    source: "Ticketmaster", category: "Sport",
    catColor: "#1A9E98", catDot: "#3ABFB8",
    saves: 89, img: "🏀",
    booking: { label: "From $78", url: "https://www.ticketmaster.com", affiliate: true },
    tags: ["NBA", "Basketball", "From $78"],
  },

  {
    id: 23, type: "recommendation",
    title: "Aire Ancient Baths",
    desc: "Luxury thermal spa in Tribeca. Ancient bathing rituals in a stunning converted building.",
    longDesc: "Inspired by the ancient bathing traditions of Rome, Greece and the Ottoman Empire, Aire Ancient Baths offers a unique wellness experience in a beautifully restored building in Tribeca. Thermal pools, aromatherapy steam rooms, salt rooms and massage treatments.",
    time: "Open until 11:00 PM",
    location: "88 Franklin St, Tribeca, New York",
    lat: 40.7183, lng: -74.0071,
    date: fmt(today),
    source: "Google Places", category: "Wellness",
    catColor: "#C25F8F", catDot: "#E88AB4",
    saves: 312, img: "💆",
    booking: {
      label: "Book a Treatment",
      url: "https://www.beaire.com/en/new-york",
      affiliate: false,
    },
    rating: 4.8, reviews: 2341,
    tags: ["Spa", "Wellness", "Luxury"],
  },

  {
    id: 24, type: "event",
    title: "Lancaster Central Market — Saturday Opening",
    desc: "America's oldest publicly owned farmers market. Fresh produce, baked goods, meats, and local crafts every Tuesday, Friday, and Saturday.",
    longDesc: "Lancaster Central Market has operated continuously since the 1730s, making it the oldest publicly owned farmers market in the United States. Located in Penn Square in the heart of downtown Lancaster, it features over 60 vendors selling fresh local produce, meats, baked goods, flowers, and handcrafted items.",
    time: "Sat 6:00 AM – 2:00 PM",
    location: "23 N Market St, Lancaster, PA",
    lat: 40.0379, lng: -76.3055,
    date: nextWeekday(6),
    startIso: nextWeekday(6) + "T06:00:00",
    endIso:   nextWeekday(6) + "T14:00:00",
    source: "Google Events", category: "Community",
    catColor: "#2860C8", catDot: "#5A90F8",
    saves: 89, img: "🤝",
    booking: {
      label: "View event",
      url: "https://www.centralmarketlancaster.com",
      affiliate: false,
    },
    tags: ["Free", "Farmers Market", "Lancaster"],
  },

  {
    id: 25, type: "event",
    title: "Philadelphia Eagles vs. Dallas Cowboys",
    desc: "NFL Football · Lincoln Financial Field · From $120",
    longDesc: "Philadelphia Eagles host the Dallas Cowboys at Lincoln Financial Field. Tickets available via SeatGeek with all-in pricing — no hidden fees.",
    time: "Sun 4:25 PM",
    location: "Lincoln Financial Field, Philadelphia, PA",
    lat: 39.9008, lng: -75.1675,
    date: nextWeekday(0),
    startIso: nextWeekday(0) + "T16:25:00",
    endIso:   nextWeekday(0) + "T19:30:00",
    source: "SeatGeek", category: "Sport",
    catColor: "#1A9E98", catDot: "#3ABFB8",
    saves: 203, img: "🏈",
    booking: {
      label: "Buy Tickets · From $120",
      url: "https://seatgeek.com/philadelphia-eagles-tickets",
      affiliate: true,
    },
    tags: ["NFL", "Football", "From $120"],
  },

  {
    id: 26, type: "recommendation",
    title: "Nitehawk Cinema",
    desc: "Cinema · Williamsburg · 0.8km away",
    longDesc: "Brooklyn's beloved dine-in cinema. First-run and independent films with food and cocktails served at your seat.",
    time: "Open nearby",
    location: "136 Metropolitan Ave, Williamsburg, Brooklyn",
    lat: 40.7157, lng: -73.9625,
    date: fmt(today),
    source: "Foursquare", category: "Culture",
    catColor: "#B8920A", catDot: "#D4A80C",
    saves: 0, img: "🎬",
    booking: {
      label: "View details",
      url: "https://foursquare.com/v/nitehawk-cinema",
      affiliate: false,
    },
    tags: ["Cinema", "Williamsburg"],
  },
  {
    id: 27, type: "recommendation",
    title: "Smorgasburg",
    desc: "Food Market · DUMBO · 0.3km away",
    longDesc: "America's largest weekly open-air food market. 100+ local vendors every Saturday in Williamsburg and Sunday in DUMBO.",
    time: "Open nearby",
    location: "Brooklyn Bridge Park, DUMBO, Brooklyn",
    lat: 40.7024, lng: -73.9875,
    date: fmt(today),
    source: "Foursquare", category: "Food & Drink",
    catColor: "#D43030", catDot: "#FF6B6B",
    saves: 0, img: "🍽️",
    booking: {
      label: "View details",
      url: "https://foursquare.com/v/smorgasburg",
      affiliate: false,
    },
    tags: ["Food Market", "DUMBO"],
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
  "All", "Events", "Food & Drink", "Nightlife", "Music", "Community", "Sport", "Activities", "Wellness", "Outdoors", "Nearby",
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
  "AMC Theatres":       "#CC0000",
  "Google Events":      "#4285F4",
  "Lititz PA":          "#E67E22",
  "Mickey's Black Box": "#7B5CE0",
  "SeatGeek":           "#F05537",
  "Foursquare":         "#F94877",
  "Activities":         "#1A9E98",
  "Wellness":           "#C25F8F",
  "Nightlife":          "#4A1570",
  "Outdoors":           "#2D7A3A",
};
