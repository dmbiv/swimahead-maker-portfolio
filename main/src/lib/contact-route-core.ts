import { z } from "zod";
import { escapeEmailHtml } from "./email-content";
import {
  WORKSPACE_DIRECT_CONTACT_SOURCES,
  type WorkspaceDirectContactSource,
} from "./workspace-contact-provenance";

export const CONTACT_ROUTE_PURPOSE = "college_recruiting_one_to_one" as const;

const ORGANIZATION_CODE = /^[A-Z0-9]{2,8}$/;
const MEMBER_ID = /^[A-Z0-9]{6,20}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const DESTINATION_VERSION = /^[a-f0-9]{64}$/;

const isoDateTimeSchema = z.string().datetime({ offset: true });
const routeIdSchema = z.string().trim().min(1).max(200).refine(
  (value) => !CONTROL_CHARACTER.test(value),
  "Route IDs cannot contain control characters.",
);
const boundedLabel = (maximum: number) => z.string().trim().min(2).max(maximum).refine(
  (value) => !CONTROL_CHARACTER.test(value),
  "This field cannot contain control characters.",
);

export const clubCodeSchema = z.string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(ORGANIZATION_CODE, "Use the exact 2-8 character alphanumeric club code."));

export const lscCodeSchema = z.string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(ORGANIZATION_CODE, "Use the exact 2-8 character alphanumeric LSC code."));

export const contactMemberIdSchema = z.string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(MEMBER_ID, "Use the exact 6-20 character alphanumeric member ID."));

export const contactEmailSchema = z.string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().email().max(320));

const httpsUrlSchema = z.string().trim().max(2_048).url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an HTTPS URL without embedded credentials.");

export function normalizeClubCode(value: string | null | undefined): string | null {
  const parsed = clubCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeLscCode(value: string | null | undefined): string | null {
  const parsed = lscCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeContactMemberId(value: string | null | undefined): string | null {
  const parsed = contactMemberIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeContactEmail(value: string | null | undefined): string | null {
  const parsed = contactEmailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const relaySourceTypeSchema = z.enum([
  "lsc_submitted",
  "club_submitted",
  "manual_verified",
  "written_agreement",
]);

export const relayRightsBasisSchema = z.enum([
  "lsc_submission",
  "club_submission",
  "operator_verified_official_source",
  "written_agreement",
]);

export const relayScopeTypeSchema = z.enum(["lsc", "club"]);

const relayRecordFields = {
  scopeType: relayScopeTypeSchema,
  scopeCode: z.string().transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(ORGANIZATION_CODE, "Use the exact 2-8 character organization code.")),
  organizationName: boundedLabel(160),
  adultContactName: boundedLabel(160),
  adultContactRole: boundedLabel(160),
  contactEmail: contactEmailSchema,
  sourceType: relaySourceTypeSchema,
  rightsBasis: relayRightsBasisSchema,
  sourceRecordId: z.string().trim().min(1).max(255).refine(
    (value) => !CONTROL_CHARACTER.test(value),
    "The source record ID cannot contain control characters.",
  ),
  sourceUrl: httpsUrlSchema.nullable().optional(),
  verifiedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  revokedAt: isoDateTimeSchema.nullable().optional(),
};

type RelayRecordShape = z.infer<ReturnType<typeof relayRecordBaseSchema>>;

function relayRecordBaseSchema() {
  return z.object(relayRecordFields).strict();
}

function refineRelayRecord(record: RelayRecordShape, context: z.RefinementCtx): void {
  const coherentRights =
    (record.scopeType === "lsc" && record.sourceType === "lsc_submitted" && record.rightsBasis === "lsc_submission") ||
    (record.scopeType === "club" && record.sourceType === "club_submitted" && record.rightsBasis === "club_submission") ||
    (record.sourceType === "written_agreement" && record.rightsBasis === "written_agreement") ||
    (record.sourceType === "manual_verified" &&
      (record.rightsBasis === "operator_verified_official_source" ||
        record.rightsBasis === "written_agreement"));

  if (!coherentRights) {
    context.addIssue({
      code: "custom",
      path: ["rightsBasis"],
      message: "The rights basis does not authorize this relay source type.",
    });
  }

  const verifiedAt = Date.parse(record.verifiedAt);
  const expiresAt = Date.parse(record.expiresAt);
  if (expiresAt <= verifiedAt) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Relay expiry must be after verification.",
    });
  }
  if (record.revokedAt && Date.parse(record.revokedAt) < verifiedAt) {
    context.addIssue({
      code: "custom",
      path: ["revokedAt"],
      message: "Relay revocation cannot predate verification.",
    });
  }
}

