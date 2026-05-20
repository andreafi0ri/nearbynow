import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) {
    // Simulators can't receive push — return null silently
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name:       "Hearby",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  // Persist token to Supabase so the server can target this device
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase
      .from("users")
      .update({ push_token: token })
      .eq("id", session.user.id);
  }

  return token;
}

export type NotificationListener = ReturnType<typeof Notifications.addNotificationReceivedListener>;

export function addForegroundListener(
  onReceive: (n: Notifications.Notification) => void,
  onResponse: (r: Notifications.NotificationResponse) => void,
): () => void {
  if (Platform.OS === "web") return () => {};
  const receiveSub  = Notifications.addNotificationReceivedListener(onReceive);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => { receiveSub.remove(); responseSub.remove(); };
}
