import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { warnDevPaymentSecretFallbackOnce } from "./dev-secret-warning";

export const ENCRYPTED_SECRET_PREFIX = "enc:v1:";
export const SECRET_ENCRYPTION_ENV_KEY = "TENANT_PAYMENT_SECRET_KEY";

/** Dev-only: must be exactly "true" to allow local fallback when the env key is missing/invalid. */
export const ALLOW_DEV_PAYMENT_SECRET_FALLBACK_ENV = "ALLOW_DEV_PAYMENT_SECRET_FALLBACK";

const DEV_FALLBACK_KEY = "glidra-local-payment-secret-key!";

let cachedKey: Buffer | null | undefined;

function isDevFallbackExplicitlyAllowed(): boolean {
  return (process.env[ALLOW_DEV_PAYMENT_SECRET_FALLBACK_ENV] ?? "").trim().toLowerCase() === "true";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function resolveRawKey(): string | null {
  const raw = process.env[SECRET_ENCRYPTION_ENV_KEY];
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseKey(raw: string): Buffer | null {
  // 64-char hex key
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // prefix-aware base64 key
  if (raw.startsWith("base64:")) {
    const decoded = Buffer.from(raw.slice("base64:".length), "base64");
    return decoded.length === 32 ? decoded : null;
  }

  // plain base64 or utf8 fallback
  const base64Decoded = Buffer.from(raw, "base64");
  if (base64Decoded.length === 32) {
    return base64Decoded;
  }
  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  return null;
}

function applyDevFallbackBuffer(): Buffer {
  warnDevPaymentSecretFallbackOnce();
  return Buffer.from(DEV_FALLBACK_KEY, "utf8");
}

function getEncryptionKey(): Buffer | null {
  if (cachedKey !== undefined) {
    return cachedKey;
  }

  const raw = resolveRawKey();
  const prod = isProduction();

  if (!raw) {
    if (prod) {
      throw new Error(
        `${SECRET_ENCRYPTION_ENV_KEY} must be set in production (32-byte key: hex, base64:, or raw 32-byte).`,
      );
    }
    if (isDevFallbackExplicitlyAllowed()) {
      cachedKey = applyDevFallbackBuffer();
      return cachedKey;
    }
    cachedKey = null;
    return null;
  }

  const parsed = parseKey(raw);
  if (parsed) {
    cachedKey = parsed;
    return cachedKey;
  }

  if (prod) {
    throw new Error(
      `${SECRET_ENCRYPTION_ENV_KEY} is invalid in production. Use a 32-byte key (hex/base64).`,
    );
  }
  if (isDevFallbackExplicitlyAllowed()) {
    cachedKey = applyDevFallbackBuffer();
    return cachedKey;
  }

  cachedKey = null;
  return null;
}

function requireEncryptionKey(): Buffer {
  const key = getEncryptionKey();
  if (key) {
    return key;
  }
  throw new Error(
    `${SECRET_ENCRYPTION_ENV_KEY} is missing or invalid. Set a 32-byte key (hex/base64), or for local dev only set ${ALLOW_DEV_PAYMENT_SECRET_FALLBACK_ENV}=true.`,
  );
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(ENCRYPTED_SECRET_PREFIX));
}

export function isLegacyPlaintextSecret(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  return !isEncryptedSecret(trimmed);
}

export function hasExplicitSecretEncryptionKey(): boolean {
  const raw = resolveRawKey();
  if (!raw) {
    return false;
  }
  return parseKey(raw) !== null;
}

export function requireExplicitSecretEncryptionKey(): Buffer {
  const raw = resolveRawKey();
  if (!raw) {
    throw new Error(
      `${SECRET_ENCRYPTION_ENV_KEY} is missing or invalid. Use a 32-byte key (hex/base64).`,
    );
  }
  const key = parseKey(raw);
  if (!key) {
    throw new Error(
      `${SECRET_ENCRYPTION_ENV_KEY} is missing or invalid. Use a 32-byte key (hex/base64).`,
    );
  }
  return key;
}

export function canDecryptEncryptedSecrets(): boolean {
  return getEncryptionKey() !== null;
}

export function encryptSecretAtRest(plainText: string): string {
  const text = plainText.trim();
  if (!text) {
    return text;
  }

  const key = requireEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_SECRET_PREFIX}${iv.toString("base64url")}.${authTag.toString(
    "base64url",
  )}.${encrypted.toString("base64url")}`;
}

export function decryptSecretAtRest(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!isEncryptedSecret(trimmed)) {
    return null;
  }

  const key = getEncryptionKey();
  if (!key) {
    return null;
  }

  const payload = trimmed.slice(ENCRYPTED_SECRET_PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    return null;
  }

  try {
    const iv = Buffer.from(ivB64, "base64url");
    const authTag = Buffer.from(tagB64, "base64url");
    const encrypted = Buffer.from(dataB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");

    return decrypted.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Migration helper: decrypt enc:v1 ciphertext with an explicit raw key string (same formats as TENANT_PAYMENT_SECRET_KEY).
 * Does not read process.env; for re-key scripts when rotating TENANT_PAYMENT_SECRET_KEY.
 */
export function decryptEncryptedSecretWithKeyMaterial(
  value: string,
  rawKeyMaterial: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!isEncryptedSecret(trimmed)) {
    return null;
  }
  const key = parseKey(rawKeyMaterial.trim());
  if (!key) {
    return null;
  }

  const payload = trimmed.slice(ENCRYPTED_SECRET_PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    return null;
  }

  try {
    const iv = Buffer.from(ivB64, "base64url");
    const authTag = Buffer.from(tagB64, "base64url");
    const encrypted = Buffer.from(dataB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");

    return decrypted.trim() || null;
  } catch {
    return null;
  }
}
