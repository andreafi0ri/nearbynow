// app/(tabs)/map.web.tsx — web-only: Mapbox GL JS map
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, Pressable, ScrollView, Switch, Linking,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/hooks/useTheme";
import { useSavedEvents } from "../../src/hooks/useSavedEvents";
import { useSavedAreas } from "../../src/context/SavedAreasContext";
import { EventItem } from "../../src/data/mockEvents";
import { EventCard } from "../../src/components/EventCard";
import { BottomSheet } from "../../src/components/BottomSheet";
import { getFeed } from "../../src/services/feedService";
import { fetchNearbyPlaces } from "../../src/services/recommendationsService";
import { FILTERS, SOURCE_FILTERS, FilterOption } from "../../src/config/filterConfig";
import { LocationInput } from "../../src/components/LocationInput";
import { Wordmark } from "../../src/components/Wordmark";
import { searchLocations } from "../../src/services/locationService";
import type { LocationSuggestion } from "../../src/services/locationService";

import { SEARCH_CONFIG } from "../../src/config/searchConfig";

const MAPBOX_KEY    = process.env.EXPO_PUBLIC_MAPBOX_KEY ?? "";
const DEFAULT_CENTER: [number, number] = [SEARCH_CONFIG.DEFAULT_LNG, SEARCH_CONFIG.DEFAULT_LAT];

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

/** Teardrop-shaped marker per design spec §10.
 *  Unselected: white fill + colored stroke. Selected: solid color fill, enlarged.
 *  transform-origin is bottom-center so the pin tip stays anchored to the coord.
 */
function markerHTML(emoji: string, color: string, sel: boolean): string {
  const fill   = sel ? color : "rgba(255,255,255,0.96)";
  const stroke = color;
  const sw     = sel ? 0 : 2.5;
  const scale  = sel ? 1.28 : 1;
  const emojiFontSize = sel ? 16 : 14;
  return `<div style="
    cursor:pointer;
    transform:scale(${scale}) translateY(0);
    transform-origin:bottom center;
    transition:transform .16s cubic-bezier(.3,1.3,.5,1);
    filter:drop-shadow(0 4px 6px rgba(0,0,0,${sel ? 0.45 : 0.22}));
    position:relative;width:38px;height:46px;">
    <svg width="38" height="46" viewBox="0 0 38 46" style="position:absolute;top:0;left:0;">
      <path d="M19 1 C9 1 1 9 1 19 C1 31 19 45 19 45 C19 45 37 31 37 19 C37 9 29 1 19 1 Z"
        fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
    </svg>
    <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);
      font-size:${emojiFontSize}px;line-height:1;">${emoji}</div>
  </div>`;
}

