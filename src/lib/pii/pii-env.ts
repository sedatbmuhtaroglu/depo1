import { Buffer } from "node:buffer";

/** AES-256-GCM data encryption (32-byte key material). */
export const PII_ENCRYPTION_KEY_CURRENT_ENV = "PII_ENCRYPTION_KEY_CURRENT";
/** Optional: decrypt legacy rows after rotation. */
export const PII_ENCRYPTION_KEY_PREVIOUS_ENV = "PII_ENCRYPTION_KEY_PREVIOUS";
/** HMAC-SHA256 blind index (32-byte key material). */
export const PII_BLIND_INDEX_KEY_ENV = "PII_BLIND_INDEX_KEY";

/** Dev-only: allow fixed test keys when env vars missing (never use in production). */
export const ALLOW_DEV_PII_KEYS_FALLBACK_ENV = "ALLOW_DEV_PII_KEYS_FALLBACK";

const DEV_ENC_FALLBACK = "pii-dev-encryption-key-32bytes!!"; // 32 chars
const DEV_HMAC_FALLBACK = "pii-dev-blind-index-key-32bytes!!"; // 32 chars

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function parseKeyMaterial(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  if (trimmed.startsWith("base64:")) {
    const decoded = Buffer.from(trimmed.slice("base64:".length), "base64");
    return decoded.length === 32 ? decoded : null;
  }
  const b64 = Buffer.from(trimmed, "base64");
  if (b64.length === 32) return b64;
  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) return utf8;
  return null;
}

export function getPiiEncryptionKeyCurrent(): Buffer | null {
  const raw = process.env[PII_ENCRYPTION_KEY_CURRENT_ENV];
  const parsed = raw ? parseKeyMaterial(raw) : null;
  if (parsed) return parsed;
  if (!isProduction() && isDevFallbackAllowed()) {
    return Buffer.from(DEV_ENC_FALLBACK, "utf8");
  }
  return null;
}

export function getPiiEncryptionKeyPrevious(): Buffer | null {
  const raw = process.env[PII_ENCRYPTION_KEY_PREVIOUS_ENV];
  if (!raw?.trim()) return null;
  return parseKeyMaterial(raw);
}

export function getPiiBlindIndexKey(): Buffer | null {
  const raw = process.env[PII_BLIND_INDEX_KEY_ENV];
  const parsed = raw ? parseKeyMaterial(raw) : null;
  if (parsed) return parsed;
  if (!isProduction() && isDevFallbackAllowed()) {
    return Buffer.from(DEV_HMAC_FALLBACK, "utf8");
  }
  return null;
}

function isDevFallbackAllowed(): boolean {
  return (process.env[ALLOW_DEV_PII_KEYS_FALLBACK_ENV] ?? "").trim().toLowerCase() === "true";
}

/**
 * Production: both encryption + blind index keys required for PII writes.
 * Development: fail unless ALLOW_DEV_PII_KEYS_FALLBACK=true or keys set.
 */
export function requirePiiKeysForWrite(): { enc: Buffer; blind: Buffer } {
  const enc = getPiiEncryptionKeyCurrent();
  const blind = getPiiBlindIndexKey();
  if (enc && blind) {
    return { enc, blind };
  }
  if (isProduction()) {
    throw new Error(
      `[PII] ${PII_ENCRYPTION_KEY_CURRENT_ENV} and ${PII_BLIND_INDEX_KEY_ENV} must be set (32-byte: hex, base64:, or raw 32 bytes).`,
    );
  }
  throw new Error(
    `[PII] Set ${PII_ENCRYPTION_KEY_CURRENT_ENV} and ${PII_BLIND_INDEX_KEY_ENV}, or for local dev only set ${ALLOW_DEV_PII_KEYS_FALLBACK_ENV}=true`,
  );
}

export function canDecryptPii(): boolean {
  return getPiiEncryptionKeyCurrent() !== null || getPiiEncryptionKeyPrevious() !== null;
}
