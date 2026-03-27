import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getPiiEncryptionKeyCurrent, getPiiEncryptionKeyPrevious } from "@/lib/pii/pii-env";

/** Versioned authenticated ciphertext (AES-256-GCM, random 12-byte IV per value). */
export const PII_CIPHERTEXT_PREFIX = "pii:v1:";

export function isPiiCiphertext(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(PII_CIPHERTEXT_PREFIX));
}

function encryptWithKey(plainUtf8: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainUtf8, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PII_CIPHERTEXT_PREFIX}${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function encryptPiiValue(plainUtf8: string, key: Buffer): string {
  const text = plainUtf8.trim();
  if (!text) return "";
  return encryptWithKey(text, key);
}

export function decryptPiiValueWithKey(ciphertext: string, key: Buffer): string | null {
  const trimmed = ciphertext.trim();
  if (!trimmed || !isPiiCiphertext(trimmed)) return null;
  const payload = trimmed.slice(PII_CIPHERTEXT_PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const authTag = Buffer.from(tagB64, "base64url");
    const encrypted = Buffer.from(dataB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return decrypted.trim() || null;
  } catch {
    return null;
  }
}

/** Decrypt with current key, then previous (rotation). */
export function decryptPiiValue(ciphertext: string | null | undefined): string | null {
  const trimmed = ciphertext?.trim();
  if (!trimmed) return null;
  if (!isPiiCiphertext(trimmed)) return trimmed;

  const current = getPiiEncryptionKeyCurrent();
  if (current) {
    const v = decryptPiiValueWithKey(trimmed, current);
    if (v !== null) return v;
  }
  const previous = getPiiEncryptionKeyPrevious();
  if (previous) {
    return decryptPiiValueWithKey(trimmed, previous);
  }
  return null;
}
