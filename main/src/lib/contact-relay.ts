import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { contactRelayAliasHash } from "./contact-route-crypto";

const RELAY_LOCAL_PREFIX = "r-";
const RELAY_TOKEN = /^[a-f0-9]{48}$/;
const RELAY_LIFETIME_MS = 72 * 60 * 60 * 1000;

const relayDomainSchema = z.string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    "Use a fully-qualified relay domain.",
  );

export type ContactRelayConfig = {
  domain: string;
  resolverKey: Buffer;
};

export type ContactRelayAlias = {
  address: string;
  tokenHash: string;
  deliveryId: string;
  expiresAt: string;
};

export function getContactRelayConfig(): ContactRelayConfig | null {
  if (process.env.CONTACT_RELAY_DELIVERY_ENABLED !== "true") return null;
  const domain = relayDomainSchema.safeParse(process.env.CONTACT_RELAY_DOMAIN);
  const resolverSecret = process.env.CONTACT_RELAY_RESOLVER_SECRET?.trim() ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(resolverSecret)) return null;
  let resolverKey: Buffer;
  try {
    resolverKey = Buffer.from(resolverSecret, "base64");
  } catch {
    return null;
  }
  if (!domain.success || resolverKey.length !== 32 || resolverKey.toString("base64") !== resolverSecret) return null;
  return { domain: domain.data, resolverKey };
}

export function isContactRelayDeliveryConfigured(): boolean {
  return getContactRelayConfig() !== null;
}

export function createContactRelayAlias(now = new Date()): ContactRelayAlias {
  const config = getContactRelayConfig();
  if (!config || !Number.isFinite(now.getTime())) {
    throw new Error("Opaque contact relay delivery is not configured.");
  }
  const token = randomBytes(24).toString("hex");
  return {
    address: `${RELAY_LOCAL_PREFIX}${token}@${config.domain}`,
    tokenHash: contactRelayAliasHash(token),
    deliveryId: randomBytes(18).toString("base64url"),
    expiresAt: new Date(now.getTime() + RELAY_LIFETIME_MS).toISOString(),
  };
}

export function contactRelayAliasTokenHash(address: string): string | null {
  const config = getContactRelayConfig();
  if (!config) return null;
  const normalized = address.trim().toLowerCase();
  const suffix = `@${config.domain}`;
  if (!normalized.endsWith(suffix)) return null;
  const local = normalized.slice(0, -suffix.length);
  if (!local.startsWith(RELAY_LOCAL_PREFIX)) return null;
  const token = local.slice(RELAY_LOCAL_PREFIX.length);
  return RELAY_TOKEN.test(token) ? contactRelayAliasHash(token) : null;
}

export function verifyContactRelayResolverRequest(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  now?: Date;
}): boolean {
  const config = getContactRelayConfig();
  const timestamp = input.timestamp?.trim() ?? "";
  const signature = input.signature?.trim().toLowerCase() ?? "";
  const now = input.now ?? new Date();
  if (!config || !/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }
  const numeric = Number(timestamp);
  const timestampMs = timestamp.length === 10 ? numeric * 1000 : numeric;
  if (!Number.isFinite(timestampMs) || !Number.isFinite(now.getTime()) || Math.abs(now.getTime() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }
  const expected = createHmac("sha256", config.resolverKey)
    .update(`${timestamp}.${input.rawBody}`, "utf8")
    .digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
