import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { EmailOAuthProvider } from "./oauth";

const REQUEST_TIMEOUT_MS = 20_000;
const emailAddress = z.string().trim().email().max(320);

export type CoachEmailMessage = {
  senderEmail: string;
  senderName?: string | null;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  deliveryId: string;
  contentSha256: string;
};

export type CoachEmailAccepted = {
  status: "provider_accepted";
  provider: EmailOAuthProvider;
  providerMessageId: string | null;
  providerThreadId: string | null;
};

export class CoachEmailProviderError extends Error {
  readonly code: string;
  readonly disposition: "rejected" | "unknown";
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    message: string,
    options: {
      code: string;
      disposition: "rejected" | "unknown";
      retryable?: boolean;
      status?: number | null;
    },
  ) {
    super(message);
    this.name = "CoachEmailProviderError";
    this.code = options.code;
    this.disposition = options.disposition;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
  }
}

function singleLine(value: string, limit: number): string {
  return [...value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()]
    .slice(0, limit)
    .join("");
}

export function canonicalOutreachSubject(value: string): string {
  return singleLine(value, 500);
}

function encodedHeaderWords(value: string): string[] {
  const words: string[] = [];
  let chunk = "";
  let chunkBytes = 0;

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (chunk && chunkBytes + characterBytes > 45) {
      words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk) {
    words.push(`=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`);
  }
  return words;
}

function subjectHeader(value: string): string {
  const clean = canonicalOutreachSubject(value);
  if (/^[\x20-\x7e]*$/.test(clean)) return `Subject: ${clean}`;
  return ["Subject:", ...encodedHeaderWords(clean).map((word) => ` ${word}`)].join("\r\n");
}

function mailbox(email: string, name?: string | null): string {
  const parsed = emailAddress.safeParse(email);
  if (!parsed.success) throw new Error("A valid sender email address is required.");
  const cleanName = name ? singleLine(name, 200) : "";
  if (!cleanName) return parsed.data;
  if (/^[\x20-\x7e]*$/.test(cleanName)) {
    return `"${cleanName.replace(/(["\\])/g, "\\$1")}" <${parsed.data}>`;
  }
  return [
    ...encodedHeaderWords(cleanName),
    `<${parsed.data}>`,
  ].join("\r\n ");
}

function base64Lines(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export function buildOutreachMime(message: CoachEmailMessage): string {
  const recipient = emailAddress.safeParse(message.recipientEmail);
  if (!recipient.success) throw new Error("A valid recipient email address is required.");
  const subject = canonicalOutreachSubject(message.subject);
  if (!subject) throw new Error("An email subject is required.");
  if (!message.html.trim() || !message.text.trim()) {
    throw new Error("Both HTML and plain-text email content are required.");
  }
  const deliveryId = singleLine(message.deliveryId, 100);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(deliveryId)) {
    throw new Error("A valid delivery ID is required.");
  }
  if (!/^[a-f0-9]{64}$/.test(message.contentSha256)) {
    throw new Error("A valid content digest is required.");
  }

  const boundary = `wr_${randomBytes(18).toString("hex")}`;
  return [
    `From: ${mailbox(message.senderEmail, message.senderName)}`,
    `To: ${recipient.data}`,
    subjectHeader(subject),
    "MIME-Version: 1.0",
    `X-SwimAhead-Delivery-ID: ${deliveryId}`,
    `X-SwimAhead-Content-SHA256: ${message.contentSha256}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(message.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(message.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function normalizedProviderCode(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.replace(/[^a-z0-9_]+/gi, "_").toLowerCase().slice(0, 80)
    : null;
}

function providerCode(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload) {
    if ("error" in payload && typeof payload.error === "object" && payload.error) {
      const error = payload.error;
      if ("errors" in error && Array.isArray(error.errors)) {
        for (const detail of error.errors) {
          if (typeof detail === "object" && detail && "reason" in detail) {
            const reason = normalizedProviderCode(detail.reason);
            if (reason) return reason;
          }
        }
      }
      if ("status" in error) {
        const errorStatus = normalizedProviderCode(error.status);
        if (errorStatus) return errorStatus;
      }
      if ("code" in error) {
        const code = normalizedProviderCode(error.code);
        if (code) return code;
      }
    }
    if ("error" in payload) {
      const error = normalizedProviderCode(payload.error);
      if (error) return error;
    }
    if ("code" in payload) {
      const code = normalizedProviderCode(payload.code);
      if (code) return code;
    }
  }
  return `provider_http_${status}`;
}

function isRetryableThrottle(status: number, code: string): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  const compact = code.replace(/_/g, "");
  return compact === "ratelimitexceeded" ||
    compact === "userratelimitexceeded" ||
    compact === "dailylimitexceeded" ||
    compact === "quotaexceeded" ||
    compact === "resourceexhausted";
}

function providerFailure(payload: unknown, status: number): {
  code: string;
  disposition: "rejected" | "unknown";
  retryable: boolean;
} {
  const code = providerCode(payload, status);
  if (isRetryableThrottle(status, code)) {
    return { code, disposition: "rejected", retryable: true };
  }
  if (status === 408 || status >= 500) {
    return { code, disposition: "unknown", retryable: false };
  }
  return { code, disposition: "rejected", retryable: false };
}

async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CoachEmailProviderError(
      "The provider response was interrupted, so send status is unknown.",
      { code: "provider_network_unknown", disposition: "unknown" },
    );
  }
}

export async function sendOutreachWithProvider(input: {
  provider: EmailOAuthProvider;
  accessToken: string;
  message: CoachEmailMessage;
}): Promise<CoachEmailAccepted> {
  const mime = buildOutreachMime(input.message);
  const authorization = `Bearer ${input.accessToken}`;

  if (input.provider === "google") {
    const response = await providerFetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = providerFailure(payload, response.status);
      throw new CoachEmailProviderError("Google rejected the email request.", {
        ...failure,
        status: response.status,
      });
    }
    const parsed = z.object({
      id: z.string().min(1).max(255),
      threadId: z.string().min(1).max(255).optional(),
    }).safeParse(payload);
    if (!parsed.success) {
      throw new CoachEmailProviderError(
        "Google accepted the request but returned an unreadable receipt.",
        { code: "invalid_google_receipt", disposition: "unknown" },
      );
    }
    return {
      status: "provider_accepted",
      provider: "google",
      providerMessageId: parsed.data.id,
      providerThreadId: parsed.data.threadId ?? null,
    };
  }

  const response = await providerFetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "text/plain",
    },
    body: Buffer.from(mime, "utf8").toString("base64"),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const failure = providerFailure(payload, response.status);
    throw new CoachEmailProviderError("Microsoft rejected the email request.", {
      ...failure,
      status: response.status,
    });
  }
  if (response.status !== 202) {
    throw new CoachEmailProviderError(
      "Microsoft returned an unexpected send receipt.",
      { code: `unexpected_microsoft_${response.status}`, disposition: "unknown" },
    );
  }
  return {
    status: "provider_accepted",
    provider: "microsoft",
    providerMessageId: null,
    providerThreadId: null,
  };
}
