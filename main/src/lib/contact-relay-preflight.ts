import "server-only";

import { domainToASCII } from "node:url";
import { createAdminClient } from "./supabase/admin";

const MAX_ALLOWLIST_LENGTH = 20_000;
const MAX_ALLOWLIST_DOMAINS = 500;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const CONTACT_RELAY_SENDER_PREFLIGHT_REQUIRED =
  "Protected relay sending requires a connected institutional mailbox whose exact domain has passed aligned-DKIM forwarding preflight.";

type ContactRelaySenderIdentity = {
  senderEmail: string;
  hostedDomain: string | null;
};

type ContactRelaySenderConnection = {
  connectionId: string;
  workspaceId: string;
  ownerUserId: string;
  expectedSenderEmail?: string;
};

function canonicalDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) return null;
  const withoutRootDot = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  if (!withoutRootDot || withoutRootDot.endsWith(".")) return null;

  let ascii: string;
  try {
    ascii = domainToASCII(withoutRootDot).toLowerCase();
  } catch {
    return null;
  }
  return DOMAIN_PATTERN.test(ascii) ? ascii : null;
}

function normalizedSenderEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (
    separator <= 0 ||
    separator !== normalized.indexOf("@") ||
    separator === normalized.length - 1
  ) return null;
  const domain = canonicalDomain(normalized.slice(separator + 1));
  return domain ? `${normalized.slice(0, separator)}@${domain}` : null;
}

function configuredPreflightDomains(rawValue: string | undefined): ReadonlySet<string> | null {
  if (!rawValue || rawValue.length > MAX_ALLOWLIST_LENGTH) return null;
  const entries = rawValue.split(",").map((entry) => entry.trim());
  if (
    entries.length === 0 ||
    entries.length > MAX_ALLOWLIST_DOMAINS ||
    entries.some((entry) => entry.length === 0)
  ) return null;

  const domains = new Set<string>();
  for (const entry of entries) {
    const domain = canonicalDomain(entry);
    if (!domain) return null;
    domains.add(domain);
  }
  return domains.size > 0 ? domains : null;
}

export function isContactRelaySenderPreflightApproved(
  identity: ContactRelaySenderIdentity,
  configuredDomains = process.env.CONTACT_RELAY_DKIM_PREFLIGHT_DOMAINS,
): boolean {
  const senderEmail = normalizedSenderEmail(identity.senderEmail);
  const hostedDomain = canonicalDomain(identity.hostedDomain);
  const approvedDomains = configuredPreflightDomains(configuredDomains);
  if (!senderEmail || !hostedDomain || !approvedDomains) return false;

  const senderDomain = senderEmail.slice(senderEmail.lastIndexOf("@") + 1);
  return senderDomain === hostedDomain && approvedDomains.has(senderDomain);
}

export async function hasApprovedContactRelaySenderConnection(
  input: ContactRelaySenderConnection,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_sender_connections")
      .select("sender_email,hosted_domain")
      .eq("id", input.connectionId)
      .eq("workspace_id", input.workspaceId)
      .eq("owner_user_id", input.ownerUserId)
      .eq("status", "connected")
      .maybeSingle();
    if (error || !data) return false;

    const senderEmail = normalizedSenderEmail(data.sender_email);
    if (!senderEmail) return false;
    if (input.expectedSenderEmail) {
      const expectedSenderEmail = normalizedSenderEmail(input.expectedSenderEmail);
      if (!expectedSenderEmail || expectedSenderEmail !== senderEmail) return false;
    }
    return isContactRelaySenderPreflightApproved({
      senderEmail,
      hostedDomain: typeof data.hosted_domain === "string" ? data.hosted_domain : null,
    });
  } catch {
    return false;
  }
}
