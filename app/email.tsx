// app/email.tsx — Email opt-in screen.
// Matches prototype nn/screen-email.jsx exactly:
//   brand bar top · envelope hero with halo · "Stay in the loop."
//   live validation badge (red •••  → gold ✓) · magic-link button
//   ~1s spinner state · "Skip for now" gold link · privacy line
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ViewStyle, TextStyle,
} from "react-native";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Rect, Path, Circle as SvgCircle } from "react-native-svg";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/hooks/useTheme";
import { MapBackground } from "../src/components/MapBackground";
import { Pin } from "../src/components/Pin";
import { supabase } from "../src/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Envelope SVG (prototype EnvelopeIcon, verbatim) ────────────────────────
function EnvelopeIcon({ size = 36, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect x="4" y="8" width="24" height="17" rx="2.5" stroke={color} strokeWidth={1.6} />
      <Path
        d="M4.5 9 L 16 18 L 27.5 9"
        stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Spinner SVG (prototype animated circle, approximated with RN Animated) ─
function Spinner({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <SvgCircle
          cx="12" cy="12" r="10"
          stroke={color} strokeWidth={2}
          strokeDasharray={32} strokeDashoffset={20}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

export default function EmailScreen() {
  const { theme: T, isDark } = useTheme();
  const router = useRouter();

  const [email,   setEmail]   = useState("");
  const [sending, setSending] = useState(false);  // real API in-flight
  const [sent,    setSent]    = useState(false);   // API done → show spinner briefly
  const [error,   setError]   = useState("");

  const valid = EMAIL_RE.test(email);

  // Pre-fill from AsyncStorage if browser / app remembers the address
  useEffect(() => {
    AsyncStorage.getItem("hearby_email").then(saved => {
      if (saved) setEmail(saved);
    });
  }, []);

  const handleSubmit = async () => {
    if (!valid || sending || sent) return;
    setError("");
    setSending(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: "nearbyandnow://auth/callback" },
      });
      if (authErr) throw authErr;
      await AsyncStorage.setItem("hearby_email", email);
      setSent(true);
      // Spinner shows for ~1.1s (matches prototype) then navigates
      setTimeout(() => router.replace("/feed"), 1100);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong — please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => router.replace("/feed");

  const btnActive  = valid && !sending && !sent;
  const btnBg      = btnActive
    ? T.text
    : isDark ? "#3A372E" : "#A8A29A";
  const btnTextCol = btnActive
    ? T.bg
    : isDark ? "#6B6760" : "#F2EFE9";

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.flex}>
        {/* ── Map background at reduced opacity ───────────────────────── */}
        <MapBackground T={T} isDark={isDark} opacity={0.45} />

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Compact brand bar ─────────────────────────────────────── */}
          <View style={s.brandBar}>
            <Pin size={22} T={T} />
            {/* Wordmark inline: Nearby &amp; Now */}
            <View style={s.wordmarkRow}>
              <Text style={[s.wNearby, { color: T.text }]}>Nearby </Text>
              <Text style={[s.wAmp,    { color: T.gold }]}>&amp;</Text>
              <Text style={[s.wNow,    { color: T.gold }]}> Now</Text>
            </View>
          </View>

          <View style={s.flex045} />

          {/* ── Envelope hero with halo ───────────────────────────────── */}
          <View style={s.heroWrap}>
            {/* Outer radial glow */}
            <Svg width={120} height={120} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="emailHalo" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%"  stopColor={T.gold} stopOpacity={isDark ? 0.34 : 0.32} />
                  <Stop offset="70%" stopColor={T.gold} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="60" cy="60" rx="60" ry="60" fill="url(#emailHalo)" />
            </Svg>

            {/* Gold ring */}
            <View style={[s.heroRing, { borderColor: T.gold }]} />

            {/* White circle with envelope */}
            <View style={[s.heroCircle, { backgroundColor: T.surface, borderColor: T.gold }]}>
              <EnvelopeIcon size={36} color={T.text} />

              {/* Red notification badge */}
              <View style={[s.heroBadge, { backgroundColor: T.red, borderColor: T.bg }]}>
                <Text style={s.heroBadgeText}>•••</Text>
              </View>
            </View>
          </View>

          {/* ── "Stay in the loop." headline ──────────────────────────── */}
          <View style={s.headlineRow}>
            <Text style={[s.headlineBase, { color: T.text }]}>Stay in the </Text>
            <Text style={[s.headlineItalic, { color: T.gold }]}>loop</Text>
            <Text style={[s.headlineBase, { color: T.text }]}>.</Text>
          </View>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <Text style={[s.body, { color: T.textSub }]}>
            Get your weekly local digest — the best events and spots in your area, curated for you.
          </Text>

          <View style={s.flex055} />

          {/* ── Email input with live badge ───────────────────────────── */}
          <View style={s.inputWrap}>
            <TextInput
              value={email}
              onChangeText={t => { setEmail(t); setError(""); }}
              onSubmitEditing={handleSubmit}
              placeholder="your@email.com"
              placeholderTextColor={T.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              editable={!sent}
              style={[
                s.input,
                {
                  backgroundColor: T.surface,
                  color:           T.text,
                  borderColor:     valid ? T.gold : T.border,
                },
              ]}
            />

            {/* Validation badge — red •••  when invalid, gold ✓ when valid */}
            <View style={[s.badge, { backgroundColor: valid ? T.gold : T.red }]}>
              {valid ? (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 12 L 10 17 L 19 7"
                    stroke="#fff" strokeWidth={2.4}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </Svg>
              ) : (
                <Text style={s.badgeDots}>•••</Text>
              )}
            </View>
          </View>

          {!!error && (
            <Text style={[s.errorText, { color: T.red }]}>{error}</Text>
          )}

          <View style={s.gap12} />

          {/* ── Send magic link button ────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!btnActive}
            style={[s.primaryBtn, { backgroundColor: btnBg }]}
            activeOpacity={0.85}
          >
            {sending || sent ? (
              <>
                <Spinner color={btnTextCol} />
                <Text style={[s.primaryBtnText, { color: btnTextCol }]}>
                  Sending magic link…
                </Text>
              </>
            ) : (
              <Text style={[s.primaryBtnText, { color: btnTextCol }]}>
                Send magic link →
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Skip for now ──────────────────────────────────────────── */}
          <TouchableOpacity onPress={handleSkip} style={s.skip} activeOpacity={0.7}>
            <Text style={[s.skipText, { color: T.gold }]}>Skip for now</Text>
          </TouchableOpacity>

          {/* ── Privacy line ──────────────────────────────────────────── */}
          <Text style={[s.privacy, { color: T.muted }]}>
            No spam. Unsubscribe any time. We never sell your data.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:       { flex: 1 } as ViewStyle,
  flex045:    { flex: 0.45 } as ViewStyle,
  flex055:    { flex: 0.55, minHeight: 16 } as ViewStyle,
  gap12:      { height: 12 } as ViewStyle,

  scroll:     {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
  } as ViewStyle,

  // ── Brand bar ───────────────────────────────────────────────────────────
  brandBar:   {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 28,
  } as ViewStyle,

  wordmarkRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "nowrap",
  } as ViewStyle,

  wNearby:    { fontFamily: "PlayfairDisplay_800ExtraBold", fontSize: 18, letterSpacing: -0.27 } as TextStyle,
  wAmp:       { fontFamily: "PlayfairDisplay_500Medium_Italic", fontStyle: "italic", fontSize: 18, letterSpacing: -0.27 } as TextStyle,
  wNow:       { fontFamily: "PlayfairDisplay_800ExtraBold", fontSize: 18, letterSpacing: -0.27 } as TextStyle,

  // ── Hero ────────────────────────────────────────────────────────────────
  heroWrap:   {
    width: 120, height: 120,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  } as ViewStyle,

  heroRing:   {
    position: "absolute",
    top: 14, left: 14, right: 14, bottom: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    opacity: 0.7,
  } as ViewStyle,

  heroCircle: {
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  } as ViewStyle,

  heroBadge:  {
    position: "absolute",
    top: -2, right: -2,
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3,
  } as ViewStyle,

  heroBadgeText: {
    color: "#fff",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1,
    lineHeight: 9,
  } as TextStyle,

  // ── Headline ─────────────────────────────────────────────────────────────
  headlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "nowrap",
    marginTop: 20,
  } as ViewStyle,

  headlineBase: {
    fontFamily: "PlayfairDisplay_800ExtraBold",
    fontWeight: "800",
    fontSize: 34,
    letterSpacing: -0.68,
    lineHeight: 38,
  } as TextStyle,

  headlineItalic: {
    fontFamily: "PlayfairDisplay_500Medium_Italic",
    fontWeight: "500",
    fontStyle: "italic",
    fontSize: 34,
    letterSpacing: -0.68,
    lineHeight: 38,
  } as TextStyle,

  // ── Body ──────────────────────────────────────────────────────────────────
  body:       {
    fontFamily: "Inter_400Regular",
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 14,
  } as TextStyle,

  // ── Input ────────────────────────────────────────────────────────────────
  inputWrap:  { width: "100%", position: "relative" } as ViewStyle,

  input:      {
    width: "100%",
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingLeft: 18,
    paddingRight: 56,    // make room for badge
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    fontSize: 15,
  } as TextStyle,

  badge:      {
    position: "absolute",
    right: 10,
    top: 10,
    width: 36, height: 36,
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  } as ViewStyle,

  badgeDots:  {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 12,
  } as TextStyle,

  errorText:  {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    marginTop: 6,
    textAlign: "center",
    width: "100%",
  } as TextStyle,

  // ── Send button ───────────────────────────────────────────────────────────
  primaryBtn: {
    width: "100%",
    height: 56,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  } as ViewStyle,

  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    fontSize: 15,
  } as TextStyle,

  // ── Skip ──────────────────────────────────────────────────────────────────
  skip:       { marginTop: 18, padding: 8 } as ViewStyle,

  skipText:   {
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    fontSize: 13.5,
    textDecorationLine: "underline",
    textUnderlineOffset: 4,
  } as TextStyle,

  // ── Privacy ───────────────────────────────────────────────────────────────
  privacy:    {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 280,
  } as TextStyle,
});
