import { EventItem, MOCK_EVENTS } from "../data/mockEvents";
import { fetchRedditPosts, getLocalSubreddits } from "./redditService";
import { fetchRSSFeeds } from "./rssService";
import { searchEventbrite } from "./eventbriteService";
import { searchMeetup } from "./meetupService";
import { searchTicketmaster } from "./ticketmasterService";
import { fetchVisitLancasterEvents } from "./visitLancasterService";
import { deduplicateFeed, MultiSourceEvent } from "./deduplicationService";
import { getRecommendations, type FeedResult } from "./recommendationEngine";
import { searchViatorExperiences } from "./viatorService";
import { searchNearbyPlaces, searchPlacesByText, fetchCinemas } from "./googlePlacesService";
import { getShowtimes } from "./showtimesService";
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

  // ── Step 1: Fetch all non-Places sources + dedicated food places in parallel
  const [
    redditResult,
    rssResult,
    eventbriteResult,
    meetupResult,
    ticketmasterResult,
    visitLancasterResult,
    foodPlacesResult,
    cinemaResult,
    viatorAlwaysResult,
    showtimesResult,
  ] = await Promise.allSettled([
    Promise.all(subreddits.map(sub => fetchRedditPosts(sub, SEARCH_CONFIG.REDDIT_MAX_RESULTS))).then(r => r.flat()),
    fetchRSSFeeds(area),
    searchEventbrite(area),
    searchMeetup(area),
    searchTicketmaster(area),
    isLancaster ? fetchVisitLancasterEvents() : Promise.resolve([]),
    // Food/drink venues are always fetched so the Food & Drink filter always works,
    // regardless of how many events the other sources return.
    fetchFoodPlaces(area, coords),
    // Movie theaters are always fetched so the Cinema filter always works.
    fetchCinemas(area, coords),
    // Viator is always fetched so results are ready for the Nearby filter without
    // waiting for a re-fetch. Shown in All only when threshold is triggered.
    searchViatorExperiences(area, coords),
    // AMC showtimes — always fetched for the All feed (today only) and Cinema filter.
    // 1-hour cache ensures no double-fetching when Cinema filter is activated.
    getShowtimes(area, coords),
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
    ...extract(visitLancasterResult),
    ...extract(foodPlacesResult),
    ...extract(cinemaResult),
    ...showtimeItems,            // AMC showtimes appear in the All feed
    ...extract(viatorAlwaysResult),
  ];

  // ── Step 2: Threshold check — decide whether to fetch Google Places + Viator
  // Count actual events (type === "event") from all non-Places sources.
  // Recommendations from Reddit etc. don't count toward the threshold.
  const allRaw     = [...seed, ...live];
  const eventItems = allRaw.filter(item => item.type === "event");
  const shouldFetch = shouldFetchGooglePlaces(eventItems.length);

  let googlePlacesItems: EventItem[] = [];

  if (shouldFetch) {
    // Google Places only — Viator is now always-on (fetched above with other sources)
    googlePlacesItems = await getRecommendations(area, coords).catch(err => {
      console.warn("[Feed] Google Places fetch failed:", err);
      return [];
    });
    console.log(`[Feed] Google Places returned ${googlePlacesItems.length} recommendations`);
  } else {
    console.log(
      `[Feed] Google Places skipped — ${eventItems.length} events found ` +
      `(threshold: ${SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD})`
    );
  }

  // ── Step 3: Merge, deduplicate, sort ─────────────────────────────────────
  const allItems                        = [...allRaw, ...googlePlacesItems];
  const { events: deduplicated, stats } = deduplicateFeed(allItems);
  const items = sortByDate(deduplicated);

  // ── Debug summary ─────────────────────────────────────────────────────────
  console.log("━━━ HEARBY FEED SUMMARY ━━━");
  console.log(`Area: ${area} | Coords: ${coords ? `${coords.lat}, ${coords.lng}` : "none"}`);
  console.log("Radii in use:");
  console.log(`  Google Places: ${SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES}m (${metresToMiles(SEARCH_CONFIG.GOOGLE_PLACES_RADIUS_METRES)} mi) — ${shouldFetch ? "ACTIVE" : "SKIPPED (≥5 events found)"}`);
  console.log(`  Eventbrite:    ${SEARCH_CONFIG.EVENTBRITE_RADIUS_KM}km`);
  console.log(`  Meetup:        ${SEARCH_CONFIG.MEETUP_RADIUS_KM}km`);
  console.log(`  Ticketmaster:  ${SEARCH_CONFIG.TICKETMASTER_RADIUS_KM}km`);
  console.log("Results per source:");
  console.log(`  Reddit:          ${extract(redditResult).length}`);
  console.log(`  RSS:             ${extract(rssResult).length}`);
  console.log(`  Eventbrite:      ${extract(eventbriteResult).length}`);
  console.log(`  Meetup:          ${extract(meetupResult).length}`);
  console.log(`  Ticketmaster:    ${extract(ticketmasterResult).length}`);
  console.log(`  Visit Lancaster: ${extract(visitLancasterResult).length}`);
  console.log(`  Food Places:     ${extract(foodPlacesResult).length} (always-on)`);
  console.log(`  Cinemas:         ${extract(cinemaResult).length} (always-on)`);
  console.log(`  AMC Showtimes:   ${showtimeItems.length} showtime cards (${new Set(showtimeItems.map(s => s.location.split(",")[0])).size} theatres)`);
  console.log(`  Viator:          ${extract(viatorAlwaysResult).length} (always-on — hidden from All until threshold)`);
  console.log(`  Google Places:   ${googlePlacesItems.length} (threshold-gated recommendations)`);
  console.log(`Google Places threshold: ${SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD} — ${shouldFetch ? "SHOWN (too few events)" : "NOT shown (enough events)"}`);
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
