import type { Prisma } from "@prisma/client";

/**
 * Public menü + sipariş doğrulamasında ortak kullanılan görünürlük filtresi.
 * - `isActive`: menüde gösterilsin mi (stoktan bağımsız)
 * - `visibleFrom` / `visibleUntil`: opsiyonel zaman penceresi
 *
 * İleride HQ modül/limit veya tenant özellik bayrakları eklendiğinde bu helper
 * tek merkezden genişletilebilir (ör. `tenant.features.hideMenu` gibi).
 */
export function getProductMenuVisibilityWhere(
  now: Date = new Date(),
): Prisma.ProductWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }] },
      { OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }] },
    ],
  };
}

/** Ürün oluşturma öncesi HQ / modül limit hook noktası (şimdilik no-op). */
export function assertProductCreateCapability(_tenantId: number): void {
  void _tenantId;
}
