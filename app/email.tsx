// app/email.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/hooks/useTheme";
import { Wordmark } from "../src/components/Wordmark";
import { GoldButton } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";

export default function EmailScreen() {
  const { theme: T } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!valid) { setError("Enter a valid email address"); return; }
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: "hearby://auth/callback" },
      });
      if (authError) throw authError;
      await AsyncStorage.setItem("hearby_email", email);
      setSent(true);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => router.replace("/feed");

  if (sent) return (
    <View style={[styles.center, { backgroundColor: T.bg }]}>
      <View style={[styles.successCircle, { backgroundColor: T.green + "18", borderColor: T.green, shadowColor: T.green }]}>
        <Text style={[styles.checkmark, { color: T.green }]}>✉️</Text>
      </View>
      <Text style={[styles.successTitle, { color: T.text }]}>Check your inbox</Text>
      <Text style={[styles.successSub, { color: T.muted }]}>
        We sent a magic link to{"\n"}{email}
      </Text>
      <TouchableOpacity onPress={handleSkip} style={styles.skip}>
        <Text style={[styles.skipText, { color: T.mutedL }]}>Continue without signing in</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: T.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Wordmark T={T} />
        <View style={[styles.iconWrap, { backgroundColor: T.goldLight, borderColor: T.gold, shadowColor: T.goldDim }]}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={[styles.headline, { color: T.text }]}>Stay in the loop</Text>
        <Text style={[styles.sub, { color: T.textSub }]}>
          Get your weekly local digest — the best events and spots in your area, curated for you.
        </Text>

        <View style={styles.inputGroup}>
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
            autoFocus
            style={[
              styles.input,
              {
                backgroundColor: T.bgCardHi,
                color: T.text,
                borderColor: error ? T.red : email ? T.text : T.borderSub,
              },
            ]}
          />
          {error ? <Text style={[styles.error, { color: T.red }]}>{error}</Text> : null}
        </View>

        <GoldButton
          label={loading ? "Sending…" : "Send magic link →"}
          onPress={handleSubmit}
          disabled={!valid || loading}
          T={T}
        />

        <TouchableOpacity onPress={handleSkip} style={styles.skip}>
          <Text style={[styles.skipText, { color: T.mutedL }]}>Skip for now</Text>
        </TouchableOpacity>

        <Text style={[styles.privacy, { color: T.mutedL }]}>
          No spam. Unsubscribe any time. We never sell your data.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  container:     { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  iconWrap:      { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 24, marginBottom: 24, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  icon:          { fontSize: 30 },
  headline:      { fontSize: 26, fontWeight: "800", fontFamily: "PlayfairDisplay_800ExtraBold", textAlign: "center", marginBottom: 10, letterSpacing: -0.5 },
  sub:           { fontSize: 14, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 28, maxWidth: 270 },
  inputGroup:    { width: "100%", marginBottom: 12 },
  input:         { borderWidth: 2, borderRadius: 12, fontSize: 15, padding: 14, fontFamily: "DMSans_400Regular", marginBottom: 6 },
  error:         { fontSize: 12, fontFamily: "DMSans_400Regular" },
  skip:          { marginTop: 12, padding: 4 },
  skipText:      { fontSize: 12, fontFamily: "DMSans_400Regular", textDecorationLine: "underline" },
  privacy:       { fontSize: 11, fontFamily: "DMSans_400Regular", textAlign: "center", marginTop: 24, maxWidth: 260, lineHeight: 18 },
  successCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  checkmark:     { fontSize: 30 },
  successTitle:  { fontSize: 20, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  successSub:    { fontSize: 14, fontFamily: "DMSans_400Regular", textAlign: "center", lineHeight: 22 },
});
