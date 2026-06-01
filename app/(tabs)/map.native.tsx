// app/(tabs)/map.tsx — native only; web uses map.web.tsx (Expo Router platform extension)
//
// @rnmapbox/maps requires a development build — it will NOT work in Expo Go.
// Run: npx expo run:ios  (or run:android) for native testing.
// Web fallback is handled automatically via map.web.tsx.
//
// Mapbox free tier: 25,000 MAU/month on mobile — monitor usage at
// https://account.mapbox.com

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Switch,
  StyleSheet, ViewStyle, TextStyle, Linking,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/hooks/useTheme";
import { useSavedEvents } from "../../src/hooks/useSavedEvents";
import { useSavedAreas } from "../../src/context/SavedAreasContext";
import { EventItem } from "../../src/data/mockEvents";
import { EventCard } from "../../src/components/EventCard";
import { BottomSheet } from "../../src/components/BottomSheet";
import { getFeed } from "../../src/services/feedService";
import { searchViatorExperiences } from "../../src/services/viatorService";
import { FILTERS, SOURCE_FILTERS, FilterOption } from "../../src/config/filterConfig";
import { SEARCH_CONFIG } from "../../src/config/searchConfig";
import { LocationInput } from "../../src/components/LocationInput";
import { Wordmark } from "../../src/components/Wordmark";
import { searchLocations } from "../../src/services/locationService";
import type { LocationSuggestion } from "../../src/services/locationService";

if (Platform.OS !== "web" && typeof MapboxGL?.setAccessToken === "function") {
  MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_KEY ?? "");
}

const DEFAULT_ZOOM  = 13;
const DEFAULT_COORD = [SEARCH_CONFIG.DEFAULT_LNG, SEARCH_CONFIG.DEFAULT_LAT] as [number, number];

const RADIUS_OPTIONS = [
  { label: "0.5 mi",  metres: 800   },
  { label: "2 miles", metres: 3200  },
  { label: "5 miles", metres: 8000  },
  { label: "10 miles",metres: 16000 },
] as const;

const QUICK_PRESETS = ["Today", "Tomorrow", "This Weekend", "This Week", "This Month"] as const;
const fmt     = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const TODAY   = new Date();

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

type DrawPoint = { lat: number; lng: number };