export const importedRelayRecordSchema = relayRecordBaseSchema().superRefine(refineRelayRecord);
export type ImportedRelayRecord = z.infer<typeof importedRelayRecordSchema>;

export const organizationRelayRouteCandidateSchema = z.object({
  ...relayRecordFields,
  routeId: routeIdSchema,
  destinationVersion: z.string().regex(DESTINATION_VERSION),
}).strict().superRefine(refineRelayRecord);
export type OrganizationRelayRouteCandidate = z.infer<typeof organizationRelayRouteCandidateSchema>;

export const contactGrantRelationshipSchema = z.enum(["athlete", "parent_guardian"]);
export const contactGrantSourceTypeSchema = z.enum([
  "athlete_opt_in",
  "guardian_opt_in",
  "national_authorized_contact",
  "national_blind_relay",
  "lsc_authorized_contact",
  "lsc_blind_relay",
  "club_authorized_contact",
  "club_blind_relay",
]);
export const identityVerificationMethodSchema = z.enum([
  "operator_review",
  "national_member_assertion",
  "national_member_sso",
  "lsc_member_assertion",
  "club_member_assertion",
]);
export const contactAuthorizationBasisSchema = z.enum([
  "individual_consent",
  "written_national_agreement",
  "written_lsc_agreement",
  "written_club_agreement",
]);
export const contactAuthorizationScopeTypeSchema = z.enum(["individual", "national", "lsc", "club"]);

const contactGrantFields = {
  memberId: contactMemberIdSchema,
  contactName: boundedLabel(160),
  relationship: contactGrantRelationshipSchema,
  contactEmail: contactEmailSchema,
  sourceType: contactGrantSourceTypeSchema,
  purpose: z.literal(CONTACT_ROUTE_PURPOSE),
  identityVerificationMethod: identityVerificationMethodSchema,
  identityVerifiedAt: isoDateTimeSchema,
  contactVerifiedAt: isoDateTimeSchema,
  authorizationBasis: contactAuthorizationBasisSchema,
  authorizationScopeType: contactAuthorizationScopeTypeSchema,
  authorizationScopeCode: z.string().transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(ORGANIZATION_CODE)).nullable().optional(),
  authorizationReference: z.string().trim().min(1).max(255).refine(
    (value) => !CONTROL_CHARACTER.test(value),
    "The authorization reference cannot contain control characters.",
  ),
  authorizedAt: isoDateTimeSchema,
  consentVersion: z.string().trim().min(1).max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).nullable().optional(),
  consentCapturedAt: isoDateTimeSchema.nullable().optional(),
  provenanceReference: z.string().trim().min(1).max(255).refine(
    (value) => !CONTROL_CHARACTER.test(value),
    "The provenance reference cannot contain control characters.",
  ),
  provenanceUrl: httpsUrlSchema.nullable().optional(),
  expiresAt: isoDateTimeSchema,
  revokedAt: isoDateTimeSchema.nullable().optional(),
};

type ContactGrantShape = z.infer<ReturnType<typeof contactGrantBaseSchema>>;

function contactGrantBaseSchema() {
  return z.object(contactGrantFields).strict();
}

function grantSourceAndRelationshipAreCoherent(grant: ContactGrantShape): boolean {
  if (grant.sourceType === "athlete_opt_in") return grant.relationship === "athlete";
  if (grant.sourceType === "guardian_opt_in") return grant.relationship === "parent_guardian";
  return true;
}

