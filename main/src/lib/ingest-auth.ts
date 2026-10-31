import "server-only";

import { timingSafeEqual } from "node:crypto";
import { isSwimsIngestionLicensed } from "./swims-license";


export type IngestGate = {
  job: string;
  secretEnvNames: readonly string[];
};

function isScheduledRequest(request: Request): boolean {
  return (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
}

function refuse(request: Request, job: string, status: number, code: string, error: string): Response {
  if (isScheduledRequest(request)) {
    console.error(`[ingest:${job}] scheduled run refused (${code}): ${error}`);
  }
  return Response.json({ ok: false, code, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function sameSecret(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export function refuseUnlicensedIngest(request: Request, gate: IngestGate): Response | null {
  if (!isSwimsIngestionLicensed()) {
    return refuse(
      request,
      gate.job,
      503,
      "license_not_confirmed",
      "Third-party ingestion is disabled pending confirmed written authorization. Set SWIMS_INGESTION_LICENSE_CONFIRMED=true only once written rights are on file.",
    );
  }

  const expected = gate.secretEnvNames
    .map((name) => process.env[name]?.trim())
    .filter((value): value is string => Boolean(value));
  if (expected.length === 0) {
    return refuse(
      request,
      gate.job,
      503,
      "secret_not_configured",
      `Scheduled ingestion is not configured: set ${gate.secretEnvNames.join(" or ")} for this environment and redeploy. Vercel attaches the cron Authorization header only once CRON_SECRET exists as a project environment variable; it is never generated for you.`,
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supplied || !expected.some((secret) => sameSecret(supplied, secret))) {
    return refuse(
      request,
      gate.job,
      401,
      "unauthorized",
      `Bearer secret missing or incorrect. Scheduled runs send ${gate.secretEnvNames[0]}; confirm the deployed value matches the one this environment reads.`,
    );
  }

  return null;
}
