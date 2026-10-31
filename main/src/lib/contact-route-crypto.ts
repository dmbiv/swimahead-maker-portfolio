import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { decryptEmailToken, encryptEmailToken } from "./email/token-vault";

const emailAddress = z.string().trim().email().max(320);

export class ContactRouteHashConfigurationError extends Error {
  constructor() {
    super("Contact-route hashing is not configured.");
    this.name = "ContactRouteHashConfigurationError";
  }
}

function normalizedEmail(value: string): string {
  return emailAddress.parse(value).toLowerCase();
}

function hashKey(): Buffer {
  const configured = process.env.CONTACT_ROUTE_HASH_KEY?.trim();
  if (!configured || !/^[A-Za-z0-9+/]{43}=$/.test(configured)) {
    throw new ContactRouteHashConfigurationError();
  }

  try {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32 && decoded.toString("base64") === configured) return decoded;
  } catch {
  }
  throw new ContactRouteHashConfigurationError();
}

export function encryptContactRouteEmail(value: string): string {
  return encryptEmailToken(normalizedEmail(value));
}

export function decryptContactRouteEmail(envelope: string): string {
  return normalizedEmail(decryptEmailToken(envelope));
}

export function contactRouteEmailHash(value: string): string {
  return createHmac("sha256", hashKey())
    .update(normalizedEmail(value), "utf8")
    .digest("hex");
}

export function contactRelayAliasHash(token: string): string {
  if (!/^[a-f0-9]{48}$/.test(token)) {
    throw new Error("Invalid contact relay token.");
  }
  return createHmac("sha256", hashKey())
    .update(`contact-relay-alias\0${token}`, "utf8")
    .digest("hex");
}
