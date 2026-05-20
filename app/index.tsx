// app/index.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";
import { useTheme } from "../src/hooks/useTheme";
import { supabase } from "../src/lib/supabase";

export default function Index() {
  const router = useRouter();
  const { theme: T } = useTheme();

  useEffect(() => {
    (async () => {
      const [area, { data: { session } }] = await Promise.all([
        AsyncStorage.getItem("hearby_area"),
        supabase.auth.getSession(),
      ]);
      // If the user has a session and an area they go straight to the feed.
      // If they have an area but no session (anonymous) they still go to feed.
      // Only send to location screen on first launch (no area saved yet).
      if (area || session) {
        router.replace("/feed");
      } else {
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
