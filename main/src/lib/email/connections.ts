import "server-only";

import { assertWorkspaceAccess, assertWorkspaceWrite, requireAccountType } from "@/lib/auth";
import { configuredSiteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildEmailAuthorizationUrl,
  codeChallenge,
  createCodeVerifier,
  createOAuthState,
  EmailOAuthConfigurationError,
  type EmailOAuthProvider,
  exchangeEmailAuthorizationCode,
  fetchEmailProviderIdentity,
  oauthStateHash,
  refreshEmailAccessToken,
} from "./oauth";
import { decryptEmailToken, encryptEmailToken } from "./token-vault";

export type EmailSenderConnection = {
  id: string;
  workspaceId: string;
  provider: EmailOAuthProvider;
  senderEmail: string;
  displayName: string;
  status: "connected" | "error" | "revoked";
  connectedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  lastErrorCode: string | null;
};

export type ConnectedMailboxSecret = EmailSenderConnection & {
  accessToken: string;
  refreshToken: string | null;
};

type OAuthStateRow = {
  workspace_id: string;
  verifier_ciphertext: string;
  redirect_path: string;
};

type SecretRow = {
  connection_id: string;
  provider: string;
  sender_email: string;
  display_name: string;
  access_token_expires_at: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
};

export class EmailConnectionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "EmailConnectionError";
    this.code = code;
  }
}

function firstRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function redirectUri(provider: EmailOAuthProvider): string {
  const siteUrl = configuredSiteUrl();
  if (!siteUrl) throw new EmailOAuthConfigurationError(provider);
  return `${siteUrl}/api/email/oauth/${provider}/callback`;
}

function safeSettingsPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/c") || value.startsWith("//") || value.includes("\\")) {
    return "/c/settings";
  }
  try {
    const parsed = new URL(value, "https://swimahead.invalid");
    return parsed.origin === "https://swimahead.invalid" &&
      (parsed.pathname === "/c" || parsed.pathname.startsWith("/c/"))
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/c/settings";
  } catch {
    return "/c/settings";
  }
}

function requiredScope(provider: EmailOAuthProvider): string {
  return provider === "google" ? "https://www.googleapis.com/auth/gmail.send" : "Mail.Send";
}

function hasRequiredScope(provider: EmailOAuthProvider, scopes: string[]): boolean {
  const required = requiredScope(provider).toLowerCase();
  return scopes.some((scope) => scope.toLowerCase() === required);
}

export async function beginEmailConnection(input: {
  workspaceId: string;
  provider: EmailOAuthProvider;
  redirectPath?: string | null;
}): Promise<string> {
  const membership = await assertWorkspaceWrite(input.workspaceId);
  const context = await requireAccountType("coach", "/c/settings");
  if (membership.workspaceId !== input.workspaceId) {
    throw new EmailConnectionError("Workspace access denied.", "workspace_access_denied");
  }

  const state = createOAuthState();
  const verifier = createCodeVerifier();
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_email_oauth_connection", {
    p_workspace_id: input.workspaceId,
    p_provider: input.provider,
    p_state_hash: oauthStateHash(state),
    p_verifier_ciphertext: encryptEmailToken(verifier),
    p_redirect_path: safeSettingsPath(input.redirectPath),
  });
  if (error) {
    throw new EmailConnectionError("The connection request could not be saved.", "state_store_failed");
  }

  return buildEmailAuthorizationUrl({
    provider: input.provider,
    state,
    challenge: codeChallenge(verifier),
    redirectUri: redirectUri(input.provider),
    loginHint: context.email || null,
  });
}

export async function consumeEmailConnectionState(input: {
  provider: EmailOAuthProvider;
  state: string;
}): Promise<OAuthStateRow> {
  await requireAccountType("coach", "/c/settings");
  if (!input.state || input.state.length > 500) {
    throw new EmailConnectionError("The email connection expired. Start again.", "invalid_state");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_email_oauth_state", {
    p_provider: input.provider,
    p_state_hash: oauthStateHash(input.state),
  });
  const row = firstRow(data as OAuthStateRow[] | OAuthStateRow | null);
  if (error || !row) {
    throw new EmailConnectionError("The email connection expired. Start again.", "invalid_state");
  }
  await assertWorkspaceWrite(row.workspace_id);
  return row;
}