function grantSourceAndVerificationAreCoherent(grant: ContactGrantShape): boolean {
  if (grant.sourceType === "national_authorized_contact" || grant.sourceType === "national_blind_relay") {
    return grant.authorizationBasis === "written_national_agreement" &&
      grant.authorizationScopeType === "national" &&
      grant.authorizationScopeCode == null &&
      grant.identityVerificationMethod === "national_member_assertion";
  }
  if (grant.sourceType === "lsc_authorized_contact" || grant.sourceType === "lsc_blind_relay") {
    return grant.authorizationBasis === "written_lsc_agreement" &&
      grant.authorizationScopeType === "lsc" &&
      Boolean(grant.authorizationScopeCode) &&
      grant.identityVerificationMethod === "lsc_member_assertion";
  }
  if (grant.sourceType === "club_authorized_contact" || grant.sourceType === "club_blind_relay") {
    return grant.authorizationBasis === "written_club_agreement" &&
      grant.authorizationScopeType === "club" &&
      Boolean(grant.authorizationScopeCode) &&
      grant.identityVerificationMethod === "club_member_assertion";
  }
  return grant.authorizationBasis === "individual_consent" &&
    grant.authorizationScopeType === "individual" &&
    grant.authorizationScopeCode == null &&
    (grant.identityVerificationMethod === "operator_review" ||
      grant.identityVerificationMethod === "national_member_sso");
}

function refineContactGrant(grant: ContactGrantShape, context: z.RefinementCtx): void {
  if (!grantSourceAndRelationshipAreCoherent(grant)) {
    context.addIssue({
      code: "custom",
      path: ["relationship"],
      message: "The relationship does not match the grant source.",
    });
  }
  if (!grantSourceAndVerificationAreCoherent(grant)) {
    context.addIssue({
      code: "custom",
      path: ["identityVerificationMethod"],
      message: "The identity verification method does not match the grant source.",
    });
  }

  const isIndividualConsent = grant.authorizationBasis === "individual_consent";
  if (isIndividualConsent && (!grant.consentVersion || !grant.consentCapturedAt)) {
    context.addIssue({
      code: "custom",
      path: ["consentCapturedAt"],
      message: "Versioned affirmative consent is required for an individual grant.",
    });
  }
  if (!isIndividualConsent && (grant.consentVersion || grant.consentCapturedAt)) {
    context.addIssue({
      code: "custom",
      path: ["consentVersion"],
      message: "An organizational agreement must not be represented as individual consent.",
    });
  }

  const contactVerifiedAt = Date.parse(grant.contactVerifiedAt);
  const evidenceTimes = [
    {
      field: "identityVerifiedAt",
      timestamp: Date.parse(grant.identityVerifiedAt),
      message: "Identity verification cannot follow contact verification.",
    },
    {
      field: "authorizedAt",
      timestamp: Date.parse(grant.authorizedAt),
      message: "Authorization cannot follow contact verification.",
    },
    ...(grant.consentCapturedAt
      ? [{
          field: "consentCapturedAt",
          timestamp: Date.parse(grant.consentCapturedAt),
          message: "Consent capture cannot follow contact verification.",
        }]
      : []),
  ];
  for (const evidence of evidenceTimes) {
    if (evidence.timestamp > contactVerifiedAt) {
      context.addIssue({
        code: "custom",
        path: [evidence.field],
        message: evidence.message,
      });
    }
  }

  const authorizationTimes = [
    contactVerifiedAt,
    ...evidenceTimes.map((evidence) => evidence.timestamp),
  ];
  const expiresAt = Date.parse(grant.expiresAt);
  if (authorizationTimes.some((timestamp) => expiresAt <= timestamp)) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Grant expiry must be after identity, contact, and authorization verification.",
    });
  }
  if (grant.revokedAt && Date.parse(grant.revokedAt) < Date.parse(grant.authorizedAt)) {
    context.addIssue({
      code: "custom",
      path: ["revokedAt"],
      message: "Grant revocation cannot predate authorization.",
    });
  }
}

export const contactGrantImportSchema = contactGrantBaseSchema().superRefine(refineContactGrant);
export type ContactGrantImport = z.infer<typeof contactGrantImportSchema>;

export const contactGrantRouteCandidateSchema = z.object({
  ...contactGrantFields,
  routeId: routeIdSchema,
  destinationVersion: z.string().regex(DESTINATION_VERSION),
}).strict().superRefine(refineContactGrant);
export type ContactGrantRouteCandidate = z.infer<typeof contactGrantRouteCandidateSchema>;

