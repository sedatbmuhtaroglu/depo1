/**
 * Public /legal/* sayfaları için MarketingSiteConfig.legalPublicPages JSON şeması.
 */

export const LEGAL_PUBLIC_PAGES_VERSION = 1 as const;

export type LegalPublicPagesV1 = {
  version: typeof LEGAL_PUBLIC_PAGES_VERSION;
  kullaniciSozlesmesiHtml: string;
  kvkkHtml: string;
  gizlilikHtml: string;
};

export type LegalPageKey = keyof Omit<LegalPublicPagesV1, "version">;

export function parseLegalPublicPagesJson(raw: unknown): LegalPublicPagesV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== LEGAL_PUBLIC_PAGES_VERSION) return null;
  const kullaniciSozlesmesiHtml =
    typeof o.kullaniciSozlesmesiHtml === "string" ? o.kullaniciSozlesmesiHtml : "";
  const kvkkHtml = typeof o.kvkkHtml === "string" ? o.kvkkHtml : "";
  const gizlilikHtml = typeof o.gizlilikHtml === "string" ? o.gizlilikHtml : "";
  if (!kullaniciSozlesmesiHtml.trim() && !kvkkHtml.trim() && !gizlilikHtml.trim()) {
    return null;
  }
  return {
    version: LEGAL_PUBLIC_PAGES_VERSION,
    kullaniciSozlesmesiHtml,
    kvkkHtml,
    gizlilikHtml,
  };
}

export function mergeLegalPublicPagesWithDefaults(
  stored: LegalPublicPagesV1 | null,
  defaults: LegalPublicPagesV1,
): LegalPublicPagesV1 {
  if (!stored) return defaults;
  return {
    version: LEGAL_PUBLIC_PAGES_VERSION,
    kullaniciSozlesmesiHtml: stored.kullaniciSozlesmesiHtml.trim()
      ? stored.kullaniciSozlesmesiHtml
      : defaults.kullaniciSozlesmesiHtml,
    kvkkHtml: stored.kvkkHtml.trim() ? stored.kvkkHtml : defaults.kvkkHtml,
    gizlilikHtml: stored.gizlilikHtml.trim() ? stored.gizlilikHtml : defaults.gizlilikHtml,
  };
}

export function hasStoredLegalOverrides(stored: LegalPublicPagesV1 | null): boolean {
  if (!stored) return false;
  return (
    stored.kullaniciSozlesmesiHtml.trim().length > 0 ||
    stored.kvkkHtml.trim().length > 0 ||
    stored.gizlilikHtml.trim().length > 0
  );
}
