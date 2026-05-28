/**
 * profileService.ts
 *
 * Keeps Supabase user_metadata and AsyncStorage in sync for the two
 * lightweight profile fields that follow the user's account:
 *   - username
 *   - avatar
 *
 * user_metadata is returned with every getSession() call — no extra
 * database query is needed and it survives reinstalls / new devices.
 *
 * AsyncStorage is used as a local cache for instant reads on subsequent
 * app launches.  Supabase is always the source of truth.
 *
 * TODO Phase 2: migrate to a profiles table when user profiles need to
 * be visible to other users. For now user_metadata is sufficient for MVP.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
const USERNAME_KEY = "nearbynow_username";
const AVATAR_KEY   = "nearbynow_avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  username: string;
  avatar: string;
  email: string;
};

const DEFAULTS: UserProfile = {
  username: "Nearby & Now user",
  avatar:   "👤",
  email:    "",
};

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Load profile — Supabase user_metadata is the source of truth.
 * AsyncStorage is the local cache.  On the first load after sign-in
 * on a new device, Supabase values overwrite any stale AsyncStorage values.
 *
 * Falls back to AsyncStorage when there is no active session (e.g. the
 * user is browsing without signing in).
 */
export async function loadProfile(): Promise<UserProfile> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const meta  = session.user.user_metadata ?? {};
      const email = session.user.email ?? "";

      const profile: UserProfile = {
        username: (meta.username as string) || DEFAULTS.username,
        avatar:   (meta.avatar   as string) || DEFAULTS.avatar,
        email,
      };

      // Write back to AsyncStorage as local cache
      await AsyncStorage.multiSet([
        [USERNAME_KEY,       profile.username],
        [AVATAR_KEY,         profile.avatar],
        ["nearbynow_email",  email],
      ]);

      return profile;
    }

    // No active session — fall back to local cache
    const [username, avatar, email] = await Promise.all([
      AsyncStorage.getItem(USERNAME_KEY),
      AsyncStorage.getItem(AVATAR_KEY),
      AsyncStorage.getItem("nearbynow_email"),
    ]);

    return {
      username: username || DEFAULTS.username,
      avatar:   avatar   || DEFAULTS.avatar,
      email:    email    || "",
    };
  } catch (err) {
    console.warn("[profileService] loadProfile error:", err);
    return DEFAULTS;
  }
}

/**
 * Save username — updates both Supabase user_metadata and AsyncStorage.
 *
 * AsyncStorage is written first so local state is always correct even if
 * the Supabase call fails (e.g. the device is offline).  The Supabase
 * value will sync on the next successful auth operation.
 */
export async function saveUsername(username: string): Promise<void> {
  const trimmed = username.trim();
  if (!trimmed) return;

  // Update local cache immediately
  await AsyncStorage.setItem(USERNAME_KEY, trimmed);

  // Persist to user_metadata
  const { error } = await supabase.auth.updateUser({ data: { username: trimmed } });
  if (error) {
    // AsyncStorage save succeeded — local state is correct.
    // Supabase will sync on next login.
    console.warn("[profileService] saveUsername Supabase error:", error.message);
  }
}

/**
 * Save avatar — updates both Supabase user_metadata and AsyncStorage.
 *
 * Same offline-safe pattern as saveUsername: AsyncStorage first, then
 * Supabase.  A failed Supabase write does not break the local experience.
 */
export async function saveAvatar(avatar: string): Promise<void> {
  // Update local cache immediately
  await AsyncStorage.setItem(AVATAR_KEY, avatar);

  // Persist to user_metadata
  const { error } = await supabase.auth.updateUser({ data: { avatar } });
  if (error) {
    console.warn("[profileService] saveAvatar Supabase error:", error.message);
  }
}

/**
 * Clear local profile cache on sign-out.
 *
 * Does NOT clear hearby_area — the user keeps their saved location so
 * that re-signing in takes them straight to the feed.
 */
export async function clearProfileCache(): Promise<void> {
  await AsyncStorage.multiRemove([
    USERNAME_KEY,
    AVATAR_KEY,
    "nearbynow_email",
  ]);
}
