import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

const webhookSchema = z.object({
  type: z.string().min(1).max(100),
  created_at: z.string().datetime({ offset: true }).optional(),
  data: z.object({
    email_id: z.string().min(1).max(200).optional(),
    to: z.array(z.string().max(320)).max(100).optional(),
    created_at: z.string().datetime({ offset: true }).optional(),
    subject: z.string().max(998).optional(),
    bounce: z.object({
      message: z.string().max(2000).optional(),
      type: z.string().max(100).optional(),
      subtype: z.string().max(100).optional(),
    }).passthrough().optional(),
    failed: z.object({
      reason: z.string().max(1000).optional(),
    }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

export type EmailWebhookEvent = z.infer<typeof webhookSchema>;

export type VerifiedEmailWebhook = {
  eventId: string;
  event: EmailWebhookEvent;
};

export class EmailWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailWebhookVerificationError";
  }
}

function signingSecret(): Buffer | null {
  const value = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!value?.startsWith("whsec_")) return null;
  try {
    const decoded = Buffer.from(value.slice("whsec_".length), "base64");
    return decoded.length >= 16 ? decoded : null;
  } catch {
    return null;
  }
}

function signatureCandidates(value: string): Buffer[] {
  return value
    .split(/\s+/)
    .map((part) => part.split(",", 2))
    .filter(([version, signature]) => version === "v1" && Boolean(signature))
    .flatMap(([, signature]) => {
      try {
        const decoded = Buffer.from(signature, "base64");
        return decoded.length > 0 ? [decoded] : [];
      } catch {
        return [];
      }
    });
}

export function verifyEmailWebhook(rawBody: string, headers: Headers): VerifiedEmailWebhook {
  const secret = signingSecret();
  if (!secret) throw new EmailWebhookVerificationError("Webhook verification is not configured.");

  const eventId = headers.get("svix-id")?.trim();
  const timestampValue = headers.get("svix-timestamp")?.trim();
  const signatureValue = headers.get("svix-signature")?.trim();
  if (!eventId || !timestampValue || !signatureValue || eventId.length > 200) {
    throw new EmailWebhookVerificationError("Required webhook headers are missing.");
  }

  const timestamp = Number(timestampValue);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    throw new EmailWebhookVerificationError("The webhook timestamp is outside the allowed window.");
  }

  const expected = createHmac("sha256", secret)
    .update(`${eventId}.${timestampValue}.${rawBody}`)
    .digest();
  const valid = signatureCandidates(signatureValue).some(
    (candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected),
  );
  if (!valid) throw new EmailWebhookVerificationError("The webhook signature is invalid.");

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    throw new EmailWebhookVerificationError("The webhook body is not valid JSON.");
  }

  const parsed = webhookSchema.safeParse(decoded);
  if (!parsed.success) throw new EmailWebhookVerificationError("The webhook payload is invalid.");
  return { eventId, event: parsed.data };
}

export function webhookFailureDetail(event: EmailWebhookEvent): string | null {
  return event.data.failed?.reason ?? event.data.bounce?.message ?? null;
}

export function transactionalEmailEventRow(verified: VerifiedEmailWebhook) {
  const occurredAt = verified.event.created_at ?? verified.event.data.created_at ?? null;
  const recipient = verified.event.data.to?.[0]?.trim().toLowerCase() ?? null;
  return {
    webhook_event_id: verified.eventId,
    provider: "resend" as const,
    event_type: verified.event.type,
    provider_message_id: verified.event.data.email_id ?? null,
    recipient_email: recipient || null,
    payload: verified.event,
    occurred_at: occurredAt,
  };
}
