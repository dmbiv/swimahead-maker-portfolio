import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  contactGrantImportSchema,
  importedRelayRecordSchema,
} from "@/lib/contact-route-core";
import {
  contactRouteEmailHash,
  encryptContactRouteEmail,
} from "@/lib/contact-route-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const MAX_BODY_BYTES = 512 * 1024;
const MAX_RECORDS = 200;
const isoDateTime = z.string().datetime({ offset: true });
const organizationCode = z.string().trim().transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{2,8}$/));

const agreementSchema = z.object({
  agreementReference: z.string().trim().min(1).max(255),
  counterpartyName: z.string().trim().min(2).max(200),
  scopeType: z.enum(["national", "lsc", "club"]),
  scopeCode: organizationCode.nullable().optional(),
  effectiveAt: isoDateTime,
  expiresAt: isoDateTime,
  revokedAt: isoDateTime.nullable().optional(),
}).strict().superRefine((record, context) => {
  if ((record.scopeType === "national") !== (record.scopeCode == null)) {
    context.addIssue({ code: "custom", path: ["scopeCode"], message: "Only LSC and club agreements require an exact scope code." });
  }
  if (Date.parse(record.expiresAt) <= Date.parse(record.effectiveAt)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Agreement expiry must follow its effective date." });
  }
  if (record.revokedAt && Date.parse(record.revokedAt) < Date.parse(record.effectiveAt)) {
    context.addIssue({ code: "custom", path: ["revokedAt"], message: "Agreement revocation cannot predate its effective date." });
  }
});

const coachAuthoritySchema = z.object({
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  athleticProgramId: z.string().uuid(),
  method: z.enum(["institution_email_review", "athletics_staff_directory_review", "manual_contract_review"]),
  evidenceReference: z.string().trim().min(1).max(2_048),
  verifiedAt: isoDateTime,
  expiresAt: isoDateTime,
  revokedAt: isoDateTime.nullable().optional(),
}).strict().superRefine((record, context) => {
  if (Date.parse(record.expiresAt) <= Date.parse(record.verifiedAt)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Authority expiry must follow verification." });
  }
  if (record.revokedAt && Date.parse(record.revokedAt) < Date.parse(record.verifiedAt)) {
    context.addIssue({ code: "custom", path: ["revokedAt"], message: "Authority revocation cannot predate verification." });
  }
});

const requestSchema = z.object({
  agreements: z.array(agreementSchema).max(MAX_RECORDS).default([]),
  coachAuthorities: z.array(coachAuthoritySchema).max(MAX_RECORDS).default([]),
  grants: z.array(contactGrantImportSchema).max(MAX_RECORDS).default([]),
  relays: z.array(importedRelayRecordSchema).max(MAX_RECORDS).default([]),
}).strict().superRefine((value, context) => {
  const total = value.agreements.length + value.coachAuthorities.length + value.grants.length + value.relays.length;
  if (total < 1 || total > MAX_RECORDS) {
    context.addIssue({
      code: "custom",
      path: [],
      message: `Provide between 1 and ${MAX_RECORDS} contact-route records.`,
    });
  }
});

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function sameSecret(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

function authorize(request: Request): Response | null {
  const expected = process.env.CONTACT_ROUTE_IMPORT_SECRET?.trim() ?? "";
  if (expected.length < 32) {
    return json({ ok: false, code: "secret_not_configured" }, 503);
  }
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return supplied && sameSecret(supplied, expected)
    ? null
    : json({ ok: false, code: "unauthorized" }, 401);
}

export async function POST(request: Request): Promise<Response> {
  const refusal = authorize(request);
  if (refusal) return refusal;

  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return json({ ok: false, code: "body_too_large" }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ ok: false, code: "invalid_body" }, 400);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json({ ok: false, code: "body_too_large" }, 413);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, code: "invalid_records" }, 400);
  }

  const agreementRequired = parsed.data.agreements.length > 0 || parsed.data.grants.some((record) =>
    record.authorizationBasis !== "individual_consent",
  ) || parsed.data.relays.some((record) =>
    record.sourceType === "written_agreement" || record.rightsBasis === "written_agreement",
  );
  if (agreementRequired && process.env.CONTACT_ROUTE_AGREEMENT_CONFIRMED !== "true") {
    return json({ ok: false, code: "agreement_not_confirmed" }, 503);
  }

  try {
    const admin = createAdminClient();
    const now = Date.now();
    const payload = {
      agreements: parsed.data.agreements.map((record) => ({
        agreement_reference: record.agreementReference,
        counterparty_name: record.counterpartyName,
        scope_type: record.scopeType,
        scope_code: record.scopeCode ?? null,
        effective_at: record.effectiveAt,
        expires_at: record.expiresAt,
        revoked_at: record.revokedAt ?? null,
      })),
      authorities: parsed.data.coachAuthorities.map((record) => ({
        user_id: record.userId,
        workspace_id: record.workspaceId,
        athletic_program_id: record.athleticProgramId,
        method: record.method,
        evidence_reference: record.evidenceReference,
        verified_at: record.verifiedAt,
        expires_at: record.expiresAt,
        revoked_at: record.revokedAt ?? null,
      })),
      identity_assertions: [],
      grants: parsed.data.grants.map((record) => ({
        member_id: record.memberId,
        contact_name: record.contactName,
        relationship: record.relationship,
        email_ciphertext: encryptContactRouteEmail(record.contactEmail),
        email_hash: contactRouteEmailHash(record.contactEmail),
        source_type: record.sourceType,
        source_record_id: record.provenanceReference,
        source_url: record.provenanceUrl ?? null,
        identity_verification_method: record.identityVerificationMethod,
        identity_verified_at: record.identityVerifiedAt,
        authorization_basis: record.authorizationBasis,
        authorization_scope_code: record.authorizationScopeCode ?? null,
        authorization_reference: record.authorizationReference,
        authorized_at: record.authorizedAt,
        consent_version: record.consentVersion ?? null,
        consented_at: record.consentCapturedAt ?? null,
        verified_at: record.contactVerifiedAt,
        expires_at: record.expiresAt,
        revoked_at: record.revokedAt ?? null,
        active: !record.revokedAt && Date.parse(record.expiresAt) > now,
      })),
      relays: parsed.data.relays.map((record) => ({
        scope_type: record.scopeType,
        scope_code: record.scopeCode,
        organization_name: record.organizationName,
        contact_name: record.adultContactName,
        contact_role: record.adultContactRole,
        email_ciphertext: encryptContactRouteEmail(record.contactEmail),
        email_hash: contactRouteEmailHash(record.contactEmail),
        source_type: record.sourceType,
        rights_basis: record.rightsBasis,
        source_record_id: record.sourceRecordId,
        source_url: record.sourceUrl ?? null,
        verified_at: record.verifiedAt,
        expires_at: record.expiresAt,
        revoked_at: record.revokedAt ?? null,
        active: !record.revokedAt && Date.parse(record.expiresAt) > now,
      })),
    };
    const { error } = await admin.rpc("ingest_contact_routes", { p_payload: payload });
    if (error) throw new Error("contact_route_batch_failed");

    return json({
      ok: true,
      agreementsUpserted: parsed.data.agreements.length,
      coachAuthoritiesUpserted: parsed.data.coachAuthorities.length,
      grantsUpserted: parsed.data.grants.length,
      relaysUpserted: parsed.data.relays.length,
    }, 200);
  } catch {
    return json({ ok: false, code: "upsert_failed" }, 500);
  }
}