export async function completeEmailConnection(input: {
  provider: EmailOAuthProvider;
  code: string;
  stateRow: OAuthStateRow;
}): Promise<{ connectionId: string; senderEmail: string; redirectPath: string }> {
  if (!input.code || input.code.length > 5000) {
    throw new EmailConnectionError("The provider did not return an authorization code.", "missing_code");
  }
  await assertWorkspaceWrite(input.stateRow.workspace_id);
  const context = await requireAccountType("coach", "/c/settings");
  const verifier = decryptEmailToken(input.stateRow.verifier_ciphertext);
  const tokens = await exchangeEmailAuthorizationCode({
    provider: input.provider,
    code: input.code,
    verifier,
    redirectUri: redirectUri(input.provider),
  });
  if (!hasRequiredScope(input.provider, tokens.scopes)) {
    throw new EmailConnectionError("The connected account did not grant email sending access.", "scope_missing");
  }
  const identity = await fetchEmailProviderIdentity(input.provider, tokens.accessToken);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("upsert_email_sender_connection", {
    p_actor_user_id: context.userId,
    p_workspace_id: input.stateRow.workspace_id,
    p_provider: input.provider,
    p_provider_account_id: identity.providerAccountId,
    p_sender_email: identity.email,
    p_display_name: identity.displayName,
    p_hosted_domain: identity.hostedDomain,
    p_scopes: tokens.scopes,
    p_access_token_expires_at: tokens.expiresAt,
    p_access_token_ciphertext: encryptEmailToken(tokens.accessToken),
    p_refresh_token_ciphertext: tokens.refreshToken
      ? encryptEmailToken(tokens.refreshToken)
      : null,
  });
  if (error || typeof data !== "string") {
    throw new EmailConnectionError("The connected mailbox could not be saved.", "connection_store_failed");
  }
  return {
    connectionId: data,
    senderEmail: identity.email,
    redirectPath: safeSettingsPath(input.stateRow.redirect_path),
  };
}

export async function listEmailSenderConnections(workspaceId: string): Promise<EmailSenderConnection[]> {
  const membership = await assertWorkspaceAccess(workspaceId);
  const context = await requireAccountType("coach", "/c/settings");
  if (membership.workspaceId !== workspaceId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_sender_connections")
    .select("id,workspace_id,provider,sender_email,display_name,status,connected_at,access_token_expires_at,last_used_at,last_error_code")
    .eq("workspace_id", workspaceId)
    .eq("owner_user_id", context.userId)
    .order("connected_at", { ascending: false });
  if (error) throw new EmailConnectionError("Mailbox connections could not be loaded.", "connection_read_failed");

  return (data ?? []).flatMap((row): EmailSenderConnection[] => {
    if (row.provider !== "google" && row.provider !== "microsoft") return [];
    if (row.status !== "connected" && row.status !== "error" && row.status !== "revoked") return [];
    return [{
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      provider: row.provider,
      senderEmail: String(row.sender_email),
      displayName: String(row.display_name ?? ""),
      status: row.status,
      connectedAt: String(row.connected_at),
      expiresAt: String(row.access_token_expires_at),
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
      lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    }];
  });
}

async function senderSecret(workspaceId: string, connectionId: string): Promise<ConnectedMailboxSecret> {
  await assertWorkspaceWrite(workspaceId);
  const context = await requireAccountType("coach", "/c/settings");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_email_sender_secret", {
    p_actor_user_id: context.userId,
    p_workspace_id: workspaceId,
    p_connection_id: connectionId,
  });
  const row = firstRow(data as SecretRow[] | SecretRow | null);
  if (error || !row || (row.provider !== "google" && row.provider !== "microsoft")) {
    throw new EmailConnectionError("The selected mailbox is unavailable.", "connection_unavailable");
  }
  return {
    id: row.connection_id,
    workspaceId,
    provider: row.provider,
    senderEmail: row.sender_email,
    displayName: row.display_name,
    status: "connected",
    connectedAt: "",
    expiresAt: row.access_token_expires_at,
    lastUsedAt: null,
    lastErrorCode: null,
    accessToken: decryptEmailToken(row.access_token_ciphertext),
    refreshToken: row.refresh_token_ciphertext
      ? decryptEmailToken(row.refresh_token_ciphertext)
      : null,
  };
}

export async function getUsableEmailSender(
  workspaceId: string,
  connectionId: string,
  forceRefresh = false,
): Promise<ConnectedMailboxSecret> {
  const current = await senderSecret(workspaceId, connectionId);
  const expiresSoon = Date.parse(current.expiresAt) <= Date.now() + 2 * 60 * 1000;
  if (!forceRefresh && !expiresSoon) return current;
  if (!current.refreshToken) {
    throw new EmailConnectionError("Reconnect this mailbox before sending.", "refresh_token_missing");
  }

  const tokens = await refreshEmailAccessToken({
    provider: current.provider,
    refreshToken: current.refreshToken,
  });
  if (!hasRequiredScope(current.provider, tokens.scopes)) {
    throw new EmailConnectionError("The mailbox no longer grants email sending access.", "scope_missing");
  }
  const context = await requireAccountType("coach", "/c/settings");
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("refresh_email_sender_secret", {
    p_actor_user_id: context.userId,
    p_workspace_id: workspaceId,
    p_connection_id: connectionId,
    p_access_token_expires_at: tokens.expiresAt,
    p_access_token_ciphertext: encryptEmailToken(tokens.accessToken),
    p_refresh_token_ciphertext: tokens.refreshToken
      ? encryptEmailToken(tokens.refreshToken)
      : null,
    p_scopes: tokens.scopes,
  });
  if (error) throw new EmailConnectionError("The refreshed mailbox could not be saved.", "refresh_store_failed");
  return {
    ...current,
    expiresAt: tokens.expiresAt,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? current.refreshToken,
  };
}

export async function disconnectEmailSender(workspaceId: string, connectionId: string): Promise<void> {
  await assertWorkspaceWrite(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_email_sender_connection", {
    p_workspace_id: workspaceId,
    p_connection_id: connectionId,
  });
  if (error) throw new EmailConnectionError("The mailbox could not be disconnected.", "disconnect_failed");
}
