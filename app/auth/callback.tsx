// app/auth/callback.tsx — Supabase magic link auth callback screen.
//
// detectSessionInUrl:true only handles implicit flow (#access_token in hash).
// For PKCE magic links the email contains ?code=<value> and the client
// MUST call exchangeCodeForSession explicitly — there is no auto-exchange.
// We also handle the older ?token_hash= OTP format as a fallback.
//
// Web flow:
//   Browser navigates fresh to /auth/callback?code=…
//   → this screen mounts, reads window.location.href, calls exchangeCodeForSession.
//
// Mobile flow (warm start):
//   _layout.tsx handles the deep link, calls exchangeCodeForSession, then
//   router.replace("/auth/callback").  By the time we mount, the session is
//   already established; getSession() picks it up immediately.
//
// Mobile flow (cold start from link):
//   App starts with nearbynow://auth/callback?code=… as the initial URL.
//   _layout.tsx fires Linking.getInitialURL and calls exchangeCodeForSession.
//   We also call Linking.getInitialURL here as a safety net.
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/hooks/useTheme";

const TIMEOUT_MS = 15_000;

// ─── URL helpers ──────────────────────────────────────────────────────────────

/** Extract a query param by name from any URL string (handles deep-link schemes). */
function getParam(url: string, name: string): string | null {
  const match = url.match(new RegExp(`[?&]${name}=([^&#\\s]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Drive the PKCE / OTP code exchange for the given callback URL.
 * Returns true when an exchange was attempted (not necessarily successful).
 */
async function exchangeFromUrl(url: string): Promise<void> {
  const code       = getParam(url, "code");
  const tokenHash  = getParam(url, "token_hash");
  const type       = (getParam(url, "type") ?? "magiclink") as Parameters<
    typeof supabase.auth.verifyOtp
  >[0]["type"];

  if (code) {
    // PKCE flow — uses the code_verifier stored in localStorage / AsyncStorage
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) console.warn("[AuthCallback] exchangeCodeForSession:", error.message);
    return;
  }

  if (tokenHash) {
    // Older OTP / implicit flow
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) console.warn("[AuthCallback] verifyOtp:", error.message);
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
      const area = await AsyncStorage.getItem("hearby_area").catch(() => null);
      router.replace(area ? "/feed" : "/location");
    };

    const init = async () => {
      // ── Step 1: Drive the code exchange from the current URL ──────────────
      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Fresh browser page-load at /auth/callback?code=…
        await exchangeFromUrl(window.location.href);
      } else {
        // Mobile: _layout.tsx already did the exchange for warm-start deep
        // links.  For cold-start (app launched via the link), pick it up here.
        const initial = await Linking.getInitialURL().catch(() => null);
        if (initial) await exchangeFromUrl(initial);
      }

      // ── Step 2: Fast path — check if session was just established ─────────
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await proceed();
    };

    init().catch(err => console.warn("[AuthCallback] init error:", err));

    // ── Step 3: Auth-state listener — catches async exchange completions ─────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          await proceed();
        }
      }
    );

    // ── Step 4: 15-second safety timeout ─────────────────────────────────────
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
