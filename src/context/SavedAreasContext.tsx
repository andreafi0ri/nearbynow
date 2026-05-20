import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  } catch {}
}

type SavedAreasCtx = {
  areas: string[];
  activeArea: string;
  addArea: (area: string) => Promise<void>;
  removeArea: (area: string) => Promise<void>;
  switchArea: (area: string) => Promise<void>;
};

const Ctx = createContext<SavedAreasCtx>({
  areas: [], activeArea: "",
  addArea: async () => {}, removeArea: async () => {}, switchArea: async () => {},
});

export function SavedAreasProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas]         = useState<string[]>([]);
  const [activeArea, setActive]   = useState("");

  useEffect(() => {
    loadState().then(({ areas, active }) => {
      setAreas(areas);
      setActive(active);
    });
  }, []);

  const addArea = useCallback(async (area: string) => {
    const trimmed = area.trim();
    if (!trimmed) return;
    setAreas(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      AsyncStorage.setItem(AREAS_KEY, JSON.stringify(next));
      return next;
    });
    setActive(trimmed);
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
    setActive(prev => {
      if (prev !== area) return prev;
      const fallback = next.find(a => a !== area) ?? "";
      AsyncStorage.setItem(ACTIVE_KEY, fallback);
      if (fallback) syncAreaToSupabase(fallback);
      return fallback;
    });
  }, []);

  const switchArea = useCallback(async (area: string) => {
    setActive(area);
    await Promise.all([
      AsyncStorage.setItem(ACTIVE_KEY, area),
      syncAreaToSupabase(area),
    ]);
  }, []);

  return (
    <Ctx.Provider value={{ areas, activeArea, addArea, removeArea, switchArea }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSavedAreas() {
  return useContext(Ctx);
}
