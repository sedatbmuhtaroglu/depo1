import type { EntitlementFeature, EntitlementLimitResource } from "@/core/entitlements/engine";

export type TenantFeatureGroupKey =
  | "MENU"
  | "OPERATIONS"
  | "MANAGEMENT"
  | "FINANCE_PAYMENT"
  | "CALL_LOG"
  | "SHOWCASE"
  | "DOMAIN_PUBLISH"
  | "STOCK"
  | "STAFF"
  | "REPORTING"
  | "OTHER";

export const TENANT_FEATURE_GROUP_LABELS: Record<TenantFeatureGroupKey, string> = {
  MENU: "Menü",
  OPERATIONS: "Operasyon",
  MANAGEMENT: "Yönetim",
  FINANCE_PAYMENT: "Finans / Ödeme",
  CALL_LOG: "Çağrı / Log",
  SHOWCASE: "Vitrin / Gösterim",
  DOMAIN_PUBLISH: "Domain / Yayin",
  STOCK: "Stok",
  STAFF: "Kullanıcı / Personel",
  REPORTING: "Rapor / Performans",
  OTHER: "Diğer",
};

const FEATURE_LABELS: Record<
  EntitlementFeature,
  { label: string; shortLabel: string; group: TenantFeatureGroupKey }
> = {
  QR_MENU_VIEW: { label: "QR Menü Görüntüleme", shortLabel: "QR Menü", group: "MENU" },
  QR_ORDERING: { label: "QR Sipariş", shortLabel: "QR Sipariş", group: "OPERATIONS" },
  ORDER_CANCELLATIONS: { label: "İptaller", shortLabel: "İptaller", group: "OPERATIONS" },
  BILLING_RECEIPTS: {
    label: "Fatura / Fiş",
    shortLabel: "Fatura / Fiş",
    group: "FINANCE_PAYMENT",
  },
  WAITER_CALL_LOGS: {
    label: "Garson Çağrı Logları",
    shortLabel: "Çağrı Logları",
    group: "CALL_LOG",
  },
  SHOWCASE_RAILS: {
    label: "Popüler / Sık Tüketilen Ürünler",
    shortLabel: "Vitrin",
    group: "SHOWCASE",
  },
  STAFF_PERFORMANCE: {
    label: "Personel Performansı",
    shortLabel: "Performans",
    group: "REPORTING",
  },
  ONLINE_PAYMENT_IYZICO: {
    label: "Online Ödeme (İyzico)",
    shortLabel: "Online Ödeme",
    group: "FINANCE_PAYMENT",
  },
  CASH_OPERATIONS: {
    label: "Kasa",
    shortLabel: "Kasa",
    group: "FINANCE_PAYMENT",
  },
  STOCK_MANAGEMENT: {
    label: "Stok / Envanter",
    shortLabel: "Stok",
    group: "STOCK",
  },
  MENU: { label: "Dijital Menü", shortLabel: "Menü", group: "MENU" },
  ORDERING: { label: "Sipariş Altyapısı", shortLabel: "Sipariş Altyapısı", group: "OPERATIONS" },
  WAITER_CALL: { label: "Garson Çağrı", shortLabel: "Garson Çağrı", group: "OPERATIONS" },
  KITCHEN_DISPLAY: { label: "Mutfak Ekranı", shortLabel: "Mutfak", group: "OPERATIONS" },
  INVOICING: { label: "Kasa / Faturalama", shortLabel: "Faturalama", group: "MANAGEMENT" },
  CUSTOM_DOMAIN: { label: "Özel Domain", shortLabel: "Domain", group: "DOMAIN_PUBLISH" },
  ADVANCED_REPORTS: { label: "Gelişmiş Raporlar", shortLabel: "Raporlar", group: "REPORTING" },
  ANALYTICS: { label: "Analitik", shortLabel: "Analitik", group: "REPORTING" },
};

export const LIMIT_LABELS: Record<
  EntitlementLimitResource,
  { label: string; shortLabel: string; summaryPriority: number }
> = {
  USERS: { label: "Kullanici / Personel Limiti", shortLabel: "Kullanicilar", summaryPriority: 1 },
  TABLES: { label: "Masa Limiti", shortLabel: "Masalar", summaryPriority: 2 },
  MENUS: { label: "Menu Limiti", shortLabel: "Menuler", summaryPriority: 3 },
  PRODUCTS: { label: "Urun Limiti", shortLabel: "Urunler", summaryPriority: 4 },
  BRANCHES: { label: "Sube Limiti", shortLabel: "Subeler", summaryPriority: 5 },
  DEVICES: { label: "Cihaz Limiti", shortLabel: "Cihazlar", summaryPriority: 6 },
};

function humanizeCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getFeatureGroupLabel(group: TenantFeatureGroupKey): string {
  return TENANT_FEATURE_GROUP_LABELS[group];
}

export function getFeaturePresentation(input: {
  code: EntitlementFeature;
  fallbackName?: string | null;
}): { label: string; shortLabel: string; group: TenantFeatureGroupKey } {
  const known = FEATURE_LABELS[input.code];
  if (known) return known;
  const fallback = input.fallbackName?.trim();
  const label = fallback && fallback.length > 0 ? fallback : humanizeCode(input.code);
  return { label, shortLabel: label, group: "OTHER" };
}

export function getFeaturePresentationByCode(input: {
  code: string;
  fallbackName?: string | null;
}): { label: string; shortLabel: string; group: TenantFeatureGroupKey } {
  const raw = (input.code ?? "").trim().toUpperCase();
  const known = (FEATURE_LABELS as Record<string, { label: string; shortLabel: string; group: TenantFeatureGroupKey }>)[raw];
  if (known) return known;
  const fallback = input.fallbackName?.trim();
  const label = fallback && fallback.length > 0 ? fallback : humanizeCode(raw);
  return { label, shortLabel: label, group: "OTHER" };
}

export function getLimitPresentation(resource: EntitlementLimitResource) {
  return LIMIT_LABELS[resource];
}

export function formatLimitValue(value: number | null | undefined): string {
  if (value == null) return "Sinirsiz";
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function formatFeatureEnabled(value: boolean): string {
  return value ? "Acik" : "Kapali";
}
