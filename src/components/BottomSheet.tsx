import React, { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback,
  Animated, ScrollView, Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Theme } from "../theme";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  T: Theme;
  children: React.ReactNode;
  maxHeightRatio?: number; // 0–1, default 0.75
};

export function BottomSheet({ open, onClose, title, T, children, maxHeightRatio = 0.75 }: Props) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [open]);

  // Keyboard dismiss on web
  useEffect(() => {
    if (Platform.OS !== "web" || !open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const backdropOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if (!open) return null;

  return (
    <Modal transparent animationType="none" visible={open} onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          {
            backgroundColor: T.bg,
            borderColor: T.border,
            maxHeight: `${maxHeightRatio * 100}%` as any,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={s.handleWrap}>
          <View style={[s.handle, { backgroundColor: T.border }]} />
        </View>

        {/* Title row */}
        {title && (
          <View style={[s.titleRow, { borderBottomColor: T.borderSub }]}>
            <Text style={[s.title, { color: T.text, fontFamily: "Inter_700Bold" }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[s.closeBtn, { color: T.muted }]}>Close ✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,8,5,0.5)",
  } as ViewStyle,
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 0,
    overflow: "hidden",
  } as ViewStyle,
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  } as ViewStyle,
  handle: {
    width: 42, height: 4, borderRadius: 2,
  } as ViewStyle,
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
  } as ViewStyle,
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
  } as TextStyle,
  closeBtn: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.05,
    fontFamily: "Inter_600SemiBold",
  } as TextStyle,
  content: {
    padding: 22,
    paddingBottom: 36,
  } as ViewStyle,
});
