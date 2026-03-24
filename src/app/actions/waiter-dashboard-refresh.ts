"use server";

import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { loadWaiterDashboardSnapshot } from "@/lib/waiter-dashboard-snapshot";

export async function refreshWaiterDashboardSnapshot() {
  const { staffId } = await requireWaiterOrManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();
  return loadWaiterDashboardSnapshot({ tenantId, staffId });
}
