import { z } from "zod";
import {
  contactRelayAliasTokenHash,
  verifyContactRelayResolverRequest,
} from "@/lib/contact-relay";
import { decryptContactRouteEmail } from "@/lib/contact-route-crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 15;

const MAX_BODY_BYTES = 16 * 1024;
const resolverBodySchema = z.object({
  alias: z.string().trim().email().max(320),
  authenticatedFrom: z.string().trim().toLowerCase().email().max(320),
  authentication: z.literal("aligned_dkim_pass"),
  deliveryId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  gatewayMessageId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{7,199}$/),
}).strict();

const resolvedSchema = z.object({
  email_ciphertext: z.string().min(20).max(20_000),
});

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return json({ ok: false, code: "invalid_request" }, 400);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ ok: false, code: "invalid_request" }, 400);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json({ ok: false, code: "invalid_request" }, 400);
  }

  if (!verifyContactRelayResolverRequest({
    rawBody,
    timestamp: request.headers.get("x-swimahead-relay-timestamp"),
    signature: request.headers.get("x-swimahead-relay-signature"),
  })) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, code: "invalid_request" }, 400);
  }
  const parsed = resolverBodySchema.safeParse(decoded);
  if (!parsed.success) return json({ ok: false, code: "invalid_request" }, 400);
  const aliasTokenHash = contactRelayAliasTokenHash(parsed.data.alias);
  if (!aliasTokenHash) return json({ ok: false, code: "route_unavailable" }, 404);

  try {
    const { data, error } = await createAdminClient().rpc("resolve_contact_relay_alias", {
      p_alias_token_hash: aliasTokenHash,
      p_authenticated_sender: parsed.data.authenticatedFrom,
      p_delivery_id: parsed.data.deliveryId,
      p_content_sha256: parsed.data.contentSha256,
      p_gateway_message_id: parsed.data.gatewayMessageId,
    });
    const candidate = Array.isArray(data) ? data[0] : data;
    const resolved = resolvedSchema.safeParse(candidate);
    if (error || !resolved.success) {
      return json({ ok: false, code: "route_unavailable" }, 404);
    }
    const destination = decryptContactRouteEmail(resolved.data.email_ciphertext);
    return json({ ok: true, destination }, 200);
  } catch {
    return json({ ok: false, code: "route_unavailable" }, 404);
  }
}
