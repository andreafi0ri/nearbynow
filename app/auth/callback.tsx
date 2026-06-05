// app/auth/callback.tsx — Supabase magic link auth callback screen.
//
// Handles every URL format Supabase may send:
//   ?code=<value>                  PKCE exchange  (exchangeCodeForSession)
//   ?token_hash=<value>&type=<t>   OTP hash       (verifyOtp)
//   #access_token=<v>&refresh_...  Implicit flow  (setSession — fallback if
//                                                  detectSessionInUrl missed it)
//
// URL sources:
//   Web:               window.location.href  (fresh page load from email link)
//   Mobile warm-start: authState module      (stored by _layout.tsx deep link handler)
//   Mobile cold-start: Linking.getInitialURL (app launched from the link)
//
// After the exchange the screen listens for any of INITIAL_SESSION / SIGNED_IN /
// TOKEN_REFRESHED, then routes to /feed (area saved) or /location.
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../src/lib/supabase";
import { consumePendingCallbackUrl } from "../../src/lib/authState";
import { loadProfile } from "../../src/services/profileService";
import { useTheme } from "../../src/hooks/useTheme";

const TIMEOUT_MS = 15_000;

/**
 * True when the app is running as an installed PWA (launched from the home
 * screen in standalone display mode) rather than inside a browser tab.
 *
 * Magic links always open in the system browser (Chrome/Safari), never in the
 * installed PWA — so a browser-context callback must NOT silently route to the
 * feed (a different storage context where there's no session yet). Instead it
 * shows a "return to app" screen.
 */
function isInstalledPWA(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari home-screen apps
    (window.navigator as any)?.standalone === true
  );
}

// ─── URL param helpers ────────────────────────────────────────────────────────

