import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export class TokenVaultConfigurationError extends Error {
  constructor() {
    super("Email token encryption is not configured.");
    this.name = "TokenVaultConfigurationError";
  }
}

export class TokenVaultDecryptionError extends Error {
  constructor() {
    super("The stored email credential could not be decrypted.");
    this.name = "TokenVaultDecryptionError";
  }
}

function decodeKey(value: string): Buffer | null {
  try {
    const key = Buffer.from(value.trim(), "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

function currentKey(): Buffer {
  const value = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  const key = value ? decodeKey(value) : null;
  if (!key) throw new TokenVaultConfigurationError();
  return key;
}

function decryptionKeys(): Buffer[] {
  const keys = [currentKey()];
  const previous = process.env.EMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS
    ?.split(",")
    .map((value) => decodeKey(value))
    .filter((value): value is Buffer => value !== null) ?? [];
  for (const key of previous) {
    if (!keys.some((candidate) => candidate.equals(key))) keys.push(key);
  }
  return keys;
}

export function encryptEmailToken(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty token.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, currentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptEmailToken(envelope: string): string {
  const [version, ivValue, tagValue, ciphertextValue, extra] = envelope.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new TokenVaultDecryptionError();
  }

  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivValue, "base64url");
    tag = Buffer.from(tagValue, "base64url");
    ciphertext = Buffer.from(ciphertextValue, "base64url");
  } catch {
    throw new TokenVaultDecryptionError();
  }
  if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) {
    throw new TokenVaultDecryptionError();
  }

  for (const key of decryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
    }
  }
  throw new TokenVaultDecryptionError();
}
