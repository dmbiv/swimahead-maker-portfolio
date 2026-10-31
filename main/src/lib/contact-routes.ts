import "server-only";

import {
  CONTACT_ROUTE_PURPOSE,
  contactGrantRouteCandidateSchema,
  normalizeClubCode,
  normalizeContactEmail,
  normalizeContactMemberId,
  normalizeLscCode,
  organizationRelayRouteCandidateSchema,
  resolveContactRoute,
  toPublicContactRouteDto,
  type OrganizationRelayRouteCandidate,
  type ContactGrantRouteCandidate,
  type PublicContactRouteDto,
  type SelectedContactRoute,
  type WorkspaceDirectRouteCandidate,
} from "./contact-route-core";
import { decryptContactRouteEmail } from "./contact-route-crypto";
import { createAdminClient } from "./supabase/admin";
import {
  isWorkspaceDirectContactSource,
  type WorkspaceDirectContactSource,
} from "./workspace-contact-provenance";

export type ContactRouteRecruit = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  lscCode: string | null;
  clubCode: string | null;
  directEmail: string | null;
  directContactName: string | null;
  directRelationship: "athlete" | "parent_guardian" | null;
  directContactSource: WorkspaceDirectContactSource | null;
  directRightsAttestedAt: string | null;
};

export class ContactRouteResolutionError extends Error {
  constructor() {
    super("Contact routes could not be resolved safely.");
    this.name = "ContactRouteResolutionError";
  }
}

type GrantRow = {
  id: string;
  member_id: string;
  contact_name: string;
  relationship: "athlete" | "parent_guardian";
  email_ciphertext: string;
  email_hash: string;
  source_type:
    | "athlete_opt_in"
    | "guardian_opt_in"
    | "national_authorized_contact"
    | "national_blind_relay"
    | "lsc_authorized_contact"
    | "lsc_blind_relay"
    | "club_authorized_contact"
    | "club_blind_relay";
  purpose_scope: string;
  source_record_id: string;
  source_url: string | null;
  identity_verification_method:
    | "operator_review"
    | "national_member_assertion"
    | "national_member_sso"
    | "lsc_member_assertion"
    | "club_member_assertion";
  identity_verified_at: string;
  authorization_basis:
    | "individual_consent"
    | "written_national_agreement"
    | "written_lsc_agreement"
    | "written_club_agreement";
  authorization_scope_code: string | null;
  authorization_reference: string;
  authorized_at: string;
  consent_version: string | null;
  consented_at: string | null;
  verified_at: string;
  expires_at: string;
  revoked_at: string | null;
};

type RelayRow = {
  id: string;
  scope_type: "lsc" | "club";
  scope_code: string;
  organization_name: string;
  contact_name: string;
  contact_role: string;
  email_ciphertext: string;
  email_hash: string;
  source_type: "lsc_submitted" | "club_submitted" | "manual_verified" | "written_agreement";
  rights_basis: "lsc_submission" | "club_submission" | "operator_verified_official_source" | "written_agreement";
  source_record_id: string | null;
  source_url: string | null;
  verified_at: string;
  expires_at: string;
  revoked_at: string | null;
};

type AgreementRow = {
  agreement_reference: string;
  scope_type: "national" | "lsc" | "club";
  scope_code: string | null;
};

const GRANT_SELECT = [
  "id", "member_id", "contact_name", "relationship", "email_ciphertext", "email_hash",
  "source_type", "purpose_scope", "source_record_id", "source_url",
  "identity_verification_method", "identity_verified_at", "authorization_basis",
  "authorization_scope_code", "authorization_reference", "authorized_at", "consent_version",
  "consented_at", "verified_at", "expires_at", "revoked_at",
].join(",");

const RELAY_SELECT = [
  "id", "scope_type", "scope_code", "organization_name", "contact_name", "contact_role",
  "email_ciphertext", "email_hash", "source_type", "rights_basis", "source_record_id",
  "source_url", "verified_at", "expires_at", "revoked_at",
].join(",");