function getQueryParam(url: string, name: string): string | null {
  const match = url.match(new RegExp(`[?&]${name}=([^&#\\s]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getHashParam(url: string, name: string): string | null {
  const hash = url.includes("#") ? url.split("#")[1] : "";
  const params = new URLSearchParams(hash);
  return params.get(name);
}

// ─── Exchange helper ──────────────────────────────────────────────────────────

/**
 * Attempt to exchange the auth credentials found in `url` for a session.
 * Tries every format so the screen works regardless of how the Supabase
 * project is configured (PKCE vs implicit vs OTP token-hash).
 */
async function exchangeFromUrl(url: string): Promise<void> {
  // 1. PKCE code — present when the Supabase project has PKCE enabled for OTP
  const code = getQueryParam(url, "code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (!error) return;
    console.warn("[AuthCallback] exchangeCodeForSession:", error.message);
    // Fall through — might still have a token_hash or hash fragment
  }

  // 2. OTP token-hash — older Supabase behaviour or when PKCE is disabled
  const tokenHash = getQueryParam(url, "token_hash");
  if (tokenHash) {
    const type = (getQueryParam(url, "type") ?? "magiclink") as Parameters<
      typeof supabase.auth.verifyOtp
    >[0]["type"];
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return;
    console.warn("[AuthCallback] verifyOtp:", error.message);
  }

  // 3. Implicit flow hash fragment — detectSessionInUrl:true handles this on
  //    web, but on mobile we must do it ourselves.
  const accessToken  = getHashParam(url, "access_token");
  const refreshToken = getHashParam(url, "refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });
    if (error) console.warn("[AuthCallback] setSession:", error.message);
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuthCallback() {
  const router = useRouter();
  const { theme: T } = useTheme();
  const [timedOut, setTimedOut] = useState(false);
  const [authDone, setAuthDone] = useState(false); // true → show return-to-app screen (browser context)

  useEffect(() => {
    let done = false;

    const proceed = async () => {
      if (done) return;
      done = true;
      // Sync username/avatar from Supabase user_metadata to local cache
      // so the profile screen shows the correct values immediately,
      // even on a new device or after reinstall.
      await loadProfile().catch(() => {});
      const area = await AsyncStorage.getItem("hearby_area").catch(() => null);

      if (isInstalledPWA()) {
        // Inside the installed PWA — normal routing.
        router.replace(area ? "/feed" : "/location");
      } else {
        // In the system browser after tapping the magic link. Auth succeeded
        // here, but the session lives in the browser's storage — the PWA on the
        // home screen has its own context. Don't route to the feed (it would
        // show signed-in only in this throwaway browser tab). Show a clear
        // "return to the app" screen instead.
        setAuthDone(true);
      }
    };

    const init = async () => {
      // ── 1. Resolve the callback URL ──────────────────────────────────────
      let url: string | null = null;

      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Web: fresh page load — the full URL (including ?code= or #access_token=)
        // is in window.location.  detectSessionInUrl:true may already be handling
        // the hash fragment, but we also try explicitly for robustness.
        url = window.location.href;
      } else {
        // Mobile: _layout.tsx stored the deep-link URL before routing here
        url = consumePendingCallbackUrl();
        // Cold-start fallback — app was launched directly from the link
        if (!url) url = await Linking.getInitialURL().catch(() => null);
      }

      // ── 2. Drive the exchange ────────────────────────────────────────────
      if (url) await exchangeFromUrl(url);

      // ── 3. Fast path — session may already be set ────────────────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await proceed();
    };

    init().catch(err => console.warn("[AuthCallback] init error:", err));

    // ── 4. Auth-state listener ────────────────────────────────────────────
    // Fires for every auth event including INITIAL_SESSION (when detectSessionInUrl
    // establishes a session before our listener was set up) and the async
    // completion of the exchanges above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          session &&
          (event === "SIGNED_IN" ||
           event === "INITIAL_SESSION" ||
           event === "TOKEN_REFRESHED")
        ) {
          await proceed();
        }
      }
    );

    // ── 5. Safety timeout ─────────────────────────────────────────────────
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        setTimedOut(true);
        setTimeout(() => router.replace("/location"), 2000);
      }
    }, TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // ── Return-to-app screen (browser context after successful auth) ──────────
  if (authDone) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAF7F3", padding: 32 }}>
        <View style={{
          backgroundColor: "#FDECEA", borderColor: "#E0392A", borderWidth: 2,
          borderRadius: 50, width: 80, height: 80,
          alignItems: "center", justifyContent: "center", marginBottom: 24,
        }}>
          <Text style={{ fontSize: 36, color: "#E0392A" }}>✓</Text>
        </View>

        <Text style={{
          fontSize: 24, fontWeight: "800", fontFamily: "Inter_700Bold",
          color: "#111111", textAlign: "center", marginBottom: 12, letterSpacing: -0.5,
        }}>
          You're signed in
        </Text>

        <Text style={{
          fontSize: 15, color: "#777788", textAlign: "center",
          lineHeight: 22, marginBottom: 32, fontFamily: "Inter_400Regular",
        }}>
          Return to the Nearby &amp; Now app{"\n"}on your home screen to continue.
        </Text>

        <TouchableOpacity
          onPress={() => {
            if (Platform.OS === "web") {
              // Android Chrome (with manifest handle_links) may open the installed
              // PWA directly; on iOS the user taps the home-screen icon manually.
              window.location.href = "https://www.nearbyandnow.com/?source=pwa";
            }
          }}
          style={{
            backgroundColor: "#111111", borderRadius: 14,
            paddingVertical: 14, paddingHorizontal: 28,
            width: "100%", maxWidth: 320, alignItems: "center", marginBottom: 14,
          }}
        >
          <Text style={{ color: "#F5F0E6", fontWeight: "700", fontSize: 15, fontFamily: "Inter_700Bold" }}>
            Open Nearby &amp; Now →
          </Text>
        </TouchableOpacity>

        <Text style={{
          fontSize: 12, color: "#AAAABC", textAlign: "center",
          lineHeight: 18, fontFamily: "Inter_400Regular",
        }}>
          On iPhone: tap the Nearby &amp; Now icon{"\n"}on your home screen to open the app.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: T.bg,
        padding: 28,
      }}
    >
      {timedOut ? (
        <Text
          style={{
            color: T.text,
            textAlign: "center",
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          Sign-in timed out.{"\n"}Redirecting…
        </Text>
      ) : (
        <>
          <ActivityIndicator color={T.gold} size="large" />
          <Text
            style={{
              color: T.muted,
              marginTop: 16,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Signing you in…
          </Text>
        </>
      )}
    </View>
  );
}
