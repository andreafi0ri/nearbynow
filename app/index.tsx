// app/index.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";
import { useTheme } from "../src/hooks/useTheme";

export default function Index() {
  const router = useRouter();
  const { theme: T } = useTheme();

  useEffect(() => {
    (async () => {
      const [area, email] = await Promise.all([
        AsyncStorage.getItem("hearby_area"),    // written by SavedAreasContext
        AsyncStorage.getItem("nearbynow_email"), // written by email.tsx on submit
      ]);
      if (area && email) {
        router.replace("/feed");
      } else if (area && !email) {
        // Has an area but hasn't agreed to T&C / provided email yet
        router.replace("/email");
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
