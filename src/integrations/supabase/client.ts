import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The single shared Supabase client for the whole app.
 *
 * Credentials are never hardcoded — they come from environment variables
 * (`.env` locally, project/deployment env vars in production).
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && publishableKey);

export const MISSING_ENV_MESSAGE =
  "The app isn't connected to its backend yet. Please try again later.";

if (!supabaseConfigured && typeof window !== "undefined") {
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables.",
  );
}

// Fallbacks keep module evaluation (and SSR) from crashing when env vars are
// absent; every call still fails safely and is surfaced as a friendly message.
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  publishableKey ?? "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "foundriq-auth",
    },
  },
);
