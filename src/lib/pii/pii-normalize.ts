import { formatTrMobileForStorage, parseTrMobileDigits } from "@/modules/marketing/lib/tr-phone";

/** Email: lowercase + trim (RFC-style local part preserved where possible). */
export function normalizeEmailForPii(input: string | null | undefined): string | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

/**
 * Phone (TR-focused): digits-only canonical for mobile; otherwise strip to digits for landline/hash.
 * Stored form aligns with `formatTrMobileForStorage` when valid mobile.
 */
export function normalizePhoneForPii(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const mobile = parseTrMobileDigits(raw);
  if (mobile && /^5[0-9]{9}$/.test(mobile)) {
    return formatTrMobileForStorage(raw).replace(/\s/g, "");
  }
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits.slice(0, 20) : null;
}

/** Tax / national id style: digits only, max 20. */
export function normalizeIdentifierDigits(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(0, 20);
}

/** Contact / person name: trim, collapse spaces, NFC lowercase for stable hash. */
export function normalizeContactNameForPii(input: string | null | undefined): string | null {
  const s = (input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .toLowerCase();
  if (!s) return null;
  return s.slice(0, 200);
}
