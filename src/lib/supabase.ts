import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isE2eMode = import.meta.env.MODE === "e2e";

type AppSupabaseClient = Pick<SupabaseClient, "auth" | "from">;

const e2eSupabase =
  isE2eMode && typeof window !== "undefined"
    ? (window as Window & { __SUOMISANAT_E2E_SUPABASE__?: AppSupabaseClient }).__SUOMISANAT_E2E_SUPABASE__ ?? null
    : null;

const hasConfiguredSupabase = Boolean(supabaseUrl && supabasePublishableKey);

export const hasSupabaseConfig = Boolean(e2eSupabase) || hasConfiguredSupabase;

export const supabase: AppSupabaseClient | null = e2eSupabase
  ? e2eSupabase
  : hasConfiguredSupabase
    ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
    : null;
