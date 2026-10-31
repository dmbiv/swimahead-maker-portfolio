import { NextResponse, type NextRequest } from "next/server";
import { getPostAuthDestination } from "@/lib/auth";
import { isSupabaseConfigured, safeRedirectPath } from "@/lib/env";
import {
  GOOGLE_AUTH_NEXT_COOKIE,
  GOOGLE_AUTH_NEXT_COOKIE_PATH,
  hasGoogleIdentity,
} from "@/lib/google-auth";
import { createClient } from "@/lib/supabase/server";

function noStoreRedirect(request: NextRequest, destination: string) {
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.set(GOOGLE_AUTH_NEXT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: GOOGLE_AUTH_NEXT_COOKIE_PATH,
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(
    request.cookies.get(GOOGLE_AUTH_NEXT_COOKIE)?.value,
    "/onboarding",
  );

  if (isSupabaseConfigured() && code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const user = data.user;
    if (!error && user?.email_confirmed_at && hasGoogleIdentity(user)) {
      const destination = await getPostAuthDestination(next);
      return noStoreRedirect(request, destination);
    }

    await supabase.auth.signOut({ scope: "local" });
  }

  return noStoreRedirect(request, "/sign-in?error=oauth");
}
