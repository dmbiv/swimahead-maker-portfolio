import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCoachBillingAccess } from "@/lib/coach-billing";
import { listCoachColleges } from "@/lib/coach-college";
import { isSupabaseConfigured, safeRedirectPath } from "@/lib/env";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountType = "swimmer" | "coach";
export type WorkspaceRole = "owner" | "admin" | "head_coach" | "assistant_coach" | "recruiter" | "viewer";

export type WorkspaceMembership = {
  workspaceId: string;
  role: WorkspaceRole;
  programId: string | null;
  athleticProgramId: string | null;
  workspaceName: string;
};

export type AuthContext = {
  userId: string;
  email: string;
  accountType: AccountType | null;
  onboardingCompleted: boolean;
  displayName: string;
  memberships: WorkspaceMembership[];
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationError extends Error {
  constructor() {
    super("You do not have access to this resource.");
    this.name = "AuthorizationError";
  }
}

type WorkspaceRel = {
  id: string;
  name: string;
  program_id: string | null;
  athletic_program_id: string | null;
  status: string;
};

type MembershipRow = {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: WorkspaceRel | WorkspaceRel[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export const getOptionalAuthContext = cache(async (): Promise<AuthContext | null> => {
  if (!isSupabaseConfigured()) return null;

  await connection();
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const claimedUserId = typeof claims?.sub === "string" ? claims.sub : null;
  if (claimsError || !claimedUserId) return null;
  const claimedEmail = typeof claims?.email === "string" ? claims.email : "";
  const claimedMetadata = claims?.user_metadata && typeof claims.user_metadata === "object"
    ? claims.user_metadata as Record<string, unknown>
    : null;
  const claimedDisplayName = [claimedMetadata?.display_name, claimedMetadata?.full_name, claimedMetadata?.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim()
    .slice(0, 100) ?? "";

  const [{ data: account }, { data: profile }, membershipResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("account_type,onboarding_completed_at")
      .eq("user_id", claimedUserId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", claimedUserId)
      .maybeSingle(),
    supabase
      .from("workspace_memberships")
      .select("workspace_id,role,workspaces(id,name,program_id,athletic_program_id,status)")
      .eq("user_id", claimedUserId)
      .eq("status", "active"),
  ]);

  let membershipData = membershipResult.data;
  const membershipRows = (membershipData ?? []) as MembershipRow[];
  if (membershipRows.some((membership) => one(membership.workspaces) === null)) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("workspace_memberships")
        .select("workspace_id,role,workspaces(id,name,program_id,athletic_program_id,status)")
        .eq("user_id", claimedUserId)
        .eq("status", "active");
      if (data) membershipData = data;
    } catch {
    }
  }

  const memberships = ((membershipData ?? []) as MembershipRow[])
    .map((membership): WorkspaceMembership | null => {
      const workspace = one(membership.workspaces);
      if (!workspace || workspace.status !== "active") return null;
      return {
        workspaceId: membership.workspace_id,
        role: membership.role,
        programId: workspace.program_id,
        athleticProgramId: workspace.athletic_program_id,
        workspaceName: workspace.name,
      };
    })
    .filter((membership): membership is WorkspaceMembership => membership !== null)
    .sort((left, right) =>
      left.workspaceName.localeCompare(right.workspaceName) ||
      left.workspaceId.localeCompare(right.workspaceId),
    );

  const accountType =
    account?.account_type === "swimmer" || account?.account_type === "coach"
      ? account.account_type
      : null;

  return {
    userId: claimedUserId,
    email: claimedEmail,
    accountType,
    onboardingCompleted: Boolean(account?.onboarding_completed_at),
    displayName: typeof profile?.display_name === "string" && profile.display_name.trim()
      ? profile.display_name
      : claimedDisplayName,
    memberships,
  };
});

export async function requireAuth(nextPath = "/"): Promise<AuthContext> {
  const context = await getOptionalAuthContext();
  if (!context) {
    redirect(`/sign-in?next=${encodeURIComponent(safeRedirectPath(nextPath, "/"))}`);
  }
  return context;
}

export async function requireOnboardedAccount(nextPath = "/"): Promise<AuthContext> {
  const context = await requireAuth(nextPath);
  if (!context.accountType || !context.onboardingCompleted) redirect("/onboarding");
  return context;
}

export async function requireAccountType(
  accountType: "swimmer" | "coach",
  nextPath = accountType === "coach" ? "/c" : "/s",
): Promise<AuthContext> {
  const context = await requireOnboardedAccount(nextPath);
  if (context.accountType !== accountType) {
    if (context.accountType === "coach") {
      redirect(context.memberships.length > 0 ? "/c" : "/onboarding");
    }
    redirect("/s");
  }
  if (!await hasCurrentLegalAcceptance(context.userId, accountType)) {
    const destination = safeRedirectPath(nextPath, accountType === "coach" ? "/c" : "/s");
    redirect(`/legal/accept?next=${encodeURIComponent(destination)}`);
  }
  return context;
}

export const hasCurrentLegalAcceptance = cache(async (
  userId: string,
  accountType: AccountType,
): Promise<boolean> => {
  try {
    const admin = createAdminClient();
    const [{ data: acceptance, error: acceptanceError }, { data: versions, error: versionsError }] =
      await Promise.all([
        admin
          .from("legal_acceptances")
          .select("age_13_or_older_confirmed,guardian_permission_confirmed_if_minor,coach_adult_and_authorized_confirmed")
          .eq("user_id", userId)
          .eq("acceptance_context", "signup")
          .eq("terms_version", TERMS_VERSION)
          .eq("privacy_version", PRIVACY_VERSION)
          .maybeSingle(),
        admin
          .from("legal_policy_versions")
          .select("terms_version,privacy_version")
          .eq("singleton", true)
          .maybeSingle(),
      ]);
    if (acceptanceError || versionsError || !acceptance || !versions) return false;
    if (versions.terms_version !== TERMS_VERSION || versions.privacy_version !== PRIVACY_VERSION) return false;
    return acceptance.age_13_or_older_confirmed === true &&
      acceptance.guardian_permission_confirmed_if_minor === true &&
      (accountType !== "coach" || acceptance.coach_adult_and_authorized_confirmed === true);
  } catch {
    return false;
  }
});

export async function requireCoachWorkspace(workspaceId?: string): Promise<{
  context: AuthContext;
  membership: WorkspaceMembership;
}> {
  const context = await requireOnboardedAccount("/c");
  if (context.accountType !== "coach") redirect("/s");

  const membership = workspaceId
    ? context.memberships.find((item) => item.workspaceId === workspaceId)
    : context.memberships[0];

  const [acceptedLegal, billing] = await Promise.all([
    hasCurrentLegalAcceptance(context.userId, "coach"),
    getCoachBillingAccess(context.userId),
    membership
      ? listCoachColleges(membership).catch(() => [])
      : Promise.resolve([]),
  ]);

  if (!acceptedLegal) redirect(`/legal/accept?next=${encodeURIComponent("/c")}`);
  if (!membership) redirect("/onboarding");
  if (!billing.entitled) redirect("/subscribe");
  return { context, membership };
}

export async function requireSwimmerProfile(): Promise<{
  context: AuthContext;
  swimmerId: string;
}> {
  const context = await requireAccountType("swimmer", "/s");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swimmers")
    .select("id")
    .eq("owner_user_id", context.userId)
    .maybeSingle();

  if (error || !data?.id) throw new AuthorizationError();
  return { context, swimmerId: String(data.id) };
}

export async function assertWorkspaceAccess(workspaceId: string): Promise<WorkspaceMembership> {
  const { membership } = await requireCoachWorkspace(workspaceId);
  return membership;
}

export async function assertWorkspaceWrite(workspaceId: string): Promise<WorkspaceMembership> {
  const membership = await assertWorkspaceAccess(workspaceId);
  if (membership.role === "viewer") throw new AuthorizationError();
  return membership;
}

export async function assertSwimmerOwnership(swimmerId: string): Promise<AuthContext> {
  const context = await requireAccountType("swimmer", "/s");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swimmers")
    .select("id")
    .eq("id", swimmerId)
    .eq("owner_user_id", context.userId)
    .maybeSingle();
  if (error || !data) throw new AuthorizationError();
  return context;
}

export async function getPostAuthDestination(requested?: string | null): Promise<string> {
  const context = await getOptionalAuthContext();
  if (!context) return "/onboarding";

  if (!context.accountType || !context.onboardingCompleted) {
    const onboarding = safeRedirectPath(requested, "/onboarding");
    return onboarding === "/onboarding" || onboarding.startsWith("/onboarding?")
      ? onboarding
      : "/onboarding";
  }

  const fallback = context.accountType === "coach" ? "/c" : "/s";
  if (context.accountType === "coach" && context.memberships.length === 0) return "/onboarding";

  const destination = safeRedirectPath(requested, fallback);
  if (destination === "/c" || destination.startsWith("/c/")) {
    return context.accountType === "coach" && context.memberships.length > 0 ? destination : fallback;
  }
  if (destination === "/s" || destination.startsWith("/s/")) {
    const isPublicSearch = destination === "/s" ||
      destination === "/s/explore" ||
      destination.startsWith("/s/explore/") ||
      destination === "/s/programs" ||
      destination.startsWith("/s/programs/");
    return context.accountType === "swimmer" || isPublicSearch ? destination : fallback;
  }
  return destination;
}
