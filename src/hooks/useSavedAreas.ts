import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

const AREAS_KEY  = "hearby_saved_areas";
const ACTIVE_KEY = "hearby_area";

async function loadState(): Promise<{ areas: string[]; active: string }> {
  try {
    const [rawAreas, active] = await Promise.all([
      AsyncStorage.getItem(AREAS_KEY),
      AsyncStorage.getItem(ACTIVE_KEY),
    ]);
    const areas: string[] = rawAreas ? JSON.parse(rawAreas) : [];
    // Migrate from single-area storage
    if (areas.length === 0 && active) return { areas: [active], active };
    return { areas, active: active ?? areas[0] ?? "" };
  } catch {
    return { areas: [], active: "" };
  }
}

async function syncAreaToSupabase(area: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("users").update({ area }).eq("id", session.user.id);
  } catch {
    // Supabase not reachable — AsyncStorage is the source of truth
  }
}

export function useSavedAreas() {
  const [areas, setAreas]           = useState<string[]>([]);
  const [activeArea, setActiveArea] = useState("");

  useEffect(() => {
    loadState().then(({ areas, active }) => {
      setAreas(areas);
      setActiveArea(active);
    });
  }, []);

  const addArea = useCallback(async (area: string) => {
    setAreas(prev => {
      const trimmed = area.trim();
      if (!trimmed || prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      AsyncStorage.setItem(AREAS_KEY, JSON.stringify(next));
      return next;
    });
    const trimmed = area.trim();
    if (!trimmed) return;
    setActiveArea(trimmed);
    await Promise.all([
      AsyncStorage.setItem(ACTIVE_KEY, trimmed),
      syncAreaToSupabase(trimmed),
    ]);
  }, []);

  const removeArea = useCallback(async (area: string) => {
    let next: string[] = [];
    setAreas(prev => {
      next = prev.filter(a => a !== area);
      AsyncStorage.setItem(AREAS_KEY, JSON.stringify(next));
      return next;
    });
    setActiveArea(prev => {
      if (prev !== area) return prev;
      const fallback = next.find(a => a !== area) ?? "";
      AsyncStorage.setItem(ACTIVE_KEY, fallback);
      if (fallback) syncAreaToSupabase(fallback);
      return fallback;
    });
  }, []);

  const switchArea = useCallback(async (area: string) => {
    setActiveArea(area);
    await Promise.all([
      AsyncStorage.setItem(ACTIVE_KEY, area),
      syncAreaToSupabase(area),
    ]);
  }, []);

  return { areas, activeArea, addArea, removeArea, switchArea };
}
