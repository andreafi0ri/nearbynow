import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Web uses the browser's built-in session storage; native uses AsyncStorage.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // true — lets Supabase auto-exchange the #access_token hash fragment
    // on web (implicit flow).  The callback screen also drives an explicit
    // exchange for any ?code= or ?token_hash= params it finds in the URL.
    detectSessionInUrl: true,
  },
});

export type UserProfile = {
  id: string;
  email: string;
  username: string | null;
  avatar: string | null;
  area: string | null;
  saved_event_ids: number[] | null;
};
