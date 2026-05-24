// app/location.tsx — Home / onboarding screen.
// Matches prototype nn/screen-home.jsx exactly:
//   map background · hero pin with pulsing halo · wordmark · tagline
//   8-chip cluster · primary + secondary CTA · privacy line
// When "Enter area manually" is tapped, an inline location input slides in
// beneath the chips before the CTA (production extension of the prototype).
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ViewStyle, TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle as SvgCircle } from "react-native-svg";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/hooks/useTheme";
import { useSavedAreas } from "../src/context/SavedAreasContext";
import { LocationInput } from "../src/components/LocationInput";
import { reverseGeocode } from "../src/services/locationService";
import { MapBackground } from "../src/components/MapBackground";
import { Pin } from "../src/components/Pin";
import type { LocationSuggestion } from "../src/services/locationService";

// ─── Category chips shown on the Home screen ────────────────────────────────
const CHIPS = [
  { id: "events",    emoji: "💌", label: "Events"      },
  { id: "music",     emoji: "🎸", label: "Music"       },
  { id: "food",      emoji: "🍽",  label: "Food & Drink"},
  { id: "arts",      emoji: "🎨", label: "Arts"        },
  { id: "community", emoji: "🤝", label: "Community"   },
  { id: "outdoors",  emoji: "🌳", label: "Outdoors"    },
  { id: "cinema",    emoji: "🎬", label: "Cinema"      },
  { id: "sport",     emoji: "🏃", label: "Sport"       },
];

