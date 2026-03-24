import type { WaiterDashboardSnapshotJson } from "@/lib/waiter-dashboard-snapshot";

export type CriticalDiffResult = {
  /** Müşteri oluşturdu; önceki snapshot'ta bu id yoktu (onay bekliyor). */
  newPendingApprovalOrderIds: number[];
  /**
   * Garson/müdür onayı: önceki snapshot'ta pending onaydaydı, şimdi mutfak akışında (PENDING/PREPARING).
   * Sunucu geçişi: PENDING_WAITER_APPROVAL -> PENDING (bkz. update-order-status).
   */
  newlyApprovedToKitchenIds: number[];
  /** Onay kuyruğu yokken doğrudan mutfağa düşen yeni sipariş (aynı id önceki poll'da ne pending ne active değildi). */
  newActiveOrderIds: number[];
  newWaiterCallIds: number[];
  newBillRequestIds: number[];
  newReadyPickupKeys: string[];
};

/**
 * Compares two snapshots (e.g. previous poll vs current poll).
 * "New" means the id/key exists in `next` but not in `prev` — avoids repeat alerts for the same record.
 */
export function diffWaiterCriticalEvents(
  prev: WaiterDashboardSnapshotJson,
  next: WaiterDashboardSnapshotJson,
): CriticalDiffResult {
  const prevPending = new Set(prev.pendingApprovalOrders.map((o) => o.id));
  const prevActive = new Set(prev.activeOrders.map((o) => o.id));
  const prevWaiter = new Set(
    prev.waiterCalls.filter((c) => c.status === "PENDING").map((c) => c.id),
  );
  const prevBill = new Set(
    prev.billRequests.filter((r) => r.status === "PENDING").map((r) => r.id),
  );
  const prevReady = new Set(
    prev.readyForPickup.map((o) => `${o.id}:${o.readyAt ?? ""}`),
  );

  const newPendingApprovalOrderIds = next.pendingApprovalOrders
    .map((o) => o.id)
    .filter((id) => !prevPending.has(id));

  /** Önceki poll'da onay beklerken listedeydi; şimdi active listesinde → onaylandı, mutfağa düştü. */
  const newlyApprovedToKitchenIds = next.activeOrders
    .map((o) => o.id)
    .filter((id) => prevPending.has(id) && !prevActive.has(id));

  const newActiveOrderIds = next.activeOrders
    .map((o) => o.id)
    .filter((id) => !prevActive.has(id) && !prevPending.has(id));

  const newWaiterCallIds = next.waiterCalls
    .filter((c) => c.status === "PENDING")
    .map((c) => c.id)
    .filter((id) => !prevWaiter.has(id));

  const newBillRequestIds = next.billRequests
    .filter((r) => r.status === "PENDING")
    .map((r) => r.id)
    .filter((id) => !prevBill.has(id));

  const nextReadyKeys = next.readyForPickup.map((o) => `${o.id}:${o.readyAt ?? ""}`);
  const newReadyPickupKeys = nextReadyKeys.filter((k) => !prevReady.has(k));

  return {
    newPendingApprovalOrderIds,
    newlyApprovedToKitchenIds,
    newActiveOrderIds,
    newWaiterCallIds,
    newBillRequestIds,
    newReadyPickupKeys,
  };
}
