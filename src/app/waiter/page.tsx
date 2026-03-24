import React from "react";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { loadWaiterDashboardSnapshot } from "@/lib/waiter-dashboard-snapshot";
import WaiterDashboardClient from "./waiter-dashboard-client";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  const { staffId } = await requireWaiterOrManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();
  const snapshot = await loadWaiterDashboardSnapshot({ tenantId, staffId });

  return <WaiterDashboardClient initial={snapshot} staffId={staffId} />;
}
