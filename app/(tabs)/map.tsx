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
  View, Text, TouchableOpacity, ScrollView, TextInput, Platform,
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

type DrawPoint = { lat: number; lng: number };

export default function MapScreen() {
  const { theme: T, isDark } = useTheme();
  const scheme = isDark ? "dark" : "light";
  const { saved, toggle } = useSavedEvents();
  const { activeArea, addArea } = useSavedAreas();

  const cameraRef = useRef<MapboxGL.Camera>(null);

  const [feedItems, setFeedItems]       = useState<EventItem[]>([]);
  const [viatorItems, setViatorItems]   = useState<EventItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [selected, setSelected]         = useState<EventItem | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [sourcesOpen, setSourcesOpen]   = useState(false);
  const [searchVal, setSearchVal]       = useState("");
  const [drawMode, setDrawMode]         = useState(false);
  const [drawPoints, setDrawPoints]     = useState<DrawPoint[]>([]);
  const [drawClosed, setDrawClosed]     = useState(false);
  const [centre, setCentre]             = useState<[number, number]>(DEFAULT_COORD);
  const [radiusMetres, setRadiusMetres] = useState<number>(SEARCH_CONFIG.DEFAULT_RADIUS_METRES);

  const [dateOpen, setDateOpen]     = useState(false);
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
    ? `${customFrom.slice(5)} – ${customTo.slice(5)}` : datePreset ?? "Date";
  const dateActive = !!datePreset;
  const noAreaData = !loading && feedItems.length === 0;
  const clearDate  = () => { setDatePreset(null); setCustomFrom(""); setCustomTo(""); setDateOpen(false); };

  const catFilter  = useMemo(() => FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0], [activeFilter]);
  const srcFilters = useMemo<FilterOption[]>(() =>
    activeSources.size === 0 ? [] : SOURCE_FILTERS.filter(f => activeSources.has(f.id)),
  [activeSources]);

  const toggleSource = (id: string) => setActiveSources(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // All items available for the map (feed + Viator pins with coords)
  const allItems = useMemo(() => {
    const feedWithCoords = feedItems.filter(e => e.lat != null && e.lng != null);
    // Viator items are already in feedItems via getFeed; viatorItems adds extras
    // that have coords but might not have appeared in the feed threshold check.
    const viatorIds = new Set(feedItems.map(e => e.id));
    const extraViator = viatorItems.filter(e => !viatorIds.has(e.id));
    return [...feedItems, ...extraViator];
  }, [feedItems, viatorItems]);

  const visible = useMemo(() => allItems.filter(e => {
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    if (e.lat == null || e.lng == null) return false;
    if (range && e.date) return e.date >= range[0] && e.date <= range[1];
    return true;
  }), [allItems, catFilter, srcFilters, range]);

  const listItems = useMemo(() => allItems.filter(e => {
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    if (range && e.date) return e.date >= range[0] && e.date <= range[1];
    return true;
  }), [allItems, catFilter, srcFilters, range]);

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

        {/* Filter chips */}
        <View style={styles.filtersWrap}>
          {/* Date chip */}
          <View style={[styles.chip, {
            backgroundColor: dateActive ? T.text : "transparent",
            borderColor: dateActive ? T.text : T.gold,
            paddingHorizontal: 0, paddingVertical: 0,
          }]}>
            <TouchableOpacity
              onPress={() => { setDateOpen(o => !o); setSelected(null); }}
              style={{ paddingHorizontal: 14, paddingVertical: 6 }}
            >
              <Text style={[styles.chipText, { color: dateActive ? T.goldBri : T.gold }]}>📅 {dateLabel}</Text>
            </TouchableOpacity>
            {dateActive && (
              <TouchableOpacity onPress={clearDate} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} style={{ paddingRight: 12, paddingVertical: 6 }}>
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

          {/* Category chips */}
          {FILTERS.map(f => {
            const on = activeFilter === f.id;
            return (
              <TouchableOpacity key={f.id}
                onPress={() => { setActiveFilter(f.id); setSelected(null); setDateOpen(false); }}
                style={[styles.chip, { backgroundColor: on ? T.text : "transparent", borderColor: on ? T.text : T.borderSub }]}>
                <Text style={[styles.chipText, { color: on ? T.goldBri : T.muted }]}>{f.icon} {f.label}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Draw button */}
          <TouchableOpacity
            onPress={() => { setDrawMode(m => !m); setDrawPoints([]); setDrawClosed(false); setDateOpen(false); }}
            style={[styles.chip, { backgroundColor: drawMode ? T.text : "transparent", borderColor: drawMode ? T.gold : T.borderSub }]}>
            <Text style={[styles.chipText, { color: drawMode ? T.goldBri : T.gold }]}>✏️ Draw</Text>
          </TouchableOpacity>
        </View>

        {/* Radius chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
          contentContainerStyle={{ gap: 7, paddingBottom: 2 }}
        >
          {RADIUS_OPTIONS.map(opt => {
            const on = radiusMetres === opt.metres;
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => setRadiusMetres(opt.metres)}
                style={[styles.chip, {
                  backgroundColor: on ? T.text : "transparent",
                  borderColor: on ? T.text : T.borderSub,
                }]}
              >
                <Text style={[styles.chipText, { color: on ? T.goldBri : T.muted }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sources panel */}
        {sourcesOpen && (
          <View style={[styles.filtersWrap, { paddingTop: 2, paddingBottom: 6 }]}>
            {activeSources.size > 0 && (
              <TouchableOpacity onPress={() => setActiveSources(new Set())} style={[styles.chip, { backgroundColor: T.red + "18", borderColor: T.red }]}>
                <Text style={[styles.chipText, { color: T.red }]}>× Clear</Text>
              </TouchableOpacity>
            )}
            {SOURCE_FILTERS.map(f => {
              const on = activeSources.has(f.id);
              return (
                <TouchableOpacity key={f.id} onPress={() => toggleSource(f.id)}
                  style={[styles.chip, { backgroundColor: on ? T.text : "transparent", borderColor: on ? T.text : T.borderSub }]}>
                  <Text style={[styles.chipText, { color: on ? T.goldBri : T.muted }]}>{f.icon} {f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Date picker dropdown */}
        {dateOpen && (
          <View style={[styles.dateDropdown, { backgroundColor: T.bg, borderColor: T.border, shadowColor: T.border }]}>
            <View style={styles.presetsRow}>
              {QUICK_PRESETS.map(p => {
                const on = datePreset === p;
                return (
                  <TouchableOpacity key={p} onPress={() => { setDatePreset(p); setDateOpen(false); }}
                    style={[styles.presetChip, { backgroundColor: on ? T.text : T.bgCardHi, borderColor: on ? T.text : T.borderSub }]}>
                    <Text style={[styles.presetText, { color: on ? T.goldBri : T.textSub }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.dateDivider, { backgroundColor: T.borderSub }]} />
            <Text style={[styles.customLabel, { color: T.muted }]}>CUSTOM RANGE</Text>
            <View style={styles.customRow}>
              <TextInput value={customFrom} onChangeText={setCustomFrom} placeholder="YYYY-MM-DD" placeholderTextColor={T.mutedL} style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customFrom ? T.text : T.borderSub }]} />
              <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
              <TextInput value={customTo} onChangeText={setCustomTo} placeholder="YYYY-MM-DD" placeholderTextColor={T.mutedL} style={[styles.dateInput, { backgroundColor: T.bgCardHi, color: T.text, borderColor: customTo ? T.text : T.borderSub }]} />
            </View>
            {customFrom && customTo && (
              <TouchableOpacity onPress={() => { setDatePreset("Custom"); setDateOpen(false); }} style={[styles.applyBtn, { backgroundColor: T.text, borderColor: T.text }]}>
                <Text style={[styles.applyText, { color: T.goldBri }]}>Apply date range</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

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
                    {selected.booking.label} ↗
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
  safe:            { flex: 1 } as ViewStyle,
  header:          { borderBottomWidth: 2, padding: 14 } as ViewStyle,
  filtersWrap:     { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center", marginTop: 10, paddingBottom: 4 } as ViewStyle,
  chip:            { borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center" } as ViewStyle,
  chipText:        { fontSize: 12, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  chipDivider:     { width: 2, height: 22, borderRadius: 2 } as ViewStyle,
  badge:           { borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 } as ViewStyle,
  badgeText:       { fontSize: 10, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  dateDropdown:    { borderWidth: 2, borderRadius: 14, padding: 14, marginTop: 10, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as ViewStyle,
  presetsRow:      { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 } as ViewStyle,
  presetChip:      { borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 } as ViewStyle,
  presetText:      { fontSize: 12, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  dateDivider:     { height: 1.5, marginBottom: 12 } as ViewStyle,
  customLabel:     { fontSize: 10, fontWeight: "700", letterSpacing: 1, fontFamily: "DMSans_700Bold", marginBottom: 8 } as TextStyle,
  customRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 } as ViewStyle,
  dateInput:       { flex: 1, borderWidth: 2, borderRadius: 10, fontSize: 12, padding: 8, fontFamily: "DMSans_400Regular" } as TextStyle,
  toLabel:         { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  applyBtn:        { borderWidth: 2, borderRadius: 10, padding: 10, alignItems: "center" } as ViewStyle,
  applyText:       { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  mapWrap:         { margin: 12, borderRadius: 16, borderWidth: 2, overflow: "hidden", shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4, height: 320 } as ViewStyle,
  map:             { flex: 1 } as ViewStyle,
  pin:             { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 } as ViewStyle,
  drawBar:         { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, borderWidth: 2, borderRadius: 14, padding: 10, marginBottom: 4 } as ViewStyle,
  drawHint:        { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  drawBtn:         { borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  callout:         { margin: 12, borderWidth: 2, borderRadius: 16, padding: 14, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 } as ViewStyle,
  calloutTitle:    { fontSize: 16, fontWeight: "800", fontFamily: "PlayfairDisplay_800ExtraBold", marginBottom: 4 } as TextStyle,
  calloutRating:   { fontSize: 13, fontFamily: "DMSans_600SemiBold", marginBottom: 4 } as TextStyle,
  calloutSub:      { fontSize: 12, fontFamily: "DMSans_400Regular", marginBottom: 10 } as TextStyle,
  calloutActions:  { flexDirection: "row", gap: 8, alignItems: "center" } as ViewStyle,
  calloutClose:    { borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 } as ViewStyle,
  calloutCTA:      { flex: 1, borderWidth: 2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" } as ViewStyle,
  calloutCTAText:  { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  listRow:         { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 12, padding: 10, marginBottom: 8, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 } as ViewStyle,
  listIcon:        { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  listTitle:       { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  listSub:         { fontSize: 11, fontFamily: "DMSans_400Regular" } as TextStyle,
  empty:           { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 } as ViewStyle,
  emptyIcon:       { fontSize: 36, marginBottom: 12 } as TextStyle,
  emptyTitle:      { fontSize: 16, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:        { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center" } as TextStyle,
});
