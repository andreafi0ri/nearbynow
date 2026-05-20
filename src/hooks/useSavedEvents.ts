import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

const KEY = "hearby_saved";

async function loadIds(): Promise<Set<number>> {
  try {
    // Prefer Supabase when signed in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from("users")
        .select("saved_event_ids")
        .eq("id", session.user.id)
        .single();
      if (data?.saved_event_ids) {
        const ids = new Set<number>(data.saved_event_ids);
        // Keep AsyncStorage in sync
        await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
        return ids;
      }
    }
    // Fallback to local storage
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    } catch {
      return new Set();
    }
  }
}

async function persistIds(ids: Set<number>) {
  const arr = [...ids];
  await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from("users")
        .update({ saved_event_ids: arr })
        .eq("id", session.user.id);
    }
  } catch {
    // Supabase unreachable — AsyncStorage persisted above
  }
}

export function useSavedEvents() {
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadIds().then(setSaved);
  }, []);

  const toggle = useCallback(async (id: number) => {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistIds(next);
      return next;
    });
  }, []);

  return { saved, toggle };
}
