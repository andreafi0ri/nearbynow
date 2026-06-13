// app/email.tsx — Email opt-in screen.
// Matches prototype nn/screen-email.jsx exactly:
//   brand bar top · envelope hero with halo · "Stay in the loop."
//   live validation badge (red •••  → gold ✓) · magic-link button
//   ~1s spinner state · "Skip for now" gold link · privacy line
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Linking, ViewStyle, TextStyle,
} from "react-native";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Rect, Path, Circle as SvgCircle } from "react-native-svg";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/hooks/useTheme";
import { MapBackground } from "../src/components/MapBackground";
import { Pin } from "../src/components/Pin";
import { supabase } from "../src/lib/supabase";
import { loadProfile } from "../src/services/profileService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase OTP length is configurable (6–10 digits) — accept the full range
// so the field works regardless of the project's "Email OTP Length" setting.
const CODE_RE  = /^\d{6,10}$/;
const CODE_MAX = 10;

// ─── Helper: open URL in new tab on web, in-app browser on native ────────────
function openLegal(url: string) {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url);
  }
}

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
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  // mode=login → returning user (skip T&C)
  // mode=signup or no mode → new user (show T&C)
  const isLogin = mode === "login";

  const [email,      setEmail]      = useState("");
  const [sending,    setSending]    = useState(false);  // real API in-flight
  const [sent,       setSent]       = useState(false);  // API done → show "check inbox"
  const [error,      setError]      = useState("");
  const [agreed,     setAgreed]     = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [code,       setCode]       = useState("");     // 6-digit OTP entered in-app
  const [verifying,  setVerifying]  = useState(false);  // verifyOtp in-flight

  const valid     = EMAIL_RE.test(email);
  const codeValid = CODE_RE.test(code);

  // Pre-fill from AsyncStorage if the app remembers the address
  useEffect(() => {
    AsyncStorage.getItem("nearbynow_email").then(saved => {
      if (saved) setEmail(saved);
    });
  }, []);

  const handleSubmit = async () => {
    // Only require T&C agreement for new signups
    if (!isLogin && !agreed) {
      setAgreeError(true);
      return;
    }
    setAgreeError(false);

    if (!valid || sending || sent) return;
    setError("");
    setSending(true);
    try {
      // Platform-aware redirect: web uses the HTTPS domain; mobile uses the deep-link scheme.
      const redirectTo =
        Platform.OS === "web"
          ? "https://www.nearbyandnow.com/auth/callback"
          : "nearbynow://auth/callback";

      const { error: authErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          // shouldCreateUser:false in login mode — Supabase won't create
          // a new account if the email doesn't exist, returns an error instead.
          shouldCreateUser: !isLogin,
        },
      });

      if (authErr) {
        // Surface a friendly error when the email isn't registered yet
        if (isLogin && authErr.message.toLowerCase().includes("not found")) {
          setError("No account found for this email. Please sign up first.");
        } else {
          setError(authErr.message);
        }
        setSending(false);
        return;
      }

      await AsyncStorage.setItem("nearbynow_email", email);
      // Show "check your inbox" screen with a 6-digit code field. The magic link
      // still works (desktop/Android), but the in-app code is the reliable path
      // on iOS PWAs — verifyOtp creates the session in THIS storage context, so
      // there's no Safari→PWA context gap.
      setSent(true);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong — please try again.");
    } finally {
      setSending(false);
    }
  };

  /**
   * Verifies the 6-digit code from the email, creating the session directly in
   * the current storage context (the PWA itself — not Safari). This sidesteps
   * the iOS PWA magic-link problem entirely. Routes to feed/location on success.
   */
  const handleVerifyCode = async () => {
    if (!codeValid || verifying) return;
    setError("");
    setVerifying(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });

      if (vErr || !data.session) {
        setError(vErr?.message ?? "That code didn't work. Check it and try again.");
        setVerifying(false);
        return;
      }

      // Session is now stored in this context — sync profile + route.
      await AsyncStorage.setItem("nearbynow_email", email);
      await loadProfile().catch(() => {});
      const area = await AsyncStorage.getItem("hearby_area").catch(() => null);
      router.replace(area ? "/feed" : "/location");
    } catch (e: any) {
      setError(e.message ?? "Couldn't verify the code — please try again.");
      setVerifying(false);
    }
  };

  const btnActive  = valid && !sending;
  const btnBg      = btnActive
    ? T.text
    : isDark ? "#3A372E" : "#A8A29A";
  const btnTextCol = btnActive
    ? T.bg
    : isDark ? "#6B6760" : "#F2EFE9";

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.flex}>
        {/* ── Map background at reduced opacity ───────────────────────── */}
        <MapBackground T={T} isDark={isDark} opacity={0.45} />

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Back / dismiss button ─────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/feed")}
            style={s.backBtn}
            activeOpacity={0.7}
          >
            <Text style={[s.backBtnText, { color: T.muted }]}>← Back</Text>
          </TouchableOpacity>

          {/* ── Compact brand bar ─────────────────────────────────────── */}
          <View style={s.brandBar}>
            <Pin size={22} T={T} />
            <View style={s.wordmarkRow}>
              <Text style={[s.wKicker, { color: T.gold }]} numberOfLines={1}>NEARBY &amp;</Text>
              <Text style={[s.wNow,    { color: T.text }]} numberOfLines={1}>NOW</Text>
            </View>
          </View>

          <View style={s.flex045} />

          {/* ── Envelope hero with halo ───────────────────────────────── */}
          <View style={s.heroWrap}>
            <Svg width={120} height={120} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="emailHalo" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%"  stopColor={T.gold} stopOpacity={isDark ? 0.34 : 0.32} />
                  <Stop offset="70%" stopColor={T.gold} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="60" cy="60" rx="60" ry="60" fill="url(#emailHalo)" />
            </Svg>

            <View style={[s.heroRing, { borderColor: T.gold }]} />

            <View style={[s.heroCircle, { backgroundColor: T.surface, borderColor: T.gold }]}>
              <EnvelopeIcon size={36} color={T.text} />
              <View style={[s.heroBadge, { backgroundColor: sent ? T.gold : T.red, borderColor: T.bg }]}>
                <Text style={s.heroBadgeText}>{sent ? "✓" : "•••"}</Text>
              </View>
            </View>
          </View>

          {sent ? (
            /* ── "Check your inbox" state ─────────────────────────────── */
            <>
              <View style={s.headlineRow}>
                <Text style={[s.headlineBase, { color: T.text }]}>Check your </Text>
                <Text style={[s.headlineItalic, { color: T.gold }]}>inbox</Text>
                <Text style={[s.headlineBase, { color: T.text }]}>.</Text>
              </View>

              <Text style={[s.body, { color: T.textSub }]}>
                We sent a 6-digit code to
                {"\n"}
                <Text style={{ color: T.text, fontFamily: "Inter_600SemiBold" }}>{email}</Text>
              </Text>

              <View style={s.flex055} />

              {/* ── 6-digit code entry — the reliable path on iOS PWAs ── */}
              <TextInput
                value={code}
                onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, CODE_MAX)); setError(""); }}
                onSubmitEditing={handleVerifyCode}
                placeholder="Enter code"
                placeholderTextColor={T.muted}
                keyboardType="number-pad"
                returnKeyType="go"
                maxLength={CODE_MAX}
                style={[
                  s.input,
                  {
                    backgroundColor: T.surface,
                    color:           T.text,
                    borderColor:     codeValid ? T.gold : T.border,
                    textAlign:       "center",
                    letterSpacing:   8,
                    fontSize:        24,
                    fontFamily:      "Inter_700Bold",
                    paddingRight:    18,
                  },
                ]}
              />

              {!!error && (
                <Text style={[s.errorText, { color: T.red }]}>{error}</Text>
              )}

              <View style={s.gap12} />

              <TouchableOpacity
                onPress={handleVerifyCode}
                disabled={!codeValid || verifying}
                style={[s.primaryBtn, { backgroundColor: codeValid ? T.text : (isDark ? "#3A372E" : "#A8A29A") }]}
                activeOpacity={0.85}
              >
                {verifying ? (
                  <>
                    <Spinner color={codeValid ? T.bg : T.muted} />
                    <Text style={[s.primaryBtnText, { color: codeValid ? T.bg : T.muted }]}>Verifying…</Text>
                  </>
                ) : (
                  <Text style={[s.primaryBtnText, { color: codeValid ? T.bg : (isDark ? "#6B6760" : "#F2EFE9") }]}>
                    Verify code →
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={[s.privacy, { color: T.muted }]}>
                Enter the code from your email — or tap the magic link inside it.{"\n"}
                The code expires in 1 hour.
              </Text>

              {/* "Wrong email?" lets the user go back and re-enter */}
              <TouchableOpacity
                onPress={() => { setSent(false); setSending(false); setCode(""); setError(""); }}
                style={{ marginTop: 16, padding: 4 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, textAlign: "center", color: T.muted, fontFamily: "Inter_400Regular" }}>
                  Wrong email? Start over
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ── Sign-in form ─────────────────────────────────────────── */
            <>
              <View style={s.headlineRow}>
                {isLogin ? (
                  <>
                    <Text style={[s.headlineBase, { color: T.text }]}>Welcome </Text>
                    <Text style={[s.headlineItalic, { color: T.gold }]}>back</Text>
                    <Text style={[s.headlineBase, { color: T.text }]}>.</Text>
                  </>
                ) : (
                  <>
                    <Text style={[s.headlineBase, { color: T.text }]}>Stay in the </Text>
                    <Text style={[s.headlineItalic, { color: T.gold }]}>loop</Text>
                    <Text style={[s.headlineBase, { color: T.text }]}>.</Text>
                  </>
                )}
              </View>

              <Text style={[s.body, { color: T.textSub }]}>
                {isLogin
                  ? "Enter your email and we'll send you\na magic link to sign in."
                  : "Get your weekly local digest — the best\nevents and spots in your area."}
              </Text>

              <View style={s.flex055} />

              {/* ── Email input with live badge ─────────────────────── */}
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
                  style={[
                    s.input,
                    {
                      backgroundColor: T.surface,
                      color:           T.text,
                      borderColor:     valid ? T.gold : T.border,
                      fontSize:        Platform.OS === "web" ? 16 : 15,
                    },
                  ]}
                />

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

              {/* ── Terms & Privacy checkbox — signup only ────────── */}
              {!isLogin && (
                <TouchableOpacity
                  onPress={() => { setAgreed(a => !a); setAgreeError(false); }}
                  style={[
                    s.checkboxRow,
                    agreeError && {
                      borderColor: T.red,
                      borderWidth: 1.5,
                      borderRadius: 10,
                      padding: 8,
                      backgroundColor: T.red + "08",
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={[
                    s.checkbox,
                    {
                      borderColor:     agreeError ? T.red : agreed ? T.text : T.borderSub,
                      backgroundColor: agreed ? T.text : "transparent",
                    },
                  ]}>
                    {agreed && (
                      <Text style={{ color: T.goldBri, fontSize: 11, fontWeight: "700" }}>✓</Text>
                    )}
                  </View>

                  <Text style={[s.checkboxLabel, { color: T.textSub }]}>
                    I agree to the{" "}
                    <Text
                      style={[s.checkboxLink, { color: T.gold }]}
                      onPress={e => {
                        e.stopPropagation();
                        openLegal("https://www.nearbyandnow.com/terms");
                      }}
                    >
                      Terms &amp; Conditions
                    </Text>
                    {" "}and{" "}
                    <Text
                      style={[s.checkboxLink, { color: T.gold }]}
                      onPress={e => {
                        e.stopPropagation();
                        openLegal("https://www.nearbyandnow.com/privacy");
                      }}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>
              )}

              {!isLogin && agreeError && (
                <Text style={[s.agreeError, { color: T.red }]}>
                  Please agree to the Terms and Privacy Policy to continue
                </Text>
              )}

              {/* ── Send magic link button ────────────────────────── */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!btnActive}
                style={[s.primaryBtn, { backgroundColor: btnBg }]}
                activeOpacity={0.85}
              >
                {sending ? (
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

              {/* ── Privacy line — signup only ────────────────────── */}
              {!isLogin && (
                <Text style={[s.privacy, { color: T.muted }]}>
                  Sign up to save events across devices and get your local digest.{"\n"}Unsubscribe any time.
                </Text>
              )}
            </>
          )}
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

  backBtn:     {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 8,
  } as ViewStyle,

  backBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  } as TextStyle,

  // ── Brand bar ───────────────────────────────────────────────────────────
  brandBar:   {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 28,
  } as ViewStyle,

  wordmarkRow: {
    flexDirection: "column",
    alignItems: "flex-start",
  } as ViewStyle,

  wKicker:    { fontFamily: "Inter_600SemiBold_Italic", fontStyle: "italic", fontWeight: "600", fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase" } as TextStyle,
  wNow:       { fontFamily: "Inter_900Black", fontWeight: "900", fontSize: 22, letterSpacing: 0.2, lineHeight: 22 } as TextStyle,

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
    fontFamily: "Inter_700Bold",
    fontWeight: "800",
    fontSize: 34,
    letterSpacing: -0.68,
    lineHeight: 38,
  } as TextStyle,

  headlineItalic: {
    fontFamily: "Inter_600SemiBold_Italic",
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

  // ── Checkbox ─────────────────────────────────────────────────────────────
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
    marginBottom: 16,
    paddingHorizontal: 2,
  } as ViewStyle,

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  } as ViewStyle,

  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  } as TextStyle,

  checkboxLink: {
    fontFamily: "Inter_700Bold",
    textDecorationLine: "underline",
  } as TextStyle,

  agreeError: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -10,
    marginBottom: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 2,
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