export default function MapScreen() {
  const { theme: T, isDark } = useTheme();
  const scheme = isDark ? "dark" : "light";
  const { saved, toggle } = useSavedEvents();
  const { activeArea, addArea } = useSavedAreas();

  const cameraRef = useRef<MapboxGL.Camera>(null);

  const [feedItems, setFeedItems]     = useState<EventItem[]>([]);
  const [viatorItems, setViatorItems] = useState<EventItem[]>([]);
  // Nightlife, Activities, Outdoors items are now in feedItems via feedService (always-on)
  const [loading, setLoading]             = useState(false);
  const [selected, setSelected]         = useState<EventItem | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [freeOnly, setFreeOnly]         = useState(false);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [dateSheetOpen,    setDateSheetOpen]    = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [sourcesSheetOpen, setSourcesSheetOpen] = useState(false);
  const [searchVal, setSearchVal]       = useState("");
  const [drawMode, setDrawMode]         = useState(false);
  const [drawPoints, setDrawPoints]     = useState<DrawPoint[]>([]);
  const [drawClosed, setDrawClosed]     = useState(false);
  const [centre, setCentre]             = useState<[number, number]>(DEFAULT_COORD);
  const [radiusMetres, setRadiusMetres] = useState<number>(SEARCH_CONFIG.DEFAULT_RADIUS_METRES);

  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");

  const mapStyle = scheme === "dark"
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/streets-v12";

  // ── Load feed + fly camera when active area changes ─────────────────────────
  useEffect(() => {
    if (!activeArea) return;
    setSearchVal(activeArea);
    setFeedItems([]);
    setLoading(true);

    Promise.all([
      AsyncStorage.getItem("hearby_lat"),
      AsyncStorage.getItem("hearby_lng"),
      AsyncStorage.getItem("hearby_coords_area"),
    ]).then(async ([latStr, lngStr, coordsArea]) => {
      let coords: { lat: number; lng: number } | undefined;

      if (latStr && lngStr && coordsArea === activeArea) {
        coords = { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
      } else {
        try {
          const suggestions = await searchLocations(activeArea);
          if (suggestions.length > 0) {
            coords = { lat: suggestions[0].lat, lng: suggestions[0].lng };
            await AsyncStorage.setItem("hearby_lat", String(coords.lat));
            await AsyncStorage.setItem("hearby_lng", String(coords.lng));
            await AsyncStorage.setItem("hearby_coords_area", activeArea);
          }
        } catch { /* feed loads without coords */ }
      }

      if (coords) {
        const coord: [number, number] = [coords.lng, coords.lat];
        setCentre(coord);
        cameraRef.current?.flyTo(coord, 600);
      }

      return getFeed(activeArea, coords);
    })
      .then(result => setFeedItems(result.items))
      .catch(() => setFeedItems([]))
      .finally(() => setLoading(false));
  }, [activeArea]);

  // ── Fetch Viator pins separately so they appear on the map ─────────────────
  useEffect(() => {
    const area = activeArea || searchVal;
    if (!area) return;

    const [centerLng, centerLat] = centre;
    const coords = (centerLat !== SEARCH_CONFIG.DEFAULT_LAT || centerLng !== SEARCH_CONFIG.DEFAULT_LNG)
      ? { lat: centerLat, lng: centerLng }
      : undefined;

    searchViatorExperiences(area, coords)
      .then(results => setViatorItems(results.filter(e => e.lat != null && e.lng != null)))
      .catch(() => setViatorItems([]));
  }, [activeArea, centre]);

  const handleAreaSelect = async (s: LocationSuggestion) => {
    setSearchVal(s.shortName);
    await AsyncStorage.setItem("hearby_lat", String(s.lat));
    await AsyncStorage.setItem("hearby_lng", String(s.lng));
    await AsyncStorage.setItem("hearby_coords_area", s.shortName);
    await addArea(s.shortName);
    const coord: [number, number] = [s.lng, s.lat];
    setCentre(coord);
    cameraRef.current?.flyTo(coord, 600);
  };

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

  const range      = dateRange();
  const dateLabel  = datePreset === "Custom" && customFrom && customTo
    ? `${customFrom.slice(5)} – ${customTo.slice(5)}` : datePreset ?? "Anytime";
  const dateActive = !!datePreset;
  const noAreaData = !loading && feedItems.length === 0;
  const clearDate  = () => { setDatePreset(null); setCustomFrom(""); setCustomTo(""); setDateSheetOpen(false); };
  const filterCount = (activeFilter !== "All" ? 1 : 0) + (freeOnly ? 1 : 0);
  const filterLabel = filterCount > 0 ? String(filterCount) : "All";
  const freeFn = FILTERS.find(f => f.id === "Free")?.matchFn;

  // Mirror feed's FILTER_ONLY_SOURCE_MAP: hide filter-specific sources from "All"
  const FILTER_ONLY_SOURCE_MAP: Record<string, string> = {
    "Food Places":      "Food & Drink",
    "Showtimes":        "Cinema",
    "AMC Theatres":     "AMC",
    "Nightlife Places": "Nightlife",
    "Outdoor Places":   "Outdoors",
    "Wellness Places":  "wellness",
    "Activity Places":  "activities",
  };

  const catFilter  = useMemo(() => FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0], [activeFilter]);
  const srcFilters = useMemo<FilterOption[]>(() =>
    activeSources.size === 0 ? [] : SOURCE_FILTERS.filter(f => activeSources.has(f.id)),
  [activeSources]);

  const toggleSource = (id: string) => setActiveSources(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // All items for the map = feedItems (contains all categories) + any extra Viator pins
  // with coords that weren't in the deduplicated feed result.
  const allItems = useMemo(() => {
    const feedIds = new Set(feedItems.map(e => e.id));
    const extras  = viatorItems.filter(e => !feedIds.has(e.id));
    return [...feedItems, ...extras];
  }, [feedItems, viatorItems]);

  const visible = useMemo(() => allItems.filter(e => {
    if (freeOnly && freeFn && !freeFn(e)) return false;
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    if (e.lat == null || e.lng == null) return false;
    if (range && e.date) return e.date >= range[0] && e.date <= range[1];
    return true;
  }), [allItems, catFilter, srcFilters, range, freeOnly]);

  const listItems = useMemo(() => allItems.filter(e => {
    if (freeOnly && freeFn && !freeFn(e)) return false;
    // Match feed's FILTER_ONLY_SOURCE_MAP: hide food/showtime recs outside their category
    const requiredCat = FILTER_ONLY_SOURCE_MAP[e.source];
    if (requiredCat && activeFilter !== requiredCat) return false;
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    // Recommendations pass date filter regardless (same as feed screen)
    if (range) {
      if (e.type === "recommendation") return true;
      if (!e.date) return false;
      return e.date >= range[0] && e.date <= range[1];
    }
    return true;
  }), [allItems, catFilter, srcFilters, range, freeOnly, activeFilter, FILTER_ONLY_SOURCE_MAP]);

  // GeoJSON for draw polygon overlay
  const drawGeoJSON = useMemo((): GeoJSON.Feature | null => {
    if (drawPoints.length < 2) return null;
    const coords = drawPoints.map(p => [p.lng, p.lat]);
    if (drawClosed && drawPoints.length >= 3) {
      return {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] },
      };
    }
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };
  }, [drawPoints, drawClosed]);

  const handleMapPress = (feature: GeoJSON.Feature) => {
    if (!drawMode) return;
    const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
    if (drawPoints.length >= 3) {
      const first = drawPoints[0];
      if (Math.abs(lat - first.lat) < 0.001 && Math.abs(lng - first.lng) < 0.001) {
        setDrawClosed(true);
        return;
      }
    }
    setDrawClosed(false);
    setDrawPoints(p => [...p, { lat, lng }]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: T.bg, borderBottomColor: T.border }]}>
        <Wordmark T={T} />
        <LocationInput
          value={searchVal}
          onChangeText={setSearchVal}
          onSelect={handleAreaSelect}
          placeholder="Search a new area…"
          returnKeyType="search"
          T={T}
        />

        {/* 3-pill filter bar */}
        <View style={styles.pillBar}>
          <PillButton T={T} label="DATE"    value={dateLabel}   active={dateActive}          onPress={() => { setDateSheetOpen(true); setSelected(null); }} />
          <PillButton T={T} label="FILTERS" value={filterLabel} active={filterCount > 0}     onPress={() => setFiltersSheetOpen(true)} />
          <PillButton T={T} label="SOURCES" value={activeSources.size > 0 ? String(activeSources.size) : "All"} active={activeSources.size > 0} onPress={() => setSourcesSheetOpen(true)} />
          <TouchableOpacity
            onPress={() => { setDrawMode(m => !m); setDrawPoints([]); setDrawClosed(false); }}
            activeOpacity={0.8}
            style={[styles.drawPill, { backgroundColor: drawMode ? T.text : T.surface, borderColor: drawMode ? T.gold : T.border }]}
          >
            <Text style={{ fontSize: 15 }}>✏️</Text>
            {drawMode && <Text style={[styles.pillLabel, { color: T.goldBri, letterSpacing: 0.5 }]}>ON</Text>}
          </TouchableOpacity>
        </View>

        {/* Radius chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 4 }}
          contentContainerStyle={{ gap: 6, paddingBottom: 10 }}
        >
          {RADIUS_OPTIONS.map(opt => {
            const on = radiusMetres === opt.metres;
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => setRadiusMetres(opt.metres)}
                style={[styles.radiusChip, {
                  backgroundColor: on ? T.text : "transparent",
                  borderColor: on ? T.text : T.borderSub,
                }]}
              >
                <Text style={[styles.radiusChipText, { color: on ? T.goldBri : T.muted }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Date sheet */}
      <BottomSheet open={dateSheetOpen} onClose={() => setDateSheetOpen(false)} title="When" T={T}>
        {[
          { id: null,           label: "Anytime",      sub: "No date filter" },
          { id: "Today",        label: "Today",        sub: fmt(TODAY) },
          { id: "Tomorrow",     label: "Tomorrow",     sub: fmt(addDays(TODAY, 1)) },
          { id: "This Weekend", label: "This weekend", sub: "Sat – Sun" },
          { id: "This Week",    label: "This week",    sub: "Mon – Sun" },
          { id: "This Month",   label: "This month",   sub: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).toLocaleString("default", { month: "long" }) },
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
        <View style={[styles.dateDivider, { backgroundColor: T.borderSub, marginTop: 8 }]} />
        <Text style={[styles.customLabel, { color: T.muted }]}>CUSTOM RANGE</Text>
        <View style={styles.customRow}>
          <TextInput value={customFrom} onChangeText={setCustomFrom} placeholder="YYYY-MM-DD" placeholderTextColor={T.mutedL}
            style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customFrom ? T.text : T.borderSub }]} />
          <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
          <TextInput value={customTo} onChangeText={setCustomTo} placeholder="YYYY-MM-DD" placeholderTextColor={T.mutedL}
            style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customTo ? T.text : T.borderSub }]} />
        </View>
        {customFrom && customTo && (
          <TouchableOpacity onPress={() => { setDatePreset("Custom"); setDateSheetOpen(false); }}
            style={[styles.applyBtn, { backgroundColor: T.text }]}>
            <Text style={[styles.applyText, { color: T.goldBri }]}>Apply date range</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>

      {/* Filters sheet */}
      <BottomSheet open={filtersSheetOpen} onClose={() => setFiltersSheetOpen(false)} title="Filter by category" T={T} maxHeightRatio={0.85}>
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
              <TouchableOpacity key={f.id} onPress={() => setActiveFilter(on ? "All" : f.id)}
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
              {filterCount > 0 ? `Show ${filterCount} filter${filterCount > 1 ? "s" : ""}` : "Show all results"}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Sources sheet */}
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

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ── Mapbox MapView ─────────────────────────────────────────────────── */}
        <View style={[styles.mapWrap, { borderColor: T.border, shadowColor: T.border }]}>
          <MapboxGL.MapView
            style={styles.map}
            styleURL={mapStyle}
            onPress={handleMapPress}
            compassEnabled={false}
            scaleBarEnabled={false}
            logoEnabled={false}
            attributionEnabled={true}
            attributionPosition={{ bottom: 4, right: 4 }}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              centerCoordinate={centre}
              zoomLevel={DEFAULT_ZOOM}
              animationMode="flyTo"
              animationDuration={600}
            />

            {/* Radius circle */}
            <MapboxGL.ShapeSource
              id="radiusCircle"
              shape={{
                type: "Feature",
                geometry: { type: "Point", coordinates: centre },
                properties: {},
              }}
            >
              <MapboxGL.CircleLayer
                id="radiusCircleFill"
                style={{
                  circleRadius: {
                    stops: [[0, 0], [20, radiusMetres / 0.075]],
                    base: 2,
                  } as unknown as number,
                  circleColor: T.gold,
                  circleOpacity: 0.06,
                  circleStrokeWidth: 1.5,
                  circleStrokeColor: T.gold,
                  circleStrokeOpacity: 0.4,
                }}
              />
            </MapboxGL.ShapeSource>

            {/* Draw polygon overlay */}
            {drawGeoJSON && (
              <MapboxGL.ShapeSource id="draw-source" shape={drawGeoJSON}>
                {drawClosed ? (
                  <>
                    <MapboxGL.FillLayer
                      id="draw-fill"
                      style={{ fillColor: T.gold + "40", fillOpacity: 1 }}
                    />
                    <MapboxGL.LineLayer
                      id="draw-line-closed"
                      style={{ lineColor: T.gold, lineWidth: 2.5 }}
                    />
                  </>
                ) : (
                  <MapboxGL.LineLayer
                    id="draw-line"
                    style={{ lineColor: T.gold, lineWidth: 2.5, lineDasharray: [3, 2] }}
                  />
                )}
              </MapboxGL.ShapeSource>
            )}

            {/* Event + Viator pins */}
            {visible.map(item => (
              <MapboxGL.MarkerView
                key={String(item.id)}
                coordinate={[item.lng!, item.lat!]}
                anchor={{ x: 0.5, y: 1 }}
              >
                <TouchableOpacity
                  onPress={() => setSelected(selected?.id === item.id ? null : item)}
                  activeOpacity={0.85}
                  style={[styles.pin, {
                    backgroundColor: selected?.id === item.id ? item.catColor : T.bg,
                    borderColor: item.catColor,
                    transform: [{ scale: selected?.id === item.id ? 1.2 : 1 }],
                  }]}
                >
                  <Text style={{ fontSize: selected?.id === item.id ? 16 : 13 }}>{item.img}</Text>
                </TouchableOpacity>
              </MapboxGL.MarkerView>
            ))}
          </MapboxGL.MapView>
        </View>

        {/* Draw controls bar */}
        {drawMode && (
          <View style={[styles.drawBar, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            {drawPoints.length === 0 ? (
              <Text style={[styles.drawHint, { color: T.muted }]}>Tap the map to start drawing your area</Text>
            ) : !drawClosed ? (
              <>
                <Text style={[styles.drawHint, { color: T.muted, flex: 1 }]}>
                  {drawPoints.length} point{drawPoints.length !== 1 ? "s" : ""}
                  {drawPoints.length >= 3 ? " — tap near first point to close" : ""}
                </Text>
                <TouchableOpacity onPress={() => setDrawPoints(p => p.slice(0, -1))} style={[styles.drawBtn, { borderColor: T.borderSub }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: T.muted, fontFamily: "DMSans_700Bold" }}>Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setDrawPoints([]); setDrawClosed(false); }} style={[styles.drawBtn, { borderColor: T.red }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: T.red, fontFamily: "DMSans_700Bold" }}>Clear</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.drawHint, { color: T.goldDim, flex: 1, fontWeight: "700" }]}>✦ Area selected</Text>
                <TouchableOpacity onPress={() => { setDrawPoints([]); setDrawClosed(false); }} style={[styles.drawBtn, { borderColor: T.borderSub }]}>
                  <Text style={{ fontSize: 12, color: T.muted, fontFamily: "DMSans_700Bold" }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDrawMode(false)} style={[styles.drawBtn, { borderColor: T.text, backgroundColor: T.text }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: T.goldBri, fontFamily: "DMSans_700Bold" }}>Search area</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Selected pin callout ───────────────────────────────────────────── */}
        {selected && (
          <View style={[styles.callout, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <Text style={[styles.calloutTitle, { color: T.text }]} numberOfLines={2}>
              {selected.title}
            </Text>
            {selected.rating != null && (
              <Text style={[styles.calloutRating, { color: T.gold }]}>
                {"★".repeat(Math.round(selected.rating))}{" "}
                {selected.rating.toFixed(1)}
                {selected.reviews ? ` (${selected.reviews.toLocaleString()} reviews)` : ""}
              </Text>
            )}
            <Text style={[styles.calloutSub, { color: T.muted }]}>
              {selected.time} · {selected.location}
            </Text>
            <View style={styles.calloutActions}>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                style={[styles.calloutClose, { borderColor: T.borderSub }]}
              >
                <Text style={{ color: T.muted, fontSize: 13 }}>✕</Text>
              </TouchableOpacity>
              {selected.booking ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(selected!.booking!.url)}
                  style={[styles.calloutCTA, { backgroundColor: T.text, borderColor: T.text }]}
                >
                  <Text style={[styles.calloutCTAText, { color: T.goldBri }]}>
                    {selected.booking.label}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    // Scroll to the full card in the list below
                  }}
                  style={[styles.calloutCTA, { backgroundColor: T.text, borderColor: T.text }]}
                >
                  <Text style={[styles.calloutCTAText, { color: T.goldBri }]}>View details</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Events counter */}
        {!loading && feedItems.length > 0 && (
          <View style={[styles.countBar, { borderBottomColor: T.borderSub }]}>
            <Text style={[styles.countText, { color: T.muted }]}>
              {listItems.length} event{listItems.length !== 1 ? "s" : ""} found
            </Text>
          </View>
        )}

        {/* ── Event list ────────────────────────────────────────────────────── */}
        <View style={{ padding: 12 }}>
          {noAreaData ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🗺️</Text>
              <Text style={[styles.emptyTitle, { color: T.text }]}>Nothing here yet</Text>
              <Text style={[styles.emptySub, { color: T.muted }]}>Try a different location or extend your time range</Text>
            </View>
          ) : listItems.length === 0 && dateActive ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={[styles.emptyTitle, { color: T.text }]}>No results for this date</Text>
              <Text style={[styles.emptySub, { color: T.muted }]}>Try a different date or tap × to clear</Text>
            </View>
          ) : (
            listItems.map(item => (
              <TouchableOpacity key={item.id} onPress={() => setSelected(selected?.id === item.id ? null : item)}
                style={[styles.listRow, {
                  backgroundColor: selected?.id === item.id ? T.bgCardHi : T.bgCard,
                  borderColor: selected?.id === item.id ? item.catColor : T.borderSub,
                  shadowColor: T.borderSub,
                }]}>
                <View style={[styles.listIcon, { backgroundColor: item.catColor + "20", borderColor: item.catColor }]}>
                  <Text style={{ fontSize: 18 }}>{item.img}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.listTitle, { color: T.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.listSub, { color: T.muted }]}>{item.time}</Text>
                </View>
                <Text style={{ color: T.muted, fontSize: 12 }}>→</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 } as ViewStyle,
  header:         { borderBottomWidth: 2, padding: 14 } as ViewStyle,
  // ── 3-pill bar ──────────────────────────────────────────────────────────
  pillBar:        { flexDirection: "row", gap: 8, marginTop: 10 } as ViewStyle,
  pill:           { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  pillLabel:      { fontSize: 9, fontWeight: "700", letterSpacing: 0.18, textTransform: "uppercase", fontFamily: "DMSans_700Bold", lineHeight: 11 } as TextStyle,
  pillValue:      { flex: 1, fontSize: 13, fontWeight: "600", fontFamily: "DMSans_700Bold", lineHeight: 16 } as TextStyle,
  pillChevron:    { fontSize: 9 } as TextStyle,
  drawPill:       { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 44 } as ViewStyle,
  radiusChip:     { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  radiusChipText: { fontSize: 12, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
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
  // ── Map & list ──────────────────────────────────────────────────────────
  countBar:       { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 } as ViewStyle,
  countText:      { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "DMSans_700Bold" } as TextStyle,
  mapWrap:        { margin: 12, borderRadius: 16, borderWidth: 2, overflow: "hidden", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4, height: 320 } as ViewStyle,
  map:            { flex: 1 } as ViewStyle,
  pin:            { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 } as ViewStyle,
  drawBar:        { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, borderWidth: 2, borderRadius: 14, padding: 10, marginBottom: 4 } as ViewStyle,
  drawHint:       { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  drawBtn:        { borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  callout:        { margin: 12, borderWidth: 2, borderRadius: 16, padding: 14, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as ViewStyle,
  calloutTitle:   { fontSize: 16, fontWeight: "800", fontFamily: "PlayfairDisplay_800ExtraBold", marginBottom: 4 } as TextStyle,
  calloutRating:  { fontSize: 13, fontFamily: "DMSans_600SemiBold", marginBottom: 4 } as TextStyle,
  calloutSub:     { fontSize: 12, fontFamily: "DMSans_400Regular", marginBottom: 10 } as TextStyle,
  calloutActions: { flexDirection: "row", gap: 8, alignItems: "center" } as ViewStyle,
  calloutClose:   { borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 } as ViewStyle,
  calloutCTA:     { flex: 1, borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" } as ViewStyle,
  calloutCTAText: { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  listRow:        { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 12, padding: 10, marginBottom: 8, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  listIcon:       { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  listTitle:      { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  listSub:        { fontSize: 11, fontFamily: "DMSans_400Regular" } as TextStyle,
  empty:          { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 } as ViewStyle,
  emptyIcon:      { fontSize: 36, marginBottom: 12 } as TextStyle,
  emptyTitle:     { fontSize: 16, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:       { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center" } as TextStyle,
});
