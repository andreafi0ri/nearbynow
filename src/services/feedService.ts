import { EventItem, MOCK_EVENTS } from "../data/mockEvents";
import { fetchRedditPosts, getLocalSubreddits } from "./redditService";
import { fetchRSSFeeds } from "./rssService";
import { searchEventbrite } from "./eventbriteService";
import { searchMeetup } from "./meetupService";
import { searchTicketmaster, searchTicketmasterSports } from "./ticketmasterService";
import { fetchVisitLancasterEvents } from "./visitLancasterService";
import { deduplicateFeed, MultiSourceEvent } from "./deduplicationService";
import { getRecommendations, type FeedResult } from "./recommendationEngine";
import { searchViatorExperiences } from "./viatorService";
import { searchNearbyPlaces, searchPlacesByText, fetchCinemas } from "./googlePlacesService";
import { getShowtimes } from "./showtimesService";
import { getNearbyActivities } from "./activitiesService";
import { getNightlife } from "./nightlifeService";
import { getParksAndOutdoors } from "./parksService";
import { SEARCH_CONFIG, shouldFetchGooglePlaces, metresToMiles } from "../config/searchConfig";
import type { Coords } from "./recommendationsService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyNewEvents } from "../utils/notificationHelpers";

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortByDate(items: MultiSourceEvent[]): MultiSourceEvent[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Mock seed ────────────────────────────────────────────────────────────────

const BRIXTON_KEYWORDS   = ["brixton", "lambeth", "sw9", "sw2", "clapham", "streatham", "stockwell"];
const LANCASTER_KEYWORDS = ["lancaster", "lancaster city", "lancaster pa"];

function mockEventsForArea(area: string): EventItem[] {
  const lower = area.toLowerCase();
  return BRIXTON_KEYWORDS.some(kw => lower.includes(kw)) ? MOCK_EVENTS : [];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Safely extract fulfilled values from a PromiseSettledResult. */
const extract = <T>(r: PromiseSettledResult<T[]>): T[] =>
  r.status === "fulfilled" ? r.value : [];

// ─── Food & Drink places ──────────────────────────────────────────────────────

const FOOD_PLACE_TYPES = ["restaurant", "bar", "cafe", "bakery", "night_club"];

/**
 * Always-on fetch of food/drink venues from Google Places.
 * Runs independently of the event-count threshold so the Food & Drink filter
 * always has results regardless of how many events other sources return.
 * Capped at 10 results to minimise API cost.
 */
async function fetchFoodPlaces(area: string, coords?: Coords): Promise<EventItem[]> {
  try {
    const results = coords
      ? await searchNearbyPlaces(
          coords.lat, coords.lng,
          SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES,
          FOOD_PLACE_TYPES,
        )
      : await searchPlacesByText("restaurants bars cafes", area);

    // Use a distinct source name so the feed can identify these as
    // filter-only items and hide them from the "All" view.
    return results.slice(0, 10).map(item => ({ ...item, source: "Food Places" }));
  } catch {
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches all live event sources in parallel, enforces the Google Places
 * threshold rule (only fetch Places if live event count < 5), deduplicates,
 * and returns a FeedResult.
 *
 * Google Places results are NEVER fetched when eventCount >= GOOGLE_PLACES_THRESHOLD.
 * This saves API quota and improves load speed for areas with sufficient events.
 *
 * @param area    Human-readable area name e.g. "Nashville, Davidson County"
 * @param coords  Optional coordinates — enables accurate Nearby Search and
 *                Facebook location-based search
 */
export async function getFeed(area: string, coords?: Coords): Promise<FeedResult> {
  const subreddits  = getLocalSubreddits(area);
  const isLancaster = LANCASTER_KEYWORDS.some(kw => area.toLowerCase().includes(kw));

  // ── Step 1: Fetch ALL sources in parallel — event sources + always-on GP filters
  //
  // Filter-specific GP sources are fetched here unconditionally, exactly like
  // Food Places and Cinema. Each uses its own 30-min/1-hr cache so re-selecting
  // a filter never costs an extra API call. They carry distinct source names
  // ("Nightlife Places", "Outdoor Places") so FILTER_ONLY_SOURCE_MAP can hide
  // them from the "All" view while surfacing them in their dedicated filter.
  const [
    redditResult,
    rssResult,
    eventbriteResult,
    meetupResult,
    ticketmasterResult,
    sportsResult,
    visitLancasterResult,
    foodPlacesResult,
    cinemaResult,
    viatorAlwaysResult,
    showtimesResult,
    nightlifeResult,
    parksResult,
    activitiesResult,
  ] = await Promise.allSettled([
    Promise.all(subreddits.map(sub => fetchRedditPosts(sub, SEARCH_CONFIG.REDDIT_MAX_RESULTS))).then(r => r.flat()),
    fetchRSSFeeds(area),
    searchEventbrite(area),
    searchMeetup(area),
    searchTicketmaster(area),
    searchTicketmasterSports(area, coords), // sports-only, 25-mile radius, 1-hr cache
    isLancaster ? fetchVisitLancasterEvents() : Promise.resolve([]),
    fetchFoodPlaces(area, coords),       // always-on → Food & Drink filter
    fetchCinemas(area, coords),          // always-on → Cinema filter
    searchViatorExperiences(area, coords), // always-on → Viator/Nearby
    getShowtimes(area, coords),          // always-on → AMC filter
    getNightlife(area, coords),          // always-on → Nightlife filter (hidden from All)
    getParksAndOutdoors(area, coords),   // always-on → Outdoors filter  (hidden from All)
    getNearbyActivities(area, coords),   // always-on → Activities filter (shown in All)
  ]);

  const seed = mockEventsForArea(area);

  // Extract showtime groups for the Cinema grouped view; map to feed items for All
  const showtimeGroups = showtimesResult.status === "fulfilled" ? showtimesResult.value : [];
  const showtimeItems  = showtimeGroups.map(g => g.feedItem);

  const live: EventItem[] = [
    ...extract(redditResult),
    ...extract(rssResult),
    ...extract(eventbriteResult),
    ...extract(meetupResult),
    ...extract(ticketmasterResult),
    ...extract(sportsResult),        // Sports-only TM fetch (25-mile radius, dedup handles overlap)
    ...extract(visitLancasterResult),
    ...extract(foodPlacesResult),
    ...extract(cinemaResult),
    ...showtimeItems,
    ...extract(viatorAlwaysResult),
    ...extract(nightlifeResult),    // Nightlife Places — hidden from All via FILTER_ONLY_SOURCE_MAP
    ...extract(parksResult),        // Outdoor Places   — hidden from All via FILTER_ONLY_SOURCE_MAP
    ...extract(activitiesResult),   // Activities (category) — shown in All TicketCard section
  ];

  // ── Step 2: GP recommendations (general food + attractions) ──────────────
  // These are the "You might also like" items in the All view footer.
  // Always fetched (threshold 9999 effectively removes the gate).
  const allRaw     = [...seed, ...live];
  const eventItems = allRaw.filter(item => item.type === "event");
  const shouldFetch = shouldFetchGooglePlaces(eventItems.length);

  let googlePlacesItems: EventItem[] = [];

  if (shouldFetch) {
    const gpResult = await Promise.allSettled([getRecommendations(area, coords)]);
    googlePlacesItems = gpResult[0].status === "fulfilled"
      ? gpResult[0].value
      : (console.warn("[Feed] GP recommendations failed:", (gpResult[0] as PromiseRejectedResult).reason), []);
  }

  // ── Step 3: Merge, deduplicate, sort ─────────────────────────────────────
  const allItems = [...allRaw, ...googlePlacesItems];
  const { events: deduplicated, stats } = deduplicateFeed(allItems);
  const items = sortByDate(deduplicated);

  // ── Debug summary ─────────────────────────────────────────────────────────
  console.log("━━━ HEARBY FEED SUMMARY ━━━");
  console.log(`Area: ${area} | Coords: ${coords ? `${coords.lat}, ${coords.lng}` : "none (using defaults)"}`);
  console.log("Results per source:");
  console.log(`  Reddit:           ${extract(redditResult).length}`);
  console.log(`  RSS:              ${extract(rssResult).length}`);
  console.log(`  Eventbrite:       ${extract(eventbriteResult).length}`);
  console.log(`  Meetup:           ${extract(meetupResult).length}`);
  console.log(`  Ticketmaster:     ${extract(ticketmasterResult).length}`);
  console.log(`  TM Sports:        ${extract(sportsResult).length} (sports-only, 25mi radius)`);
  console.log(`  Visit Lancaster:  ${extract(visitLancasterResult).length}`);
  console.log(`  Food Places:      ${extract(foodPlacesResult).length} (always-on, filter-only)`);
  console.log(`  Cinemas:          ${extract(cinemaResult).length} (always-on)`);
  console.log(`  AMC Showtimes:    ${showtimeItems.length} cards`);
  console.log(`  Viator:           ${extract(viatorAlwaysResult).length} (always-on)`);
  console.log(`  Nightlife Places: ${extract(nightlifeResult).length} (always-on, filter-only)`);
  console.log(`  Outdoor Places:   ${extract(parksResult).length} (always-on, filter-only)`);
  console.log(`  Activities:       ${extract(activitiesResult).length} (always-on, shown in All)`);
  console.log(`  GP Recs:          ${googlePlacesItems.length} (recommendations footer)`);
  console.log("Deduplication stats:");
  console.log(`  Input:                 ${stats.inputCount} items`);
  console.log(`  Output:                ${stats.outputCount} items`);
  console.log(`  Hard merged:           ${stats.hardMergeCount} groups`);
  console.log(`  Fuzzy matches flagged: ${stats.fuzzyMatchCount}`);
  console.log("  Source breakdown:", stats.sourceBreakdown);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Fire-and-forget: check for new events and notify user if any found.
  // Never awaited — must never block the feed return.
  const notifArea = await AsyncStorage.getItem("nearbynow_area").catch(() => null) ?? area;
  notifyNewEvents(deduplicated, notifArea).catch(err =>
    console.warn("[Feed] Notification check failed:", err)
  );

  return {
    items,
    showingRecommendations: googlePlacesItems.length > 0,
    eventCount:             eventItems.length,
    recommendationCount:    googlePlacesItems.length,
    thresholdUsed:          SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD,
    cinemaGroups:           showtimeGroups,
  };
}