function chunks<T>(items: readonly T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function grantCandidate(row: GrantRow, agreements: readonly AgreementRow[]): ContactGrantRouteCandidate | null {
  if (
    row.purpose_scope !== CONTACT_ROUTE_PURPOSE ||
    !row.authorization_reference
  ) return null;
  const authorizationScopeType = row.source_type === "athlete_opt_in" || row.source_type === "guardian_opt_in"
    ? "individual" as const
    : row.source_type === "national_authorized_contact" || row.source_type === "national_blind_relay"
      ? "national" as const
      : row.source_type === "lsc_authorized_contact" || row.source_type === "lsc_blind_relay"
        ? "lsc" as const
        : "club" as const;
  const authorizationScopeCode = authorizationScopeType === "lsc"
    ? normalizeLscCode(row.authorization_scope_code)
    : authorizationScopeType === "club"
      ? normalizeClubCode(row.authorization_scope_code)
      : null;
  if (
    (authorizationScopeType === "individual" || authorizationScopeType === "national") &&
    row.authorization_scope_code != null
  ) return null;
  if (authorizationScopeType !== "individual") {
    const hasExactAgreement = agreements.some((agreement) =>
      agreement.agreement_reference === row.authorization_reference &&
      agreement.scope_type === authorizationScopeType &&
      (authorizationScopeType === "national"
        ? agreement.scope_code == null
        : authorizationScopeType === "lsc"
          ? normalizeLscCode(agreement.scope_code) === authorizationScopeCode
          : normalizeClubCode(agreement.scope_code) === authorizationScopeCode));
    const scopedCodeMissing = authorizationScopeType !== "national" && !authorizationScopeCode;
    if (
      process.env.CONTACT_ROUTE_AGREEMENT_CONFIRMED !== "true" ||
      scopedCodeMissing ||
      !hasExactAgreement
    ) return null;
  }
  try {
    const parsed = contactGrantRouteCandidateSchema.safeParse({
      routeId: row.id,
      destinationVersion: row.email_hash,
      memberId: row.member_id,
      contactName: row.contact_name,
      relationship: row.relationship,
      contactEmail: decryptContactRouteEmail(row.email_ciphertext),
      sourceType: row.source_type,
      purpose: CONTACT_ROUTE_PURPOSE,
      identityVerificationMethod: row.identity_verification_method,
      identityVerifiedAt: row.identity_verified_at,
      contactVerifiedAt: row.verified_at,
      authorizationBasis: row.authorization_basis,
      authorizationScopeType,
      authorizationScopeCode,
      authorizationReference: row.authorization_reference,
      authorizedAt: row.authorized_at,
      consentVersion: row.consent_version,
      consentCapturedAt: row.consented_at,
      provenanceReference: row.source_record_id,
      provenanceUrl: row.source_url,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    });
    if (!parsed.success) throw new ContactRouteResolutionError();
    return parsed.data;
  } catch {
    throw new ContactRouteResolutionError();
  }
}

function relayCandidate(row: RelayRow, agreements: readonly AgreementRow[]): OrganizationRelayRouteCandidate | null {
  if (!row.source_record_id) return null;
  if (
    (row.source_type === "written_agreement" || row.rights_basis === "written_agreement") &&
    (process.env.CONTACT_ROUTE_AGREEMENT_CONFIRMED !== "true" ||
      !agreements.some((agreement) =>
        agreement.agreement_reference === row.source_record_id &&
        (agreement.scope_type === "national" ||
          (agreement.scope_type === row.scope_type && agreement.scope_code === row.scope_code))))
  ) return null;
  try {
    const parsed = organizationRelayRouteCandidateSchema.safeParse({
      routeId: row.id,
      destinationVersion: row.email_hash,
      scopeType: row.scope_type,
      scopeCode: row.scope_code,
      organizationName: row.organization_name,
      adultContactName: row.contact_name,
      adultContactRole: row.contact_role,
      contactEmail: decryptContactRouteEmail(row.email_ciphertext),
      sourceType: row.source_type,
      rightsBasis: row.rights_basis,
      sourceRecordId: row.source_record_id,
      sourceUrl: row.source_url,
      verifiedAt: row.verified_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    });
    if (!parsed.success) throw new ContactRouteResolutionError();
    return parsed.data;
  } catch {
    throw new ContactRouteResolutionError();
  }
}

type IdentityAssertionRow = {
  recruit_id: string;
  member_id: string | null;
  lsc_code: string | null;
  club_code: string | null;
  expires_at: string | null;
};

function directRouteIsAttested(
  recruit: ContactRouteRecruit,
): recruit is ContactRouteRecruit & {
  directContactSource: WorkspaceDirectContactSource;
  directRightsAttestedAt: string;
} {
  return Boolean(
    recruit.directRightsAttestedAt &&
    isWorkspaceDirectContactSource(recruit.directContactSource),
  );
}

export async function resolveContactRoutes(
  workspaceId: string,
  recruits: readonly ContactRouteRecruit[],
  now = new Date(),
): Promise<Map<string, SelectedContactRoute>> {
  const admin = createAdminClient();
  const recruitIds = [...new Set(recruits.map((recruit) => recruit.id))];
  const assertionPages = await Promise.all(chunks(recruitIds).map(async (page) => {
    if (page.length === 0) return [] as IdentityAssertionRow[];
    const { data, error } = await admin
      .from("recruit_contact_identity_assertions")
      .select("recruit_id,member_id,lsc_code,club_code,expires_at")
      .eq("workspace_id", workspaceId)
      .in("recruit_id", page)
      .lte("verified_at", now.toISOString())
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .is("revoked_at", null);
    if (error) throw new ContactRouteResolutionError();
    return (data ?? []) as IdentityAssertionRow[];
  }));
  const assertions = new Map(assertionPages.flat().map((row) => [row.recruit_id, row]));
  const memberIds = [...new Set([...assertions.values()].map((row) => normalizeContactMemberId(row.member_id)).filter((value): value is string => Boolean(value)))];
  const organizationAssertions = [...assertions.values()].filter((row) => row.expires_at != null);
  const lscCodes = [...new Set(organizationAssertions.map((row) => normalizeLscCode(row.lsc_code)).filter((value): value is string => Boolean(value)))];
  const clubCodes = [...new Set(organizationAssertions.map((row) => normalizeClubCode(row.club_code)).filter((value): value is string => Boolean(value)))];
  const organizationCodes = [...new Set([...lscCodes, ...clubCodes])];
  const directEmails = [...new Set(recruits
    .filter(directRouteIsAttested)
    .map((recruit) => normalizeContactEmail(recruit.directEmail))
    .filter((value): value is string => Boolean(value)))];

  const [grantPages, relayPages, suppressions, agreementRows] = await Promise.all([
    Promise.all(chunks(memberIds).map(async (page) => {
      if (page.length === 0) return [] as GrantRow[];
      const { data, error } = await admin
        .from("recruit_contact_grants")
        .select(GRANT_SELECT)
        .in("member_id", page)
        .eq("active", true)
        .is("opted_out_at", null)
        .is("revoked_at", null)
        .gt("expires_at", now.toISOString());
      if (error) throw new ContactRouteResolutionError();
      return (data ?? []) as unknown as GrantRow[];
    })),
    Promise.all(chunks(organizationCodes).map(async (page) => {
      if (page.length === 0) return [] as RelayRow[];
      const { data, error } = await admin
        .from("organization_relay_contacts")
        .select(RELAY_SELECT)
        .in("scope_code", page)
        .eq("active", true)
        .is("opted_out_at", null)
        .is("revoked_at", null)
        .gt("expires_at", now.toISOString());
      if (error) throw new ContactRouteResolutionError();
      return (data ?? []) as unknown as RelayRow[];
    })),
    directEmails.length === 0
      ? Promise.resolve([] as { email: string }[])
      : admin
          .from("email_suppressions")
          .select("email")
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .then(({ data, error }) => {
            if (error) throw new ContactRouteResolutionError();
            return (data ?? []) as { email: string }[];
          }),
    admin
      .from("contact_route_agreements")
      .select("agreement_reference,scope_type,scope_code")
      .eq("purpose_scope", CONTACT_ROUTE_PURPOSE)
      .lte("effective_at", now.toISOString())
      .gt("expires_at", now.toISOString())
      .is("revoked_at", null)
      .then(({ data, error }) => {
        if (error) throw new ContactRouteResolutionError();
        return (data ?? []) as AgreementRow[];
      }),
  ]);

  const protectedHashes = [...new Set([
    ...grantPages.flat().map((row) => row.email_hash),
    ...relayPages.flat().map((row) => row.email_hash),
  ])];
  const protectedSuppressionPages = await Promise.all(chunks(protectedHashes).map(async (page) => {
    if (page.length === 0) return [] as { email_hash: string }[];
    const { data, error } = await admin
      .from("contact_route_suppressions")
      .select("email_hash")
      .in("email_hash", page)
      .eq("active", true);
    if (error) throw new ContactRouteResolutionError();
    return (data ?? []) as { email_hash: string }[];
  }));
  const protectedSuppressions = new Set(
    protectedSuppressionPages.flat().map((row) => row.email_hash),
  );

  const grantsByMember = new Map<string, ContactGrantRouteCandidate[]>();
  for (const row of grantPages.flat()) {
    if (protectedSuppressions.has(row.email_hash)) continue;
    const candidate = grantCandidate(row, agreementRows);
    if (!candidate) continue;
    const key = normalizeContactMemberId(candidate.memberId);
    if (!key) continue;
    const existing = grantsByMember.get(key) ?? [];
    existing.push(candidate);
    grantsByMember.set(key, existing);
  }

  const relaysByScope = new Map<string, OrganizationRelayRouteCandidate[]>();
  for (const row of relayPages.flat()) {
    if (protectedSuppressions.has(row.email_hash)) continue;
    const candidate = relayCandidate(row, agreementRows);
    if (!candidate) continue;
    const code = candidate.scopeType === "lsc"
      ? normalizeLscCode(candidate.scopeCode)
      : normalizeClubCode(candidate.scopeCode);
    if (!code) continue;
    const key = `${candidate.scopeType}:${code}`;
    const existing = relaysByScope.get(key) ?? [];
    existing.push(candidate);
    relaysByScope.set(key, existing);
  }
  const suppressed = new Set(suppressions.map((row) => normalizeContactEmail(row.email)).filter(Boolean));

  const result = new Map<string, SelectedContactRoute>();
  for (const recruit of recruits) {
    const assertion = assertions.get(recruit.id);
    const memberId = normalizeContactMemberId(assertion?.member_id);
    const organizationScopeIsFresh = assertion?.expires_at != null;
    const lscCode = organizationScopeIsFresh ? normalizeLscCode(assertion?.lsc_code) : null;
    const clubCode = organizationScopeIsFresh ? normalizeClubCode(assertion?.club_code) : null;
    let direct: WorkspaceDirectRouteCandidate | null = null;
    if (directRouteIsAttested(recruit)) {
      const directEmail = normalizeContactEmail(recruit.directEmail);
      if (directEmail) {
        direct = {
          routeId: recruit.id,
          workspaceId,
          recruitId: recruit.id,
          contactEmail: directEmail,
          contactName: recruit.directContactName,
          relationship: recruit.directRelationship ?? "unknown",
          sourceType: recruit.directContactSource,
          rightsAttestedAt: recruit.directRightsAttestedAt,
          suppressedAt: suppressed.has(directEmail) ? now.toISOString() : null,
        };
      }
    }
    result.set(recruit.id, resolveContactRoute({
      workspaceId,
      recruitId: recruit.id,
      memberId,
      lscCode,
      clubCode,
      workspaceDirect: direct,
      contactGrants: memberId ? grantsByMember.get(memberId) : null,
      organizationRelays: [
        ...(lscCode ? relaysByScope.get(`lsc:${lscCode}`) ?? [] : []),
        ...(clubCode ? relaysByScope.get(`club:${clubCode}`) ?? [] : []),
      ],
      now,
    }));
  }
  return result;
}

export async function publicContactRoutes(
  workspaceId: string,
  recruits: readonly ContactRouteRecruit[],
  now = new Date(),
): Promise<Map<string, PublicContactRouteDto>> {
  const routes = await resolveContactRoutes(workspaceId, recruits, now);
  return new Map([...routes].map(([recruitId, route]) => [recruitId, toPublicContactRouteDto(route)]));
}

export async function hasVerifiedCoachAuthority(input: {
  userId: string;
  workspaceId: string;
  athleticProgramId: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const { data, error } = await createAdminClient()
    .from("coach_authority_verifications")
    .select("id")
    .eq("user_id", input.userId)
    .eq("workspace_id", input.workspaceId)
    .eq("athletic_program_id", input.athleticProgramId)
    .is("revoked_at", null)
    .lte("verified_at", now.toISOString())
    .gt("expires_at", now.toISOString())
    .limit(1);
  return !error && Boolean(data?.length);
}
