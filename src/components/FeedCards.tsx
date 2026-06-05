// src/components/FeedCards.tsx
// v2 Mix feed card components: TicketCard, ListRow, SectionHeader + shared helpers.
// Also exports: ctaFor (source-to-CTA helper), SourceBadge, ActionCTA.

import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, Linking, Platform, Modal, Pressable,
  Image, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Theme } from "../theme";
import type { EventItem } from "../data/mockEvents";

// ── Source-aware CTA map ──────────────────────────────────────────────────────
export type CTAInfo = {
  action: string;
  brand:  string;
  color:  string;
  emoji:  string;
};

const CTA_BY_SOURCE: Record<string, CTAInfo> = {
  "r/nashville":       { action: "View",        brand: "REDDIT",       color: "#FF4500", emoji: "👽" },
  "Reddit":            { action: "View",        brand: "REDDIT",       color: "#FF4500", emoji: "👽" },
  "Nashville Scene":   { action: "Read",        brand: "SCENE",        color: "#E0392A", emoji: "📰" },
  "The Tennessean":    { action: "Read",        brand: "TENNESSEAN",   color: "#1F4D8A", emoji: "📰" },
  "Eventbrite":        { action: "Get Tickets", brand: "EVENTBRITE",   color: "#F05537", emoji: "🎉" },
  "Ticketmaster":      { action: "Buy Tickets", brand: "TICKETMASTER", color: "#026CDF", emoji: "🎫" },
  "Songkick":          { action: "Get Tickets", brand: "SONGKICK",     color: "#F80046", emoji: "🎫" },
  "Meetup":            { action: "RSVP",        brand: "MEETUP",       color: "#ED1C40", emoji: "👥" },
  "Viator":            { action: "Book",        brand: "VIATOR",       color: "#1A8270", emoji: "🗺"  },
  "BluebirdCafe.com":  { action: "RSVP",        brand: "BLUEBIRD",     color: "#3D9BE9", emoji: "🎫" },
  "WMOT.org":          { action: "Details",     brand: "WMOT",         color: "#0F4A78", emoji: "📻" },
  "Google Places":     { action: "Open",        brand: "GOOGLE",       color: "#4285F4", emoji: "📍" },
  "Food Places":       { action: "Open",        brand: "GOOGLE",       color: "#4285F4", emoji: "📍" },
  "Showtimes":         { action: "Buy Tickets", brand: "AMC",          color: "#CC0000", emoji: "🎬" },
  "AMC Theatres":      { action: "Buy Tickets", brand: "AMC",          color: "#CC0000", emoji: "🎬" },
};

/** Returns the source's brand name, action verb, color, and emoji. */
export function ctaFor(source: string | undefined): CTAInfo {
  if (!source) return { action: "View", brand: "SOURCE", color: "#3a3633", emoji: "🔗" };
  // Reddit subreddits (r/*)
  if (source.startsWith("r/")) return CTA_BY_SOURCE["Reddit"]!;
  return CTA_BY_SOURCE[source] ?? { action: "View", brand: source.toUpperCase(), color: "#3a3633", emoji: "🔗" };
}

// ── SourceBadge ───────────────────────────────────────────────────────────────
/** Small monospace brand pill — JetBrains Mono on web, Inter Bold on native. */
export function SourceBadge({ cta }: { cta: CTAInfo }) {
  return (
    <View style={[
      sbStyles.pill,
      { backgroundColor: cta.color + "10", borderColor: cta.color + "55" },
    ]}>
      <Text style={[sbStyles.text, { color: cta.color }]}>{cta.brand}</Text>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 } as ViewStyle,
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    ...Platform.select({
      web:     { fontFamily: "JetBrains Mono, ui-monospace, monospace" },
      default: { fontFamily: "Inter_700Bold" },
    }),
  } as TextStyle,
});

// ── ActionCTA ─────────────────────────────────────────────────────────────────
/** Gold-on-ink pill with just the verb. No arrow, no brand name. */
export function ActionCTA({
  cta,
  T,
  compact = false,
}: {
  cta: CTAInfo;
  T: Theme;
  compact?: boolean;
}) {
  return (
    <View style={[
      ctaStyles.btn,
      { height: compact ? 30 : 36, paddingHorizontal: compact ? 12 : 14,
        borderRadius: compact ? 999 : 12, backgroundColor: T.text },
    ]}>
      <Text style={[ctaStyles.label, { color: T.goldBri, fontSize: compact ? 12 : 13 }]}>
        {cta.action}
      </Text>
    </View>
  );
}

