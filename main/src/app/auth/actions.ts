"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  configuredSiteUrl,
  isSupabaseConfigured,
  requireSupabasePublicConfig,
  safeRedirectPath,
  SupabaseConfigurationError,
} from "@/lib/env";
import { getOptionalAuthContext } from "@/lib/auth";
import {
  GOOGLE_AUTH_NEXT_COOKIE,
  GOOGLE_AUTH_NEXT_COOKIE_MAX_AGE,
  GOOGLE_AUTH_NEXT_COOKIE_PATH,
  hasGoogleIdentity,
} from "@/lib/google-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/auth/form-state";
import { isPersonalDataCollectionConfigured, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

const emailSchema = z.string().trim().email("Enter a valid email address.").max(320);

const onboardingSchema = z.object({
  accountType: z.enum(["swimmer", "coach"]),
  displayName: z.string().trim().min(2, "Enter your name.").max(100),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  gender: z.enum(["M", "F"]).optional(),
  gradYear: z.coerce.number().int().min(2024).max(2045).optional(),
  club: z.string().trim().max(140).optional(),
  state: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  legalAccepted: z.string().optional(),
  eligibilityConfirmed: z.string().optional(),
});

const programClaimSchema = z.object({
  programId: z.string().trim().min(1, "Choose a program.").max(100),
  institutionalEmail: emailSchema,
  jobTitle: z.string().trim().min(2, "Enter your title.").max(100),
  note: z.string().trim().max(1000).optional(),
});

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalid(error: z.ZodError): FormState {
  return {
    status: "error",
    message: "Check the fields below.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function setupError(): FormState {
  return {
    status: "error",
    message:
      "Account access is not configured yet. Add the Supabase project URL and publishable key, then restart the app.",
  };
}

function genericError(message = "We could not complete that request. Try again."): FormState {
  return { status: "error", message };
}

async function requestOrigin(): Promise<string> {
  const configured = configuredSiteUrl();
  if (configured) return configured;

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "https:" || parsed.hostname === "localhost") return parsed.origin;
    } catch {
    }
  }

  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ||
    (host?.startsWith("localhost") ? "http" : "https");
  if (host && /^[a-z0-9.:-]+$/i.test(host) && ["http", "https"].includes(protocol)) {
    return `${protocol}://${host}`;
  }
  return "http://localhost:3000";
}

function oauthCallbackUrl(origin: string): string {
  return new URL("/auth/callback", origin).toString();
}

function sanitizedAuthError(error: unknown) {
  if (!error || typeof error !== "object") return { name: "Error" };
  const candidate = error as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
  return {
    name: typeof candidate.name === "string" ? candidate.name : "Error",
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
  };
}

function isExpectedOAuthUrl(value: string): boolean {
  try {
    const configured = new URL(requireSupabasePublicConfig().url);
    const candidate = new URL(value);
    return candidate.origin === configured.origin &&
      candidate.pathname === `${configured.pathname.replace(/\/$/, "")}/auth/v1/authorize`;
  } catch {
    return false;
  }
}

export async function googleSignInAction(_state: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return setupError();

  const requested = formData.get("next");
  const next = typeof requested === "string" ? safeRedirectPath(requested, "/onboarding") : "/onboarding";
  let authorizationUrl: string;
  try {
    const origin = await requestOrigin();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: oauthCallbackUrl(origin),
        scopes: "openid email profile",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url || !isExpectedOAuthUrl(data.url)) {
      console.error("Google OAuth initialization failed", sanitizedAuthError(error));
      return genericError("Google sign-in is unavailable right now. Try again shortly.");
    }
    authorizationUrl = data.url;

    const cookieStore = await cookies();
    cookieStore.set(GOOGLE_AUTH_NEXT_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(origin).protocol === "https:",
      path: GOOGLE_AUTH_NEXT_COOKIE_PATH,
      maxAge: GOOGLE_AUTH_NEXT_COOKIE_MAX_AGE,
    });
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return setupError();
    console.error("Google OAuth initialization failed", sanitizedAuthError(error));
    return genericError("Google sign-in is unavailable right now. Try again shortly.");
  }

  redirect(authorizationUrl);
}

export async function signOutAction(formData?: FormData): Promise<void> {
  const requested = formData?.get("next");
  const next = typeof requested === "string" ? safeRedirectPath(requested, "/") : "/";
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
    }
  }
  const signInUrl = new URL("/sign-in", "https://swimahead.invalid");
  signInUrl.searchParams.set("message", "signed-out");
  if (next !== "/") signInUrl.searchParams.set("next", next);
  redirect(`${signInUrl.pathname}${signInUrl.search}`);
}

type SignupAcceptanceRow = {
  age_13_or_older_confirmed: boolean;
  guardian_permission_confirmed_if_minor: boolean;
  coach_adult_and_authorized_confirmed: boolean;
};

function acceptanceAllowsRole(
  acceptance: SignupAcceptanceRow | null,
  accountType: "swimmer" | "coach",
): boolean {
  return acceptance?.age_13_or_older_confirmed === true &&
    acceptance.guardian_permission_confirmed_if_minor === true &&
    acceptance.coach_adult_and_authorized_confirmed === (accountType === "coach");
}

