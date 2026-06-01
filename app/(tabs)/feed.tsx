// app/(tabs)/feed.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, FlatList, ScrollView, Platform,
  StyleSheet, ViewStyle, TextStyle, TextInput, ActivityIndicator, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/hooks/useTheme";
import { TicketCard, ListRow, SectionHeader } from "../../src/components/FeedCards";
import { BottomSheet } from "../../src/components/BottomSheet";
import { useSavedEvents } from "../../src/hooks/useSavedEvents";
import { useSavedAreas } from "../../src/context/SavedAreasContext";
import { EventItem } from "../../src/data/mockEvents";
import { FILTERS, SOURCE_FILTERS, FilterOption } from "../../src/config/filterConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFeed } from "../../src/services/feedService";
import { CinemaGroupedView } from "../../src/components/CinemaGroupedView";
import { getShowtimes, clearShowtimesCache } from "../../src/services/showtimesService";
import type { ShowtimeGroup } from "../../src/services/showtimesService";
import { Wordmark } from "../../src/components/Wordmark";
import { SEARCH_CONFIG, getRadiusLabel } from "../../src/config/searchConfig";
import { scheduleEventNotification } from "../../src/services/notificationService";
import * as Notifications from "expo-notifications";

const QUICK_PRESETS = ["Today", "Tomorrow", "This Weekend", "This Week", "This Month"] as const;

// Category options shown in the Filters sheet
const CATEGORY_FILTERS = FILTERS.filter(f => !["All", "Free"].includes(f.id));

const SOURCE_DESCS: Record<string, string> = {
  "Reddit":        "Local subreddits and community posts",
  "Local News":    "News sites and local publications",
  "Eventbrite":    "Ticketed events and workshops",
  "Meetup":        "Groups and gatherings",
  "Ticketmaster":  "Concerts, sports, theater",
  "Google Places": "Restaurants, venues, points of interest",
  "Facebook":      "Public events from local pages",
  "Viator":        "Tours and experiences",
};

const fmt = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const TODAY = new Date();

