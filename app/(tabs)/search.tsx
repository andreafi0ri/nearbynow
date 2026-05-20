// app/(tabs)/search.tsx — Saved + Search
import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, FlatList, Modal, Pressable, TextInput,
  StyleSheet, ViewStyle, TextStyle, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/hooks/useTheme";
import { useSavedEvents } from "../../src/hooks/useSavedEvents";
import { useSavedAreas } from "../../src/context/SavedAreasContext";
import { EventCard } from "../../src/components/EventCard";
import { EventItem } from "../../src/data/mockEvents";
import { getFeed } from "../../src/services/feedService";
import { Wordmark } from "../../src/components/Wordmark";

export default function SavedScreen() {
  const { theme: T } = useTheme();
  const { saved, toggle } = useSavedEvents();
  const { activeArea } = useSavedAreas();

  const [allItems, setAllItems] = useState<EventItem[]>([]);
  const [detailItem, setDetailItem] = useState<EventItem | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!activeArea) return;
    getFeed(activeArea)
      .then(result => setAllItems(result.items))
      .catch(() => setAllItems([]));
  }, [activeArea]);

  // Derive trending tags from all items
  const trendingTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const item of allItems) {
      const tokens = [
        item.category,
        item.source,
        ...(item.tags ?? []),
      ];
      for (const t of tokens) {
        if (t) freq[t] = (freq[t] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [allItems]);

  const q = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return [];
    return allItems.filter(item => {
      const hay = [
        item.title,
        item.desc,
        item.category,
        item.source,
        item.location,
        ...(item.tags ?? []),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, q]);

  const savedItems = useMemo(() =>
    allItems.filter(e => saved.has(e.id)),
  [allItems, saved]);

  const displayItems = searching && q ? searchResults : savedItems;
  const isSearchMode = searching && q.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bgSub }]} edges={["top"]}>
      <View style={[styles.headerWrap, { backgroundColor: T.bg, borderBottomColor: T.border }]}>
        <Wordmark T={T} />
        <View style={styles.header}>
        {!searching ? (
          <>
            <Text style={[styles.headerLabel, { color: T.mutedL }]}>SAVED</Text>
            {savedItems.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: T.text }]}>
                <Text style={[styles.countText, { color: T.goldBri }]}>{savedItems.length}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setSearching(true)}
              style={[styles.searchBtn, { borderColor: T.borderSub }]}
            >
              <Text style={{ color: T.muted, fontSize: 14 }}>🔍</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchRow}>
            <View style={[styles.searchInput, { backgroundColor: T.bgCard, borderColor: T.border }]}>
              <Text style={{ color: T.muted, fontSize: 13, marginRight: 6 }}>🔍</Text>
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search events, places, tags…"
                placeholderTextColor={T.mutedL}
                style={[styles.searchText, { color: T.text }]}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: T.muted, fontSize: 16 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => { setSearching(false); setQuery(""); }}
              style={styles.cancelBtn}
            >
              <Text style={[styles.cancelText, { color: T.gold }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>

      {/* Trending tags (shown in search mode when no query yet) */}
      {searching && !q && trendingTags.length > 0 && (
        <View style={[styles.trendingWrap, { backgroundColor: T.bg, borderBottomColor: T.border }]}>
          <Text style={[styles.trendingLabel, { color: T.mutedL }]}>TRENDING</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
            {trendingTags.map(tag => (
              <TouchableOpacity
                key={tag}
                onPress={() => setQuery(tag)}
                style={[styles.trendChip, { backgroundColor: T.bgCardHi, borderColor: T.borderSub }]}
              >
                <Text style={[styles.trendText, { color: T.textSub }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={displayItems}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={isSearchMode ? (
          <Text style={[styles.resultCount, { color: T.muted }]}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{query.trim()}"
          </Text>
        ) : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{isSearchMode ? "🔍" : "♡"}</Text>
            <Text style={[styles.emptyTitle, { color: T.text }]}>
              {isSearchMode ? "No results found" : "Nothing saved yet"}
            </Text>
            <Text style={[styles.emptySub, { color: T.muted }]}>
              {isSearchMode
                ? "Try a different keyword or browse the feed"
                : "Tap ♡ on any card in the feed to save it here"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          isSearchMode ? (
            <TouchableOpacity
              onPress={() => setDetailItem(item)}
              style={[styles.row, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border }]}
            >
              <View style={[styles.icon, { backgroundColor: item.catColor + "18", borderColor: item.catColor }]}>
                <Text style={{ fontSize: 20 }}>{item.img}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: T.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.rowMeta, { color: T.muted }]}>{item.time} · {item.source}</Text>
              </View>
              <TouchableOpacity
                onPress={() => toggle(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: saved.has(item.id) ? T.red : T.muted, fontSize: 18 }}>
                  {saved.has(item.id) ? "♥" : "♡"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setDetailItem(item)}
              style={[styles.row, { backgroundColor: T.bgCard, borderColor: T.border, shadowColor: T.border }]}
            >
              <View style={[styles.icon, { backgroundColor: item.catColor + "18", borderColor: item.catColor }]}>
                <Text style={{ fontSize: 20 }}>{item.img}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: T.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.rowMeta, { color: T.muted }]}>{item.time} · {item.source}</Text>
              </View>
              <TouchableOpacity
                onPress={() => toggle(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: T.red, fontSize: 18 }}>♥</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )
        )}
      />

      <Modal
        visible={detailItem !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailItem(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setDetailItem(null)} />
        <View style={[styles.sheet, { backgroundColor: T.bg, borderColor: T.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: T.borderSub }]} />
          <FlatList
            data={detailItem ? [detailItem] : []}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => (
              <EventCard item={item} saved={saved.has(item.id)} onSave={toggle} T={T} />
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 } as ViewStyle,
  headerWrap:   { borderBottomWidth: 2, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 0 } as ViewStyle,
  header:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 } as ViewStyle,
  headerLabel:  { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, fontFamily: "DMSans_700Bold" } as TextStyle,
  countBadge:   { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 } as ViewStyle,
  countText:    { fontSize: 11, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  searchBtn:    { marginLeft: "auto", borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle,
  searchRow:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  searchInput:  { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, gap: 4 } as ViewStyle,
  searchText:   { flex: 1, fontSize: 13, fontFamily: "DMSans_400Regular" } as TextStyle,
  cancelBtn:    { paddingHorizontal: 4 } as ViewStyle,
  cancelText:   { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  trendingWrap: { borderBottomWidth: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 } as ViewStyle,
  trendingLabel:{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, fontFamily: "DMSans_700Bold", marginBottom: 8 } as TextStyle,
  trendingRow:  { gap: 7, flexDirection: "row" } as ViewStyle,
  trendChip:    { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 } as ViewStyle,
  trendText:    { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  resultCount:  { fontSize: 12, fontFamily: "DMSans_400Regular", paddingBottom: 8 } as TextStyle,
  list:         { padding: 14, paddingBottom: 100 } as ViewStyle,
  row:          { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderRadius: 14, padding: 12, marginBottom: 10, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 } as ViewStyle,
  icon:         { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" } as ViewStyle,
  rowTitle:     { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold", marginBottom: 3 } as TextStyle,
  rowMeta:      { fontSize: 11, fontFamily: "DMSans_400Regular" } as TextStyle,
  empty:        { alignItems: "center", paddingTop: 100 } as ViewStyle,
  emptyIcon:    { fontSize: 40, marginBottom: 14 } as TextStyle,
  emptyTitle:   { fontSize: 16, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:     { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center", maxWidth: 240 } as TextStyle,
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" } as ViewStyle,
  sheet:        { maxHeight: "85%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 2, borderBottomWidth: 0, paddingHorizontal: 14, paddingTop: 10 } as ViewStyle,
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 } as ViewStyle,
});
