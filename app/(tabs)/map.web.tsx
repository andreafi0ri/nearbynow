// app/(tabs)/map.web.tsx — web-only: Mapbox GL JS map
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, Pressable, ScrollView, Switch,
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

function markerHTML(emoji: string, color: string, sel: boolean): string {
  const s = sel ? 44 : 36;
  return `<div style="width:${s}px;height:${s}px;border-radius:${s/2}px;` +
    `background:${sel ? color : "#1a1a1a"};border:2.5px solid ${color};` +
    `display:flex;align-items:center;justify-content:center;` +
    `font-size:${sel ? 18 : 14}px;box-shadow:3px 3px 0 rgba(0,0,0,0.25);cursor:pointer;` +
    `transform:${sel ? "scale(1.2)" : "scale(1)"};transition:transform .15s;">${emoji}</div>`;
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
  const [feedPosts, setFeedPosts]       = useState<EventItem[]>([]);
  const [recItems, setRecItems]         = useState<EventItem[]>([]);
  // feedItems drives map markers (incl. dynamic recs as map pans)
  const feedItems = useMemo(() => [...feedPosts, ...recItems], [feedPosts, recItems]);
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

  const listItems = useMemo(() => listFeedItems.filter(e => {
    if (freeOnly && freeFn && !freeFn(e)) return false;
    if (!catFilter.matchFn(e)) return false;
    if (srcFilters.length > 0 && !srcFilters.some(f => f.matchFn(e))) return false;
    if (range && e.date) return e.date >= range[0] && e.date <= range[1];
    return true;
  }), [listFeedItems, catFilter, srcFilters, range, freeOnly]);

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

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Mapbox map container */}
        <View style={[styles.mapWrap, { borderColor: T.border, shadowColor: T.border }]}>
          {!mapboxLoaded && (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: T.muted, fontFamily: "DMSans_400Regular" }}>Loading map…</Text>
            </View>
          )}
          {React.createElement("div", {
            ref: mapContainerRef,
            style: { width: "100%", height: "100%", display: mapboxLoaded ? "block" : "none" },
          })}
        </View>

        {/* Draw controls */}
        {drawMode && (
          <View style={[styles.drawBar, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            {drawPoints.length === 0 ? (
              <Text style={[styles.drawHint, { color: T.muted }]}>Click the map to start drawing your area</Text>
            ) : !drawClosed ? (
              <>
                <Text style={[styles.drawHint, { color: T.muted, flex: 1 }]}>
                  {drawPoints.length} point{drawPoints.length !== 1 ? "s" : ""}
                  {drawPoints.length >= 3 ? " — click near first point to close" : ""}
                </Text>
                <TouchableOpacity onPress={() => setDrawPoints(p => p.slice(0, -1))} style={[styles.drawBtn, { borderColor: T.borderSub }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: T.muted, fontFamily: "DMSans_700Bold" }}>Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearDraw} style={[styles.drawBtn, { borderColor: T.red }]}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: T.red, fontFamily: "DMSans_700Bold" }}>Clear</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.drawHint, { color: T.goldDim, flex: 1, fontWeight: "700" }]}>✦ Area selected</Text>
                <TouchableOpacity onPress={clearDraw} style={[styles.drawBtn, { borderColor: T.borderSub }]}>
                  <Text style={{ fontSize: 12, color: T.muted, fontFamily: "DMSans_700Bold" }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDrawMode(false)} style={[styles.drawBtn, { borderColor: T.text, backgroundColor: T.text }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: T.goldBri, fontFamily: "DMSans_700Bold" }}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Events counter */}
        {!loading && listFeedItems.length > 0 && (
          <View style={[styles.countBar, { borderBottomColor: T.borderSub }]}>
            <Text style={[styles.countText, { color: T.muted }]}>
              {listItems.length} event{listItems.length !== 1 ? "s" : ""} found
            </Text>
          </View>
        )}

        {/* Event list */}
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
              <TouchableOpacity key={item.id} onPress={() => setSelected(item)}
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

      {/* Selected event sheet */}
      <Modal visible={selected !== null} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.overlay} onPress={() => setSelected(null)} />
        <View style={[styles.sheet, { backgroundColor: T.bg, borderColor: T.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: T.borderSub }]} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {selected && <EventCard item={selected} saved={saved.has(selected.id)} onSave={toggle} T={T} />}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 } as ViewStyle,
  header:        { borderBottomWidth: 2, padding: 14, zIndex: 10, elevation: 10 } as ViewStyle,
  // ── 3-pill bar ──────────────────────────────────────────────────────────
  pillBar:       { flexDirection: "row", gap: 8, marginTop: 10, paddingBottom: 10 } as ViewStyle,
  pill:          { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  pillLabel:     { fontSize: 9, fontWeight: "700", letterSpacing: 0.18, textTransform: "uppercase", fontFamily: "DMSans_700Bold", lineHeight: 11 } as TextStyle,
  pillValue:     { flex: 1, fontSize: 13, fontWeight: "600", fontFamily: "DMSans_700Bold", lineHeight: 16 } as TextStyle,
  pillChevron:   { fontSize: 9 } as TextStyle,
  drawPill:      { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 44 } as ViewStyle,
  // ── Sheet rows ───────────────────────────────────────────────────────────
  sheetRow:      { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 6 } as ViewStyle,
  sheetRowLabel: { fontSize: 15, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  sheetRowSub:   { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 } as TextStyle,
  freeRow:       { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 4 } as ViewStyle,
  catGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  catCell:       { width: "30.5%", borderWidth: 1.5, borderRadius: 14, padding: 12, alignItems: "center", gap: 8, position: "relative" } as ViewStyle,
  catIcon:       { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  catLabel:      { fontSize: 13, fontWeight: "600", fontFamily: "DMSans_700Bold", textAlign: "center" } as TextStyle,
  catCheck:      { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" } as ViewStyle,
  sheetActions:  { flexDirection: "row", gap: 10, marginTop: 20 } as ViewStyle,
  resetBtn:      { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  resetText:     { fontSize: 14, fontWeight: "600", fontFamily: "DMSans_700Bold" } as TextStyle,
  showBtn:       { flex: 2, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" } as ViewStyle,
  showText:      { fontSize: 14, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  sourceRow:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 8 } as ViewStyle,
  sourceIcon:    { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  checkbox:      { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  dateDivider:   { height: 1.5, marginBottom: 12 } as ViewStyle,
  customLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 1, fontFamily: "DMSans_700Bold", marginBottom: 8 } as TextStyle,
  customRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 } as ViewStyle,
  toLabel:       { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  applyBtn:      { borderRadius: 10, padding: 10, alignItems: "center" } as ViewStyle,
  applyText:     { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  // ── Map & list ──────────────────────────────────────────────────────────
  countBar:      { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 } as ViewStyle,
  countText:     { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "DMSans_700Bold" } as TextStyle,
  mapWrap:       { margin: 12, borderRadius: 16, borderWidth: 2, overflow: "hidden", height: 360 } as ViewStyle,
  drawBar:       { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, borderWidth: 2, borderRadius: 14, padding: 10, marginBottom: 4 } as ViewStyle,
  drawHint:      { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  drawBtn:       { borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  listRow:       { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 12, padding: 10, marginBottom: 8 } as ViewStyle,
  listIcon:      { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  listTitle:     { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  listSub:       { fontSize: 11, fontFamily: "DMSans_400Regular" } as TextStyle,
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" } as ViewStyle,
  sheet:         { maxHeight: "82%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 2, borderBottomWidth: 0, paddingHorizontal: 14, paddingTop: 10 } as ViewStyle,
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 } as ViewStyle,
  empty:         { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 } as ViewStyle,
  emptyIcon:     { fontSize: 36, marginBottom: 12 } as TextStyle,
  emptyTitle:    { fontSize: 16, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:      { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center" } as TextStyle,
});
