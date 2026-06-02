// app/(tabs)/profile.tsx
import React, { useState, useEffect } from "react";
import {
  Alert, View, Text, TextInput, TouchableOpacity, ScrollView, Switch,
  StyleSheet, Platform, Linking, ViewStyle, TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/hooks/useTheme";
import { Wordmark } from "../../src/components/Wordmark";
import type { ThemePreference } from "../../src/context/ThemeContext";
import { useAuth } from "../../src/hooks/useAuth";
import { useSavedAreas } from "../../src/context/SavedAreasContext";
import { supabase } from "../../src/lib/supabase";
import {
  loadProfile,
  saveUsername,
  saveAvatar as saveAvatarMeta,
  clearProfileCache,
} from "../../src/services/profileService";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  scheduleWeeklyDigest,
  DEFAULT_PREFS,
  type NotificationPreferences,
} from "../../src/services/notificationService";
import { checkFeedHealth } from "../../src/services/rssService";

const AVATAR_OPTIONS = ["👤","🦊","🐻","🦁","🐼","🦋","🌟","🎭","🏄","🎨","🎸","🌿"];

export default function ProfileScreen() {
  const { theme: T, preference, isDark, setPreference } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { areas, activeArea, switchArea, removeArea } = useSavedAreas();

  const [username, setUsername]       = useState("hearby user");
  const [avatar, setAvatar]           = useState("👤");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState(username);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [email, setEmail] = useState("");
  const [notifs, setNotifs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [showRecs, setShowRecs] = useState(false);
  const [healthResults, setHealthResults] = useState("");
  const [healthLoading, setHealthLoading] = useState(false);

  // Derived directly from useAuth — always in sync, no async gap on mount.
  const isSignedIn = !!session;

  // Load profile from Supabase user_metadata (source of truth) with
  // AsyncStorage as local cache.  Reload on SIGNED_IN so a user who
  // signs in on a new device gets their saved username/avatar immediately.
  useEffect(() => {
    loadProfile().then(p => {
      setUsername(p.username);
      setAvatar(p.avatar);
      setEmail(p.email);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          loadProfile().then(p => {
            setUsername(p.username);
            setAvatar(p.avatar);
            setEmail(p.email);
          });
        }
      });

    return () => subscription.unsubscribe();
  }, []);

  // Load notification preferences and feed settings
  useEffect(() => {
    loadNotificationPreferences().then(setNotifs);
    AsyncStorage.getItem("hearby_show_recs")
      .then(v => setShowRecs(v === "true"))
      .catch(() => {});
  }, []);

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    setEditingName(false);
    await saveUsername(trimmed);
  };

  const saveAvatar = async (opt: string) => {
    setAvatar(opt);
    setShowAvatarPicker(false);
    await saveAvatarMeta(opt);
  };

  const runHealthCheck = async () => {
    setHealthLoading(true);
    setHealthResults("");
    const area = (await AsyncStorage.getItem("nearbynow_area")) ?? "Brooklyn, NY";
    const lines: string[] = [];
    // Temporarily capture console.log output so we can display it on screen
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
      origLog(...args);
    };
    await checkFeedHealth(area);
    console.log = origLog;
    setHealthResults(lines.join("\n"));
    setHealthLoading(false);
  };

  const toggleNotif = async (key: string) => {
    const updated: NotificationPreferences = {
      ...notifs,
      [key]: !notifs[key as keyof NotificationPreferences],
    };
    setNotifs(updated);
    await saveNotificationPreferences(updated);

    // When turning ON the weekly digest, immediately schedule it
    if (key === "weekly" && updated.weekly) {
      const area = await AsyncStorage.getItem("nearbynow_area");
      if (area) scheduleWeeklyDigest(area);
    }

    const isOn  = updated[key as keyof NotificationPreferences];
    const label = key === "breaking" ? "Breaking news"
                : key === "events"   ? "Event alerts"
                : key === "recs"     ? "Recommendations"
                : "Weekly digest";
    console.log(`${label} notifications: ${isOn ? "ON" : "OFF"}`);
  };

  const toggleShowRecs = async () => {
    const next = !showRecs;
    setShowRecs(next);
    await AsyncStorage.setItem("hearby_show_recs", String(next));
  };

  const handleSignOut = () => {
    const doSignOut = async () => {
      await supabase.auth.signOut();
      await clearProfileCache();
      // Reset visible local state — _layout.tsx SIGNED_OUT handler
      // takes care of storage cleanup and routing to /location.
      setEmail("");
      setUsername("Nearby & Now user");
      setAvatar("👤");
    };

    if (Platform.OS === "web") {
      // Alert.alert maps to window.confirm on web, which many browsers
      // block or surface unreliably. Call it directly instead.
      if (window.confirm("Are you sure you want to log out?")) doSignOut();
    } else {
      Alert.alert(
        "Log out",
        "Are you sure you want to log out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log out", style: "destructive", onPress: doSignOut },
        ]
      );
    }
  };

  const handleSignIn = () => {
    router.push("/email?mode=login");
  };

  const accountRows = [
    {
      label: "Privacy Policy",
      isDestructive: false,
      onPress: () => Linking.openURL("https://www.nearbyandnow.com/privacy"),
    },
    {
      label: "Terms of Service",
      isDestructive: false,
      onPress: () => Linking.openURL("https://www.nearbyandnow.com/terms"),
    },
    {
      label: "Send feedback",
      isDestructive: false,
      onPress: () => Linking.openURL("mailto:hello@nearbyandnow.com"),
    },
    isSignedIn
      ? {
          label: "Log out",
          isDestructive: true,
          onPress: handleSignOut,
        }
      : {
          label: "Log in",
          isDestructive: false,
          onPress: handleSignIn,
        },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bgSub }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: T.bg, borderBottomColor: T.border }]}>
        <Wordmark T={T} />
        <Text style={[styles.headerLabel, { color: T.mutedL }]}>YOUR PROFILE</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* ── User card ── */}
        <View style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border }]}>
          <View style={styles.userRow}>
            <View style={{ position: "relative" }}>
              <TouchableOpacity onPress={() => setShowAvatarPicker(o => !o)}
                style={[styles.avatarBtn, { backgroundColor: T.goldLight, borderColor: T.gold, shadowColor: T.goldDim }]}>
                <Text style={{ fontSize: 28 }}>{avatar}</Text>
              </TouchableOpacity>
              <View style={[styles.editBadge, { backgroundColor: T.text, borderColor: T.bg }]}>
                <Text style={{ fontSize: 9, color: T.goldBri }}>✎</Text>
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <View style={styles.nameEditGroup}>
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    onSubmitEditing={saveName}
                    autoFocus
                    style={[styles.nameInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: T.text }]}
                  />
                  <View style={styles.nameEditBtns}>
                    <TouchableOpacity onPress={saveName}
                      style={[styles.saveBtn, { backgroundColor: T.text, borderColor: T.text, shadowColor: T.goldDim }]}>
                      <Text style={[styles.saveBtnText, { color: T.goldBri }]}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingName(false); setNameInput(username); }}
                      style={[styles.cancelBtn, { borderColor: T.borderSub }]}>
                      <Text style={[styles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => { setEditingName(true); setNameInput(username); }} style={styles.nameRow}>
                  <Text style={[styles.username, { color: T.text }]}>{username}</Text>
                  <View style={[styles.editPill, { backgroundColor: T.goldLight, borderColor: T.gold }]}>
                    <Text style={[styles.editPillText, { color: T.goldBri }]}>Edit</Text>
                  </View>
                </TouchableOpacity>
              )}
              {email ? <Text style={[styles.email, { color: T.muted }]}>{email}</Text> : null}
              {session && <Text style={[styles.authBadge, { color: T.green }]}>✓ signed in</Text>}
            </View>
          </View>

          {showAvatarPicker && (
            <View style={[styles.avatarPicker, { backgroundColor: T.bgCardHi, borderColor: T.border, shadowColor: T.border }]}>
              <Text style={[styles.pickerLabel, { color: T.muted }]}>CHOOSE YOUR AVATAR</Text>
              <View style={styles.avatarGrid}>
                {AVATAR_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt} onPress={() => saveAvatar(opt)}
                    style={[styles.avatarOption, {
                      borderColor: avatar === opt ? T.text : T.borderSub,
                      backgroundColor: avatar === opt ? T.text + "18" : "transparent",
                    }]}>
                    <Text style={{ fontSize: 22 }}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: T.borderSub }]} />

          <View style={styles.areaHeaderRow}>
            <Text style={[styles.areaLabel, { color: T.muted }]}>YOUR AREAS</Text>
            <TouchableOpacity onPress={() => router.replace("/location")}
              style={[styles.changeBtn, { backgroundColor: T.text, borderColor: T.text, shadowColor: T.goldDim }]}>
              <Text style={[styles.changeBtnText, { color: T.goldBri }]}>＋ Add</Text>
            </TouchableOpacity>
          </View>
          {areas.length === 0 ? (
            <Text style={[styles.areaValue, { color: T.muted, marginTop: 4 }]}>—</Text>
          ) : (
            areas.map(a => (
              <View key={a} style={[styles.areaRow, { marginTop: 8 }]}>
                <TouchableOpacity onPress={() => switchArea(a)} style={styles.areaChipBtn}>
                  <View style={[styles.areaChip, {
                    backgroundColor: a === activeArea ? T.text + "12" : T.bgCardHi,
                    borderColor: a === activeArea ? T.text : T.borderSub,
                  }]}>
                    <Text style={{ fontSize: 12, marginRight: 5 }}>📍</Text>
                    <Text style={[styles.areaValue, { color: T.text, fontSize: 14 }]} numberOfLines={1}>{a}</Text>
                    {a === activeArea && (
                      <Text style={[styles.activeBadge, { color: T.gold }]}> ✓ active</Text>
                    )}
                  </View>
                </TouchableOpacity>
                {areas.length > 1 && (
                  <TouchableOpacity onPress={() => removeArea(a)}
                    style={[styles.removeBtn, { borderColor: T.borderSub }]}>
                    <Text style={{ color: T.muted, fontSize: 14 }}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* ── Appearance ── */}
        <Text style={[styles.sectionLabel, { color: T.muted, marginTop: 8 }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border, padding: 0, overflow: "hidden" }]}>
          {/* Description row */}
          <View style={[styles.themeRow, { borderBottomColor: T.borderSub }]}>
            <View style={styles.themeLabelGroup}>
              <Text style={[styles.notifLabel, { color: T.text }]}>Theme</Text>
              <Text style={[styles.notifSub, { color: T.muted }]}>
                {preference === "system"
                  ? "Following device settings"
                  : isDark
                  ? "Dark mode is on"
                  : "Light mode is on"}
              </Text>
            </View>
          </View>

          {/* Segmented control: Light | Auto | Dark */}
          <View style={[styles.segmentedControl, { margin: 14, backgroundColor: T.bgCardHi, borderColor: T.borderSub }]}>
            {([
              { value: "light",  label: "Light", icon: "☀️" },
              { value: "system", label: "Auto",  icon: "⚙️" },
              { value: "dark",   label: "Dark",  icon: "🌙" },
            ] as Array<{ value: ThemePreference; label: string; icon: string }>).map((opt) => {
              const active = preference === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setPreference(opt.value)}
                  style={[
                    styles.segmentOption,
                    active && {
                      backgroundColor: T.text,
                      borderRadius: 10,
                      shadowColor: T.goldDim,
                      shadowOffset: { width: 2, height: 2 },
                      shadowOpacity: 1,
                      shadowRadius: 0,
                      elevation: 2,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 16, marginBottom: 3 }}>{opt.icon}</Text>
                  <Text style={[styles.segmentLabel, { color: active ? T.goldBri : T.muted }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Feed ── */}
        <Text style={[styles.sectionLabel, { color: T.muted, marginTop: 8 }]}>FEED</Text>
        <View style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border, padding: 0, overflow: "hidden" }]}>
          <View style={[styles.notifRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.notifLabel, { color: T.text }]}>Show recommendations</Text>
              <Text style={[styles.notifSub, { color: T.muted }]}>
                Nearby places in the "You might also like" section
              </Text>
            </View>
            <Switch
              value={showRecs}
              onValueChange={toggleShowRecs}
              trackColor={{ false: T.borderSub, true: T.text }}
              thumbColor={showRecs ? T.goldBri : T.bg}
            />
          </View>
        </View>

        {/* ── Notifications ── */}
        <Text style={[styles.sectionLabel, { color: T.muted, marginTop: 8 }]}>NOTIFICATIONS</Text>
        <View style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border, padding: 0, overflow: "hidden" }]}>
          {[
            { key: "breaking", label: "Breaking local news",  sub: "Incidents, closures, urgent updates" },
            { key: "events",   label: "New events nearby",    sub: "When new events appear in your area" },
            { key: "weekly",   label: "Weekly digest email",  sub: "Every Monday morning summary" },
          ].map((n, i) => (
            <View key={n.key} style={[styles.notifRow, { borderBottomColor: T.borderSub, borderBottomWidth: i < 2 ? 1.5 : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifLabel, { color: T.text }]}>{n.label}</Text>
                <Text style={[styles.notifSub, { color: T.muted }]}>{n.sub}</Text>
              </View>
              <Switch
                value={notifs[n.key as keyof typeof notifs]}
                onValueChange={() => toggleNotif(n.key)}
                trackColor={{ false: T.borderSub, true: T.text }}
                thumbColor={notifs[n.key as keyof typeof notifs] ? T.goldBri : T.bg}
              />
            </View>
          ))}
        </View>

        {/* ── Account ── */}
        <Text style={[styles.sectionLabel, { color: T.muted, marginTop: 8 }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border, padding: 0, overflow: "hidden" }]}>
          {accountRows.map((row, i) => (
            <TouchableOpacity
              key={row.label}
              onPress={row.onPress}
              style={[
                styles.accountRow,
                {
                  borderBottomColor: T.borderSub,
                  borderBottomWidth: i < accountRows.length - 1 ? 1.5 : 0,
                },
              ]}
            >
              <Text style={[
                styles.accountLabel,
                {
                  color: row.isDestructive ? T.red : T.text,
                  fontWeight: row.isDestructive ? "700" : "500",
                },
              ]}>
                {row.label}
              </Text>
              {!row.isDestructive && (
                <Text style={{ color: T.muted }}>→</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.version, { color: T.mutedL }]}>Nearby &amp; Now</Text>

        {/* ── Dev: RSS feed health check ── */}
        {__DEV__ && (
          <>
            <TouchableOpacity
              onPress={runHealthCheck}
              disabled={healthLoading}
              style={[styles.debugBtn, { borderColor: T.borderSub, opacity: healthLoading ? 0.5 : 1 }]}
            >
              <Text style={[styles.debugBtnText, { color: T.muted }]}>
                {healthLoading ? "⏳ Running health check…" : "🔧 Run RSS feed health check (dev only)"}
              </Text>
            </TouchableOpacity>
            {healthResults ? (
              <ScrollView
                style={[styles.healthBox, { backgroundColor: T.bgCardHi, borderColor: T.borderSub }]}
                nestedScrollEnabled
              >
                <Text style={[styles.healthText, { color: T.text }]}>{healthResults}</Text>
              </ScrollView>
            ) : null}
          </>
        )}

      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 } as ViewStyle,
  header:        { borderBottomWidth: 2, paddingHorizontal: 18, paddingVertical: 14 } as ViewStyle,
  headerLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, fontFamily: "DMSans_700Bold" } as TextStyle,
  card:          { borderWidth: 2, borderRadius: 16, padding: 18, marginBottom: 16, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as ViewStyle,
  userRow:       { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 } as ViewStyle,
  avatarBtn:     { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 } as ViewStyle,
  editBadge:     { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  nameEditGroup: { gap: 8 } as ViewStyle,
  nameInput:     { borderWidth: 2, borderRadius: 10, fontSize: 15, padding: 9, fontFamily: "PlayfairDisplay_800ExtraBold" } as TextStyle,
  nameEditBtns:  { flexDirection: "row", gap: 8 } as ViewStyle,
  saveBtn:       { flex: 1, borderWidth: 2, borderRadius: 10, padding: 8, alignItems: "center", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  saveBtnText:   { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  cancelBtn:     { flex: 1, borderWidth: 2, borderRadius: 10, padding: 8, alignItems: "center" } as ViewStyle,
  cancelBtnText: { fontSize: 13, fontFamily: "DMSans_400Regular" } as TextStyle,
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 } as ViewStyle,
  username:      { fontSize: 17, fontWeight: "800", fontFamily: "PlayfairDisplay_800ExtraBold" } as TextStyle,
  editPill:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 } as ViewStyle,
  editPillText:  { fontSize: 11, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  email:         { fontSize: 13, fontFamily: "DMSans_400Regular" } as TextStyle,
  authBadge:     { fontSize: 11, fontFamily: "DMSans_700Bold", marginTop: 2 } as TextStyle,
  avatarPicker:  { borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 14, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 } as ViewStyle,
  pickerLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", fontFamily: "DMSans_700Bold", marginBottom: 10 } as TextStyle,
  avatarGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  avatarOption:  { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" } as ViewStyle,
  divider:       { height: 1.5, marginBottom: 14 } as ViewStyle,
  areaHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } as ViewStyle,
  areaLabel:     { fontSize: 10, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", fontFamily: "DMSans_700Bold" } as TextStyle,
  areaRow:       { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  areaChipBtn:   { flex: 1, minWidth: 0 } as ViewStyle,
  areaChip:      { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 } as ViewStyle,
  areaValue:     { fontSize: 15, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" } as TextStyle,
  activeBadge:   { fontSize: 11, fontFamily: "DMSans_700Bold" } as TextStyle,
  removeBtn:     { width: 30, height: 30, borderWidth: 1.5, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  changeBtn:     { borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  changeBtnText: { fontSize: 12, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  sectionLabel:  { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "DMSans_700Bold", marginBottom: 10 } as TextStyle,
  notifRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 } as ViewStyle,
  notifLabel:    { fontSize: 13, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  notifSub:      { fontSize: 11, fontFamily: "DMSans_400Regular", marginTop: 2 } as TextStyle,
  accountRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 } as ViewStyle,
  accountLabel:  { fontSize: 13, fontFamily: "DMSans_400Regular" } as TextStyle,
  version:          { textAlign: "center", fontSize: 11, fontFamily: "DMSans_400Regular", marginTop: 24 } as TextStyle,
  debugBtn:         { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8, marginBottom: 8 } as ViewStyle,
  debugBtnText:     { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  healthBox:        { borderWidth: 1.5, borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 16, maxHeight: 200 } as ViewStyle,
  healthText:       { fontSize: 11, fontFamily: "DMSans_400Regular", lineHeight: 16 } as TextStyle,
  themeRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1.5 } as ViewStyle,
  themeLabelGroup:  { flex: 1 } as ViewStyle,
  segmentedControl: { flexDirection: "row", borderWidth: 2, borderRadius: 14, padding: 4, gap: 4 } as ViewStyle,
  segmentOption:    { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10 } as ViewStyle,
  segmentLabel:     { fontSize: 12, fontWeight: "700", fontFamily: "DMSans_700Bold", letterSpacing: 0.3 } as TextStyle,
});