function radiusForZoom(zoom: number): number {
  if (zoom >= 16) return 500;
  if (zoom >= 14) return 1500;
  if (zoom >= 12) return 4000;
  if (zoom >= 10) return 10_000;
  return 20_000;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { theme: T, isDark } = useTheme();
  const scheme = isDark ? "dark" : "light";
  const { saved, toggle } = useSavedEvents();
  const { activeArea, addArea } = useSavedAreas();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef          = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const moveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAreaRef   = useRef(activeArea);
  const drawModeRef     = useRef(false);

  const [mapboxLoaded, setMapboxLoaded] = useState(!!(window as any).mapboxgl);
  const [feedPosts, setFeedPosts] = useState<EventItem[]>([]);
  const [recItems, setRecItems]   = useState<EventItem[]>([]);
  // feedItems = feed result + dynamic map-move recs; all categories (Nightlife, Activities,
  // Outdoors) are already inside feedPosts via feedService's always-on fetches.
  const feedItems = useMemo(() => {
    const base    = [...feedPosts, ...recItems];
    const baseIds = new Set(base.map(e => e.id));
    return [...base, ...recItems.filter(e => !baseIds.has(e.id))];
  }, [feedPosts, recItems]);
  // listFeedItems is frozen to the getFeed result so the list matches the feed screen
  const [listFeedItems, setListFeedItems] = useState<EventItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [searchVal, setSearchVal]       = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [freeOnly, setFreeOnly]         = useState(false);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [dateSheetOpen,    setDateSheetOpen]    = useState(false);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [sourcesSheetOpen, setSourcesSheetOpen] = useState(false);
  const [selected, setSelected]         = useState<EventItem | null>(null);
  const [drawMode, setDrawMode]         = useState(false);
  const [drawPoints, setDrawPoints]     = useState<[number, number][]>([]);
  const [drawClosed, setDrawClosed]     = useState(false);
  const [datePreset, setDatePreset]     = useState<string | null>(null);
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");

  // ── Date range ──────────────────────────────────────────────────────────────
  const range = useMemo((): [string, string] | null => {
    const t = fmt(TODAY), tom = fmt(addDays(TODAY, 1));
    const day    = TODAY.getDay();
    const satOff = (6 - day + 7) % 7 || 7;
    const sat = fmt(addDays(TODAY, satOff)), sun = fmt(addDays(TODAY, satOff + 1));
    const endWeek  = fmt(addDays(TODAY, (7 - day) % 7 || 7));
    const monthEnd = fmt(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0));
    if (datePreset === "Today")        return [t, t];
    if (datePreset === "Tomorrow")     return [tom, tom];
    if (datePreset === "This Weekend") return [sat, sun];
    if (datePreset === "This Week")    return [t, endWeek];
    if (datePreset === "This Month")   return [fmt(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)), monthEnd];
    if (datePreset === "Custom" && customFrom && customTo) return [customFrom, customTo];
    return null;
  }, [datePreset, customFrom, customTo]);

  const dateLabel  = datePreset === "Custom" && customFrom && customTo
    ? `${customFrom.slice(5)} – ${customTo.slice(5)}` : datePreset ?? "Anytime";
  const dateActive = !!datePreset;
  const noAreaData = !loading && feedItems.length === 0;
  const clearDate  = () => { setDatePreset(null); setCustomFrom(""); setCustomTo(""); setDateSheetOpen(false); };
  const filterCount = (activeFilter !== "All" ? 1 : 0) + (freeOnly ? 1 : 0);
  const filterLabel = filterCount > 0 ? String(filterCount) : "All";
  const freeFn = FILTERS.find(f => f.id === "Free")?.matchFn;

  // Mirror feed's FILTER_ONLY_SOURCE_MAP
  const FILTER_ONLY_SOURCE_MAP: Record<string, string> = {
    "Food Places":      "Food & Drink",
    "Showtimes":        "Cinema",
    "AMC Theatres":     "AMC",
    "Nightlife Places": "Nightlife",
    "Outdoor Places":   "Outdoors",
    "Wellness Places":  "wellness",
    "Activity Places":  "activities",
  };

  // ── Filtered views ──────────────────────────────────────────────────────────
  const catFilter  = useMemo(() => FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0], [activeFilter]);
  const srcFilters = useMemo<FilterOption[]>(() =>
    activeSources.size === 0 ? [] : SOURCE_FILTERS.filter(f => activeSources.has(f.id)),
  [activeSources]);

  const toggleSource = (id: string) => setActiveSources(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const visible = useMemo(() => feedItems.filter(e => {
    if (freeOnly && freeFn && !freeFn(e)) return false;
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    if (e.lat == null || e.lng == null) return false;
    if (range && e.date) return e.date >= range[0] && e.date <= range[1];
    return true;
  }), [feedItems, catFilter, srcFilters, range, freeOnly]);

  // listItems filters the frozen getFeed result for the sidebar list.
  // All categories (Nightlife, Activities, Outdoors) are already in listFeedItems.
  const listItems = useMemo(() => listFeedItems.filter(e => {
    if (freeOnly && freeFn && !freeFn(e)) return false;
    const requiredCat = FILTER_ONLY_SOURCE_MAP[e.source];
    if (requiredCat && activeFilter !== requiredCat) return false;
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    if (range) {
      if (e.type === "recommendation") return true;
      if (!e.date) return false;
      return e.date >= range[0] && e.date <= range[1];
    }
    return true;
  }), [listFeedItems, catFilter, srcFilters, range, freeOnly, activeFilter, FILTER_ONLY_SOURCE_MAP]);

  // ── Load Mapbox GL JS from CDN ───────────────────────────────────────────────
  useEffect(() => {
    if ((window as any).mapboxgl) { setMapboxLoaded(true); return; }
    if (document.getElementById("mapbox-gl-css")) return;

    const css = document.createElement("link");
    css.id = "mapbox-gl-css"; css.rel = "stylesheet";
    css.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = () => setMapboxLoaded(true);
    document.head.appendChild(script);
  }, []);

  // ── Initialise map once SDK is ready ────────────────────────────────────────
  useEffect(() => {
    if (!mapboxLoaded || !mapContainerRef.current || mapRef.current) return;
    const mapboxgl = (window as any).mapboxgl;
    mapboxgl.accessToken = MAPBOX_KEY;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: scheme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: 13,
    });

    mapRef.current = map;

    // Fly to stored coords on first load; geocode area name if no coords stored
    Promise.all([
      AsyncStorage.getItem("hearby_lat"),
      AsyncStorage.getItem("hearby_lng"),
      AsyncStorage.getItem("hearby_coords_area"),
    ]).then(async ([lat, lng, coordsArea]) => {
      if (lat && lng && coordsArea === activeAreaRef.current) {
        mapRef.current?.flyTo({ center: [parseFloat(lng), parseFloat(lat)], zoom: 13, duration: 800 });
      } else if (activeAreaRef.current) {
        try {
          const suggestions = await searchLocations(activeAreaRef.current);
          if (suggestions.length > 0 && mapRef.current) {
            const { lat: gLat, lng: gLng } = suggestions[0];
            mapRef.current.flyTo({ center: [gLng, gLat], zoom: 13, duration: 800 });
            await AsyncStorage.setItem("hearby_lat", String(gLat));
            await AsyncStorage.setItem("hearby_lng", String(gLng));
            await AsyncStorage.setItem("hearby_coords_area", activeAreaRef.current);
          }
        } catch { /* leave map at DEFAULT_CENTER */ }
      }
    });

    // Dynamic recommendations on map move
    map.on("moveend", () => {
      if (!mapRef.current) return;
      const c = mapRef.current.getCenter();
      const z = mapRef.current.getZoom();
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        fetchNearbyPlaces(c.lat, c.lng, activeAreaRef.current ?? "", radiusForZoom(z))
          .then(setRecItems).catch(() => {});
      }, 800);
    });

    // Draw: click adds a point, close polygon if near first point
    map.on("click", (e: any) => {
      if (!drawModeRef.current) return;
      const lng = e.lngLat.lng, lat = e.lngLat.lat;
      setDrawPoints(prev => {
        if (prev.length >= 3) {
          const [fLng, fLat] = prev[0];
          if (Math.abs(lat - fLat) < 0.0008 && Math.abs(lng - fLng) < 0.0008) {
            setDrawClosed(true); return prev;
          }
        }
        setDrawClosed(false);
        return [...prev, [lng, lat] as [number, number]];
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [mapboxLoaded]);

  // ── Switch light/dark style ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(scheme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11");
  }, [scheme]);

  // Keep refs in sync
  useEffect(() => { activeAreaRef.current = activeArea; }, [activeArea]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  // ── Load feed when area changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeArea) return;
    setSearchVal(activeArea);
    setListFeedItems([]);
    setFeedPosts([]);          // clear stale events from previous area immediately
    setRecItems([]);
    setLoading(true);
    Promise.all([
      AsyncStorage.getItem("hearby_lat"),
      AsyncStorage.getItem("hearby_lng"),
      AsyncStorage.getItem("hearby_coords_area"),
    ])
      .then(async ([latStr, lngStr, coordsArea]) => {
        let coords: { lat: number; lng: number } | undefined;
        if (latStr && lngStr && coordsArea === activeArea) {
          coords = { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
        } else {
          // Geocode area name — covers areas added via feed tab switch
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
        if (coords && mapRef.current) {
          mapRef.current.flyTo({ center: [coords.lng, coords.lat], zoom: 13, duration: 800 });
        }
        return getFeed(activeArea, coords);
      })
      .then(result => {
        setListFeedItems(result.items);
        setFeedPosts(result.items.filter(i => i.type === "event"));
        setRecItems(result.items.filter(i => i.type === "recommendation"));
      })
      .catch(() => { setFeedPosts([]); setRecItems([]); })
      .finally(() => setLoading(false));
  }, [activeArea]);

  // ── Draw overlay ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    let data: any;
    if (drawPoints.length < 2) {
      data = { type: "FeatureCollection", features: [] };
    } else if (drawClosed && drawPoints.length >= 3) {
      data = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...drawPoints, drawPoints[0]]] } };
    } else {
      data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: drawPoints } };
    }

    const addLayers = () => {
      if (!map.getSource("draw")) {
        map.addSource("draw", { type: "geojson", data });
        map.addLayer({ id: "draw-fill", type: "fill", source: "draw",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": T.gold, "fill-opacity": 0.2 } });
        map.addLayer({ id: "draw-outline", type: "line", source: "draw",
          paint: { "line-color": T.gold, "line-width": 2.5, "line-dasharray": [3, 2] } });
      } else {
        (map.getSource("draw") as any).setData(data);
      }
    };

    if (map.isStyleLoaded()) addLayers();
    else map.once("style.load", addLayers);
  }, [drawPoints, drawClosed]);

  // ── Update markers ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapboxLoaded) return;
    const mapboxgl = (window as any).mapboxgl;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    visible.forEach(item => {
      const el = document.createElement("div");
      el.innerHTML = markerHTML(item.img, item.catColor, selected?.id === item.id);
      el.onclick = () => setSelected(prev => prev?.id === item.id ? null : item);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([item.lng!, item.lat!])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [visible, selected, mapboxLoaded]);

  // ── Area selection ───────────────────────────────────────────────────────────
  const handleAreaSelect = async (s: LocationSuggestion) => {
    await AsyncStorage.setItem("hearby_lat", String(s.lat));
    await AsyncStorage.setItem("hearby_lng", String(s.lng));
    await AsyncStorage.setItem("hearby_coords_area", s.shortName);
    await addArea(s.shortName);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [s.lng, s.lat], zoom: 13, duration: 800 });
    }
  };

  const clearDraw = () => { setDrawPoints([]); setDrawClosed(false); };

  // ── Render ───────────────────────────────────────────────────────────────────
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
            onPress={() => { setDrawMode(m => !m); clearDraw(); }}
            activeOpacity={0.8}
            style={[styles.drawPill, { backgroundColor: drawMode ? T.text : T.surface, borderColor: drawMode ? T.gold : T.border }]}
          >
            <Text style={{ fontSize: 15 }}>✏️</Text>
            {drawMode && <Text style={[styles.pillLabel, { color: T.goldBri, letterSpacing: 0.5 }]}>ON</Text>}
          </TouchableOpacity>
        </View>
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
          {React.createElement("input", { type: "date", value: customFrom,
            onChange: (e: any) => setCustomFrom(e.target.value),
            style: { flex: 1, border: `2px solid ${customFrom ? T.text : T.borderSub}`, borderRadius: 10, fontSize: 12, padding: 8, backgroundColor: T.bgCardHi, color: T.text, outline: "none", fontFamily: "Inter" } })}
          <Text style={[styles.toLabel, { color: T.muted }]}>to</Text>
          {React.createElement("input", { type: "date", value: customTo,
            onChange: (e: any) => setCustomTo(e.target.value),
            style: { flex: 1, border: `2px solid ${customTo ? T.text : T.borderSub}`, borderRadius: 10, fontSize: 12, padding: 8, backgroundColor: T.bgCardHi, color: T.text, outline: "none", fontFamily: "Inter" } })}
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

      {/* ── Full-bleed map ──────────────────────────────────────────────────── */}
      <View style={styles.mapFull}>
        {!mapboxLoaded && (
          <View style={styles.mapLoading}>
            <Text style={{ color: T.muted, fontFamily: "Inter_400Regular" }}>Loading map…</Text>
          </View>
        )}
        {React.createElement("div", {
          ref: mapContainerRef,
          style: { width: "100%", height: "100%", display: mapboxLoaded ? "block" : "none" },
          onClick: () => setSelected(null),
        })}
      </View>

      {/* ── Draw controls (floating bar above preview) ─────────────────────── */}
      {drawMode && (
        <View style={[styles.drawBar, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          {drawPoints.length === 0 ? (
            <Text style={[styles.drawHint, { color: T.muted }]}>Click the map to start drawing your area</Text>
          ) : !drawClosed ? (
            <>
              <Text style={[styles.drawHint, { color: T.muted, flex: 1 }]}>
                {drawPoints.length} pt{drawPoints.length !== 1 ? "s" : ""}
                {drawPoints.length >= 3 ? " — close to finish" : ""}
              </Text>
              <TouchableOpacity onPress={() => setDrawPoints(p => p.slice(0, -1))} style={[styles.drawBtn, { borderColor: T.borderSub }]}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: T.muted, fontFamily: "Inter_700Bold" }}>Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearDraw} style={[styles.drawBtn, { borderColor: T.red }]}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: T.red, fontFamily: "Inter_700Bold" }}>Clear</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.drawHint, { color: T.goldDim, flex: 1, fontWeight: "700" }]}>✦ Area selected</Text>
              <TouchableOpacity onPress={clearDraw} style={[styles.drawBtn, { borderColor: T.borderSub }]}>
                <Text style={{ fontSize: 11, color: T.muted, fontFamily: "Inter_700Bold" }}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDrawMode(false)} style={[styles.drawBtn, { borderColor: T.text, backgroundColor: T.text }]}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: T.goldBri, fontFamily: "Inter_700Bold" }}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ── FABs — slide up when preview card is visible ────────────────────── */}
      <View style={[styles.fabs, { bottom: selected ? 220 : 110 }]}>
        <TouchableOpacity
          onPress={() => { setDrawMode(m => !m); clearDraw(); }}
          style={[styles.fab, { backgroundColor: drawMode ? T.text : T.surface, borderColor: drawMode ? T.gold : T.border }]}
          accessibilityLabel="Draw area"
        >
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (mapRef.current) {
              const center = mapRef.current.getCenter();
              mapRef.current.flyTo({ center, zoom: mapRef.current.getZoom(), duration: 300 });
            }
          }}
          style={[styles.fab, { backgroundColor: T.surface, borderColor: T.border }]}
          accessibilityLabel="My location"
        >
          <Text style={{ fontSize: 16 }}>⊕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Floating preview card + dot pager ──────────────────────────────── */}
      {selected && (
        <View style={styles.previewWrap}>
          {/* Dot pager */}
          <View style={styles.pager}>
            <TouchableOpacity
              onPress={() => {
                const i = visible.findIndex(v => v.id === selected.id);
                if (i > 0) setSelected(visible[i - 1]);
              }}
              style={styles.pagerArrow}
              accessibilityLabel="Previous"
            >
              <Text style={{ color: T.text, fontSize: 18, opacity: 0.7 }}>‹</Text>
            </TouchableOpacity>
            <View style={styles.dots}>
              {visible.slice(0, 9).map((v, i) => {
                const idx = visible.findIndex(x => x.id === selected.id);
                return (
                  <View
                    key={v.id}
                    style={[
                      styles.dot,
                      {
                        width: i === idx ? 16 : 6,
                        backgroundColor: i === idx ? T.gold : (isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.22)"),
                      },
                    ]}
                  />
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => {
                const i = visible.findIndex(v => v.id === selected.id);
                if (i < visible.length - 1) setSelected(visible[i + 1]);
              }}
              style={styles.pagerArrow}
              accessibilityLabel="Next"
            >
              <Text style={{ color: T.text, fontSize: 18, opacity: 0.7 }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Preview card */}
          <View style={[styles.previewCard, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <View style={[styles.previewAccent, { backgroundColor: selected.catColor }]} />
            <View style={styles.previewBody}>
              <View style={[styles.previewIconWrap, { backgroundColor: selected.catColor + "1A", borderColor: selected.catColor + "33" }]}>
                <Text style={{ fontSize: 22 }}>{selected.img}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.previewCat, { color: selected.catColor }]}>{selected.category.toUpperCase()}</Text>
                <Text style={[styles.previewTitle, { color: T.text }]} numberOfLines={1}>{selected.title}</Text>
                <Text style={[styles.previewMeta, { color: T.muted }]} numberOfLines={1}>🕐 {selected.time} · 📍 {selected.location}</Text>
              </View>
            </View>
            <View style={styles.previewFooter}>
              <Text style={[styles.previewSource, { borderColor: T.border }]}>{selected.source}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => toggle(selected.id)}
                style={[styles.previewSaveBtn, { backgroundColor: T.bgCardHi, borderColor: T.border }]}
                accessibilityLabel="Save"
              >
                <Text style={{ fontSize: 16, color: saved.has(selected.id) ? selected.catColor : T.muted }}>
                  {saved.has(selected.id) ? "♥" : "♡"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => selected.booking?.url && Linking.openURL(selected.booking.url)}
                style={[styles.previewViewBtn, { backgroundColor: T.text }]}
              >
                <Text style={[styles.previewViewText, { color: T.goldBri }]}>View details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, position: "relative" } as ViewStyle,
  header:        { borderBottomWidth: 0, padding: 14, zIndex: 10, elevation: 10, position: "relative" } as ViewStyle,
  // ── Full-bleed map ───────────────────────────────────────────────────────
  mapFull:       { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 } as ViewStyle,
  mapLoading:    { flex: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  // ── FABs ────────────────────────────────────────────────────────────────
  fabs:          { position: "absolute", right: 16, zIndex: 20, flexDirection: "column", gap: 10, transition: "bottom .25s" as any } as ViewStyle,
  fab:           { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 6 } as ViewStyle,
  // ── Floating preview card ────────────────────────────────────────────────
  previewWrap:   { position: "absolute", left: 16, right: 16, bottom: 104, zIndex: 20 } as ViewStyle,
  pager:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 9 } as ViewStyle,
  pagerArrow:    { padding: "0 6px" as any } as ViewStyle,
  dots:          { flexDirection: "row", gap: 5, alignItems: "center" } as ViewStyle,
  dot:           { height: 6, borderRadius: 3 } as ViewStyle,
  previewCard:   { borderRadius: 16, overflow: "hidden", borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 34, elevation: 12 } as ViewStyle,
  previewAccent: { height: 3 } as ViewStyle,
  previewBody:   { flexDirection: "row", alignItems: "center", gap: 12, padding: "13px 15px" as any } as ViewStyle,
  previewIconWrap: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  previewCat:    { fontSize: 9.5, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 1.6, textTransform: "uppercase" } as TextStyle,
  previewTitle:  { fontSize: 15, fontWeight: "600", fontFamily: "Inter_700Bold", lineHeight: 20, marginTop: 2 } as TextStyle,
  previewMeta:   { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 3 } as TextStyle,
  previewFooter: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 15, paddingBottom: 14 } as ViewStyle,
  previewSource: { fontSize: 9.5, fontWeight: "600", fontFamily: "Inter_700Bold", letterSpacing: 0.8, color: "#888", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 } as TextStyle,
  previewSaveBtn:{ width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  previewViewBtn:{ height: 38, paddingHorizontal: 16, borderRadius: 11, alignItems: "center", justifyContent: "center" } as ViewStyle,
  previewViewText:{ fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" } as TextStyle,
  // ── 3-pill bar ──────────────────────────────────────────────────────────
  pillBar:       { flexDirection: "row", gap: 8, marginTop: 10, paddingBottom: 10 } as ViewStyle,
  pill:          { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  pillLabel:     { fontSize: 9, fontWeight: "700", letterSpacing: 0.18, textTransform: "uppercase", fontFamily: "Inter_700Bold", lineHeight: 11 } as TextStyle,
  pillValue:     { flex: 1, fontSize: 13, fontWeight: "600", fontFamily: "Inter_700Bold", lineHeight: 16 } as TextStyle,
  pillChevron:   { fontSize: 9 } as TextStyle,
  drawPill:      { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 44 } as ViewStyle,
  // ── Sheet rows ───────────────────────────────────────────────────────────
  sheetRow:      { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 6 } as ViewStyle,
  sheetRowLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_700Bold" } as TextStyle,
  sheetRowSub:   { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 } as TextStyle,
  freeRow:       { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 4 } as ViewStyle,
  catGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  catCell:       { width: "30.5%", borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: "center", gap: 8, position: "relative" } as ViewStyle,
  catIcon:       { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  catLabel:      { fontSize: 13, fontWeight: "600", fontFamily: "Inter_700Bold", textAlign: "center" } as TextStyle,
  catCheck:      { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sheetActions:  { flexDirection: "row", gap: 10, marginTop: 20 } as ViewStyle,
  resetBtn:      { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  resetText:     { fontSize: 14, fontWeight: "600", fontFamily: "Inter_700Bold" } as TextStyle,
  showBtn:       { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" } as ViewStyle,
  showText:      { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" } as TextStyle,
  sourceRow:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 8 } as ViewStyle,
  sourceIcon:    { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkbox:      { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dateDivider:   { height: 1.5, marginBottom: 12 } as ViewStyle,
  customLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1, fontFamily: "Inter_700Bold", marginBottom: 8 } as TextStyle,
  customRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 } as ViewStyle,
  toLabel:       { fontSize: 12, fontFamily: "Inter_400Regular" } as TextStyle,
  applyBtn:      { borderRadius: 10, padding: 10, alignItems: "center" } as ViewStyle,
  applyText:     { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" } as TextStyle,
  // ── Map & list ──────────────────────────────────────────────────────────
  countBar:      { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 } as ViewStyle,
  countText:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "Inter_700Bold" } as TextStyle,
  mapWrap:       { margin: 12, borderRadius: 16, borderWidth: 2, overflow: "hidden", height: 360 } as ViewStyle,
  drawBar:       { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, borderWidth: 2, borderRadius: 14, padding: 10, marginBottom: 4 } as ViewStyle,
  drawHint:      { fontSize: 12, fontFamily: "Inter_400Regular" } as TextStyle,
  drawBtn:       { borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  listRow:       { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 12, padding: 10, marginBottom: 8 } as ViewStyle,
  listIcon:      { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  listTitle:     { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" } as TextStyle,
  listSub:       { fontSize: 11, fontFamily: "Inter_400Regular" } as TextStyle,
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" } as ViewStyle,
  sheet:         { maxHeight: "82%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 2, borderBottomWidth: 0, paddingHorizontal: 14, paddingTop: 10 } as ViewStyle,
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 } as ViewStyle,
  empty:         { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 } as ViewStyle,
  emptyIcon:     { fontSize: 36, marginBottom: 12 } as TextStyle,
  emptyTitle:    { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" } as TextStyle,
});