export const workspaceDirectRouteCandidateSchema = z.object({
  routeId: routeIdSchema,
  workspaceId: z.string().trim().min(1).max(200),
  recruitId: z.string().trim().min(1).max(200),
  contactEmail: contactEmailSchema,
  contactName: z.string().trim().min(1).max(160).nullable().optional(),
  relationship: z.enum(["athlete", "parent_guardian", "unknown"]).default("unknown"),
  sourceType: z.enum(WORKSPACE_DIRECT_CONTACT_SOURCES),
  rightsAttestedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema.nullable().optional(),
  revokedAt: isoDateTimeSchema.nullable().optional(),
  suppressedAt: isoDateTimeSchema.nullable().optional(),
}).strict();
export type WorkspaceDirectRouteCandidate = z.infer<typeof workspaceDirectRouteCandidateSchema>;

export type SelectedContactRoute =
  | {
      kind: "workspace_direct";
      routeId: string;
      destinationEmail: string;
      contactName: string | null;
      relationship: "athlete" | "parent_guardian" | "unknown";
      sourceType: WorkspaceDirectContactSource;
    }
  | {
      kind: "contact_grant";
      routeId: string;
      destinationEmail: string;
      contactName: string;
      relationship: z.infer<typeof contactGrantRelationshipSchema>;
      sourceType: z.infer<typeof contactGrantSourceTypeSchema>;
      authorizationScopeType: z.infer<typeof contactAuthorizationScopeTypeSchema>;
      authorizationScopeCode: string | null;
      destinationVersion: string;
    }
  | {
      kind: "organization_relay";
      routeId: string;
      destinationEmail: string;
      scopeType: "lsc" | "club";
      scopeCode: string;
      organizationName: string;
      adultContactName: string;
      adultContactRole: string;
      destinationVersion: string;
    }
  | { kind: "none" };

export type ResolveContactRouteInput = {
  workspaceId: string;
  recruitId: string;
  memberId: string | null | undefined;
  lscCode?: string | null;
  clubCode?: string | null;
  workspaceDirect?: WorkspaceDirectRouteCandidate | null;
  contactGrants?: readonly (ContactGrantRouteCandidate | null | undefined)[] | null;
  organizationRelays?: readonly (OrganizationRelayRouteCandidate | null | undefined)[] | null;
  now?: Date;
};

