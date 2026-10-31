import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const REQUEST_TIMEOUT_MS = 15_000;

export const EMAIL_OAUTH_PROVIDERS = ["google", "microsoft"] as const;
export type EmailOAuthProvider = (typeof EMAIL_OAUTH_PROVIDERS)[number];

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Send",
] as const;

type OAuthProviderConfig = {
  provider: EmailOAuthProvider;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: readonly string[];
};

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
};

export type OAuthProviderIdentity = {
  providerAccountId: string;
  email: string;
  displayName: string;
  hostedDomain: string | null;
};

export class EmailOAuthConfigurationError extends Error {
  constructor(provider: EmailOAuthProvider) {
    super(`${provider} email connection is not configured.`);
    this.name = "EmailOAuthConfigurationError";
  }
}

export class EmailOAuthProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: { code: string; retryable?: boolean }) {
    super(message);
    this.name = "EmailOAuthProviderError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.coerce.number().int().positive().max(86_400).default(3600),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const googleIdentitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().email().max(320),
  email_verified: z.boolean(),
  name: z.string().max(200).optional(),
  hd: z.string().max(255).optional(),
});

const microsoftIdentitySchema = z.object({
  id: z.string().min(1).max(255),
  displayName: z.string().max(200).optional().nullable(),
  mail: z.string().email().max(320).optional().nullable(),
  userPrincipalName: z.string().email().max(320),
});

function microsoftTenant(): string {
  const value = process.env.MICROSOFT_EMAIL_TENANT?.trim() || "organizations";
  if (value === "organizations" || /^[0-9a-f-]{36}$/i.test(value) || /^[a-z0-9.-]+$/i.test(value)) {
    return value;
  }
  return "organizations";
}

export function isEmailOAuthProvider(value: string): value is EmailOAuthProvider {
  return EMAIL_OAUTH_PROVIDERS.includes(value as EmailOAuthProvider);
}

export function getEmailOAuthConfig(provider: EmailOAuthProvider): OAuthProviderConfig | null {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_EMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_EMAIL_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      scopes: GOOGLE_SCOPES,
    };
  }

  const clientId = process.env.MICROSOFT_EMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_EMAIL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const tenant = encodeURIComponent(microsoftTenant());
  return {
    provider,
    clientId,
    clientSecret,
    authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes: MICROSOFT_SCOPES,
  };
}

function requireConfig(provider: EmailOAuthProvider): OAuthProviderConfig {
  const config = getEmailOAuthConfig(provider);
  if (!config) throw new EmailOAuthConfigurationError(provider);
  return config;
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function createCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function oauthStateHash(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function buildEmailAuthorizationUrl(input: {
  provider: EmailOAuthProvider;
  state: string;
  challenge: string;
  redirectUri: string;
  loginHint?: string | null;
}): string {
  const config = requireConfig(input.provider);
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);

  if (input.provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
  } else {
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("prompt", "select_account");
  }
  return url.toString();
}

async function tokenRequest(provider: EmailOAuthProvider, body: URLSearchParams): Promise<OAuthTokenSet> {
  const config = requireConfig(provider);
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);

  let response: Response;
  try {
    response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new EmailOAuthProviderError("The email provider token service could not be reached.", {
      code: "token_network_error",
      retryable: true,
    });
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof payload === "object" && payload && "error" in payload
      ? String(payload.error).replace(/[^a-z0-9_]+/gi, "_").toLowerCase().slice(0, 80)
      : `token_http_${response.status}`;
    throw new EmailOAuthProviderError("The email provider rejected the authorization request.", {
      code,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const parsed = tokenResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new EmailOAuthProviderError("The email provider returned an invalid token response.", {
      code: "invalid_token_response",
    });
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString(),
    scopes: (parsed.data.scope || config.scopes.join(" ")).split(/\s+/).filter(Boolean),
  };
}

export function exchangeEmailAuthorizationCode(input: {
  provider: EmailOAuthProvider;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<OAuthTokenSet> {
  return tokenRequest(input.provider, new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
  }));
}

export function refreshEmailAccessToken(input: {
  provider: EmailOAuthProvider;
  refreshToken: string;
}): Promise<OAuthTokenSet> {
  const config = requireConfig(input.provider);
  return tokenRequest(input.provider, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    scope: config.scopes.join(" "),
  }));
}

export async function fetchEmailProviderIdentity(
  provider: EmailOAuthProvider,
  accessToken: string,
): Promise<OAuthProviderIdentity> {
  const endpoint = provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName";

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new EmailOAuthProviderError("The connected account profile could not be loaded.", {
      code: "identity_network_error",
      retryable: true,
    });
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new EmailOAuthProviderError("The connected account profile was rejected.", {
      code: `identity_http_${response.status}`,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  if (provider === "google") {
    const parsed = googleIdentitySchema.safeParse(payload);
    if (!parsed.success || !parsed.data.email_verified) {
      throw new EmailOAuthProviderError("Google did not return a verified email identity.", {
        code: "unverified_google_identity",
      });
    }
    return {
      providerAccountId: parsed.data.sub,
      email: parsed.data.email.toLowerCase(),
      displayName: parsed.data.name ?? parsed.data.email,
      hostedDomain: parsed.data.hd ?? null,
    };
  }

  const parsed = microsoftIdentitySchema.safeParse(payload);
  if (!parsed.success) {
    throw new EmailOAuthProviderError("Microsoft did not return a usable email identity.", {
      code: "invalid_microsoft_identity",
    });
  }
  const email = parsed.data.mail ?? parsed.data.userPrincipalName;
  return {
    providerAccountId: parsed.data.id,
    email: email.toLowerCase(),
    displayName: parsed.data.displayName || email,
    hostedDomain: email.includes("@") ? email.split("@")[1].toLowerCase() : null,
  };
}
