import type { User } from "@supabase/supabase-js";

export const GOOGLE_AUTH_NEXT_COOKIE = "swimahead_google_auth_next";
export const GOOGLE_AUTH_NEXT_COOKIE_PATH = "/auth/callback";
export const GOOGLE_AUTH_NEXT_COOKIE_MAX_AGE = 10 * 60;

export function hasGoogleIdentity(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.identities?.some((identity) => identity.provider === "google")) return true;

  const provider = user.app_metadata?.provider;
  if (provider === "google") return true;
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("google");
}