function activeThrough(expiresAt: string | null | undefined, now: number): boolean {
  if (expiresAt == null) return true;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

function authorizationIsCurrent(grant: ContactGrantRouteCandidate, now: number): boolean {
  if (grant.revokedAt) return false;
  const timestamps = [
    Date.parse(grant.identityVerifiedAt),
    Date.parse(grant.contactVerifiedAt),
    Date.parse(grant.authorizedAt),
    ...(grant.consentCapturedAt ? [Date.parse(grant.consentCapturedAt)] : []),
  ];
  return timestamps.every((timestamp) => Number.isFinite(timestamp) && timestamp <= now) &&
    activeThrough(grant.expiresAt, now);
}

export function resolveContactRoute(input: ResolveContactRouteInput): SelectedContactRoute {
  const now = (input.now ?? new Date()).getTime();
  const memberId = normalizeContactMemberId(input.memberId);
  const lscCode = normalizeLscCode(input.lscCode);
  const clubCode = normalizeClubCode(input.clubCode);
  if (!Number.isFinite(now) || !input.workspaceId || !input.recruitId) return { kind: "none" };

  const direct = workspaceDirectRouteCandidateSchema.safeParse(input.workspaceDirect);
  if (
    direct.success &&
    direct.data.workspaceId === input.workspaceId &&
    direct.data.recruitId === input.recruitId &&
    Date.parse(direct.data.rightsAttestedAt) <= now &&
    !direct.data.revokedAt &&
    !direct.data.suppressedAt &&
    activeThrough(direct.data.expiresAt, now)
  ) {
    return {
      kind: "workspace_direct",
      routeId: direct.data.routeId,
      destinationEmail: direct.data.contactEmail,
      contactName: direct.data.contactName ?? null,
      relationship: direct.data.relationship,
      sourceType: direct.data.sourceType,
    };
  }

  const grants = (input.contactGrants ?? [])
    .flatMap((candidate) => {
      const parsed = contactGrantRouteCandidateSchema.safeParse(candidate);
      return memberId && parsed.success && parsed.data.memberId === memberId &&
        (parsed.data.authorizationScopeType === "individual" ||
          parsed.data.authorizationScopeType === "national" ||
          (parsed.data.authorizationScopeType === "lsc" && parsed.data.authorizationScopeCode === lscCode) ||
          (parsed.data.authorizationScopeType === "club" && parsed.data.authorizationScopeCode === clubCode)) &&
        authorizationIsCurrent(parsed.data, now)
        ? [parsed.data]
        : [];
    })
    .sort((left, right) => {
      const scopePriority = (scope: ContactGrantRouteCandidate["authorizationScopeType"]) =>
        ({ individual: 0, national: 1, lsc: 2, club: 3 })[scope];
      const authorityPriority = scopePriority(left.authorizationScopeType) - scopePriority(right.authorizationScopeType);
      if (authorityPriority) return authorityPriority;
      const relationshipPriority = Number(right.relationship === "parent_guardian") -
        Number(left.relationship === "parent_guardian");
      if (relationshipPriority) return relationshipPriority;
      const expiryPriority = Date.parse(right.expiresAt) - Date.parse(left.expiresAt);
      return expiryPriority || left.routeId.localeCompare(right.routeId);
    });

  const grant = grants[0];
  if (grant) {
    return {
      kind: "contact_grant",
      routeId: grant.routeId,
      destinationEmail: grant.contactEmail,
      contactName: grant.contactName,
      relationship: grant.relationship,
      sourceType: grant.sourceType,
      authorizationScopeType: grant.authorizationScopeType,
      authorizationScopeCode: grant.authorizationScopeCode ?? null,
      destinationVersion: grant.destinationVersion,
    };
  }

  if (!lscCode && !clubCode) return { kind: "none" };
  const relays = (input.organizationRelays ?? [])
    .flatMap((candidate) => {
      const parsed = organizationRelayRouteCandidateSchema.safeParse(candidate);
      if (!parsed.success || parsed.data.revokedAt) return [];
      const exactScopeMatch = parsed.data.scopeType === "lsc"
        ? parsed.data.scopeCode === lscCode
        : parsed.data.scopeCode === clubCode;
      if (!exactScopeMatch) return [];
      const verifiedAt = Date.parse(parsed.data.verifiedAt);
      return verifiedAt <= now && activeThrough(parsed.data.expiresAt, now) ? [parsed.data] : [];
    })
    .sort((left, right) => {
      const scopePriority = Number(left.scopeType === "lsc") - Number(right.scopeType === "lsc");
      if (scopePriority) return -scopePriority;
      const verificationPriority = Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt);
      return verificationPriority || left.routeId.localeCompare(right.routeId);
    });

  const relay = relays[0];
  return relay
    ? {
        kind: "organization_relay",
        routeId: relay.routeId,
        destinationEmail: relay.contactEmail,
        scopeType: relay.scopeType,
        scopeCode: relay.scopeCode,
        organizationName: relay.organizationName,
        adultContactName: relay.adultContactName,
        adultContactRole: relay.adultContactRole,
        destinationVersion: relay.destinationVersion,
      }
    : { kind: "none" };
}

type PublicSensitiveFieldGuard = {
  email?: never;
  contactEmail?: never;
  destinationEmail?: never;
  encryptedEmail?: never;
  emailCiphertext?: never;
  emailHash?: never;
  ciphertext?: never;
  hash?: never;
};

export type PublicContactRouteDto = PublicSensitiveFieldGuard & (
  | {
      kind: "workspace_direct";
      available: true;
      delivery: "direct";
      routeId: string;
      relationship: "athlete" | "parent_guardian" | "unknown";
      label: "Direct contact available" | "Athlete contact available" | "Parent or guardian contact available";
    }
  | {
      kind: "protected_contact";
      available: true;
      delivery: "relay";
      routeId: null;
      relationship?: never;
      scopeType?: never;
      scopeCode?: never;
      organizationName?: never;
      label: "Protected contact route available";
    }
  | {
      kind: "protected_introduction";
      available: true;
      delivery: "relay";
      routeId: null;
      relationship?: never;
      scopeType?: never;
      scopeCode?: never;
      organizationName?: never;
      label: "Protected introduction route available";
    }
  | {
      kind: "none";
      available: false;
      delivery: "none";
      routeId: null;
      label: "Contact route unavailable";
    }
);