const ctaStyles = StyleSheet.create({
  btn:   { alignItems: "center", justifyContent: "center" } as ViewStyle,
  label: { fontWeight: "700", fontFamily: "Inter_700Bold" } as TextStyle,
});

// ── SectionHeader ─────────────────────────────────────────────────────────────
/**
 * Playfair Display section label, optional subtitle below, optional "See all →"
 * aligned to the right. Used for all three feed blocks.
 */
export function SectionHeader({
  label, sub, count, onSeeAll, T,
}: {
  label: string;
  sub?: string;
  count?: string;
  onSeeAll?: () => void;
  T: Theme;
}) {
  return (
    <View style={[shStyles.wrap, { paddingHorizontal: 18 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[shStyles.label, { color: T.text }]} numberOfLines={1}>{label}</Text>
        {sub && <Text style={[shStyles.sub, { color: T.muted }]}>{sub}</Text>}
      </View>
      {count != null && (
        <Text style={[shStyles.count, { color: T.muted }]} numberOfLines={1}>{count}</Text>
      )}
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Text style={[shStyles.seeAll, { color: T.goldBri }]}>See all →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const shStyles = StyleSheet.create({
  wrap:   { flexDirection: "row", alignItems: "baseline", gap: 10, paddingTop: 18, paddingBottom: 11 } as ViewStyle,
  label:  { fontFamily: "Inter_700Bold", fontSize: 19, letterSpacing: -0.2, flexShrink: 0, whiteSpace: "nowrap" as any } as TextStyle,
  sub:    { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2 } as TextStyle,
  count:  { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", flexShrink: 0 } as TextStyle,
  seeAll: { fontSize: 12.5, fontWeight: "600", fontFamily: "Inter_700Bold", flexShrink: 0 } as TextStyle,
  line:   { flex: 1, height: 1, minWidth: 8 } as ViewStyle,
});

// ── Calendar helpers (shared with EventCard) ──────────────────────────────────
const toGCal = (iso: string) => iso.replace(/[-:]/g, "");

const buildGoogleUrl = (item: EventItem) =>
  `https://calendar.google.com/calendar/render?action=TEMPLATE` +
  `&text=${encodeURIComponent(item.title)}` +
  `&dates=${toGCal(item.startIso!)}/${toGCal(item.endIso!)}` +
  `&details=${encodeURIComponent(item.desc)}` +
  `&location=${encodeURIComponent(item.location)}`;

const buildICS = (item: EventItem): string => {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hearby//EN",
    "BEGIN:VEVENT",
    `UID:hearby-${item.id}@hearby.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toGCal(item.startIso!)}`,
    `DTEND:${toGCal(item.endIso!)}`,
    `SUMMARY:${item.title}`,
    `DESCRIPTION:${item.desc.replace(/\n/g, "\\n")}`,
    `LOCATION:${item.location}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
};

// ── CalendarModal ─────────────────────────────────────────────────────────────
function CalendarModal({ item, onClose, T }: { item: EventItem; onClose: () => void; T: Theme }) {
  const [added, setAdded] = useState<"google" | "ical" | null>(null);

  const handleGoogle = () => {
    if (item.startIso && item.endIso) Linking.openURL(buildGoogleUrl(item));
    setAdded("google");
    setTimeout(onClose, 1200);
  };

  const handleICalWeb = () => {
    if (!item.startIso || !item.endIso) return;
    const ics = buildICS(item);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = item.title.replace(/\s+/g, "-") + ".ics";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setAdded("ical");
    setTimeout(onClose, 1200);
  };

  const handleICal = async () => {
    if (!item.startIso || !item.endIso) return;
    const ics = buildICS(item);
    const filename = item.title.replace(/\s+/g, "-") + ".ics";
    const path = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(path, ics, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: "text/calendar", dialogTitle: "Add to Calendar" });
    setAdded("ical");
    setTimeout(onClose, 1200);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={calStyles.overlay} onPress={onClose}>
        <Pressable style={[calStyles.sheet, { backgroundColor: T.bg, borderColor: T.border }]}>
          <View style={[calStyles.handle, { backgroundColor: T.borderSub }]} />
          <Text style={[calStyles.sheetLabel, { color: T.muted }]}>ADD TO CALENDAR</Text>
          <Text style={[calStyles.sheetTitle, { color: T.text }]}>{item.title}</Text>
          <Text style={[calStyles.sheetMeta, { color: T.muted }]}>🕐 {item.time}  ·  📍 {item.location}</Text>
          <View style={[calStyles.divider, { backgroundColor: T.borderSub }]} />
          <View style={{ gap: 10, marginTop: 14 }}>
            <TouchableOpacity onPress={handleGoogle} activeOpacity={0.8}
              style={[calStyles.option, { backgroundColor: added === "google" ? T.green + "15" : T.bgCardHi, borderColor: added === "google" ? T.green : T.border }]}>
              <Text style={[calStyles.optionTitle, { color: added === "google" ? T.green : T.text }]}>
                {added === "google" ? "✓ Opening Google Calendar…" : "Google Calendar"}
              </Text>
              <Text style={[calStyles.optionSub, { color: T.muted }]}>Opens in browser — tap Save</Text>
            </TouchableOpacity>
            {Platform.OS === "web" ? (
              <TouchableOpacity onPress={handleICalWeb} activeOpacity={0.8}
                style={[calStyles.option, { backgroundColor: added === "ical" ? T.green + "15" : T.bgCardHi, borderColor: added === "ical" ? T.green : T.border }]}>
                <Text style={[calStyles.optionTitle, { color: added === "ical" ? T.green : T.text }]}>
                  {added === "ical" ? "✓ Downloaded!" : "Apple Calendar (iCal)"}
                </Text>
                <Text style={[calStyles.optionSub, { color: T.muted }]}>Downloads .ics file</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleICal} activeOpacity={0.8}
                style={[calStyles.option, { backgroundColor: T.bgCardHi, borderColor: T.border }]}>
                <Text style={[calStyles.optionTitle, { color: T.text }]}>Apple Calendar (iCal)</Text>
                <Text style={[calStyles.optionSub, { color: T.muted }]}>Share .ics file</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose}
            style={[calStyles.cancel, { borderColor: T.borderSub }]}>
            <Text style={[calStyles.cancelText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" } as ViewStyle,
  sheet:       { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 2, borderBottomWidth: 0, padding: 20, paddingBottom: 32 } as ViewStyle,
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 } as ViewStyle,
  sheetLabel:  { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Inter_700Bold", marginBottom: 4 } as TextStyle,
  sheetTitle:  { fontSize: 16, fontWeight: "800", fontFamily: "Inter_700Bold", lineHeight: 22, marginBottom: 4 } as TextStyle,
  sheetMeta:   { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 14 } as TextStyle,
  divider:     { height: 1.5 } as ViewStyle,
  option:      { borderWidth: 2, borderRadius: 14, padding: 14 } as ViewStyle,
  optionTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 2 } as TextStyle,
  optionSub:   { fontSize: 12, fontFamily: "Inter_400Regular" } as TextStyle,
  cancel:      { borderWidth: 2, borderRadius: 14, padding: 12, alignItems: "center", marginTop: 14 } as ViewStyle,
  cancelText:  { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" } as TextStyle,
});

// ── Day stub helpers ──────────────────────────────────────────────────────────
function getDayStub(item: EventItem): { label: string; num: string } {
  if (!item.date) return { label: "·", num: "·" };
  const [yr, mo, dy] = item.date.split("-").map(Number);
  const itemDate = new Date(yr, mo - 1, dy);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  if (itemDate.toDateString() === today.toDateString())    return { label: "TODAY", num: String(dy) };
  if (itemDate.toDateString() === tomorrow.toDateString()) return { label: "TMRW",  num: String(dy) };

  const names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return { label: names[itemDate.getDay()], num: String(dy) };
}

// ── TicketCard ────────────────────────────────────────────────────────────────
/**
 * Ticket-stub style card for events with a date/time/venue.
 * Left stub: tone color + day + number + emoji.
 * Perforation column with punch-out circles.
 * Footer: SourceBadge · saves · calBtn · ActionCTA.
 */
export function TicketCard({
  item, T, saved, onSave,
}: {
  item: EventItem;
  T: Theme;
  saved: boolean;
  onSave: () => void;
}) {
  const [calOpen,  setCalOpen]  = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [item.id]);

  const tone = item.catColor || T.red;
  const cta  = ctaFor(item.source);
  const { label: dayLabel, num: dayNum } = getDayStub(item);

  return (
    <>
      {/* Outer: position:relative so punch-out circles can overflow */}
      <View style={[tcStyles.outer, { marginBottom: 10 }]}>
        {/* Punch-out circles — drawn BEFORE the card so they sit below it visually */}
        <View style={[tcStyles.circle, { top: -6, left: 68, backgroundColor: T.bg }]} />
        <View style={[tcStyles.circle, { bottom: -6, left: 68, backgroundColor: T.bg }]} />

        {/* Card */}
        <View style={[tcStyles.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
          {/* Hero image — spans full card width above the stub row */}
          {item.imageUrl && !imgError && (
            <View style={tcStyles.imageWrap}>
              <Image
                source={{ uri: item.imageUrl }}
                style={tcStyles.heroImage as any}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
              <View style={[tcStyles.imageAccent, { backgroundColor: tone }]} />
            </View>
          )}

          {/* Stub row */}
          <View style={tcStyles.stubRow}>
          {/* Stub */}
          <View style={[tcStyles.stub, { backgroundColor: tone }]}>
            <Text style={[tcStyles.stubDayLabel, { fontSize: dayLabel.length > 4 ? 9 : 11 }]}>
              {dayLabel}
            </Text>
            <Text style={tcStyles.stubDayNum}>{dayNum}</Text>
            <Text style={tcStyles.stubEmoji}>{item.img}</Text>
          </View>

          {/* Perforation column */}
          <View style={tcStyles.perf}>
            <View style={[tcStyles.perfLine, { borderColor: T.border }]} />
          </View>

          {/* Content */}
          <View style={tcStyles.content}>
            {/* Category eyebrow */}
            <Text style={[tcStyles.cat, { color: tone }]}>{item.category.toUpperCase()}</Text>

            {/* Title + save */}
            <View style={tcStyles.titleRow}>
              <Text style={[tcStyles.title, { color: T.text }]} numberOfLines={2}>{item.title}</Text>
              <TouchableOpacity onPress={onSave} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={{ fontSize: 16, color: saved ? tone : T.muted }}>
                  {saved ? "♥" : "♡"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Meta: time · venue */}
            <View style={tcStyles.metaRow}>
              <Text style={[tcStyles.metaTime, { color: T.text }]}>🕐 {item.time}</Text>
              <Text style={[tcStyles.metaDot, { color: T.muted }]}>·</Text>
              <Text style={[tcStyles.metaLoc, { color: T.muted }]} numberOfLines={1}>📍 {item.location}</Text>
            </View>

            {/* Footer: badge · saves · cal · CTA */}
            <View style={tcStyles.footer}>
              <View style={tcStyles.footerLeft}>
                <SourceBadge cta={cta} />
                <Text style={[tcStyles.saves, { color: T.muted }]}>{item.saves} saves</Text>
              </View>
              <View style={tcStyles.footerRight}>
                <TouchableOpacity
                  onPress={() => setCalOpen(true)}
                  style={[tcStyles.calBtn, { backgroundColor: T.bgCardHi, borderColor: T.borderSub }]}
                  accessibilityLabel="Add to calendar"
                >
                  <Text style={{ fontSize: 12 }}>📅</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { const url = item.booking?.url ?? item.sourceUrl; if (url) Linking.openURL(url); }}
                  activeOpacity={0.85}
                >
                  <ActionCTA cta={cta} T={T} compact />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </View>{/* end stubRow */}
        </View>
      </View>

      {calOpen && <CalendarModal item={item} onClose={() => setCalOpen(false)} T={T} />}
    </>
  );
}

const tcStyles = StyleSheet.create({
  outer:       { position: "relative" } as ViewStyle,
  circle:      { position: "absolute", width: 14, height: 12, borderRadius: 6, zIndex: 10 } as ViewStyle,
  card:        { flexDirection: "column", alignItems: "stretch", borderRadius: 14, borderWidth: 1, overflow: "hidden" } as ViewStyle,
  // Hero image — sits above the stub row when imageUrl is present
  imageWrap:   { width: "100%", height: 130, overflow: "hidden", position: "relative" } as ViewStyle,
  heroImage:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: 130 } as any,
  imageAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 } as ViewStyle,
  // Stub row — existing horizontal layout unchanged
  stubRow:     { flexDirection: "row", alignItems: "stretch" } as ViewStyle,
  stub:        { width: 68, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", gap: 4 } as ViewStyle,
  stubDayLabel:{ fontFamily: "Inter_600SemiBold_Italic", letterSpacing: 1.4, color: "#fff" } as TextStyle,
  stubDayNum:  { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff", letterSpacing: -0.5, lineHeight: 30 } as TextStyle,
  stubEmoji:   { fontSize: 16, lineHeight: 18 } as TextStyle,
  perf:        { width: 14, alignItems: "center", paddingVertical: 6 } as ViewStyle,
  perfLine:    { flex: 1, borderLeftWidth: 1, borderStyle: "dashed" } as ViewStyle,
  content:     { flex: 1, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 4, minWidth: 0 } as ViewStyle,
  cat:         { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 4 } as TextStyle,
  titleRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 } as ViewStyle,
  title:       { flex: 1, fontSize: 14.5, fontWeight: "600", fontFamily: "Inter_600SemiBold", lineHeight: 20 } as TextStyle,
  metaRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 } as ViewStyle,
  metaTime:    { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" } as TextStyle,
  metaDot:     { fontSize: 12 } as TextStyle,
  metaLoc:     { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 } as TextStyle,
  footer:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  footerLeft:  { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 } as ViewStyle,
  footerRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 } as ViewStyle,
  saves:       { fontSize: 11, fontFamily: "Inter_400Regular" } as TextStyle,
  calBtn:      { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
});

// ── WideImageCard ─────────────────────────────────────────────────────────────
/**
 * 248px-wide horizontal-carousel card. Photo banner on top (130px), solid
 * surface below: category eyebrow · 2-line title · time · source badge + CTA.
 * Text lives on the solid surface — never overlaid on the photo (per spec §11).
 */
export function WideImageCard({
  item, T, saved, onSave,
}: {
  item: EventItem;
  T: Theme;
  saved: boolean;
  onSave: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [item.id]);

  const tone = item.catColor || T.red;
  const cta  = ctaFor(item.source);
  const { label: dayLabel, num: dayNum } = getDayStub(item);

  return (
    <View style={[wcStyles.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      {/* Photo banner — Foursquare uses a category pictogram (icon) rendered
          centered on a tint; real photo sources use a full-bleed cover image. */}
      <View style={wcStyles.banner}>
        {item.imageUrl && !imgError ? (
          item.source === "Foursquare" ? (
            <View style={[wcStyles.bannerPlaceholder, { backgroundColor: tone + "22" }]}>
              <Image
                source={{ uri: item.imageUrl }}
                style={wcStyles.iconImg as any}
                resizeMode="contain"
                onError={() => setImgError(true)}
              />
            </View>
          ) : (
            <Image
              source={{ uri: item.imageUrl }}
              style={wcStyles.bannerImg as any}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          )
        ) : (
          <View style={[wcStyles.bannerPlaceholder, { backgroundColor: tone + "55" }]}>
            <Text style={wcStyles.bannerPlaceholderEmoji}>{item.img}</Text>
          </View>
        )}
        {/* Day badge — top-left */}
        <View style={[wcStyles.dayBadge, { backgroundColor: tone }]}>
          <Text style={wcStyles.dayBadgeLabel}>{dayLabel}</Text>
          <Text style={wcStyles.dayBadgeNum}>{dayNum}</Text>
        </View>
        {/* Heart — top-right */}
        <TouchableOpacity
          onPress={onSave}
          style={wcStyles.heartBtn}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={{ fontSize: 14, color: saved ? tone : "#111" }}>
            {saved ? "♥" : "♡"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Text surface — below image */}
      <View style={wcStyles.body}>
        <Text style={[wcStyles.cat, { color: tone }]}>{item.category.toUpperCase()}</Text>
        <Text style={[wcStyles.title, { color: T.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[wcStyles.meta, { color: T.muted }]} numberOfLines={1}>
          🕐 {item.time}
        </Text>
        <View style={wcStyles.footer}>
          <SourceBadge cta={cta} />
          <TouchableOpacity
            onPress={() => { const url = item.booking?.url ?? item.sourceUrl; if (url) Linking.openURL(url); }}
            style={[wcStyles.cta, { backgroundColor: T.text }]}
          >
            <Text style={[wcStyles.ctaText, { color: T.goldBri }]}>{cta.action}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const wcStyles = StyleSheet.create({
  card:                 { width: 248, borderRadius: 16, borderWidth: 1, overflow: "hidden", flexShrink: 0 } as ViewStyle,
  banner:               { width: 248, height: 130, position: "relative", backgroundColor: "#DDD" } as ViewStyle,
  bannerImg:            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: 248, height: 130 } as any,
  bannerPlaceholder:    { flex: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  bannerPlaceholderEmoji: { fontSize: 40 } as TextStyle,
  iconImg:              { width: 64, height: 64 } as any,
  dayBadge:             { position: "absolute", top: 8, left: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" } as ViewStyle,
  dayBadgeLabel:        { fontFamily: "Inter_600SemiBold_Italic", fontSize: 8, letterSpacing: 1, color: "#fff" } as TextStyle,
  dayBadgeNum:          { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff", lineHeight: 18 } as TextStyle,
  heartBtn:             { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" } as ViewStyle,
  body:                 { padding: 11 } as ViewStyle,
  cat:                  { fontSize: 9.5, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 4 } as TextStyle,
  title:                { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", lineHeight: 19, marginBottom: 6 } as TextStyle,
  meta:                 { fontSize: 11.5, fontFamily: "Inter_400Regular", marginBottom: 10 } as TextStyle,
  footer:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  cta:                  { height: 30, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center" } as ViewStyle,
  ctaText:              { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" } as TextStyle,
});

// ── ListRow ───────────────────────────────────────────────────────────────────
/**
 * Magazine-style row for community posts and news articles.
 * Left day column (54px): tone-colored label + date + emoji.
 * Footer: SourceBadge + spacer + calBtn + ActionCTA.
 * Bottom hairline between rows; omitted on the last row.
 */
export function ListRow({
  item, T, saved, onSave, isLast = false,
}: {
  item: EventItem;
  T: Theme;
  saved: boolean;
  onSave: () => void;
  isLast?: boolean;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const tone = item.catColor || T.red;
  const cta  = ctaFor(item.source);
  const { label: dayLabel, num: dayNum } = getDayStub(item);

  return (
    <>
      <View style={[lrStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: T.border }]}>
        {/* Day column */}
        <View style={lrStyles.dayCol}>
          <Text style={[lrStyles.dayLabel, { color: tone }]}>{dayLabel}</Text>
          <Text style={[lrStyles.dayNum, { color: T.text }]}>{dayNum}</Text>
          <Text style={lrStyles.dayEmoji}>{item.img}</Text>
        </View>

        {/* Content */}
        <View style={lrStyles.content}>
          {/* Title + save */}
          <View style={lrStyles.titleRow}>
            <Text style={[lrStyles.title, { color: T.text }]} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity onPress={onSave} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={{ fontSize: 15, color: saved ? tone : T.muted }}>{saved ? "♥" : "♡"}</Text>
            </TouchableOpacity>
          </View>

          {/* Meta: location · saves */}
          <View style={lrStyles.metaRow}>
            <Text style={[lrStyles.meta, { color: T.muted }]} numberOfLines={1}>
              📍 {item.location}
            </Text>
            <Text style={[lrStyles.meta, { color: T.muted }]}>·</Text>
            <Text style={[lrStyles.meta, { color: T.muted }]}>{item.saves} saves</Text>
          </View>

          {/* Action row: badge · spacer · cal · CTA */}
          <View style={lrStyles.actionRow}>
            <SourceBadge cta={cta} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => setCalOpen(true)}
              style={[lrStyles.calBtn, { backgroundColor: T.bgCardHi, borderColor: T.borderSub }]}
              accessibilityLabel="Add to calendar"
            >
              <Text style={{ fontSize: 11 }}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { const url = item.booking?.url ?? item.sourceUrl; if (url) Linking.openURL(url); }}
              activeOpacity={0.85}
            >
              <ActionCTA cta={cta} T={T} compact />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {calOpen && <CalendarModal item={item} onClose={() => setCalOpen(false)} T={T} />}
    </>
  );
}

const lrStyles = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14 } as ViewStyle,
  dayCol:   { width: 54, alignItems: "center", gap: 3, flexShrink: 0 } as ViewStyle,
  dayLabel: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 1.6 } as TextStyle,
  dayNum:   { fontSize: 12.5, fontWeight: "500", fontFamily: "Inter_500Medium", lineHeight: 15 } as TextStyle,
  dayEmoji: { fontSize: 14, lineHeight: 16, marginTop: 2 } as TextStyle,
  content:  { flex: 1, minWidth: 0, gap: 5 } as ViewStyle,
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } as ViewStyle,
  title:    { flex: 1, fontSize: 14.5, fontWeight: "600", fontFamily: "Inter_600SemiBold", lineHeight: 20 } as TextStyle,
  metaRow:  { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  meta:     { fontSize: 11.5, fontFamily: "Inter_400Regular" } as TextStyle,
  actionRow:{ flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  calBtn:   { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
});
