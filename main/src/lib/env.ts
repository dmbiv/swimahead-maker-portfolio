const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publicSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
    this.name = "SupabaseConfigurationError";
  }
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  if (!isHttpUrl(publicSupabaseUrl) || !publicSupabaseKey) return null;

  return {
    url: publicSupabaseUrl.replace(/\/$/, ""),
    publishableKey: publicSupabaseKey,
  };
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();
  if (!config) throw new SupabaseConfigurationError();
  return config;
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

const allowedRedirectRoots = [
  "/",
  "/s",
  "/c",
  "/for-coaches",
  "/subscribe",
  "/legal/accept",
  "/onboarding",
  "/sign-in",
  "/sign-up",
] as const;

export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://swimahead.invalid");
    if (parsed.origin !== "https://swimahead.invalid") return fallback;

    const allowed = allowedRedirectRoots.some((root) =>
      root === "/"
        ? parsed.pathname === "/"
        : parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
    );

    return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function configuredSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (isHttpUrl(explicit)) return new URL(explicit).origin;

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!vercelHost) return null;

  const candidate = vercelHost.includes("://") ? vercelHost : `https://${vercelHost}`;
  return isHttpUrl(candidate) ? new URL(candidate).origin : null;
}