export function toPublicContactRouteDto(route: SelectedContactRoute): PublicContactRouteDto {
  if (route.kind === "workspace_direct") {
    return {
      kind: "workspace_direct",
      available: true,
      delivery: "direct",
      routeId: route.routeId,
      relationship: route.relationship,
      label: route.relationship === "athlete"
        ? "Athlete contact available"
        : route.relationship === "parent_guardian"
          ? "Parent or guardian contact available"
          : "Direct contact available",
    };
  }
  if (route.kind === "contact_grant") {
    return {
      kind: "protected_contact",
      available: true,
      delivery: "relay",
      routeId: null,
      label: "Protected contact route available",
    };
  }
  if (route.kind === "organization_relay") {
    return {
      kind: "protected_introduction",
      available: true,
      delivery: "relay",
      routeId: null,
      label: "Protected introduction route available",
    };
  }
  return {
    kind: "none",
    available: false,
    delivery: "none",
    routeId: null,
    label: "Contact route unavailable",
  };
}

const relayMessageInputSchema = z.object({
  adultContactName: boundedLabel(160),
  scopeType: relayScopeTypeSchema,
  organizationName: boundedLabel(160),
  coachName: boundedLabel(160),
  collegeProgramName: boundedLabel(200),
  recruitName: boundedLabel(160),
  renderedRecruitMessageHtml: z.string().max(200_000).refine((value) => Boolean(value.trim())),
  renderedRecruitMessageText: z.string().max(200_000).refine((value) => Boolean(value.trim())),
  optOutEmail: contactEmailSchema,
}).strict();

export type OrganizationRelayMessageInput = z.input<typeof relayMessageInputSchema>;
export type OrganizationRelayMessage = { subject: string; html: string; text: string };

function singleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function buildOrganizationRelayMessage(
  input: OrganizationRelayMessageInput,
): OrganizationRelayMessage {
  const parsed = relayMessageInputSchema.parse(input);
  const adultContactName = singleLine(parsed.adultContactName);
  const organizationName = singleLine(parsed.organizationName);
  const coachName = singleLine(parsed.coachName);
  const collegeProgramName = singleLine(parsed.collegeProgramName);
  const recruitName = singleLine(parsed.recruitName);
  const optOutEmail = parsed.optOutEmail;
  const subject = `One-to-one recruiting introduction request for ${recruitName} - ${collegeProgramName}`;

  const html = [
    `<p>Hello ${escapeEmailHtml(adultContactName)},</p>`,
    `<p>I'm ${escapeEmailHtml(coachName)} with ${escapeEmailHtml(collegeProgramName)}. I'm sending one one-to-one college recruiting message for ${escapeEmailHtml(recruitName)}.</p>`,
    `<p>Please forward the enclosed message to ${escapeEmailHtml(recruitName)} or their parent or guardian, or reply to this email if you can make an introduction. Please do not send their private contact details to SwimAhead.</p>`,
    "<hr>",
    `<div>${parsed.renderedRecruitMessageHtml.trim()}</div>`,
    "<hr>",
    `<p>If you are not the right adult business contact at ${escapeEmailHtml(organizationName)}, please reply to let me know.</p>`,
    `<p>To stop receiving these one-to-one introduction requests, contact <a href="mailto:${escapeEmailHtml(optOutEmail)}">${escapeEmailHtml(optOutEmail)}</a>.</p>`,
  ].join("");

  const text = [
    `Hello ${adultContactName},`,
    `I'm ${coachName} with ${collegeProgramName}. I'm sending one one-to-one college recruiting message for ${recruitName}.`,
    `Please forward the enclosed message to ${recruitName} or their parent or guardian, or reply to this email if you can make an introduction. Please do not send their private contact details to SwimAhead.`,
    "--- Enclosed recruiting message ---",
    parsed.renderedRecruitMessageText.trim(),
    "--- End enclosed message ---",
    `If you are not the right adult business contact at ${organizationName}, please reply to let me know.`,
    `To stop receiving these one-to-one introduction requests, contact ${optOutEmail}.`,
  ].join("\n\n");

  return { subject, html, text };
}
