import { createHmac } from "node:crypto";
import { getPiiBlindIndexKey } from "@/lib/pii/pii-env";

/** Domain separation for HMAC inputs (email vs phone vs contactName). */
export type PiiBlindDomain = "email" | "phone" | "contactName";

/**
 * HMAC-SHA256(normalizedValue) as 64-char hex — exact-match lookup only.
 */
export function blindIndexHex(domain: PiiBlindDomain, normalizedValue: string): string {
  const key = getPiiBlindIndexKey();
  if (!key) {
    throw new Error("[PII] Blind index key missing; set PII_BLIND_INDEX_KEY or dev fallback.");
  }
  const payload = `${domain}:${normalizedValue}`;
  return createHmac("sha256", key).update(payload, "utf8").digest("hex");
}

/** When keys unavailable (e.g. misconfigured dev), skip hash lookup instead of throwing. */
export function blindIndexHexOrNull(domain: PiiBlindDomain, normalizedValue: string): string | null {
  const key = getPiiBlindIndexKey();
  if (!key) return null;
  const payload = `${domain}:${normalizedValue}`;
  return createHmac("sha256", key).update(payload, "utf8").digest("hex");
}
