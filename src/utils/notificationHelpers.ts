// src/utils/notificationHelpers.ts
// Utility functions for triggering contextual notifications after a feed
// refresh. Import these in feedService.ts to notify users about new content.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { scheduleLocalNotification } from "../services/notificationService";
import { EventItem } from "../data/mockEvents";

const SEEN_EVENTS_KEY = "nearbynow_seen_events";

/**
 * Compares the latest feed items against a persisted list of seen event IDs.
 * If genuinely new events are found, fires ONE consolidated notification —
 * never one per event, to avoid notification spam.
 *
 * Call this after every successful feed refresh. It is fire-and-forget;
 * await is optional and failures are handled internally.
 *
 * Requires the "events" notification preference to be enabled.
 *
 * @param newItems  Deduplicated feed items returned by getFeed()
 * @param area      The user's active area, shown in the notification title
 */
export async function notifyNewEvents(
  newItems: EventItem[],
  area: string,
): Promise<void> {
  try {
    // ── Step 1: Load previously seen event IDs ────────────────────────────────
    const stored = await AsyncStorage.getItem(SEEN_EVENTS_KEY);
    const seenIds: string[] = stored ? JSON.parse(stored) : [];

    // ── Step 2: Find genuinely new events ─────────────────────────────────────
    const newEvents = newItems.filter(
      item => item.type === "event" && !seenIds.includes(String(item.id))
    );

    // ── Step 3: Send ONE consolidated notification (never one per event) ──────
    if (newEvents.length > 0) {
      const title = newEvents.length === 1
        ? `New event in ${area}: ${newEvents[0].title}`
        : `${newEvents.length} new events in ${area}`;

      const body = newEvents.length === 1
        ? `${newEvents[0].time} · ${newEvents[0].location}`
        : newEvents.slice(0, 3).map(e => e.title).join(", ");

      await scheduleLocalNotification(
        "events",
        title,
        body,
        { screen: "feed", count: newEvents.length },
      );
    }

    // ── Step 4: Update seen IDs (cap at 200 to avoid unbounded growth) ────────
    const allIds = [
      ...seenIds,
      ...newItems.map(e => String(e.id)),
    ].slice(-200);

    await AsyncStorage.setItem(SEEN_EVENTS_KEY, JSON.stringify(allIds));
  } catch (err) {
    // Never crash the feed — notifications are best-effort
    console.warn("[notifyNewEvents] Failed:", err);
  }
}

/**
 * Sends a breaking news notification immediately.
 * Only fires when the "breaking" notification preference is enabled.
 * Only call this for genuinely urgent content — not for every news item.
 *
 * @param title  Short notification title (e.g. "Road closure: A23 Brixton")
 * @param body   Notification body text with details
 */
export async function notifyBreakingNews(
  title: string,
  body: string,
): Promise<void> {
  await scheduleLocalNotification("breaking", title, body, { screen: "feed" });
}
