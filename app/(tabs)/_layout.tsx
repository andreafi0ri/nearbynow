// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Text, Platform } from "react-native";
import { useTheme } from "../../src/hooks/useTheme";

export default function TabLayout() {
  const { theme: T } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.bg,
          borderTopWidth: 2,
          borderTopColor: T.border,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          paddingTop: 10,
          height: Platform.OS === "ios" ? 82 : 62,
        },
        tabBarActiveTintColor:   T.gold,
        tabBarInactiveTintColor: T.mutedL,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "DMSans_700Bold",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⊞</Text>,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⊙</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>♡</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>◉</Text>,
        }}
      />
    </Tabs>
  );
}
