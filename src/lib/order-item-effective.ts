export type OrderItemQuantityAdjustmentRow = {
  orderId: number;
  productId: number;
  quantity: number;
};

export function buildOrderItemAdjustmentMap(
  rows: OrderItemQuantityAdjustmentRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const orderId = Number(row.orderId);
    const productId = Number(row.productId);
    const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (!Number.isFinite(orderId) || orderId <= 0) continue;
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (quantity <= 0) continue;
    const key = `${orderId}:${productId}`;
    map.set(key, (map.get(key) ?? 0) + quantity);
  }
  return map;
}

export function getEffectiveOrderItemQuantity(params: {
  orderId: number;
  productId: number;
  originalQuantity: number;
  cancellationMap?: Map<string, number>;
  cashAdjustmentMap?: Map<string, number>;
}): number {
  const orderId = Number(params.orderId);
  const productId = Number(params.productId);
  const originalQuantity = Math.max(0, Math.floor(Number(params.originalQuantity) || 0));
  if (!Number.isFinite(orderId) || orderId <= 0) return 0;
  if (!Number.isFinite(productId) || productId <= 0) return 0;
  if (originalQuantity <= 0) return 0;

  const key = `${orderId}:${productId}`;
  const cancelledQuantity = params.cancellationMap?.get(key) ?? 0;
  const cashAdjustedQuantity = params.cashAdjustmentMap?.get(key) ?? 0;
  return Math.max(0, originalQuantity - cancelledQuantity - cashAdjustedQuantity);
}
