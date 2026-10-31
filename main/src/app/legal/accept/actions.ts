"use server";

import { redirect } from "next/navigation";
import { requireOnboardedAccount } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/env";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";

function acceptanceUrl(nextPath: string, error: string): string {
  const query = new URLSearchParams({ next: nextPath, error });
  return `/legal/accept?${query.toString()}`;
}

export async function acceptCurrentPoliciesAction(formData: FormData): Promise<void> {
  const requested = safeRedirectPath(String(formData.get("next") ?? ""), "/");
  const context = await requireOnboardedAccount(requested);
  const fallback = context.accountType === "coach" ? "/c" : "/s";
  const destination = safeRedirectPath(requested, fallback);

  if (formData.get("legalAccepted") !== "accepted" ||
      formData.get("eligibilityConfirmed") !== "confirmed") {
    redirect(acceptanceUrl(destination, "required"));
  }

  const admin = createAdminClient();
  const { data: versions, error: versionError } = await admin
    .from("legal_policy_versions")
    .select("terms_version,privacy_version")
    .eq("singleton", true)
    .maybeSingle();
  if (versionError || !versions ||
      versions.terms_version !== TERMS_VERSION ||
      versions.privacy_version !== PRIVACY_VERSION) {
    redirect(acceptanceUrl(destination, "configuration"));
  }

  const acceptedAt = new Date().toISOString();
  const record = {
    user_id: context.userId,
    acceptance_context: "signup",
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    age_13_or_older_confirmed: true,
    guardian_permission_confirmed_if_minor: true,
    coach_adult_and_authorized_confirmed: context.accountType === "coach",
    accepted_at: acceptedAt,
  };
  const { error } = await admin.from("legal_acceptances").insert(record);
  if (error?.code === "23505") {
    const { data: existing } = await admin
      .from("legal_acceptances")
      .select("age_13_or_older_confirmed,guardian_permission_confirmed_if_minor,coach_adult_and_authorized_confirmed")
      .eq("user_id", context.userId)
      .eq("acceptance_context", "signup")
      .eq("terms_version", TERMS_VERSION)
      .eq("privacy_version", PRIVACY_VERSION)
      .maybeSingle();
    const valid = existing?.age_13_or_older_confirmed === true &&
      existing.guardian_permission_confirmed_if_minor === true &&
      (context.accountType !== "coach" || existing.coach_adult_and_authorized_confirmed === true);
    if (!valid) redirect(acceptanceUrl(destination, "unavailable"));
  } else if (error) {
    redirect(acceptanceUrl(destination, "unavailable"));
  }

  redirect(destination);
}
