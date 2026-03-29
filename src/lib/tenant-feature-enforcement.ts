import { hasFeature, type EntitlementFeature } from "@/core/entitlements/engine";

export const FEATURE_LOCKED_MESSAGE =
  "Bu özelliğe erişmek için lütfen Çatal App ile iletişime geçin.";
export const GENERIC_CLOSED_FEATURE_MESSAGE =
  "Bu özellik sizde kapalı, lütfen satıcınıza ulaşınız!";

export function getClosedFeatureMessage(): string {
  return GENERIC_CLOSED_FEATURE_MESSAGE;
}

export async function isTenantFeatureEnabled(
  tenantId: number,
  feature: EntitlementFeature,
): Promise<boolean> {
  return hasFeature(tenantId, feature);
}

export async function ensureTenantFeatureEnabled(
  tenantId: number,
  feature: EntitlementFeature,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const enabled = await isTenantFeatureEnabled(tenantId, feature);
  if (!enabled) {
    return { ok: false, message: FEATURE_LOCKED_MESSAGE };
  }
  return { ok: true };
}
