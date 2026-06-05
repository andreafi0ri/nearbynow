// app/_layout.tsx
import React, { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View, Text, TouchableOpacity } from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerForPushNotifications, addForegroundListener } from "../src/services/notifications";
import {
  loadNotificationPreferences,
  scheduleWeeklyDigest,
  handleNotificationResponse,
} from "../src/services/notificationService";
import { SavedAreasProvider } from "../src/context/SavedAreasContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import {
  useFonts,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_500Medium_Italic,
} from "@expo-google-fonts/playfair-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
  Inter_700Bold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "../src/lib/supabase";
import { setPendingCallbackUrl } from "../src/lib/authState";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync();
}

// ─── Error boundary ───────────────────────────────────────────────────────────

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0F0D08" }}>
          <Text style={{ fontSize: 32, marginBottom: 16 }}>😕</Text>
          <Text style={{ fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 8, color: "#F5F0E8" }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, textAlign: "center", color: "#888", marginBottom: 24 }}>
            Pull down to refresh or tap below
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: "#1C1A15", borderRadius: 12, padding: 14, paddingHorizontal: 28, borderWidth: 1.5, borderColor: "#3A3528" }}
          >
            <Text style={{ color: "#FF6F62", fontWeight: "700" }}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Reads the active theme from context to set the correct StatusBar style. */
function AppStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
    PlayfairDisplay_500Medium_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_600SemiBold_Italic,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded && Platform.OS !== "web") SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Push notifications — register, handle taps, schedule weekly digest
  // Will return null on simulators and Expo Go.
  // Use: npx expo run:ios for dev build testing.
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener     = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    // Register device for push (no-op on simulator/Expo Go)
    registerForPushNotifications();

    // Clear badge count when app opens
    if (Platform.OS !== "web") {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }

    // Foreground notification listener (banner auto-shows via setNotificationHandler)
    const legacyUnsub = addForegroundListener(
      notification => {
        console.log("Notification received:", notification.request.content.title);
      },
      response => {
        handleNotificationResponse(response, router);
      },
    );

    // Schedule weekly digest if the preference is enabled
    loadNotificationPreferences().then(prefs => {
      if (prefs.weekly) {
        AsyncStorage.getItem("nearbynow_area").then(area => {
          if (area) scheduleWeeklyDigest(area);
        });
      }
    });

    return () => {
      legacyUnsub();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Route auth deep links (mobile) to the callback screen.
  // We store the raw URL in authState so the callback screen can drive
  // the exchange itself — this works for both warm-start and cold-start.
  // (On web the browser does a full page load so _layout never sees the URL.)
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (!url.includes("auth/callback")) return;
      setPendingCallbackUrl(url);
      router.replace("/auth/callback");
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener("url", e => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  // Global SIGNED_OUT listener — wipe local state and return to home.
  // Handles both explicit sign-outs (profile screen) and expired sessions.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        AsyncStorage.multiRemove([
          "nearbynow_email",
          "hearby_area",
          "hearby_show_recs",
          "nearbynow_username",
          "nearbynow_avatar",
          "hearby_lat",
          "hearby_lng",
          "hearby_coords_area",
        ]).catch(() => {});
        router.replace("/location");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <SavedAreasProvider>
          <AppStatusBar />
          <Stack screenOptions={{ headerShown: false }} />
        </SavedAreasProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
