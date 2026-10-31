import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig, safeRedirectPath } from "@/lib/env";

const protectedRoots = [
  "/c",
  "/onboarding",
  "/s/board",
  "/s/outreach",
  "/s/profile",
  "/s/times",
  "/s/plan",
];
const authEntryRoots = ["/sign-in", "/sign-up"];

function pathStartsWith(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export async function updateSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  const isProtected = protectedRoots.some((root) => pathStartsWith(request.nextUrl.pathname, root));

  if (!config) {
    if (!isProtected) return NextResponse.next({ request });

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set("error", "setup");
    signInUrl.searchParams.set(
      "next",
      safeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`, "/"),
    );
    const response = NextResponse.redirect(signInUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          supabaseResponse.headers.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  let userExists = Boolean(userId);
  if (isProtected && userId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await supabase.auth.signOut();
      userExists = false;
    }
  }

  if (isProtected && (error || !userId || !userExists)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set(
      "next",
      safeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`, "/"),
    );
    const redirectResponse = NextResponse.redirect(signInUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  const isAuthEntry = authEntryRoots.some((root) => pathStartsWith(request.nextUrl.pathname, root));
  if (isAuthEntry && userId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await supabase.auth.signOut();
      return supabaseResponse;  
    }
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    const redirectResponse = NextResponse.redirect(onboardingUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  return supabaseResponse;
}
