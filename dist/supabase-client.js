import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const config = window.__SUPABASE_CONFIG__ || {};
const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url || "");

export const isSupabaseConfigured =
  validUrl &&
  typeof config.publishableKey === "string" &&
  config.publishableKey.startsWith("sb_publishable_");

export const supabase = isSupabaseConfigured
  ? createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export async function testSupabaseConnection() {
  if (!supabase) {
    return { ok: false, error: "Supabase browser configuration is missing or invalid." };
  }

  const { error } = await supabase.auth.getSession();
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
}
