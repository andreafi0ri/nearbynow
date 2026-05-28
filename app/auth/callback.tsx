// app/auth/callback.tsx — Supabase magic link auth callback screen.
//
// Web flow:   detectSessionInUrl:true + flowType:"pkce" exchanges the code
//             automatically when the page loads at /auth/callback?code=…
//
// Mobile flow: _layout.tsx calls supabase.auth.exchangeCodeForSession(url)
//              before routing here, so the session is already being set.
//
// Either way, we wait for SIGNED_IN (or find an existing session), then
// route to /feed (if they have a saved area) or /location.
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/hooks/useTheme";

const TIMEOUT_MS = 15_000;

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

    // Fast path: session may already exist by the time this screen mounts
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) proceed();
    });

    // Listener: fires when supabase finishes exchanging the PKCE code
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) proceed();
      }
    );

    // 15-second safety timeout — send back to onboarding so user can retry
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
