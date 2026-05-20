// app/(tabs)/feed.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, FlatList, Platform,
  StyleSheet, ViewStyle, TextStyle, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/hooks/useTheme";
import { EventCard } from "../../src/components/EventCard";
import { useSavedEvents } from "../../src/hooks/useSavedEvents";
import { useSavedAreas } from "../../src/context/SavedAreasContext";
import { EventItem } from "../../src/data/mockEvents";
import { FILTERS, SOURCE_FILTERS, FilterOption } from "../../src/config/filterConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFeed } from "../../src/services/feedService";
import { Wordmark } from "../../src/components/Wordmark";
import { SEARCH_CONFIG, getRadiusLabel } from "../../src/config/searchConfig";
import { scheduleEventNotification } from "../../src/services/notificationService";
import * as Notifications from "expo-notifications";

const QUICK_PRESETS = ["Today", "Tomorrow", "This Weekend", "This Week", "This Month"] as const;

const fmt = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const TODAY = new Date();

export default function FeedScreen() {
  const { theme: T } = useTheme();
  const router = useRouter();
  const { saved, toggle: toggleSaved } = useSavedEvents();
  const [badgeCount, setBadgeCount] = useState(0);

  const { areas, activeArea: area, switchArea } = useSavedAreas();
  const [areaSwitcherOpen, setAreaSwitcherOpen] = useState(false);
  const [headerH, setHeaderH] = useState(0);
  const [feedItems, setFeedItems] = useState<EventItem[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [showingRecommendations, setShowingRecommendations] = useState(false);

  // Notification badge count
  useEffect(() => {
    if (Platform.OS !== "web") {
      Notifications.getBadgeCountAsync().then(setBadgeCount).catch(() => {});
    }
  }, []);

  /** Saves/unsaves an event and schedules a 1-hour reminder when saving. */
  const handleToggle = (id: number) => {
    const isNowSaving = !saved.has(id);
    toggleSaved(id);
    if (isNowSaving) {
      const event = feedItems.find(e => e.id === id);
      if (event?.startIso) {
        scheduleEventNotification(event, 60)
          .then(notifId => {
            if (notifId) console.log(`Reminder set for "${event.title}" — 1 hour before`);
          })
          .catch(() => {});
      }
    }
  };

  // Category filter
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // Source filter
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // Date filter
  const [showSaved, setShowSaved] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    if (!area) return;
    setFeedItems([]);          // clear stale events from previous area immediately
    setRemoteLoading(true);
    Promise.all([
      AsyncStorage.getItem("hearby_lat"),
      AsyncStorage.getItem("hearby_lng"),
      AsyncStorage.getItem("hearby_coords_area"),
    ]).then(([latStr, lngStr, coordsArea]) => {
      // Only use stored coords if they were saved for this exact area,
      // otherwise stale Brixton coords would pollute recommendations for other areas
      const coords = latStr && lngStr && coordsArea === area
        ? { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
        : undefined;
      return getFeed(area, coords);
    })
      .then(result => {
        setFeedItems(result.items);
        setShowingRecommendations(result.showingRecommendations);
      })
      .catch(() => setFeedItems([]))
      .finally(() => setRemoteLoading(false));
  }, [area]);

  const dateRange = (): [string, string] | null => {
    const t = fmt(TODAY), tom = fmt(addDays(TODAY, 1));
    const day = TODAY.getDay();
    const satOff = (6 - day + 7) % 7 || 7;
    const sat = fmt(addDays(TODAY, satOff));
    const sun = fmt(addDays(TODAY, satOff + 1));
    const endWeek = fmt(addDays(TODAY, (7 - day) % 7 || 7));
    const monthStart = fmt(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
    const monthEnd   = fmt(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0));
    if (datePreset === "Today")        return [t, t];
    if (datePreset === "Tomorrow")     return [tom, tom];
    if (datePreset === "This Weekend") return [sat, sun];
    if (datePreset === "This Week")    return [t, endWeek];
    if (datePreset === "This Month")   return [monthStart, monthEnd];
    if (datePreset === "Custom" && customFrom && customTo) return [customFrom, customTo];
    return null;
  };

  const catFilter  = useMemo(() => FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0], [activeFilter]);
  const srcFilters = useMemo<FilterOption[]>(() =>
    activeSources.size === 0 ? [] : SOURCE_FILTERS.filter(f => activeSources.has(f.id)),
  [activeSources]);

  const range = dateRange();

  // Sources that are only meaningful when their specific category filter is active.
  // Items from these sources are hidden everywhere EXCEPT when their
  // designated filter (or the saved view) is active.
  const FILTER_ONLY_SOURCE_MAP: Record<string, string> = {
    "Food Places": "Food & Drink",
    "Showtimes":   "Cinema",
  };

  const filtered = useMemo(() => feedItems.filter(item => {
    if (showSaved) return saved.has(item.id);

    // Guard: filter-only sources must only appear for their designated filter.
    const requiredFilter = FILTER_ONLY_SOURCE_MAP[item.source];
    if (requiredFilter && activeFilter !== requiredFilter) return false;

    if (!catFilter.matchFn(item)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(item))) return false;
    if (range) {
      // Recommendations are place-based, not date-specific — always show them
      if (item.type === "recommendation") return true;
      // Events with no date are excluded when a date range is active
      if (!item.date) return false;
      return item.date >= range[0] && item.date <= range[1];
    }
    return true;
  }), [feedItems, showSaved, saved, catFilter, srcFilters, range, activeFilter, activeSources]);

  // In the "All" view filter-only items are already excluded above.
  // This set is kept as a belt-and-suspenders guard on the recs footer.
  const FILTER_ONLY_SOURCES = new Set(Object.keys(FILTER_ONLY_SOURCE_MAP));

  const showAll = activeFilter === "All" && activeSources.size === 0 && !showSaved;
  // Viator items (type: "recommendation") are shown inline with events, not in the
  // "You might also like" footer. All other recommendations stay in the footer.
  const events  = filtered.filter(i => i.type === "event" || i.source === "Viator");
  const recs    = filtered.filter(
    i => i.type === "recommendation" && i.source !== "Viator" &&
         (!showAll || !FILTER_ONLY_SOURCES.has(i.source))
  );

  const dateLabel  = datePreset === "Custom" && customFrom && customTo
    ? `${customFrom.slice(5)} – ${customTo.slice(5)}` : datePreset ?? "Date";
  const dateActive = !!datePreset;
  const noAreaData = !remoteLoading && feedItems.length === 0;
  const clearDate  = () => { setDatePreset(null); setCustomFrom(""); setCustomTo(""); setDateOpen(false); };

  const toggleSource = (id: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeFilterCount = (activeFilter !== "All" ? 1 : 0) + activeSources.size;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={["top"]}>
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: T.bg, borderBottomColor: T.border }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <Wordmark T={T} />
        <View style={styles.areaRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.browsingLabel, { color: T.mutedL }]}>NOW BROWSING</Text>
            <TouchableOpacity
              onPress={() => areas.length > 1 ? setAreaSwitcherOpen(o => !o) : router.replace("/location")}
              style={styles.areaBtn}
            >
              <Text style={[styles.areaText, { color: T.text }]} numberOfLines={1}>{area || "…"}</Text>
              <View style={[styles.changePill, { backgroundColor: T.goldLight, borderColor: T.gold }]}>
                <Text style={[styles.changeText, { color: T.goldDim }]}>{areas.length > 1 ? "▾ switch" : "▾ change"}</Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.radiusLabel, { color: T.mutedL }]}>
              Within {getRadiusLabel(SEARCH_CONFIG.DEFAULT_RADIUS_METRES)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => { setShowSaved(s => !s); setActiveFilter("All"); setActiveSources(new Set()); setDateOpen(false); }}
              style={[styles.iconBtn, {
                borderColor: showSaved ? T.red : T.borderSub,
                backgroundColor: showSaved ? T.red + "15" : "transparent",
              }]}
            >
              <Text style={{ color: showSaved ? T.red : T.muted, fontSize: 14 }}>
                {showSaved ? "♥" : "♡"}{saved.size > 0 ? ` ${saved.size}` : ""}
              </Text>
            </TouchableOpacity>
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/profile")}
                style={[styles.iconBtn, { borderColor: T.borderSub }]}
              >
                <Text style={{ fontSize: 15 }}>🔔</Text>
              </TouchableOpacity>
              {badgeCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: T.red }]}>
                  <Text style={styles.notifBadgeText}>
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Sparse area hint — only when Google Places recommendations were fetched (events < 5) */}
        {showingRecommendations && !remoteLoading && (
          <Text style={[styles.sparseHint, { color: T.goldDim }]}>
            Fewer than {SEARCH_CONFIG.GOOGLE_PLACES_THRESHOLD} events found · Showing nearby recommendations
          </Text>
        )}

        {/* Filter chips — wrapping row, Date + Sources locked left */}
        <View style={styles.filtersWrap}>
          {/* Date chip */}
          <View style={[styles.chip, {
            backgroundColor: dateActive ? T.text : "transparent",
            borderColor: dateActive ? T.text : T.gold,
            shadowColor: dateActive ? T.goldDim : T.gold,
            paddingHorizontal: 0, paddingVertical: 0,
          }]}>
            <TouchableOpacity
              onPress={() => setDateOpen(o => !o)}
              style={{ paddingHorizontal: 14, paddingVertical: 6 }}
            >
              <Text style={[styles.chipText, { color: dateActive ? T.goldBri : T.gold }]}>📅 {dateLabel}</Text>
            </TouchableOpacity>
            {dateActive && (
              <TouchableOpacity
                onPress={clearDate}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                style={{ paddingRight: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: T.goldBri, fontSize: 16, lineHeight: 18 }}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sources toggle */}
          <TouchableOpacity
            onPress={() => setSourcesOpen(o => !o)}
            style={[styles.chip, {
              backgroundColor: activeSources.size > 0 ? T.text : "transparent",
              borderColor: activeSources.size > 0 ? T.text : T.borderSub,
              shadowColor: activeSources.size > 0 ? T.goldDim : "transparent",
              flexDirection: "row", alignItems: "center", gap: 4,
            }]}
          >
            <Text style={[styles.chipText, { color: activeSources.size > 0 ? T.goldBri : T.muted }]}>
              {sourcesOpen ? "▴" : "▾"} Sources
            </Text>
            {activeSources.size > 0 && (
              <View style={[styles.badge, { backgroundColor: T.gold }]}>
                <Text style={[styles.badgeText, { color: T.bg }]}>{activeSources.size}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.chipDivider, { backgroundColor: T.borderSub }]} />

          {/* Category chips — wrap freely */}
          {FILTERS.map(f => {
            const on = activeFilter === f.id && !showSaved;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => { setActiveFilter(f.id); setShowSaved(false); setDateOpen(false); }}
                style={[styles.chip, {
                  backgroundColor: on ? T.text : "transparent",
                  borderColor: on ? T.text : T.borderSub,
                  shadowColor: on ? T.goldDim : "transparent",
                }]}
              >
                <Text style={[styles.chipText, { color: on ? T.goldBri : T.muted }]}>
                  {f.icon} {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Source chips panel (collapsible, also wrapping) */}
        {sourcesOpen && (
          <View style={[styles.filtersWrap, { paddingTop: 2, paddingBottom: 6 }]}>
            {activeSources.size > 0 && (
              <TouchableOpacity
                onPress={() => setActiveSources(new Set())}
                style={[styles.chip, { backgroundColor: T.red + "18", borderColor: T.red }]}
              >
                <Text style={[styles.chipText, { color: T.red }]}>× Clear</Text>
              </TouchableOpacity>
            )}
            {SOURCE_FILTERS.map(f => {
              const on = activeSources.has(f.id);
              return (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => toggleSource(f.id)}
                  style={[styles.chip, {
                    backgroundColor: on ? T.text : "transparent",
                    borderColor: on ? T.text : T.borderSub,
                    shadowColor: on ? T.goldDim : "transparent",
                  }]}
                >
                  <Text style={[styles.chipText, { color: on ? T.goldBri : T.muted }]}>
                    {f.icon} {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Active filter count hint */}
        {activeFilterCount > 0 && (
          <View style={styles.filterHint}>
            <Text style={[styles.filterHintText, { color: T.goldDim }]}>
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
              {" · "}
              <Text
                onPress={() => { setActiveFilter("All"); setActiveSources(new Set()); }}
                style={{ color: T.gold, textDecorationLine: "underline" }}
              >
                Clear all
              </Text>
            </Text>
          </View>
        )}

        {/* Date dropdown */}
        {dateOpen && (
          <View style={[styles.dateDropdown, { backgroundColor: T.bg, borderColor: T.border, shadowColor: T.border }]}>
            <View style={styles.presetsRow}>
              {QUICK_PRESETS.map(p => {
                const on = datePreset === p;
                return (
                  <TouchableOpacity key={p} onPress={() => { setDatePreset(p); setDateOpen(false); }}
                    style={[styles.presetChip, {
                      backgroundColor: on ? T.text : T.bgCardHi,
                      borderColor: on ? T.text : T.borderSub,
                      shadowColor: on ? T.goldDim : "transparent",
                    }]}>
                    <Text style={[styles.presetText, { color: on ? T.goldBri : T.textSub }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.dateDivider, { backgroundColor: T.borderSub }]} />
            <Text style={[styles.customLabel, { color: T.muted }]}>CUSTOM RANGE</Text>
            <View style={styles.customRow}>
              {Platform.OS === "web" ? (
                <>
                  {React.createElement("input", {
                    type: "date",
                    value: customFrom,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCustomFrom(e.target.value),
                    style: {
                      flex: 1, borderWidth: 2, borderStyle: "solid",
                      borderColor: customFrom ? T.text : T.borderSub,
                      borderRadius: 10, fontSize: 12, padding: 8,
                      fontFamily: "DMSans_400Regular",
                      backgroundColor: T.bgCardHi, color: T.text, outline: "none",
                    },
                  })}
                  <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
                  {React.createElement("input", {
                    type: "date",
                    value: customTo,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCustomTo(e.target.value),
                    style: {
                      flex: 1, borderWidth: 2, borderStyle: "solid",
                      borderColor: customTo ? T.text : T.borderSub,
                      borderRadius: 10, fontSize: 12, padding: 8,
                      fontFamily: "DMSans_400Regular",
                      backgroundColor: T.bgCardHi, color: T.text, outline: "none",
                    },
                  })}
                </>
              ) : (
                <>
                  <TextInput value={customFrom} onChangeText={setCustomFrom} placeholder="YYYY-MM-DD"
                    placeholderTextColor={T.mutedL}
                    style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customFrom ? T.text : T.borderSub }]} />
                  <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
                  <TextInput value={customTo} onChangeText={setCustomTo} placeholder="YYYY-MM-DD"
                    placeholderTextColor={T.mutedL}
                    style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customTo ? T.text : T.borderSub }]} />
                </>
              )}
            </View>
            {customFrom && customTo && (
              <TouchableOpacity onPress={() => { setDatePreset("Custom"); setDateOpen(false); }}
                style={[styles.applyBtn, { backgroundColor: T.text, borderColor: T.text, shadowColor: T.goldDim }]}>
                <Text style={[styles.applyText, { color: T.goldBri }]}>Apply date range</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Area switcher overlay */}
      {areaSwitcherOpen && (
        <TouchableOpacity style={styles.areaSwitcherBackdrop} activeOpacity={1} onPress={() => setAreaSwitcherOpen(false)} />
      )}
      {areaSwitcherOpen && (
        <View style={[styles.areaSwitcher, { top: headerH, backgroundColor: T.bg, borderColor: T.border, shadowColor: T.border }]}>
          {areas.map(a => (
            <TouchableOpacity key={a} onPress={() => { switchArea(a); setAreaSwitcherOpen(false); }}
              style={[styles.areaSwitcherRow, {
                backgroundColor: a === area ? T.text + "12" : "transparent",
                borderBottomColor: T.borderSub,
              }]}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>📍</Text>
              <Text style={[styles.areaSwitcherText, { color: a === area ? T.text : T.textSub, fontWeight: a === area ? "700" : "400" }]} numberOfLines={1}>{a}</Text>
              {a === area && <Text style={{ color: T.gold, fontSize: 12, marginLeft: "auto" }}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setAreaSwitcherOpen(false); router.replace("/location"); }}
            style={[styles.areaSwitcherRow, { borderBottomWidth: 0 }]}>
            <Text style={{ fontSize: 13, marginRight: 6 }}>＋</Text>
            <Text style={[styles.areaSwitcherText, { color: T.gold }]}>Add new area</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feed */}
      <FlatList
        data={showAll ? events : filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <EventCard item={item} saved={saved.has(item.id)} onSave={handleToggle} T={T} />
        )}
        ListHeaderComponent={(() => {
          const count = showAll ? events.length : filtered.length;
          if (remoteLoading || count === 0) return null;
          const label = showSaved
            ? `${count} saved item${count !== 1 ? "s" : ""}`
            : `${count} result${count !== 1 ? "s" : ""}${activeFilter !== "All" ? ` · ${activeFilter}` : ""}${showAll && recs.length > 0 ? ` + ${recs.length} nearby` : ""}`;
          return (
            <Text style={[styles.resultCount, { color: T.muted }]}>{label}</Text>
          );
        })()}
        ListFooterComponent={(
          <>
            {showAll && recs.length > 0 && (
              <>
                <View style={styles.recDivider}>
                  <View style={[styles.dividerLine, { backgroundColor: T.gold }]} />
                  <Text style={[styles.dividerText, { color: T.goldDim }]}>
                  {showingRecommendations
                    ? "✦ More recommendations for you in the area"
                    : "✦ You might also like"}
                </Text>
                  <View style={[styles.dividerLine, { backgroundColor: T.gold }]} />
                </View>
                {recs.map(item => (
                  <EventCard key={item.id} item={item} saved={saved.has(item.id)} onSave={handleToggle} T={T} />
                ))}
              </>
            )}
            {remoteLoading && (
              <View style={styles.remoteLoader}>
                <ActivityIndicator size="small" color={T.muted} />
                <Text style={[styles.remoteLoaderText, { color: T.muted }]}>Loading community posts…</Text>
              </View>
            )}
          </>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              {showSaved ? "♡" : noAreaData ? "🗺️" : "📅"}
            </Text>
            <Text style={[styles.emptyTitle, { color: T.text }]}>
              {showSaved ? "Nothing saved yet"
                : noAreaData ? "Nothing here yet"
                : dateActive ? "No results for this date"
                : "No results for this filter"}
            </Text>
            <Text style={[styles.emptySub, { color: T.muted }]}>
              {showSaved ? "Tap ♡ on any card to save it here"
                : noAreaData ? "Try a different location or extend your time range"
                : dateActive ? "Try a different date or tap × to clear"
                : "Try a different category or clear source filters"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 } as ViewStyle,
  header:         { borderBottomWidth: 2, paddingHorizontal: 16, paddingTop: 10 } as ViewStyle,
  areaRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } as ViewStyle,
  browsingLabel:  { fontSize: 10, fontWeight: "600", letterSpacing: 1.2, fontFamily: "DMSans_700Bold" } as TextStyle,
  areaBtn:        { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 } as ViewStyle,
  areaText:       { fontSize: 19, fontWeight: "800", fontFamily: "PlayfairDisplay_800ExtraBold" } as TextStyle,
  changePill:     { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 } as ViewStyle,
  changeText:     { fontSize: 10, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  headerActions:  { flexDirection: "row", gap: 8 } as ViewStyle,
  iconBtn:        { borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle,
  notifBadge:     { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  notifBadgeText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF", fontFamily: "DMSans_700Bold" } as TextStyle,
  radiusLabel:    { fontSize: 10, fontFamily: "DMSans_400Regular", marginTop: 2, letterSpacing: 0.2 } as TextStyle,
  sparseHint:     { fontSize: 11, fontFamily: "DMSans_400Regular", paddingBottom: 8, paddingHorizontal: 2 } as TextStyle,
  filtersWrap:    { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center", paddingBottom: 10 } as ViewStyle,
  chip:           { borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  chipText:       { fontSize: 12, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  chipDivider:    { width: 2, height: 22, borderRadius: 2 } as ViewStyle,
  badge:          { borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 } as ViewStyle,
  badgeText:      { fontSize: 10, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  filterHint:     { paddingBottom: 8, paddingHorizontal: 2 } as ViewStyle,
  filterHintText: { fontSize: 11, fontFamily: "DMSans_400Regular" } as TextStyle,
  dateDropdown:   { borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 12, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as ViewStyle,
  presetsRow:     { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 } as ViewStyle,
  presetChip:     { borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  presetText:     { fontSize: 12, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  dateDivider:    { height: 1.5, marginBottom: 12 } as ViewStyle,
  customLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 1, fontFamily: "DMSans_700Bold", marginBottom: 8 } as TextStyle,
  customRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 } as ViewStyle,
  dateInput:      { flex: 1, borderWidth: 2, borderRadius: 10, fontSize: 12, padding: 8, fontFamily: "DMSans_400Regular" } as TextStyle,
  toLabel:        { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  applyBtn:       { borderWidth: 2, borderRadius: 10, padding: 10, alignItems: "center", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  applyText:      { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  feed:           { padding: 14, paddingBottom: 40 } as ViewStyle,
  resultCount:    { fontSize: 11, fontFamily: "DMSans_700Bold", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", paddingBottom: 10 } as TextStyle,
  recDivider:     { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 } as ViewStyle,
  dividerLine:    { flex: 1, height: 2 } as ViewStyle,
  dividerText:    { fontSize: 11, fontWeight: "700", fontFamily: "DMSans_700Bold", letterSpacing: 0.6, textTransform: "uppercase" } as TextStyle,
  empty:          { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 } as ViewStyle,
  emptyIcon:      { fontSize: 36, marginBottom: 12 } as TextStyle,
  emptyTitle:     { fontSize: 16, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:       { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center" } as TextStyle,
  remoteLoader:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 } as ViewStyle,
  remoteLoaderText:   { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  areaSwitcher:       { position: "absolute", left: 12, right: 12, zIndex: 200, borderWidth: 2, borderRadius: 14, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 200, overflow: "hidden" } as ViewStyle,
  areaSwitcherBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 } as ViewStyle,
  areaSwitcherRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1.5 } as ViewStyle,
  areaSwitcherText:   { fontSize: 13, fontFamily: "DMSans_400Regular", flex: 1 } as TextStyle,
});
