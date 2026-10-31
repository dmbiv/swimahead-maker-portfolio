import type { Metadata } from "next";
import Link from "@/components/app-link";
import { AuthShell } from "@/app/auth/auth-shell";
import { isSupabaseConfigured, safeRedirectPath } from "@/lib/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const notices: Record<string, string> = { "signed-out": "You are signed out." };

const errors: Record<string, string> = {
  oauth: "Google sign-in could not be completed. Try again and choose the Google account you want to use.",
  "google-only": "SwimAhead accounts now use Google sign-in.",
};

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const setupMissing = params.error === "setup" || !configured;
  const notice = params.message ? notices[params.message] : undefined;
  const error = params.error ? errors[params.error] : undefined;
  const requestedDestination = params.next
    ? safeRedirectPath(params.next, "") || undefined
    : undefined;

  return (
    <AuthShell
      title="Continue to SwimAhead"
      description="Continue with Google whether you are signing in or creating your SwimAhead account."
    >
      {setupMissing ? (
        <div role="alert" className="auth2-note auth2-note--info">
          Account access needs a Supabase project URL and publishable key.{" "}
          <Link href="/s/explore">Browse the public college search</Link> in the meantime.
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="auth2-note auth2-note--ok">{notice}</div>
      ) : null}
      {error ? (
        <div role="alert" className="auth2-note auth2-note--info">{error}</div>
      ) : null}
      <SignInForm next={requestedDestination} disabled={!configured} />
    </AuthShell>
  );
}