async function ensureSignupAcceptance(input: {
  userId: string;
  accountType: "swimmer" | "coach";
  legalAccepted?: string;
  eligibilityConfirmed?: string;
}): Promise<FormState | null> {
  if (!isPersonalDataCollectionConfigured()) {
    return genericError("Account creation is unavailable until the operator's legal contact details are configured.");
  }

  const admin = createAdminClient();
  const [versionsResult, acceptanceResult] = await Promise.all([
    admin
      .from("legal_policy_versions")
      .select("terms_version,privacy_version")
      .eq("singleton", true)
      .maybeSingle(),
    admin
      .from("legal_acceptances")
      .select("age_13_or_older_confirmed,guardian_permission_confirmed_if_minor,coach_adult_and_authorized_confirmed")
      .eq("user_id", input.userId)
      .eq("acceptance_context", "signup")
      .eq("terms_version", TERMS_VERSION)
      .eq("privacy_version", PRIVACY_VERSION)
      .maybeSingle(),
  ]);

  const versions = versionsResult.data;
  if (versionsResult.error || !versions ||
      versions.terms_version !== TERMS_VERSION ||
      versions.privacy_version !== PRIVACY_VERSION) {
    return genericError("The current policy version is not configured correctly. Contact support.");
  }
  if (acceptanceResult.error) {
    return genericError("Account setup could not verify policy acceptance. Try again.");
  }

  const existing = acceptanceResult.data as SignupAcceptanceRow | null;
  if (existing) {
    return acceptanceAllowsRole(existing, input.accountType)
      ? null
      : genericError("The account type cannot differ from the role selected with your policy attestations.");
  }

  if (input.legalAccepted !== "accepted" || input.eligibilityConfirmed !== "confirmed") {
    return {
      status: "error",
      message: "Review the required confirmations.",
      fieldErrors: {
        ...(input.legalAccepted === "accepted"
          ? {}
          : { legalAccepted: ["Agree to the Terms and acknowledge the Privacy Policy."] }),
        ...(input.eligibilityConfirmed === "confirmed"
          ? {}
          : { eligibilityConfirmed: ["Confirm that you meet the age and authorization requirements."] }),
      },
    };
  }

  const record = {
    user_id: input.userId,
    acceptance_context: "signup",
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    age_13_or_older_confirmed: true,
    guardian_permission_confirmed_if_minor: true,
    coach_adult_and_authorized_confirmed: input.accountType === "coach",
    accepted_at: new Date().toISOString(),
  };
  const { error } = await admin.from("legal_acceptances").insert(record);
  if (!error) return null;
  if (error.code !== "23505") {
    return genericError("Account setup could not save policy acceptance. Try again.");
  }

  const { data: raced, error: racedError } = await admin
    .from("legal_acceptances")
    .select("age_13_or_older_confirmed,guardian_permission_confirmed_if_minor,coach_adult_and_authorized_confirmed")
    .eq("user_id", input.userId)
    .eq("acceptance_context", "signup")
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .maybeSingle();
  return !racedError && acceptanceAllowsRole(raced as SignupAcceptanceRow | null, input.accountType)
    ? null
    : genericError("Account setup could not save policy acceptance. Try again.");
}

export async function completeOnboardingAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return setupError();
  const parsed = onboardingSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  if (parsed.data.accountType === "swimmer") {
    if (!parsed.data.firstName || !parsed.data.lastName || !parsed.data.gender || !parsed.data.gradYear) {
      return genericError("First name, last name, gender, and graduation year are required.");
    }
  } else if (!parsed.data.jobTitle) {
    return genericError("Enter your role with the team.");
  }

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) return genericError("Your session ended. Continue with Google again.");
    if (!user.email_confirmed_at || !hasGoogleIdentity(user)) {
      return genericError("Account setup requires a verified Google sign-in.");
    }

    const acceptanceError = await ensureSignupAcceptance({
      userId: user.id,
      accountType: parsed.data.accountType,
      legalAccepted: parsed.data.legalAccepted,
      eligibilityConfirmed: parsed.data.eligibilityConfirmed,
    });
    if (acceptanceError) return acceptanceError;

    const { error } = await supabase.rpc("complete_account_onboarding", {
      p_account_type: parsed.data.accountType,
      p_display_name: parsed.data.displayName,
      p_first_name: parsed.data.firstName || null,
      p_last_name: parsed.data.lastName || null,
      p_gender: parsed.data.gender || null,
      p_grad_year: parsed.data.gradYear || null,
      p_club: parsed.data.club || null,
      p_state: parsed.data.state || null,
      p_date_of_birth: null,
      p_job_title: parsed.data.jobTitle || null,
    });
    if (error) return genericError("Account setup could not be saved. Try again.");

    if (parsed.data.accountType === "coach") {
      const { error: provisionError } = await supabase.rpc("provision_coach_workspace");
      if (provisionError) return genericError("Coach workspace could not be set up. Try again.");
    }
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return setupError();
    return genericError();
  }

  revalidatePath("/onboarding");
  if (parsed.data.accountType === "coach") redirect("/c");
  redirect("/onboarding");
}

export async function submitProgramClaimAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return setupError();
  const parsed = programClaimSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const context = await getOptionalAuthContext();
  if (!context) redirect("/sign-in?next=/onboarding");
  if (context.accountType !== "coach" || !context.onboardingCompleted) {
    return genericError("Finish coach account setup first.");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("request_program_claim", {
      p_program_id: parsed.data.programId,
      p_institutional_email: parsed.data.institutionalEmail,
      p_job_title: parsed.data.jobTitle,
      p_note: parsed.data.note || null,
    });
    if (error) return genericError("The access request could not be submitted. Try again.");
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) return setupError();
    return genericError();
  }

  revalidatePath("/onboarding");
  redirect("/onboarding?message=claim-submitted");
}
