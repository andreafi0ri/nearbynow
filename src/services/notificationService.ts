// src/services/notificationService.ts
// Comprehensive push notification service for Hearby.
//
// IMPORTANT: expo-notifications requires a real device or development build.
//   Push tokens return null on simulators and Expo Go.
//   To test: npx expo run:ios  (creates a dev build)
//
// EAS Project ID:
//   Run `eas init` in the project root to generate.
//   Until then, push tokens work in development via Expo Go on real devices.
//
// Production: run `eas build` to provision push credentials automatically.
// Free tier: unlimited push notifications via Expo.

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { EventItem } from "../data/mockEvents";

// ─── Notification handler ─────────────────────────────────────────────────────
// Must be set at module level — controls how notifications behave when the
// app is in the foreground (alert, sound, badge).

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  });
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const PUSH_TOKEN_KEY       = "nearbynow_push_token";
const NOTIF_PREFS_KEY      = "nearbynow_notif_prefs";
const LAST_NOTIF_CHECK_KEY = "nearbynow_last_notif_check";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationPreferences = {
  /** Breaking local news: incidents, closures, urgent updates. */
  breaking: boolean;
  /** New events nearby: when new events appear in the user's area. */
  events: boolean;
  /** Recommendations: new restaurants and places to try. */
  recs: boolean;
  /** Weekly digest: Monday morning summary. */
  weekly: boolean;
};

export const DEFAULT_PREFS: NotificationPreferences = {
  breaking: true,
  events:   true,
  recs:     false,
  weekly:   true,
};

// ─── Function 1: registerForPushNotifications ─────────────────────────────────

/**
 * Requests push notification permissions and registers the device for
 * Expo push notifications. Persists the token to AsyncStorage.
 *
 * Will return null on:
 *   - Simulators (use real device or dev build)
 *   - Expo Go (use: npx expo run:ios)
 *   - User-denied permissions
 *   - Any unexpected error
 *
 * @returns Expo push token string, or null if unavailable
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;

    // Simulators cannot receive push — skip silently
    if (!Device.isDevice) {
      console.info(
        "Push notifications: simulator detected — " +
        "skipping registration (use real device or dev build)"
      );
      return null;
    }

    // Check / request permissions
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.info("Push notifications: permission denied by user");
      return null;
    }

    // Android notification channels
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name:             "Nearby & Now",
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       "#B8920A",
      });

      await Notifications.setNotificationChannelAsync("breaking", {
        name:             "Breaking local news",
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500],
        lightColor:       "#D94040",
      });

      await Notifications.setNotificationChannelAsync("events", {
        name:       "New events",
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: "#B8920A",
      });
    }

    // Get Expo push token
    // TODO: replace with actual EAS project ID from `eas init`.
    // For development, EXPO_PUBLIC_PROJECT_ID from .env is used.
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    const pushToken = token.data;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
    console.log("Push token registered:", pushToken);
    return pushToken;
  } catch (err) {
    console.warn("Push registration failed:", err);
    return null;
  }
}

// ─── Function 2: saveNotificationPreferences ──────────────────────────────────

/**
 * Persists notification preferences to AsyncStorage and cancels any
 * scheduled notifications for types that were turned off.
 *
 * Also mirrors the breaking-news preference to "hearby_breaking_news"
 * so rssService can continue to gate news sources correctly.
 *
 * @param prefs Updated preferences object
 */
export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));

    // Mirror breaking-news to the legacy key used by rssService
    await AsyncStorage.setItem("hearby_breaking_news", String(prefs.breaking));

    // Cancel scheduled notifications for types that are now off
    if (!prefs.breaking) await cancelNotificationsByType("breaking");
    if (!prefs.events)   await cancelNotificationsByType("events");
    if (!prefs.recs)     await cancelNotificationsByType("recs");
    if (!prefs.weekly)   await cancelScheduledWeeklyDigest();

    console.log("Notification prefs saved:", prefs);
  } catch (err) {
    console.warn("Failed to save notification prefs:", err);
  }
}

// ─── Function 3: loadNotificationPreferences ──────────────────────────────────

/**
 * Loads notification preferences from AsyncStorage.
 * Returns DEFAULT_PREFS if no preferences have been saved yet.
 *
 * @returns Current notification preferences
 */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
    if (stored) return JSON.parse(stored) as NotificationPreferences;
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_PREFS };
}

// ─── Function 4: scheduleLocalNotification ────────────────────────────────────

/**
 * Schedules a local notification for a given notification type.
 * Silently returns null if the type is currently disabled in preferences.
 *
 * @param type            One of the NotificationPreferences keys
 * @param title           Notification title
 * @param body            Notification body text
 * @param data            Optional payload attached to the notification
 * @param triggerSeconds  Delay in seconds before showing (null = immediate)
 * @returns Notification identifier, or null if skipped/failed
 */
