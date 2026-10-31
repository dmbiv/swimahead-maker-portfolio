import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/app/auth/auth-shell";
import { signOutAction } from "@/app/auth/actions";
import { getOptionalAuthContext } from "@/lib/auth";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AccountSetupForm } from "./account-setup-form";

export const metadata: Metadata = { title: "Account setup" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const context = await getOptionalAuthContext();
  if (!context) redirect("/sign-in?next=/onboarding");
  const params = await searchParams;

  if (context.accountType === "coach" && context.memberships.length > 0) redirect("/c");
  if (context.accountType === "swimmer" && context.onboardingCompleted) redirect("/s");

  if (context.accountType === "coach" && context.onboardingCompleted) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("provision_coach_workspace");
    if (!error) redirect("/c");
  }

  const { data: signupAcceptance } = await createAdminClient()
    .from("legal_acceptances")
    .select("age_13_or_older_confirmed,guardian_permission_confirmed_if_minor,coach_adult_and_authorized_confirmed")
    .eq("user_id", context.userId)
    .eq("acceptance_context", "signup")
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .maybeSingle();
  const hasCurrentAcceptance = signupAcceptance?.age_13_or_older_confirmed === true &&
    signupAcceptance.guardian_permission_confirmed_if_minor === true;
  const requestedRole = hasCurrentAcceptance
    ? (signupAcceptance.coach_adult_and_authorized_confirmed ? "coach" : "swimmer")
    : (params.role === "coach" ? "coach" : "swimmer");
  return (
    <AuthShell
      title="Set up your account"
      description={`Signed in with Google as ${context.email}`}
      footer={<SignOutForm />}
    >
      <AccountSetupForm
        initialRole={requestedRole}
        initialName={context.displayName}
        requiresSignupAcceptance={!hasCurrentAcceptance}
      />
    </AuthShell>
  );
}

function SignOutForm() {
  return (
    <form action={signOutAction}>
      <button className="font-semibold text-[var(--accent-2)] underline underline-offset-2" type="submit">Sign out</button>
    </form>
  );
}
