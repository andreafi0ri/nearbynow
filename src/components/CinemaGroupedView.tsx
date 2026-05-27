// src/components/CinemaGroupedView.tsx
// Grouped Cinema filter view — shows movies per AMC theatre with
// interactive showtime pills that deep-link to purchase pages.

import React from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ViewStyle, TextStyle, Linking,
} from "react-native";
import type { Theme } from "../theme";
import type { ShowtimeGroup } from "../services/showtimesService";

type Props = {
  groups: ShowtimeGroup[];
  T: Theme;
  /** When true, renders as a plain View instead of a ScrollView (for embedding in a parent scroll). */
  contained?: boolean;
};

export function CinemaGroupedView({ groups, T, contained = false }: Props) {
  // Group by theatre
  type TheatreSection = {
    theatre: ShowtimeGroup["theatre"];
    movies: ShowtimeGroup[];
  };
  const theatreMap = new Map<number, TheatreSection>();
  for (const group of groups) {
    const key = group.theatre.id;
    if (!theatreMap.has(key)) {
      theatreMap.set(key, { theatre: group.theatre, movies: [] });
    }
    theatreMap.get(key)!.movies.push(group);
  }
  const sections = [...theatreMap.values()];

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🎬</Text>
        <Text style={[styles.emptyTitle, { color: T.text }]}>No showtimes today</Text>
        <Text style={[styles.emptySub, { color: T.muted }]}>
          No AMC theatres found nearby, or no AMC API key configured.
        </Text>
      </View>
    );
  }

  const Wrapper = contained ? View : ScrollView;
  const wrapperProps = contained
    ? { style: styles.container }
    : { contentContainerStyle: [styles.container, { paddingBottom: 100 }], showsVerticalScrollIndicator: false };

  return (
    <Wrapper {...(wrapperProps as any)}>
      {sections.map(({ theatre, movies }) => (
        <View key={theatre.id} style={styles.theatreSection}>

          {/* ── Theatre header ────────────────────────────────────────── */}
          <View style={[styles.theatreHeader, {
            backgroundColor: T.bgCardHi,
            borderColor: T.border,
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }]}>
            <Text style={styles.theatreEmoji}>🎬</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.theatreName, { color: T.text }]}>
                {theatre.name}
              </Text>
              <Text style={[styles.theatreAddress, { color: T.muted }]}>
                {theatre.location.addressLine1}, {theatre.location.city}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(`https://www.amctheatres.com/movie-theatres/${theatre.slug}`)
              }
              style={[styles.theatreBtn, { borderColor: T.borderSub }]}
            >
              <Text style={[styles.theatreBtnText, { color: T.muted }]}>Info ↗</Text>
            </TouchableOpacity>
          </View>

          {/* ── Movies at this theatre ────────────────────────────────── */}
          {movies.map((group, idx) => {
            const isLast = idx === movies.length - 1;
            return (
              <View
                key={group.movie.id}
                style={[
                  styles.movieRow,
                  {
                    borderColor: T.border,
                    borderBottomLeftRadius: isLast ? 14 : 0,
                    borderBottomRightRadius: isLast ? 14 : 0,
                  },
                ]}
              >
                {/* Movie info */}
                <View style={styles.movieInfo}>
                  <Text style={[styles.movieTitle, { color: T.text }]}>
                    {group.movie.name}
                  </Text>
                  <Text style={[styles.movieMeta, { color: T.muted }]}>
                    {[
                      group.movie.mpaaRating,
                      group.movie.runTime
                        ? `${Math.floor(group.movie.runTime / 60)}h ${group.movie.runTime % 60}m`
                        : null,
                      group.movie.starRating
                        ? `★ ${group.movie.starRating.toFixed(1)}/5`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  {group.movie.synopsis ? (
                    <Text
                      style={[styles.movieSynopsis, { color: T.muted }]}
                      numberOfLines={2}
                    >
                      {group.movie.synopsis}
                    </Text>
                  ) : null}
                </View>

                {/* Showtime pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.pillsScroll}
                  contentContainerStyle={styles.pillsContent}
                >
                  {group.showtimes.map((showtime, i) => {
                    const isSoldOut = showtime.isSoldOut;
                    const isAlmost  = showtime.isAlmostSoldOut;
                    const displayTime = group.feedItem.showings?.[i] ??
                      new Date(showtime.showDateTimeLocal).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      });

                    return (
                      <TouchableOpacity
                        key={showtime.id}
                        onPress={() => {
                          const url = showtime.purchaseUrl || group.feedItem.booking?.url;
                          if (url) Linking.openURL(url);
                        }}
                        disabled={isSoldOut}
                        style={[
                          styles.pill,
                          {
                            borderColor: isSoldOut
                              ? T.borderSub
                              : isAlmost
                              ? T.red
                              : T.gold,
                            backgroundColor: isSoldOut
                              ? T.bgCardHi
                              : isAlmost
                              ? T.red + "15"
                              : T.goldLight,
                            opacity: isSoldOut ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            {
                              color: isSoldOut
                                ? T.muted
                                : isAlmost
                                ? T.red
                                : T.goldDim,
                            },
                          ]}
                        >
                          {isSoldOut ? `${displayTime} · SOLD OUT` : displayTime}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Get tickets button */}
                <TouchableOpacity
                  onPress={() => {
                    const url = group.feedItem.booking?.url;
                    if (url) Linking.openURL(url);
                  }}
                  style={[
                    styles.ticketBtn,
                    { backgroundColor: T.text, borderColor: T.text },
                  ]}
                >
                  <Text style={[styles.ticketBtnText, { color: T.goldBri }]}>
                    Get Tickets
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ))}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container:      { padding: 14 } as ViewStyle,
  // ── Empty state ─────────────────────────────────────────────────────────────
  empty:          { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 } as ViewStyle,
  emptyIcon:      { fontSize: 36, marginBottom: 12 } as TextStyle,
  emptyTitle:     { fontSize: 16, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 } as TextStyle,
  emptySub:       { fontSize: 13, fontFamily: "DMSans_400Regular", textAlign: "center" } as TextStyle,
  // ── Theatre section ─────────────────────────────────────────────────────────
  theatreSection: { marginBottom: 20 } as ViewStyle,
  theatreHeader:  {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 2, padding: 12, borderBottomWidth: 0,
  } as ViewStyle,
  theatreEmoji:   { fontSize: 20 } as TextStyle,
  theatreName:    { fontSize: 14, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
  theatreAddress: { fontSize: 12, fontFamily: "DMSans_400Regular", marginTop: 1 } as TextStyle,
  theatreBtn:     { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 } as ViewStyle,
  theatreBtnText: { fontSize: 11, fontFamily: "DMSans_600SemiBold" } as TextStyle,
  // ── Movie row ───────────────────────────────────────────────────────────────
  movieRow:       { borderWidth: 2, borderTopWidth: 0, padding: 14, gap: 10 } as ViewStyle,
  movieInfo:      { gap: 3 } as ViewStyle,
  movieTitle:     { fontSize: 15, fontWeight: "800", fontFamily: "PlayfairDisplay_800ExtraBold" } as TextStyle,
  movieMeta:      { fontSize: 12, fontFamily: "DMSans_400Regular" } as TextStyle,
  movieSynopsis:  { fontSize: 12, fontFamily: "DMSans_400Regular", lineHeight: 18, marginTop: 2 } as TextStyle,
  // ── Showtime pills ──────────────────────────────────────────────────────────
  pillsScroll:    { marginTop: 4 } as ViewStyle,
  pillsContent:   { flexDirection: "row", gap: 7 } as ViewStyle,
  pill:           { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle,
  pillText:       { fontSize: 12, fontWeight: "600", fontFamily: "DMSans_600SemiBold" } as TextStyle,
  // ── Ticket button ───────────────────────────────────────────────────────────
  ticketBtn:      { borderWidth: 2, borderRadius: 12, padding: 10, alignItems: "center", marginTop: 4 } as ViewStyle,
  ticketBtnText:  { fontSize: 13, fontWeight: "700", fontFamily: "DMSans_700Bold" } as TextStyle,
});
