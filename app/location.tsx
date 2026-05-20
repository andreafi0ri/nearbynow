// app/location.tsx
import React, { useState } from "react";
import {
  View, Text,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TextStyle, ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/hooks/useTheme";
import { useSavedAreas } from "../src/context/SavedAreasContext";
import { GoldButton, GhostButton } from "../src/components/ui";
import { LocationInput } from "../src/components/LocationInput";
import { reverseGeocode } from "../src/services/locationService";
import { BrandPin } from "../src/components/BrandPin";
import type { LocationSuggestion } from "../src/services/locationService";

export default function LocationScreen() {
  const { theme: T } = useTheme();
  const router = useRouter();
  const { addArea } = useSavedAreas();
  const [manual, setManual] = useState(false);
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saveAndProceed = async (areaName: string) => {
    await addArea(areaName);
    router.replace("/email");
  };

  const handleUseLocation = async () => {
    setLoading(true);
    setError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied. Please enter your area manually.");
        setManual(true);
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const areaName = (await reverseGeocode(latitude, longitude)) || "Your area";
      await AsyncStorage.setItem("hearby_lat", String(latitude));
      await AsyncStorage.setItem("hearby_lng", String(longitude));
      await AsyncStorage.setItem("hearby_coords_area", areaName);
      await saveAndProceed(areaName);
    } catch {
      setError("Couldn't detect location. Please enter your area manually.");
      setManual(true);
    }
    setLoading(false);
  };

  const handleManualSubmit = () => {
    if (!area.trim()) return;
    saveAndProceed(area.trim());
  };

  const handleSuggestionSelect = async (s: LocationSuggestion) => {
    await AsyncStorage.setItem("hearby_lat", String(s.lat));
    await AsyncStorage.setItem("hearby_lng", String(s.lng));
    await AsyncStorage.setItem("hearby_coords_area", s.shortName);
    saveAndProceed(s.shortName);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Brand lockup */}
        <BrandPin size={72} pinColor={T.text} goldColor={T.gold} />

        <View style={styles.wordmarkWrap}>
          <Text style={[styles.brandNearby, { color: T.textSub }]}>Nearby</Text>
          <Text style={[styles.brandNow,    { color: T.gold   }]}>&amp; Now</Text>
        </View>

        <Text style={[styles.tagline, { color: T.mutedL }]}>
          WHAT'S HAPPENING NEAR YOU
        </Text>

        <Text style={[styles.sub, { color: T.textSub, marginTop: 24 }]}>
          Local events, news, and recommendations from across the web — all in one feed.
        </Text>

        {!manual ? (
          <View style={styles.btnGroup}>
            <GoldButton
              label={loading ? "Detecting location…" : "Use my location"}
              onPress={handleUseLocation}
              disabled={loading}
              T={T}
            />
            <GhostButton
              label="Enter area manually"
              onPress={() => setManual(true)}
              T={T}
            />
          </View>
        ) : (
          <View style={styles.manualGroup}>
            <Text style={[styles.manualLabel, { color: T.textSub }]}>
              City, postcode, neighbourhood — anything works.
            </Text>
            <LocationInput
              value={area}
              onChangeText={setArea}
              onSelect={handleSuggestionSelect}
              placeholder="e.g. Brixton, SW9, East Nashville…"
              returnKeyType="go"
              autoFocus
              T={T}
            />
            <GoldButton
              label="Show me what's on →"
              onPress={handleManualSubmit}
              disabled={!area.trim()}
              T={T}
            />
            <GhostButton
              label="← Use my location instead"
              onPress={() => { setManual(false); setError(""); }}
              T={T}
            />
          </View>
        )}

        {error ? (
          <Text style={[styles.error, { color: T.red }]}>{error}</Text>
        ) : null}

        <Text style={[styles.privacy, { color: T.mutedL }]}>
          Your location is never stored or shared with third parties.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1 },
  container:    { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  wordmarkWrap: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 18, marginBottom: 6 } as ViewStyle,
  brandNearby:  { fontFamily: "PlayfairDisplay_800ExtraBold", fontSize: 28, letterSpacing: -0.5 } as TextStyle,
  brandNow:     { fontFamily: "PlayfairDisplay_800ExtraBold", fontSize: 28, letterSpacing: -0.5 } as TextStyle,
  tagline:      { fontSize: 10, fontFamily: "DMSans_700Bold", letterSpacing: 2.5, marginBottom: 4 } as TextStyle,
  sub:          { fontSize: 14, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 36, maxWidth: 280 } as TextStyle,
  btnGroup:     { width: "100%", gap: 10 } as ViewStyle,
  manualGroup:  { width: "100%", gap: 12 } as ViewStyle,
  manualLabel:  { fontSize: 14, fontFamily: "DMSans_400Regular", marginBottom: 4 } as TextStyle,
  error:        { fontSize: 13, fontFamily: "DMSans_400Regular", marginTop: 12, textAlign: "center" } as TextStyle,
  privacy:      { fontSize: 11, fontFamily: "DMSans_400Regular", textAlign: "center", marginTop: 28, maxWidth: 240, lineHeight: 18 } as TextStyle,
});
