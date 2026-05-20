import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, UserProfile } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data ?? null);
    setLoading(false);
  };

  const updateProfile = async (updates: Partial<Omit<UserProfile, "id" | "email">>) => {
    if (!session) return;
    const { data } = await supabase
      .from("users")
      .update(updates)
      .eq("id", session.user.id)
      .select()
      .single();
    if (data) setProfile(data);
  };

  return { session, profile, loading, updateProfile };
}