export async function scheduleLocalNotification(
  type: keyof NotificationPreferences,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  triggerSeconds?: number,
): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;

    // Check preference gate — skip if this type is disabled
    const prefs = await loadNotificationPreferences();
    if (!prefs[type]) {
      console.log(`Notification type "${type}" is disabled — skipped`);
      return null;
    }

    const channelId =
      type === "breaking" ? "breaking" :
      type === "events"   ? "events"   : "default";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type, ...data },
        sound: true,
        badge: 1,
        ...(Platform.OS === "android" && { channelId }),
      },
      trigger: triggerSeconds != null
        ? ({ seconds: triggerSeconds } as Notifications.NotificationTriggerInput)
        : null,
    });

    console.log(`Scheduled ${type} notification: "${title}" (id: ${id})`);
    return id;
  } catch (err) {
    console.warn(`Failed to schedule ${type} notification:`, err);
    return null;
  }
}

// ─── Function 5: scheduleEventNotification ────────────────────────────────────

/**
 * Schedules a reminder notification for a saved event, fired N minutes
 * before the event starts. Requires event.startIso to be set.
 *
 * Only fires when the "events" notification preference is enabled.
 *
 * @param event         The event to remind about
 * @param minutesBefore Minutes before event start to fire the reminder (default 60)
 * @returns Notification identifier, or null if not scheduled
 */
export async function scheduleEventNotification(
  event: EventItem,
  minutesBefore: number = 60,
): Promise<string | null> {
  try {
    if (!event.startIso) return null;

    const eventTime   = new Date(event.startIso);
    const triggerTime = new Date(eventTime.getTime() - minutesBefore * 60 * 1000);

    // Don't schedule if trigger time is already in the past
    if (triggerTime <= new Date()) return null;

    const delaySecs = Math.floor((triggerTime.getTime() - Date.now()) / 1000);

    return scheduleLocalNotification(
      "events",
      `Upcoming: ${event.title}`,
      `Starting in ${minutesBefore} minutes · ${event.location}`,
      { eventId: event.id, screen: "detail" },
      delaySecs,
    );
  } catch (err) {
    console.warn("Failed to schedule event notification:", err);
    return null;
  }
}

// ─── Function 6: scheduleWeeklyDigest ────────────────────────────────────────

/**
 * Schedules a recurring weekly digest notification every Monday at 9am.
 * The trigger is calendar-based and fires on the device — no server needed.
 *
 * Only fires when the "weekly" notification preference is enabled.
 *
 * Note: In Phase 2, move to server-side push via Expo EAS so it fires
 * even when the app has not been opened recently.
 *
 * @param area  The user's active area, shown in the notification title
 * @returns Notification identifier, or null if not scheduled
 */
export async function scheduleWeeklyDigest(area: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;

    const prefs = await loadNotificationPreferences();
    if (!prefs.weekly) return null;

    // Cancel any existing weekly digest before re-scheduling
    await cancelScheduledWeeklyDigest();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Your week in ${area} 📍`,
        body:  "See what's happening near you this week →",
        data:  { type: "weekly", screen: "feed" },
        sound: true,
      },
      trigger: {
        weekday:  2,      // 1 = Sunday, 2 = Monday in Expo
        hour:     9,
        minute:   0,
        repeats:  true,   // fire every Monday
      } as Notifications.NotificationTriggerInput,
    });

    console.log("Weekly digest scheduled every Monday 9am:", id);
    return id;
  } catch (err) {
    console.warn("Failed to schedule weekly digest:", err);
    return null;
  }
}

// ─── Function 7: cancelNotificationsByType ───────────────────────────────────

/**
 * Cancels all scheduled notifications whose data.type matches the given type.
 * Called automatically when a preference is toggled off.
 */
async function cancelNotificationsByType(type: string): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if ((notif.content.data as Record<string, unknown>)?.type === type) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
    console.log(`Cancelled all scheduled "${type}" notifications`);
  } catch (err) {
    console.warn(`Failed to cancel ${type} notifications:`, err);
  }
}

// ─── Function 8: cancelScheduledWeeklyDigest ─────────────────────────────────

/** Cancels all scheduled weekly digest notifications. */
async function cancelScheduledWeeklyDigest(): Promise<void> {
  await cancelNotificationsByType("weekly");
}

// ─── Function 9: handleNotificationResponse ──────────────────────────────────

/**
 * Called when the user taps a notification. Navigates to the appropriate
 * screen based on the data payload embedded in the notification.
 *
 * Pass the expo-router `router` instance from the root layout.
 *
 * @param response  The notification response from Expo
 * @param router    expo-router router instance for navigation
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any,
): void {
  try {
    const data = response.notification.request.content.data as Record<string, unknown>;

    switch (data?.screen) {
      case "detail":
        // TODO: pass eventId as route param when detail screen is ready
        router.push("/(tabs)/feed");
        break;
      case "feed":
        router.push("/(tabs)/feed");
        break;
      default:
        router.push("/(tabs)/feed");
    }
  } catch (err) {
    console.warn("handleNotificationResponse error:", err);
  }
}

// ─── Re-export LAST_NOTIF_CHECK_KEY for helpers ────────────────────────────────
export { LAST_NOTIF_CHECK_KEY };
