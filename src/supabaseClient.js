import { createClient } from "@supabase/supabase-js";

const supabaseUrl = window.env?.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = window.env?.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