function PillButton({ T, label, value, active, onPress }: {
  T: any; label: string; value: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.pill, { backgroundColor: T.surface, borderColor: active ? T.gold : T.border }]}
    >
      <Text style={[styles.pillLabel, { color: T.muted }]}>{label}</Text>
      <Text style={[styles.pillValue, { color: active ? T.gold : T.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.pillChevron, { color: T.muted }]}>▾</Text>
    </TouchableOpacity>
  );
}

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
  const [showRecsEnabled, setShowRecsEnabled] = useState(false);
  const [cinemaGroups, setCinemaGroups] = useState<ShowtimeGroup[]>([]);

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

  // Category + free filter
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [freeOnly, setFreeOnly] = useState(false);

  // Source filter
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());

  // Bottom sheet open states
  const [dateSheetOpen,    setDateSheetOpen]    = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [sourcesSheetOpen, setSourcesSheetOpen] = useState(false);

  // Date filter
  const [showSaved, setShowSaved] = useState(false);
  const [datePreset, setDatePreset] = useState<string | null>("This Week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Load "show recommendations" preference from profile settings
  useEffect(() => {
    AsyncStorage.getItem("hearby_show_recs")
      .then(v => setShowRecsEnabled(v === "true"))
      .catch(() => {});
  }, []);

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
        setCinemaGroups(result.cinemaGroups ?? []);
      })
      .catch(() => setFeedItems([]))
      .finally(() => setRemoteLoading(false));
  }, [area]);

  // On-demand AMC fetch — fires when AMC filter is selected and cinemaGroups
  // is still empty. Always clears the in-memory cache first so a stale []
  // from a previous failed attempt (wrong coords, old code) never blocks a retry.
  useEffect(() => {
    if (activeFilter !== "AMC") return;
    if (cinemaGroups.length > 0) return; // already loaded — skip
    // Wipe any stale empty-result cache before retrying
    clearShowtimesCache();
    Promise.all([
      AsyncStorage.getItem("hearby_lat"),
      AsyncStorage.getItem("hearby_lng"),
      AsyncStorage.getItem("hearby_coords_area"),
    ]).then(([latStr, lngStr, coordsArea]) => {
      const coords = latStr && lngStr && coordsArea === area
        ? { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
        : undefined;
      return getShowtimes(area ?? "", coords);
    }).then(groups => {
      if (groups.length > 0) setCinemaGroups(groups);
    }).catch(() => {});
  }, [activeFilter, area, cinemaGroups.length]);

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
    "Food Places":      "Food & Drink",
    "Showtimes":        "Cinema",
    "AMC Theatres":     "AMC",
    "Nightlife Places": "Nightlife",   // bars/clubs hidden from All, shown under Nightlife filter
    "Outdoor Places":   "Outdoors",   // parks hidden from All, shown under Outdoors filter
    "Wellness Places":  "wellness",   // spas/yoga hidden from All, shown under Wellness filter
    "Activity Places":  "activities", // bowling/arcades hidden from All, shown under Activities filter
  };

  const freeFn = useMemo(() => FILTERS.find(f => f.id === "Free")?.matchFn, []);

  const filtered = useMemo(() => {
    const base = feedItems.filter(item => {
      if (showSaved) return saved.has(item.id);

      // Free-only overlay (applies on top of category filter)
      if (freeOnly && freeFn && !freeFn(item)) return false;

      // Guard: filter-only sources must only appear for their designated filter.
      const requiredFilter = FILTER_ONLY_SOURCE_MAP[item.source];
      if (requiredFilter && activeFilter !== requiredFilter) return false;

      if (!catFilter.matchFn(item)) return false;
      if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(item))) return false;
      if (range) {
        if (item.type === "recommendation") return true;
        if (!item.date) return false;
        return item.date >= range[0] && item.date <= range[1];
      }
      return true;
    });

    return base;
  }, [feedItems, showSaved, saved, freeOnly, catFilter, srcFilters, range, activeFilter, activeSources]);

  // In the "All" view filter-only items are already excluded above.
  // This set is kept as a belt-and-suspenders guard on the recs footer.
  const FILTER_ONLY_SOURCES = new Set(Object.keys(FILTER_ONLY_SOURCE_MAP));

  const showAll = activeFilter === "All" && activeSources.size === 0 && !showSaved;
  // Viator and Activities items (type: "recommendation") are shown inline with
  // events, not in the "You might also like" footer. All other recommendations
  // stay in the footer.
  const events  = filtered.filter(
    i => i.type === "event" || i.source === "Viator" || i.category === "Activities"
  );
  const recs    = filtered.filter(
    i => i.type === "recommendation" && i.source !== "Viator" &&
         i.category !== "Activities" &&
         !FILTER_ONLY_SOURCES.has(i.source ?? "")
  );

  // ── Mix layout partition (All view only) ────────────────────────────────
  // Community sources: Reddit posts, local news, community categories
  const COMMUNITY_SOURCES = new Set(["Nashville Scene", "The Tennessean", "Local News"]);
  const isCommunityItem = (item: EventItem) =>
    item.category === "Community" ||
    item.category === "Local Gov"  ||
    item.source?.startsWith("r/")  ||
    COMMUNITY_SOURCES.has(item.source ?? "");

  // Events + Activities + Viator recs → TicketCard section
  // (Activities are type:"recommendation" but shown as ticket-style cards)
  const mixTicketItems    = filtered.filter(i =>
    (i.type === "event" || i.category === "Activities" || i.source === "Viator")
    && !isCommunityItem(i)
  );
  const mixCommunityItems = filtered.filter(isCommunityItem);
  // Remaining recs (not activities, not Viator, not community) → "You might also like" footer
  const mixRecItems       = filtered.filter(
    i => i.type === "recommendation"
      && i.category !== "Activities"
      && i.source !== "Viator"
      && !isCommunityItem(i)
      && !FILTER_ONLY_SOURCES.has(i.source ?? "")
  );

  // Time-aware section label: "Tonight" after 5 pm, otherwise "This weekend"
  const eventSectionLabel = (() => {
    const h = new Date().getHours();
    if (h >= 17) return "Tonight";
    const day = new Date().getDay();
    if (day === 0 || day === 6) return "This weekend";
    return "This weekend";
  })();

  // True when we should render the sectioned Mix layout
  const isMixLayout = activeFilter === "All" && !showSaved;

  const dateLabel  = datePreset === "Custom" && customFrom && customTo
    ? `${customFrom.slice(5)} – ${customTo.slice(5)}` : datePreset ?? "Anytime";
  const dateActive = !!datePreset;
  const noAreaData = !remoteLoading && feedItems.length === 0;
  const clearDate  = () => { setDatePreset(null); setCustomFrom(""); setCustomTo(""); setDateSheetOpen(false); };

  const filterCount   = (activeFilter !== "All" ? 1 : 0) + (freeOnly ? 1 : 0);
  const filterLabel   = filterCount > 0 ? String(filterCount) : "All";

  const toggleSource = (id: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
              onPress={() => { setShowSaved(s => !s); setActiveFilter("All"); setActiveSources(new Set()); setDateSheetOpen(false); }}
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

        {/* ── 3-pill filter bar ──────────────────────────────────────────── */}
        <View style={styles.pillBar}>
          <PillButton T={T} label="DATE"    value={dateLabel}   active={dateActive}          onPress={() => setDateSheetOpen(true)} />
          <PillButton T={T} label="FILTERS" value={filterLabel} active={filterCount > 0}     onPress={() => setFiltersSheetOpen(true)} />
          <PillButton T={T} label="SOURCES" value={activeSources.size > 0 ? String(activeSources.size) : "All"} active={activeSources.size > 0} onPress={() => setSourcesSheetOpen(true)} />
        </View>
      </View>

      {/* ── Date sheet ─────────────────────────────────────────────────── */}
      <BottomSheet open={dateSheetOpen} onClose={() => setDateSheetOpen(false)} title="When" T={T}>
        {[
          { id: null,      label: "Anytime",       sub: "No date filter" },
          { id: "Today",   label: "Today",          sub: fmt(TODAY) },
          { id: "Tomorrow",label: "Tomorrow",       sub: fmt(addDays(TODAY, 1)) },
          { id: "This Weekend", label: "This weekend", sub: "Sat – Sun" },
          { id: "This Week",    label: "This week",    sub: "Mon – Sun" },
          { id: "This Month",   label: "This month",   sub: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).toLocaleString("default", { month: "long" }) },
          { id: "Custom",  label: "Pick a date…",  sub: "Custom range" },
        ].map(opt => {
          const on = opt.id === null ? !datePreset : datePreset === opt.id;
          return (
            <TouchableOpacity key={String(opt.id)} onPress={() => { setDatePreset(opt.id); setDateSheetOpen(false); }}
              style={[styles.sheetRow, { backgroundColor: on ? T.surface : "transparent", borderColor: on ? T.gold : "transparent" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetRowLabel, { color: T.text }]}>{opt.label}</Text>
                <Text style={[styles.sheetRowSub,   { color: T.muted }]}>{opt.sub}</Text>
              </View>
              {on && <Text style={{ color: T.gold, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          );
        })}
        {/* Custom range inputs */}
        <View style={[styles.dateDivider, { backgroundColor: T.borderSub, marginTop: 8 }]} />
        <Text style={[styles.customLabel, { color: T.muted }]}>CUSTOM RANGE</Text>
        <View style={styles.customRow}>
          {Platform.OS === "web" ? (
            <>
              {React.createElement("input", { type: "date", value: customFrom,
                onChange: (e: any) => setCustomFrom(e.target.value),
                style: { flex: 1, border: `2px solid ${customFrom ? T.text : T.borderSub}`, borderRadius: 10, fontSize: 12, padding: 8, backgroundColor: T.bgCardHi, color: T.text, outline: "none", fontFamily: "Inter" } })}
              <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
              {React.createElement("input", { type: "date", value: customTo,
                onChange: (e: any) => setCustomTo(e.target.value),
                style: { flex: 1, border: `2px solid ${customTo ? T.text : T.borderSub}`, borderRadius: 10, fontSize: 12, padding: 8, backgroundColor: T.bgCardHi, color: T.text, outline: "none", fontFamily: "Inter" } })}
            </>
          ) : (
            <>
              <TextInput value={customFrom} onChangeText={setCustomFrom} placeholder="YYYY-MM-DD" placeholderTextColor={T.mutedL}
                style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customFrom ? T.text : T.borderSub }]} />
              <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
              <TextInput value={customTo} onChangeText={setCustomTo} placeholder="YYYY-MM-DD" placeholderTextColor={T.mutedL}
                style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customTo ? T.text : T.borderSub }]} />
            </>
          )}
        </View>
        {customFrom && customTo && (
          <TouchableOpacity onPress={() => { setDatePreset("Custom"); setDateSheetOpen(false); }}
            style={[styles.applyBtn, { backgroundColor: T.text }]}>
            <Text style={[styles.applyText, { color: T.goldBri }]}>Apply date range</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>

      {/* ── Filters sheet ──────────────────────────────────────────────── */}
      <BottomSheet open={filtersSheetOpen} onClose={() => setFiltersSheetOpen(false)} title="Filter by category" T={T} maxHeightRatio={0.85}>
        {/* Free only toggle */}
        <View style={[styles.freeRow, { backgroundColor: T.surface, borderColor: freeOnly ? T.gold : T.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetRowLabel, { color: T.text }]}>Free only</Text>
            <Text style={[styles.sheetRowSub,   { color: T.muted }]}>Hide ticketed events</Text>
          </View>
          <Switch value={freeOnly} onValueChange={setFreeOnly}
            trackColor={{ false: T.borderSub, true: T.text }}
            thumbColor={freeOnly ? T.goldBri : T.bg} />
        </View>

        <Text style={[styles.customLabel, { color: T.muted, marginTop: 16, marginBottom: 10 }]}>CATEGORIES</Text>
        <View style={styles.catGrid}>
          {CATEGORY_FILTERS.map(f => {
            const on = activeFilter === f.id;
            return (
              <TouchableOpacity key={f.id} onPress={() => { setActiveFilter(on ? "All" : f.id); setShowSaved(false); }}
                style={[styles.catCell, { backgroundColor: on ? T.surface : T.bgSub, borderColor: on ? T.gold : "transparent" }]}>
                <View style={[styles.catIcon, { backgroundColor: T.bgCard, borderColor: T.borderSub }]}>
                  <Text style={{ fontSize: 20 }}>{f.icon}</Text>
                </View>
                <Text style={[styles.catLabel, { color: T.text }]}>{f.label}</Text>
                {on && (
                  <View style={[styles.catCheck, { backgroundColor: T.gold }]}>
                    <Text style={{ color: T.bg, fontSize: 10, fontWeight: "700" }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sheetActions}>
          <TouchableOpacity onPress={() => { setActiveFilter("All"); setFreeOnly(false); }}
            style={[styles.resetBtn, { borderColor: T.border }]}>
            <Text style={[styles.resetText, { color: T.text }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFiltersSheetOpen(false)}
            style={[styles.showBtn, { backgroundColor: T.text }]}>
            <Text style={[styles.showText, { color: T.goldBri }]}>
              {filterCount > 0
                ? `Show ${filterCount} filter${filterCount > 1 ? "s" : ""}`
                : "Show all results"}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Sources sheet ──────────────────────────────────────────────── */}
      <BottomSheet open={sourcesSheetOpen} onClose={() => setSourcesSheetOpen(false)} title="Sources" T={T}>
        <Text style={[styles.sheetRowSub, { color: T.textSub, marginBottom: 14 }]}>
          We aggregate from these places. Untick to mute any of them.
        </Text>
        {SOURCE_FILTERS.map(f => {
          const on = activeSources.has(f.id);
          return (
            <TouchableOpacity key={f.id} onPress={() => toggleSource(f.id)}
              style={[styles.sourceRow, { backgroundColor: T.surface, borderColor: on ? T.gold : T.border }]}>
              <View style={[styles.sourceIcon, { backgroundColor: T.bgSub, borderColor: T.borderSub }]}>
                <Text style={{ fontSize: 18 }}>{f.icon}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.sheetRowLabel, { color: T.text }]}>{f.label}</Text>
                <Text style={[styles.sheetRowSub,   { color: T.muted }]} numberOfLines={1}>
                  {SOURCE_DESCS[f.label] ?? ""}
                </Text>
              </View>
              <View style={[styles.checkbox, { borderColor: on ? T.gold : T.border, backgroundColor: on ? T.gold : "transparent" }]}>
                {on && <Text style={{ color: T.bg, fontSize: 12, fontWeight: "700" }}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
        {activeSources.size > 0 && (
          <TouchableOpacity onPress={() => setActiveSources(new Set())}
            style={[styles.resetBtn, { borderColor: T.red, marginTop: 14 }]}>
            <Text style={[styles.resetText, { color: T.red }]}>Clear all source filters</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>

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

      {/* AMC filter — rich grouped view by theatre */}
      {activeFilter === "AMC" && cinemaGroups.length > 0 ? (
        <CinemaGroupedView groups={cinemaGroups} T={T} />
      ) : isMixLayout ? (

      /* ── "All" view — sectioned Mix layout ──────────────────────── */
      <ScrollView
        contentContainerStyle={[styles.feed, { paddingHorizontal: 0, paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Events + Activities section — TicketCards */}
        {mixTicketItems.length > 0 && (
          <>
            <SectionHeader
              label={eventSectionLabel}
              count={`${mixTicketItems.length} result${mixTicketItems.length !== 1 ? "s" : ""}`}
              T={T}
            />
            <View style={{ paddingHorizontal: 16 }}>
              {mixTicketItems.map(item => (
                <TicketCard
                  key={item.id} item={item} T={T}
                  saved={saved.has(item.id)}
                  onSave={() => handleToggle(item.id)}
                />
              ))}
            </View>
          </>
        )}

        {/* Community section — ListRows */}
        {mixCommunityItems.length > 0 && (
          <>
            <SectionHeader
              label="From the community"
              count={`${mixCommunityItems.length}`}
              T={T}
            />
            <View style={{ paddingHorizontal: 22 }}>
              {mixCommunityItems.map((item, i) => (
                <ListRow
                  key={item.id} item={item} T={T}
                  saved={saved.has(item.id)}
                  onSave={() => handleToggle(item.id)}
                  isLast={i === mixCommunityItems.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Recommendations footer — only shown when the "Show recommendations"
            toggle is ON in Profile → Feed settings */}
        {showRecsEnabled && mixRecItems.length > 0 && (
          <>
            <View style={[styles.recDivider, { marginHorizontal: 16 }]}>
              <View style={[styles.dividerLine, { backgroundColor: T.gold }]} />
              <Text style={[styles.dividerText, { color: T.goldDim }]}>
                {showingRecommendations ? "✦ More recommendations for you in the area" : "✦ You might also like"}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: T.gold }]} />
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {mixRecItems.map(item => (
                <TicketCard key={item.id} item={item} T={T} saved={saved.has(item.id)} onSave={() => handleToggle(item.id)} />
              ))}
            </View>
          </>
        )}

        {/* Loading indicator */}
        {remoteLoading && (
          <View style={styles.remoteLoader}>
            <ActivityIndicator size="small" color={T.muted} />
            <Text style={[styles.remoteLoaderText, { color: T.muted }]}>Loading community posts…</Text>
          </View>
        )}

        {/* Empty state */}
        {!remoteLoading && mixTicketItems.length === 0 && mixCommunityItems.length === 0 && mixRecItems.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{noAreaData ? "🗺️" : "📅"}</Text>
            <Text style={[styles.emptyTitle, { color: T.text }]}>
              {noAreaData ? "Nothing here yet" : dateActive ? "No results for this date" : "Nothing found nearby"}
            </Text>
            <Text style={[styles.emptySub, { color: T.muted }]}>
              {noAreaData ? "Try a different location or extend your time range"
                : dateActive ? "Try a different date or tap × to clear"
                : "Try a different category or source filter"}
            </Text>
          </View>
        )}
      </ScrollView>

      ) : (

      /* ── All other filters — same card style as Mix layout ─────────── */
      <FlatList
        data={showAll ? events : filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.feed, { paddingHorizontal: 0 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (isCommunityItem(item)) {
            return (
              <View style={{ paddingHorizontal: 22 }}>
                <ListRow
                  item={item} T={T}
                  saved={saved.has(item.id)}
                  onSave={() => handleToggle(item.id)}
                  isLast={false}
                />
              </View>
            );
          }
          if (item.type === "recommendation" && item.source !== "Viator" && item.category !== "Activities") {
            return (
              <View style={{ paddingHorizontal: 16 }}>
                <TicketCard item={item} T={T} saved={saved.has(item.id)} onSave={() => handleToggle(item.id)} />
              </View>
            );
          }
          return (
            <View style={{ paddingHorizontal: 16 }}>
              <TicketCard
                item={item} T={T}
                saved={saved.has(item.id)}
                onSave={() => handleToggle(item.id)}
              />
            </View>
          );
        }}
        ListHeaderComponent={(() => {
          const count = showAll ? events.length : filtered.length;
          if (remoteLoading || count === 0) return null;
          const label = showSaved
            ? `${count} saved item${count !== 1 ? "s" : ""}`
            : `${count} result${count !== 1 ? "s" : ""} · this week in your area${activeFilter !== "All" ? ` · ${activeFilter}` : ""}`;
          return (
            <Text style={[styles.resultCount, { color: T.muted, paddingHorizontal: 16 }]}>{label}</Text>
          );
        })()}
        ListFooterComponent={(
          <>
            {/* In filtered views recs always show; in the All view respect the toggle */}
            {!showSaved && recs.length > 0 && (showRecsEnabled || !showAll) && (
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
                <View style={{ paddingHorizontal: 16 }}>
                  {recs.map(item => (
                    <TicketCard key={item.id} item={item} T={T} saved={saved.has(item.id)} onSave={() => handleToggle(item.id)} />
                  ))}
                </View>
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
      )}
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
  // ── 3-pill bar ──────────────────────────────────────────────────────────
  pillBar:        { flexDirection: "row", gap: 8, paddingBottom: 12 } as ViewStyle,
  pill:           { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  pillLabel:      { fontSize: 9, fontWeight: "700", letterSpacing: 0.18, textTransform: "uppercase", fontFamily: "DMSans_700Bold", lineHeight: 11 } as TextStyle,
  pillValue:      { flex: 1, fontSize: 13, fontWeight: "600", fontFamily: "DMSans_700Bold", lineHeight: 16 } as TextStyle,
  pillChevron:    { fontSize: 9 } as TextStyle,
  // ── Sheet rows ───────────────────────────────────────────────────────────
  sheetRow:       { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 6 } as ViewStyle,
  sheetRowLabel:  { fontSize: 15, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  sheetRowSub:    { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 } as TextStyle,
  freeRow:        { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 4 } as ViewStyle,
  catGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  catCell:        { width: "30.5%", borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: "center", gap: 8, position: "relative" } as ViewStyle,
  catIcon:        { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  catLabel:       { fontSize: 13, fontWeight: "600", fontFamily: "DMSans_700Bold", textAlign: "center" } as TextStyle,
  catCheck:       { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sheetActions:   { flexDirection: "row", gap: 10, marginTop: 20 } as ViewStyle,
  resetBtn:       { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  resetText:      { fontSize: 14, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  showBtn:        { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" } as ViewStyle,
  showText:       { fontSize: 14, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  sourceRow:      { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 8 } as ViewStyle,
  sourceIcon:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dateDivider:    { height: 1.5, marginBottom: 12 } as ViewStyle,
  customLabel:    { fontSize: 10, fontWeight: "700", letterSpacing: 1, fontFamily: "DMSans_700Bold", marginBottom: 8 } as TextStyle,
  customRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 } as ViewStyle,
  dateInput:      { flex: 1, borderWidth: 2, borderRadius: 10, fontSize: 12, padding: 8, fontFamily: "DMSans_400Regular" } as TextStyle,
  toLabel:        { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  applyBtn:       { borderRadius: 10, padding: 10, alignItems: "center" } as ViewStyle,
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
