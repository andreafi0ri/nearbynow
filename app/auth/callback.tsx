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
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../src/lib/supabase";
import { consumePendingCallbackUrl } from "../../src/lib/authState";
import { loadProfile } from "../../src/services/profileService";
import { useTheme } from "../../src/hooks/useTheme";

const TIMEOUT_MS = 15_000;

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
      router.replace(area ? "/feed" : "/location");
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
