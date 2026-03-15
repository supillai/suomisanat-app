import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isE2eMode = import.meta.env.MODE === "e2e";

type AppSupabaseClient = Pick<SupabaseClient, "auth" | "from">;

declare global {
  interface Window {
    __SUOMISANAT_E2E_SUPABASE__?: AppSupabaseClient;
  }
}

const hasConfiguredSupabase = Boolean(supabaseUrl && supabasePublishableKey);
let configuredSupabase: AppSupabaseClient | null | undefined;

const getE2eSupabaseClient = (): AppSupabaseClient | null => {
  if (!isE2eMode || typeof window === "undefined") {
    return null;
  }

  return window.__SUOMISANAT_E2E_SUPABASE__ ?? null;
};

export const getSupabaseClient = (): AppSupabaseClient | null => {
  const e2eSupabase = getE2eSupabaseClient();
  if (e2eSupabase) {
    return e2eSupabase;
  }

  if (!hasConfiguredSupabase) {
    return null;
  }

  if (configuredSupabase === undefined) {
    configuredSupabase = createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return configuredSupabase;
};

export const hasSupabaseConfig = (): boolean => Boolean(getE2eSupabaseClient()) || hasConfiguredSupabase;