export default function LocationScreen() {
  const { theme: T, isDark } = useTheme();
  const router  = useRouter();
  const { addArea } = useSavedAreas();
  const insets = useSafeAreaInsets();

  const [manual,  setManual]  = useState(false);
  const [area,    setArea]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Halo pulse animation ──────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const pulseScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1,    1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] });

  // ── Navigation helpers ────────────────────────────────────────────────────
  const saveAndProceed = async (areaName: string) => {
    await addArea(areaName);
    router.replace("/email");
  };

  const handleUseLocation = async () => {
    setLoading(true);
    setError("");

    if (Platform.OS === "web") {
      if (!navigator?.geolocation) {
        setError("Geolocation not supported. Please enter your area manually.");
        setManual(true);
        setLoading(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude, longitude } }) => {
          try {
            const name = (await reverseGeocode(latitude, longitude)) || "Your area";
            await AsyncStorage.setItem("hearby_lat",          String(latitude));
            await AsyncStorage.setItem("hearby_lng",          String(longitude));
            await AsyncStorage.setItem("hearby_coords_area",  name);
            await saveAndProceed(name);
          } catch {
            setError("Couldn't detect location. Please enter your area manually.");
            setManual(true);
          }
          setLoading(false);
        },
        () => { setError("Couldn't detect location."); setManual(true); setLoading(false); }
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied. Please enter your area manually.");
        setManual(true);
        setLoading(false);
        return;
      }
      const loc  = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const name = (await reverseGeocode(latitude, longitude)) || "Your area";
      await AsyncStorage.setItem("hearby_lat",         String(latitude));
      await AsyncStorage.setItem("hearby_lng",         String(longitude));
      await AsyncStorage.setItem("hearby_coords_area", name);
      await saveAndProceed(name);
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
    await AsyncStorage.setItem("hearby_lat",         String(s.lat));
    await AsyncStorage.setItem("hearby_lng",         String(s.lng));
    await AsyncStorage.setItem("hearby_coords_area", s.shortName);
    saveAndProceed(s.shortName);
  };

  // ── Chip background colour (semi-transparent surface) ────────────────────
  const chipBg = isDark ? "rgba(28,26,22,0.85)" : "rgba(255,255,255,0.92)";

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.flex}>
        {/* ── Absolute map background ───────────────────────────────────── */}
        <MapBackground T={T} isDark={isDark} opacity={0.7} />

        <ScrollView
          contentContainerStyle={[s.scroll, {
            paddingTop: Math.max(52, insets.top + 16),
            paddingBottom: Math.max(30, insets.bottom + 20),
          }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero pin with gold halo ──────────────────────────────────── */}
          <View style={s.heroWrap}>
            {/* Outer radial glow */}
            <Svg width={140} height={140} viewBox="0 0 140 140" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%"   stopColor={T.gold} stopOpacity={isDark ? 0.34 : 0.32} />
                  <Stop offset="70%"  stopColor={T.gold} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="70" cy="70" rx="70" ry="70" fill="url(#halo)" />
            </Svg>

            {/* Dashed outer ring — pulses */}
            <Animated.View
              style={[
                s.dashedRing,
                { borderColor: T.gold, transform: [{ scale: pulseScale }], opacity: pulseOpacity },
              ]}
            />

            {/* Solid inner ring */}
            <View style={[s.solidRing, { borderColor: T.gold }]} />

            {/* Pin glyph */}
            <Pin size={82} T={T} />
          </View>

          {/* ── Wordmark (44 px, prototype-exact) ────────────────────────── */}
          <View style={s.wordmarkRow}>
            <Text style={[s.wordmarkNearby, { color: T.text }]}>Nearby </Text>
            <Text style={[s.wordmarkAmp,    { color: T.gold }]}>&amp;</Text>
            <Text style={[s.wordmarkNow,    { color: T.gold }]}> Now</Text>
          </View>

          {/* ── Tagline ───────────────────────────────────────────────────── */}
          <Text style={[s.tagline, { color: T.muted }]}>
            WHAT'S HAPPENING NEAR YOU
          </Text>

          {/* ── Body copy ────────────────────────────────────────────────── */}
          <Text style={[s.body, { color: T.textSub }]}>
            Local events, news, and recommendations from across the web — all in one feed.
          </Text>

          {/* ── Category chip cluster ────────────────────────────────────── */}
          <View style={s.chips}>
            {CHIPS.map(c => (
              <View key={c.id} style={[s.chip, { backgroundColor: chipBg, borderColor: T.border }]}>
                <Text style={s.chipEmoji}>{c.emoji}</Text>
                <Text style={[s.chipLabel, { color: T.text }]}>{c.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Manual area input (shown when user taps "Enter manually") ── */}
          {manual && (
            <View style={s.manualWrap}>
              <Text style={[s.manualHint, { color: T.textSub }]}>
                City, postcode, or neighbourhood — anything works.
              </Text>
              <LocationInput
                value={area}
                onChangeText={setArea}
                onSelect={handleSuggestionSelect}
                placeholder="e.g. East Nashville, Brooklyn, Shoreditch…"
                returnKeyType="go"
                autoFocus
                T={T}
              />
            </View>
          )}

          {/* ── Error ────────────────────────────────────────────────────── */}
          {!!error && (
            <Text style={[s.error, { color: T.red }]}>{error}</Text>
          )}

          {/* ── Spacer pushes CTA to bottom on tall screens ───────────────── */}
          <View style={s.spacer} />

          {/* ── CTA stack ────────────────────────────────────────────────── */}
          <View style={s.cta}>
            {!manual ? (
              <>
                <TouchableOpacity
                  onPress={handleUseLocation}
                  disabled={loading}
                  style={[s.primaryBtn, { backgroundColor: T.text }]}
                  activeOpacity={0.85}
                >
                  {/* Gold dot bullet */}
                  <View style={[s.primaryDot, { backgroundColor: isDark ? "#1A1505" : T.goldLight }]} />
                  <Text style={[s.primaryBtnText, { color: T.bg }]}>
                    {loading ? "Detecting location…" : "Use my location"}
                  </Text>
                </TouchableOpacity>

                <View style={s.gap10} />

                <TouchableOpacity
                  onPress={() => setManual(true)}
                  style={[s.secondaryBtn, { borderColor: T.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.secondaryBtnText, { color: T.text }]}>Enter area manually</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={handleManualSubmit}
                  disabled={!area.trim()}
                  style={[s.primaryBtn, {
                    backgroundColor: area.trim() ? T.text : T.border,
                  }]}
                  activeOpacity={0.85}
                >
                  <View style={[s.primaryDot, { backgroundColor: isDark ? "#1A1505" : T.goldLight }]} />
                  <Text style={[s.primaryBtnText, { color: area.trim() ? T.bg : T.muted }]}>
                    Show me what's on →
                  </Text>
                </TouchableOpacity>

                <View style={s.gap10} />

                <TouchableOpacity
                  onPress={() => { setManual(false); setError(""); }}
                  style={[s.secondaryBtn, { borderColor: T.border }]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.secondaryBtnText, { color: T.text }]}>← Use my location instead</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Privacy line ──────────────────────────────────────────────── */}
          <Text style={[s.privacy, { color: T.muted }]}>
            Your location is never stored or shared with third parties.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const HALO_SIZE = 140;
const RING_INSET_DASHED = 16;
const RING_INSET_SOLID  = 36;

const s = StyleSheet.create({
  flex:          { flex: 1 } as ViewStyle,

  scroll:        {
    flexGrow: 1,
    alignItems: "center",
    textAlign: "center" as any,
    paddingHorizontal: 28,
  } as ViewStyle,

  // ── Hero ────────────────────────────────────────────────────────────────
  heroWrap:      {
    width: HALO_SIZE, height: HALO_SIZE,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  } as ViewStyle,

  dashedRing:    {
    position: "absolute",
    top:    RING_INSET_DASHED,
    left:   RING_INSET_DASHED,
    right:  RING_INSET_DASHED,
    bottom: RING_INSET_DASHED,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
  } as ViewStyle,

  solidRing:     {
    position: "absolute",
    top:    RING_INSET_SOLID,
    left:   RING_INSET_SOLID,
    right:  RING_INSET_SOLID,
    bottom: RING_INSET_SOLID,
    borderRadius: 999,
    borderWidth: 1,
    opacity: 0.75,
  } as ViewStyle,

  // ── Wordmark ─────────────────────────────────────────────────────────────
  wordmarkRow:   {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 18,
    flexWrap: "nowrap",
  } as ViewStyle,

  wordmarkNearby: {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontWeight: "800",
    fontSize: 44,
    letterSpacing: -0.88,
    lineHeight: 48,
  } as TextStyle,

  wordmarkAmp:   {
    fontFamily: "PlayfairDisplay_500Medium_Italic",
    fontWeight: "500",
    fontStyle: "italic",
    fontSize: 44,
    letterSpacing: -0.88,
    lineHeight: 48,
  } as TextStyle,

  wordmarkNow:   {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontWeight: "800",
    fontSize: 44,
    letterSpacing: -0.88,
    lineHeight: 48,
  } as TextStyle,

  // ── Tagline ───────────────────────────────────────────────────────────────
  tagline:       {
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    fontSize: 11.5,
    letterSpacing: 2.54,   // .22em at 11.5px
    textTransform: "uppercase",
    marginTop: 14,
    textAlign: "center",
  } as TextStyle,

  // ── Body ─────────────────────────────────────────────────────────────────
  body:          {
    fontFamily: "Inter_400Regular",
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 23,         // 1.55
    textAlign: "center",
    maxWidth: 300,
    marginTop: 22,
  } as TextStyle,

  // ── Chips ────────────────────────────────────────────────────────────────
  chips:         {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    justifyContent: "center",
    marginTop: 30,
    maxWidth: 330,
  } as ViewStyle,

  chip:          {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  } as ViewStyle,

  chipEmoji:     { fontSize: 14, lineHeight: 18 } as TextStyle,

  chipLabel:     {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,

  // ── Manual entry ──────────────────────────────────────────────────────────
  manualWrap:    { width: "100%", marginTop: 20, zIndex: 20 } as ViewStyle,

  manualHint:    {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    textAlign: "center",
    marginBottom: 10,
  } as TextStyle,

  error:         {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  } as TextStyle,

  // ── Spacer ────────────────────────────────────────────────────────────────
  spacer:        { flex: 1, minHeight: 24 } as ViewStyle,

  // ── CTA ──────────────────────────────────────────────────────────────────
  cta:           { width: "100%" } as ViewStyle,

  primaryBtn:    {
    width: "100%",
    height: 56,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  } as ViewStyle,

  primaryDot:    {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,

  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    fontSize: 15,
  } as TextStyle,

  gap10:         { height: 10 } as ViewStyle,

  secondaryBtn:  {
    width: "100%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  } as ViewStyle,

  secondaryBtnText: {
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    fontSize: 14,
  } as TextStyle,

  // ── Privacy ───────────────────────────────────────────────────────────────
  privacy:       {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 280,
  } as TextStyle,
});
