import { MISSING_ENV_MESSAGE, supabaseConfigured } from "@/integrations/supabase/client";

/**
 * Turns any Supabase / network failure into a short, user-friendly sentence.
 * Technical details stay in the console — never in the UI.
 */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!supabaseConfigured) return MISSING_ENV_MESSAGE;

  if (error) console.error("[foundriq]", error);

  const raw = (error as { message?: string })?.message ?? "";
  const status = (error as { status?: number })?.status;
  const code = (error as { code?: string })?.code ?? "";
  const msg = raw.toLowerCase();

  if (!raw && !status) return fallback;

  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
    return "You appear to be offline. Check your connection and try again.";
  }
  if (msg.includes("timeout") || msg.includes("timed out") || status === 504) {
    return "That took too long. Please try again.";
  }
  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("email not confirmed")) return "Please confirm your email address first.";
  if (msg.includes("user already registered") || code === "user_already_exists") {
    return "An account with this email already exists. Try signing in.";
  }
  if (msg.includes("password should be") || msg.includes("weak password")) {
    return "Please choose a stronger password.";
  }
  if (msg.includes("rate limit") || status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("row-level security") || msg.includes("permission denied") || status === 403) {
    return "You don't have permission to do that.";
  }
  if (status === 401 || msg.includes("jwt") || msg.includes("session")) {
    return "Your session expired. Please sign in again.";
  }
  if (code === "PGRST116" || msg.includes("not found") || status === 404) {
    return "We couldn't find that item.";
  }
  if (msg.includes("exceeded the maximum allowed size") || msg.includes("payload too large")) {
    return "That file is too large.";
  }
  if (msg.includes("bucket not found")) return "File storage isn't set up yet.";

  return fallback;
}
