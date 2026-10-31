import "server-only";

import { createHash } from "node:crypto";
import type { SelectedContactRoute } from "./contact-route-core";

type SendableContactRoute = Exclude<SelectedContactRoute, { kind: "none" }>;

export const OUTREACH_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

export type OutreachIdempotencyInput = {
  workspaceId: string;
  actorUserId: string;
  connectionId: string;
  campaignId: string;
  recruitId: string;
  templateId: string;
  routeKind: SendableContactRoute["kind"];
  routeId: string;
  destinationVersion: string;
  contentSha256: string;
};

export function outreachRouteDestinationVersion(route: SendableContactRoute): string {
  return route.kind === "workspace_direct"
    ? createHash("sha256").update(route.destinationEmail.trim().toLowerCase(), "utf8").digest("hex")
    : route.destinationVersion;
}

export function createOutreachIdempotencyKey(
  input: OutreachIdempotencyInput,
  now = new Date(),
): string {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) throw new Error("A valid idempotency timestamp is required.");
  const windowBucket = Math.floor(timestamp / OUTREACH_IDEMPOTENCY_WINDOW_MS);
  return createHash("sha256")
    .update(JSON.stringify([
      input.workspaceId,
      input.actorUserId,
      input.connectionId,
      input.campaignId,
      input.recruitId,
      input.templateId,
      input.routeKind,
      input.routeId,
      input.destinationVersion,
      input.contentSha256,
      windowBucket,
    ]), "utf8")
    .digest("hex");
}
