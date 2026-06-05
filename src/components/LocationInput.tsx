import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, ViewStyle, TextStyle,
} from "react-native";
import { Theme } from "../theme";
import { searchLocations, LocationSuggestion } from "../services/locationService";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  placeholder?: string;
  T: Theme;
  returnKeyType?: "search" | "go" | "done" | "next";
  autoFocus?: boolean;
};

export function LocationInput({
  value,
  onChangeText,
  onSelect,
  placeholder = "Search a new area…",
  T,
  returnKeyType = "search",
  autoFocus = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading]         = useState(false);
  const [open, setOpen]               = useState(false);

  const handleChange = useCallback(async (text: string) => {
    onChangeText(text);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const results = await searchLocations(text);
    setLoading(false);
    setSuggestions(results);
    setOpen(results.length > 0);
  }, [onChangeText]);

  const handleSelect = useCallback((s: LocationSuggestion) => {
    onChangeText(s.shortName);
    setSuggestions([]);
    setOpen(false);
    onSelect(s);
  }, [onChangeText, onSelect]);

  const dismiss = useCallback(() => {
    setSuggestions([]);
    setOpen(false);
  }, []);

  return (
    <View style={styles.wrapper}>
      {/* Transparent backdrop to dismiss on outside tap */}
      {open && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />
      )}

      <View style={[styles.inputWrap, { backgroundColor: T.bgCardHi, borderColor: value ? T.text : T.borderSub }]}>
        <Text style={styles.pin}>📍</Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={T.muted}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          onSubmitEditing={dismiss}
          style={[styles.input, { color: T.text }, Platform.OS === "web" && { fontSize: 16 }]}
        />
        {loading && (
          <ActivityIndicator size="small" color={T.muted} style={styles.spinner} />
        )}
      </View>

      {open && (
        <View style={[styles.dropdown, {
          backgroundColor: T.bg,
          borderColor:     T.border,
          shadowColor:     T.border,
        }]}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.lat}-${s.lng}-${i}`}
              onPress={() => handleSelect(s)}
              style={[styles.row, {
                borderBottomColor: T.borderSub,
                borderBottomWidth: i < suggestions.length - 1 ? 1.5 : 0,
              }]}
            >
              <Text style={[styles.shortName, { color: T.text }]}>{s.shortName}</Text>
              <Text style={[styles.fullName,  { color: T.muted }]} numberOfLines={1}>
                {s.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:   { position: "relative", zIndex: 100 } as ViewStyle,
  backdrop:  { position: "absolute", top: -9999, left: -9999, right: -9999, bottom: -9999, zIndex: 98 } as ViewStyle,
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 2 } as ViewStyle,
  pin:       { fontSize: 15, marginRight: 8 } as TextStyle,
  input:     { flex: 1, fontSize: 14, paddingVertical: 11, fontFamily: "Inter_400Regular" } as TextStyle,
  spinner:   { marginLeft: 8 } as ViewStyle,
  dropdown:  {
    position: "absolute",
    top: "100%" as unknown as number,
    left: 0,
    right: 0,
    zIndex: 99,
    marginTop: 6,
    borderWidth: 2,
    borderRadius: 14,
    overflow: "hidden",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 99,
  } as ViewStyle,
  row:       { paddingHorizontal: 14, paddingVertical: 12 } as ViewStyle,
  shortName: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 } as TextStyle,
  fullName:  { fontSize: 11, fontFamily: "Inter_400Regular" } as TextStyle,
});
