// src/components/EventCard.tsx
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, Linking, Modal, Pressable,
  Image, StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Theme } from "../theme";
import { EventItem, SOURCE_COLORS } from "../data/mockEvents";
import { SourcePill } from "./ui";

// ── Date formatter ─────────────────────────────────────────────
/** "2026-05-20" → "05/20/26". Avoids Date parsing to sidestep timezone shifts. */
function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  return `${month}/${day}/${year.slice(2)}`;
}

// ── Calendar helpers ───────────────────────────────────────────
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
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hearby//EN",
    "BEGIN:VEVENT",
    `UID:hearby-${item.id}@hearby.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toGCal(item.startIso!)}`,
    `DTEND:${toGCal(item.endIso!)}`,
    `SUMMARY:${item.title}`,
    `DESCRIPTION:${item.desc.replace(/\n/g, "\\n")}`,
    `LOCATION:${item.location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
};

// ── CalendarModal ──────────────────────────────────────────────
function CalendarModal({ item, onClose, T }: { item: EventItem; onClose: () => void; T: Theme }) {
  const [added, setAdded] = useState<"google" | "ical" | null>(null);

  const handleGoogle = () => {
    Linking.openURL(buildGoogleUrl(item));
    setAdded("google");
    setTimeout(onClose, 1200);
  };

  // Web: trigger a browser download of the .ics file
  const handleICalWeb = () => {
    const ics = buildICS(item);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.title.replace(/\s+/g, "-") + ".ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAdded("ical");
    setTimeout(onClose, 1200);
  };

  // Native: write to cache then open system share sheet
  const handleICal = async () => {
    const ics = buildICS(item);
    const filename = item.title.replace(/\s+/g, "-") + ".ics";
    const path = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(path, ics, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(path, {
      mimeType: "text/calendar",
      dialogTitle: "Add to Calendar",
    });
    setAdded("ical");
    setTimeout(onClose, 1200);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: T.bg, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.borderSub }]} />
          <Text style={[styles.sheetLabel, { color: T.muted }]}>ADD TO CALENDAR</Text>
          <Text style={[styles.sheetTitle, { color: T.text }]}>{item.title}</Text>
          <Text style={[styles.sheetMeta, { color: T.muted }]}>
            🕐 {item.time}  ·  📍 {item.location}
          </Text>
          <View style={[styles.sheetDivider, { backgroundColor: T.borderSub }]} />

          <TouchableOpacity onPress={handleGoogle} activeOpacity={0.8}
            style={[styles.calOption, { backgroundColor: added==="google" ? T.green+"15" : T.bgCardHi, borderColor: added==="google" ? T.green : T.border, shadowColor: added==="google" ? T.green : T.border }]}>
            <View style={styles.calIconWrap}><Text style={styles.calIcon}>📅</Text></View>
            <View>
              <Text style={[styles.calOptionTitle, { color: added==="google" ? T.green : T.text }]}>
                {added==="google" ? "✓ Opening Google Calendar…" : "Google Calendar"}
              </Text>
              <Text style={[styles.calOptionSub, { color: T.muted }]}>Opens in browser — tap Save</Text>
            </View>
          </TouchableOpacity>

          {/* iCal download — web only. Native uses expo-sharing (system share sheet). */}
          {Platform.OS === "web" && (
            <TouchableOpacity onPress={handleICalWeb} activeOpacity={0.8}
              style={[styles.calOption, { backgroundColor: added==="ical" ? T.green+"15" : T.bgCardHi, borderColor: added==="ical" ? T.green : T.border, shadowColor: added==="ical" ? T.green : T.border }]}>
              <View style={styles.calIconWrap}><Text style={styles.calIcon}>🍎</Text></View>
              <View>
                <Text style={[styles.calOptionTitle, { color: added==="ical" ? T.green : T.text }]}>
                  {added==="ical" ? "✓ Downloaded!" : "Apple Calendar (iCal)"}
                </Text>
                <Text style={[styles.calOptionSub, { color: T.muted }]}>Downloads .ics file</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: T.borderSub }]}>
            <Text style={[styles.cancelText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── EventCard ──────────────────────────────────────────────────
export function EventCard({
  item,
  saved,
  onSave,
  T,
}: {
  item: EventItem;
  saved: boolean;
  onSave: (id: number) => void;
  T: Theme;
}) {
  const isAff        = item.booking?.affiliate;
  const isCanceled   = item.isCanceled === true;
  const isMerged     = item.isMerged   === true;
  const sourceLinks  = item.sourceLinks ?? [];
  const showTimes    = item.showTimes && item.showTimes.length > 1 ? item.showTimes : null;
  const [calOpen,   setCalOpen]   = useState(false);
  const [imgError,  setImgError]  = useState(false);

  // Reset image error state when the card item changes
  useEffect(() => { setImgError(false); }, [item.id]);

  return (
    <View style={[
      styles.card,
      { backgroundColor: T.bgCard, borderColor: isAff ? T.gold : T.border, shadowColor: T.border },
      isCanceled && { opacity: 0.6 },
    ]}>
      {/* Hero image — shown when imageUrl is available and hasn't errored */}
      {item.imageUrl && !imgError ? (
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.heroImage as any}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          {/* Thin category-colour accent at top of image */}
          <View style={[styles.imageStripe, { backgroundColor: item.catColor }]} />
          {/* Dark fade at bottom for overlay legibility */}
          <View style={styles.imageFade} />
          {/* Category + NEARBY badge overlaid on image */}
          <View style={styles.imageOverlay}>
            <Text style={styles.emoji}>{item.img}</Text>
            <Text style={[styles.catLabel, { color: "#FFFFFF" }]}>{item.category}</Text>
            {item.type === "recommendation" && (
              <View style={styles.nearbyBadgeOnImage}>
                <Text style={styles.nearbyTextOnImage}>NEARBY</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.stripe, { backgroundColor: item.catColor }]} />
      )}

      <View style={styles.body}>

        {/* Header row — category label hidden when image overlay covers it; save button always shown */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {!(item.imageUrl && !imgError) && (
              <>
                <Text style={styles.emoji}>{item.img}</Text>
                <Text style={[styles.catLabel, { color: item.catDot }]}>{item.category}</Text>
                {item.type === "recommendation" && (
                  <View style={[styles.nearbyBadge, { backgroundColor: T.goldLight, borderColor: T.gold }]}>
                    <Text style={[styles.nearbyText, { color: T.goldDim }]}>NEARBY</Text>
                  </View>
                )}
              </>
            )}
          </View>
          <TouchableOpacity
            onPress={() => onSave(item.id)}
            style={[styles.saveBtn, { borderColor: saved ? T.red : T.borderSub, backgroundColor: saved ? T.red + "18" : "transparent" }]}
          >
            <Text style={{ color: saved ? T.red : T.muted, fontSize: 16 }}>{saved ? "♥" : "♡"}</Text>
          </TouchableOpacity>
        </View>

        {/* Cancelled banner */}
        {isCanceled && (
          <View style={[styles.cancelledBanner, { backgroundColor: T.red + "18", borderColor: T.red }]}>
            <Text style={[styles.cancelledText, { color: T.red }]}>⚠️ This event has been cancelled</Text>
          </View>
        )}

        <Text style={[styles.title, { color: T.text }]}>{item.title}</Text>

        {item.rating != null && (
          <View style={styles.ratingRow}>
            <Text style={[styles.stars, { color: T.gold }]}>{"★".repeat(Math.round(item.rating))}</Text>
            <Text style={[styles.ratingNum, { color: T.goldDim }]}>{item.rating}</Text>
            <Text style={[styles.reviewCount, { color: T.muted }]}>({item.reviews})</Text>
          </View>
        )}

        <Text style={[styles.desc, { color: T.textSub }]}>{item.desc}</Text>

        {item.showings && (
          <View style={styles.showingsRow}>
            {item.showings.map(t => (
              <View key={t} style={[styles.showingPill, { backgroundColor: T.purple + "15", borderColor: T.purple + "50" }]}>
                <Text style={[styles.showingText, { color: T.purple }]}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.meta, { borderTopColor: T.borderSub }]}>
          {showTimes ? (
            <View style={styles.metaRow}>
              <Text>🕐</Text>
              <View style={styles.showTimesWrap}>
                <Text style={[styles.showTimesLabel, { color: T.muted }]}>
                  SHOW TIMES · {formatDateShort(item.date)}
                </Text>
                <View style={styles.showTimesRow}>
                  {showTimes.map(t => (
                    <View key={t} style={[styles.showTimePill, { backgroundColor: T.purple + "15", borderColor: T.purple + "60" }]}>
                      <Text style={[styles.showTimeText, { color: T.purple }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Text>🕐</Text>
              <Text style={[styles.metaTime, { color: T.text }]}>{item.time}</Text>
              <Text style={[styles.metaDate, { color: T.muted }]}>· {formatDateShort(item.date)}</Text>
            </View>
          )}
          <View style={styles.metaRow}><Text>📍</Text><Text style={[styles.metaLoc, { color: T.muted }]}>{item.location}</Text></View>
        </View>

        {/* Multi-source links — shown when merged from 2+ platforms */}
        {isMerged && sourceLinks.length > 1 && (
          <View style={[styles.sourceLinksSection, { borderTopColor: T.borderSub }]}>
            <Text style={[styles.sourceLinksLabel, { color: T.muted }]}>Also on:</Text>
            <View style={styles.sourceLinksRow}>
              {sourceLinks.map(link => (
                <TouchableOpacity
                  key={link.platform}
                  onPress={() => Linking.openURL(link.url)}
                  style={[styles.sourceLink, { borderColor: T.border, backgroundColor: T.bgCardHi, shadowColor: T.border }]}
                >
                  <Text style={[styles.sourceLinkText, { color: T.text }]}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {isMerged && sourceLinks.length > 1 ? (
              <View style={[styles.mergedPill, { backgroundColor: T.goldLight, borderColor: T.gold }]}>
                <Text style={[styles.mergedPillText, { color: T.goldDim }]}>
                  {sourceLinks.length} sources
                </Text>
              </View>
            ) : (
              <SourcePill source={item.source} colors={SOURCE_COLORS} />
            )}
            <Text style={[styles.saves, { color: T.muted }]}>{item.saves} saves</Text>
          </View>
          <View style={styles.footerRight}>
            <TouchableOpacity
              onPress={() => setCalOpen(true)}
              style={[styles.calBtn, { borderColor: T.borderSub, backgroundColor: T.bgCardHi, shadowColor: T.borderSub }]}
            >
              <Text style={{ fontSize: 14 }}>📅</Text>
            </TouchableOpacity>

            {/* Cancelled: replace booking button with muted label */}
            {isCanceled ? (
              <View style={[styles.viewBtn, { borderColor: T.borderSub, shadowColor: "transparent" }]}>
                <Text style={[styles.viewBtnText, { color: T.muted }]}>Event cancelled</Text>
              </View>
            ) : item.booking ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.booking!.url)}
                activeOpacity={0.8}
                style={[styles.bookBtn, { backgroundColor: isAff ? T.text : "transparent", borderColor: T.text, shadowColor: isAff ? T.goldDim : "transparent" }]}
              >
                <Text style={[styles.bookBtnText, { color: isAff ? T.goldBri : T.text }]}>
                  {item.booking.label}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { const url = item.sourceUrl ?? sourceLinks[0]?.url; if (url) Linking.openURL(url); }}
                activeOpacity={0.8}
                style={[styles.viewBtn, { borderColor: T.borderSub, shadowColor: T.borderSub }]}
              >
                <Text style={[styles.viewBtnText, { color: T.text }]}>View →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {calOpen && <CalendarModal item={item} onClose={() => setCalOpen(false)} T={T} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card:          { borderRadius:16, borderWidth:2, marginBottom:14, overflow:"hidden", shadowOffset:{width:4,height:4}, shadowOpacity:1, shadowRadius:0, elevation:4 } as ViewStyle,
  stripe:        { height:4 } as ViewStyle,
  // ── Hero image ────────────────────────────────────────────────────────────
  imageWrap:     { width:"100%", height:160, position:"relative", overflow:"hidden" } as ViewStyle,
  heroImage:     { width:"100%", height:160 } as any,
  imageStripe:   { position:"absolute", top:0, left:0, right:0, height:3, zIndex:2 } as ViewStyle,
  imageFade:     { position:"absolute", bottom:0, left:0, right:0, height:70, backgroundColor:"rgba(0,0,0,0.42)", zIndex:1 } as ViewStyle,
  imageOverlay:  { position:"absolute", bottom:10, left:12, flexDirection:"row", alignItems:"center", gap:5, zIndex:3 } as ViewStyle,
  nearbyBadgeOnImage: { borderWidth:1, borderColor:"rgba(255,255,255,0.6)", borderRadius:10, paddingHorizontal:6, paddingVertical:1, backgroundColor:"rgba(255,255,255,0.15)" } as ViewStyle,
  nearbyTextOnImage:  { fontSize:9, fontWeight:"700", letterSpacing:1, textTransform:"uppercase", color:"#FFFFFF", fontFamily:"Inter_700Bold" } as TextStyle,
  body:          { padding:14 } as ViewStyle,
  headerRow:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:10 } as ViewStyle,
  headerLeft:    { flexDirection:"row", alignItems:"center", gap:6, flex:1, flexWrap:"wrap" } as ViewStyle,
  emoji:         { fontSize:12 } as TextStyle,
  catLabel:      { fontSize:10, fontWeight:"700", letterSpacing:1, textTransform:"uppercase", fontFamily:"Inter_700Bold" } as TextStyle,
  nearbyBadge:   { borderWidth:1, borderRadius:10, paddingHorizontal:6, paddingVertical:1 } as ViewStyle,
  nearbyText:    { fontSize:9, fontWeight:"700", letterSpacing:1, textTransform:"uppercase", fontFamily:"Inter_700Bold" } as TextStyle,
  saveBtn:       { borderWidth:1.5, borderRadius:20, paddingHorizontal:10, paddingVertical:4 } as ViewStyle,
  title:         { fontSize:17, fontWeight:"800", lineHeight:22, marginBottom:6, fontFamily:"Inter_700Bold" } as TextStyle,
  ratingRow:     { flexDirection:"row", alignItems:"center", gap:4, marginBottom:6 } as ViewStyle,
  stars:         { fontSize:12 } as TextStyle,
  ratingNum:     { fontSize:12, fontWeight:"700", fontFamily:"Inter_700Bold" } as TextStyle,
  reviewCount:   { fontSize:11, fontFamily:"Inter_400Regular" } as TextStyle,
  desc:          { fontSize:13, lineHeight:20, marginBottom:12, fontFamily:"Inter_400Regular" } as TextStyle,
  showingsRow:   { flexDirection:"row", flexWrap:"wrap", gap:6, marginBottom:12 } as ViewStyle,
  showingPill:   { borderWidth:1.5, borderRadius:20, paddingHorizontal:10, paddingVertical:3 } as ViewStyle,
  showingText:   { fontSize:12, fontWeight:"600", fontFamily:"Inter_600SemiBold" } as TextStyle,
  meta:          { borderTopWidth:1.5, paddingTop:10, marginBottom:12, gap:4 } as ViewStyle,
  metaRow:       { flexDirection:"row", alignItems:"flex-start", gap:8 } as ViewStyle,
  metaTime:      { fontSize:13, fontWeight:"600", fontFamily:"Inter_600SemiBold" } as TextStyle,
  metaDate:      { fontSize:12, fontFamily:"Inter_400Regular" } as TextStyle,
  metaLoc:       { fontSize:12, fontFamily:"Inter_400Regular", marginTop:2 } as TextStyle,
  showTimesWrap: { flex:1, gap:4 } as ViewStyle,
  showTimesLabel:{ fontSize:9, fontWeight:"700", letterSpacing:1.1, textTransform:"uppercase", fontFamily:"Inter_700Bold" } as TextStyle,
  showTimesRow:  { flexDirection:"row", flexWrap:"wrap", gap:5 } as ViewStyle,
  showTimePill:  { borderWidth:1.5, borderRadius:20, paddingHorizontal:9, paddingVertical:3 } as ViewStyle,
  showTimeText:  { fontSize:12, fontWeight:"600", fontFamily:"Inter_600SemiBold" } as TextStyle,
  footer:        { flexDirection:"row", justifyContent:"space-between", alignItems:"center" } as ViewStyle,
  saves:         { fontSize:11, fontFamily:"Inter_400Regular" } as TextStyle,
  footerLeft:    { flexDirection:"row", alignItems:"center", gap:6 } as ViewStyle,
  footerRight:   { flexDirection:"row", alignItems:"center", gap:7 } as ViewStyle,
  calBtn:        { borderWidth:2, borderRadius:20, paddingHorizontal:10, paddingVertical:6, shadowOffset:{width:2,height:2}, shadowOpacity:1, shadowRadius:0, elevation:2 } as ViewStyle,
  bookBtn:       { borderWidth:2, borderRadius:20, paddingHorizontal:14, paddingVertical:7, shadowOffset:{width:2,height:2}, shadowOpacity:1, shadowRadius:0, elevation:2 } as ViewStyle,
  bookBtnText:   { fontSize:12, fontWeight:"700", fontFamily:"Inter_700Bold" } as TextStyle,
  viewBtn:       { borderWidth:2, borderRadius:20, paddingHorizontal:14, paddingVertical:7, shadowOffset:{width:2,height:2}, shadowOpacity:1, shadowRadius:0, elevation:2 } as ViewStyle,
  viewBtnText:   { fontSize:12, fontWeight:"600", fontFamily:"Inter_600SemiBold" } as TextStyle,
  overlay:       { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end", alignItems:"center" } as ViewStyle,
  sheet:         { width:"100%", borderTopLeftRadius:20, borderTopRightRadius:20, borderWidth:2, borderBottomWidth:0, padding:20, paddingBottom:32 } as ViewStyle,
  handle:        { width:36, height:4, borderRadius:2, alignSelf:"center", marginBottom:18 } as ViewStyle,
  sheetLabel:    { fontSize:11, fontWeight:"700", letterSpacing:1.2, textTransform:"uppercase", fontFamily:"Inter_700Bold", marginBottom:4 } as TextStyle,
  sheetTitle:    { fontSize:16, fontWeight:"800", fontFamily:"Inter_700Bold", lineHeight:22, marginBottom:4 } as TextStyle,
  sheetMeta:     { fontSize:12, fontFamily:"Inter_400Regular", marginBottom:14 } as TextStyle,
  sheetDivider:  { height:1.5, marginBottom:14 } as ViewStyle,
  calOption:     { flexDirection:"row", alignItems:"center", gap:14, borderWidth:2, borderRadius:14, padding:13, marginBottom:10, shadowOffset:{width:2,height:2}, shadowOpacity:1, shadowRadius:0, elevation:2 } as ViewStyle,
  calIconWrap:   { width:36, height:36, borderRadius:10, backgroundColor:"#fff", borderWidth:1.5, borderColor:"#E0E0E8", alignItems:"center", justifyContent:"center" } as ViewStyle,
  calIcon:       { fontSize:20 } as TextStyle,
  calOptionTitle:{ fontSize:14, fontWeight:"700", fontFamily:"Inter_700Bold", marginBottom:2 } as TextStyle,
  calOptionSub:  { fontSize:12, fontFamily:"Inter_400Regular" } as TextStyle,
  cancelBtn:         { borderWidth:2, borderRadius:14, padding:12, alignItems:"center", marginTop:4 } as ViewStyle,
  cancelText:        { fontSize:13, fontWeight:"600", fontFamily:"Inter_600SemiBold" } as TextStyle,
  // Merged-source pill (footer — replaces SourcePill when isMerged)
  mergedPill:        { borderWidth:1.5, borderRadius:20, paddingHorizontal:8, paddingVertical:2 } as ViewStyle,
  mergedPillText:    { fontSize:10, fontWeight:"700", fontFamily:"Inter_700Bold", letterSpacing:0.5, textTransform:"uppercase" } as TextStyle,
  // Cancelled event banner
  cancelledBanner:   { borderWidth:1.5, borderRadius:8, padding:8, marginBottom:10, alignItems:"center" } as ViewStyle,
  cancelledText:     { fontSize:12, fontWeight:"700", fontFamily:"Inter_700Bold" } as TextStyle,
  // Multi-source link strip
  sourceLinksSection:{ borderTopWidth:1.5, paddingTop:10, marginBottom:12, gap:8 } as ViewStyle,
  sourceLinksLabel:  { fontSize:10, fontWeight:"700", letterSpacing:1, textTransform:"uppercase", fontFamily:"Inter_700Bold" } as TextStyle,
  sourceLinksRow:    { flexDirection:"row", flexWrap:"wrap", gap:6 } as ViewStyle,
  sourceLink:        { borderWidth:2, borderRadius:20, paddingHorizontal:12, paddingVertical:5, shadowOffset:{width:2,height:2}, shadowOpacity:1, shadowRadius:0, elevation:2 } as ViewStyle,
  sourceLinkText:    { fontSize:11, fontWeight:"700", fontFamily:"Inter_700Bold" } as TextStyle,
});
