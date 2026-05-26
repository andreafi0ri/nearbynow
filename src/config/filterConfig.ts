// src/config/filterConfig.ts
// Category and source filter definitions for the feed screen.
// matchFn receives an EventItem and returns true if the item passes.

import { EventItem } from "../data/mockEvents";

export type FilterOption = {
  id: string;
  label: string;
  icon: string;
  matchFn: (item: EventItem) => boolean;
};

const getToday = () => new Date().toISOString().split("T")[0];

export const FILTERS: FilterOption[] = [
  {
    id: "All",
    label: "All",
    icon: "✦",
    matchFn: () => true,
  },
  {
    id: "Free",
    label: "Free",
    icon: "🆓",
    matchFn: item =>
      item.category === "Free" ||
      item.tags?.includes("free") === true ||
      /\bfree\b/i.test(item.title + " " + item.desc),
  },
  {
    id: "Nearby",
    label: "Nearby",
    icon: "📍",
    matchFn: item => item.type === "recommendation",
  },
  {
    id: "Today",
    label: "Today",
    icon: "📅",
    matchFn: item => item.date === getToday(),
  },
  {
    id: "Events",
    label: "Events",
    icon: "🎟️",
    matchFn: item => item.type === "event",
  },
  {
    id: "Food & Drink",
    label: "Food & Drink",
    icon: "🍽️",
    matchFn: item => {
      // Hard-exclude items that belong to a clearly non-food category.
      // This prevents music/theatre events whose venue name contains "bar" or
      // "pub" from leaking through the text-match rules below.
      const NON_FOOD = new Set([
        "Music", "Culture", "Arts", "Sport",
        "Community", "Cinema", "Outdoors", "Local Gov",
      ]);
      if (item.category && NON_FOOD.has(item.category)) return false;

      return (
        item.category === "Food & Drink" ||
        item.category === "Restaurant"   ||
        item.source   === "Food Places"  ||
        // Catch food-tagged items from Reddit / RSS
        item.tags?.some(t => /food|drink|restaurant|bar|cafe|pub|eat/i.test(t)) === true ||
        // Catch food emoji assigned by rssParser / redditService
        ["🍽️", "🍸", "☕", "🍺", "🍕", "🍣"].includes(item.img ?? "") ||
        // Catch items whose title/desc mention food venues
        /\b(restaurant|bar|café|cafe|pub|bistro|brasserie|diner|eatery|brunch|cocktail|tapas|ramen|sushi|pizza|burger)\b/i.test(
          `${item.title} ${item.desc}`
        )
      );
    },
  },
  {
    id: "Music",
    label: "Music",
    icon: "🎸",
    matchFn: item => item.category === "Music",
  },
  {
    id: "Culture",
    label: "Culture",
    icon: "🎭",
    matchFn: item => item.category === "Culture" || item.category === "Cinema",
  },
  {
    id: "Arts",
    label: "Arts",
    icon: "🎨",
    matchFn: item => item.category === "Arts",
  },
  {
    id: "Sport",
    label: "Sport",
    icon: "🏃",
    matchFn: item => item.category === "Sport",
  },
  {
    id: "Community",
    label: "Community",
    icon: "🤝",
    matchFn: item => item.category === "Community" || item.category === "Local Gov",
  },
  {
    id: "Outdoors",
    label: "Outdoors",
    icon: "🌳",
    matchFn: item =>
      item.category === "Outdoors" ||
      item.tags?.some(t => ["park", "outdoor", "walk", "nature", "garden"].includes(t.toLowerCase())) === true,
  },
  {
    id: "Cinema",
    label: "Cinema",
    icon: "🎬",
    matchFn: item => {
      // Hard-exclude items that belong to a clearly non-cinema category so that
      // "theatre" / "theater" in the tag regex doesn't pull in Culture/Arts events.
      const NON_CINEMA = new Set([
        "Music", "Arts", "Sport", "Community",
        "Food & Drink", "Restaurant", "Outdoors", "Local Gov",
      ]);
      if (item.category && NON_CINEMA.has(item.category)) return false;

      return (
        item.category === "Cinema"    ||
        item.source   === "Showtimes" ||
        item.tags?.some(t => /cinema|movie|film/i.test(t)) === true
      );
    },
  },
];

export const SOURCE_FILTERS: FilterOption[] = [
  {
    id: "Reddit",
    label: "Reddit",
    icon: "🤖",
    matchFn: item => item.source.startsWith("r/"),
  },
  {
    id: "Local News",
    label: "Local News",
    icon: "📰",
    matchFn: item =>
      !item.source.startsWith("r/") &&
      !["Eventbrite", "Meetup", "Ticketmaster", "Google Places", "Showtimes"].includes(item.source),
  },
  {
    id: "Eventbrite",
    label: "Eventbrite",
    icon: "🎉",
    matchFn: item => item.source === "Eventbrite",
  },
  {
    id: "Meetup",
    label: "Meetup",
    icon: "👥",
    matchFn: item => item.source === "Meetup",
  },
  {
    id: "Ticketmaster",
    label: "Ticketmaster",
    icon: "🎫",
    matchFn: item => item.source === "Ticketmaster",
  },
  {
    id: "src_google",
    label: "Google Places",
    icon: "📍",
    matchFn: item => item.source === "Google Places",
  },
  {
    id: "src_viator",
    label: "Viator",
    icon: "🗺️",
    matchFn: item => item.source === "Viator",
  },
];
