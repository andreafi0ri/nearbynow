// app/index.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, Platform } from "react-native";
import { useTheme } from "../src/hooks/useTheme";
import { supabase } from "../src/lib/supabase";
import { loadProfile } from "../src/services/profileService";

export default function Index() {
  const router = useRouter();
  const { theme: T } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        // On web, give Supabase (detectSessionInUrl: true) a moment to parse any
        // auth tokens present in the URL before we read the session — e.g. when the
        // PWA is opened right after completing a magic link, or on a callback load.
        if (Platform.OS === "web") {
          await new Promise(r => setTimeout(r, 500));
        }

        // Primary: live Supabase session is the source of truth.
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const email = session.user.email ?? "";
          if (email) await AsyncStorage.setItem("nearbynow_email", email);
          await loadProfile().catch(() => {});
          const area = await AsyncStorage.getItem("hearby_area");
          router.replace(area ? "/feed" : "/location");
          return;
        }

        // Fallback: no Supabase session yet — use AsyncStorage state.
        const [area, email] = await Promise.all([
          AsyncStorage.getItem("hearby_area"),    // written by SavedAreasContext
          AsyncStorage.getItem("nearbynow_email"), // written by email.tsx on submit
        ]);
        if (area) {
          // Area is set — go to feed regardless of email (signup is optional).
          router.replace("/feed");
        } else {
          router.replace("/location");
        }
      } catch (err) {
        console.error("[Index] routing error:", err);
        router.replace("/location");
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
      <ActivityIndicator color={T.gold} size="large" />
    </View>
  );
}
