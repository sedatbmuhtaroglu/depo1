import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { redirect } from "next/navigation";
import { getTenantEntitlements } from "@/core/entitlements/engine";
import { STAFF_VISIBLE_ORDER_FILTER } from "@/lib/order-payment-visibility";
import { getTenantLimitUsageSummary } from "@/lib/tenant-limits";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";
import TableManager from "./table-manager";

export const dynamic = "force-dynamic";

export default async function RestaurantTablesPage() {
  const { tenantId } = await getCurrentTenantOrThrow();

  const [
    restaurants,
    tables,
    activeOrdersByTable,
    limitSummary,
    openBillRequests,
    openWaiterCalls,
    blockedSessions,
    entitlements,
  ] = await Promise.all([
    prisma.restaurant.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
    prisma.table.findMany({
      where: { restaurant: { tenantId } },
      include: { restaurant: true },
      orderBy: { tableNo: "asc" },
    }),
    prisma.order.groupBy({
      by: ["tableId"],
      where: {
        table: { restaurant: { tenantId } },
        status: { in: ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING"] },
        AND: [STAFF_VISIBLE_ORDER_FILTER],
      },
      _count: true,
    }),
    getTenantLimitUsageSummary(tenantId),
    prisma.billRequest.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
      select: { tableId: true },
    }),
    prisma.waiterCall.findMany({
      where: {
        tenantId,
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
      select: { tableId: true },
    }),
    prisma.tableSession.findMany({
      where: {
        tenantId,
        isActive: true,
        blockedUntil: { gt: new Date() },
      },
      select: { tableId: true },
    }),
    getTenantEntitlements(tenantId),
  ]);

  const tableIdsWithActiveOrders = new Set(activeOrdersByTable.map((g) => g.tableId));
  const billRequestTableIds = new Set(openBillRequests.map((row) => row.tableId));
  const waiterCallTableIds = new Set(openWaiterCalls.map((row) => row.tableId));
  const blockedTableIds = new Set(blockedSessions.map((row) => row.tableId));

  const tableBillingMap = new Map(
    await Promise.all(
      tables.map(async (table) => [
        table.id,
        await getTableBillingSnapshot({
          tenantId,
          tableId: table.id,
        }),
      ] as const),
    ),
  );

  if (restaurants.length === 0) {
    redirect("/restaurant");
  }

  const tablesUsageText =
    limitSummary.usage.tables.max == null
      ? `${limitSummary.usage.tables.used}/∞`
      : `${limitSummary.usage.tables.used}/${limitSummary.usage.tables.max}`;
  const activeTableCount = tables.filter((table) => table.isActive).length;
  const attentionTableCount = tables.filter(
    (table) =>
      blockedTableIds.has(table.id) ||
      billRequestTableIds.has(table.id) ||
      waiterCallTableIds.has(table.id),
  ).length;

  return (
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-5 shadow-none" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Masa Operasyonu
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Masa Yönetimi</h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Masaların anlık durumunu izleyin ve hızlı aksiyon alın.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={badgeClasses("neutral")}>
            Toplam <span className="font-semibold text-[color:var(--ui-text-primary)]">{tables.length}</span>
          </span>
          <span className={badgeClasses("success")}>
            Açık <span className="font-semibold text-[color:var(--ui-text-primary)]">{activeTableCount}</span>
          </span>
          <span className={badgeClasses("warning")}>
            Dikkat <span className="font-semibold">{attentionTableCount}</span>
          </span>
          <span className={badgeClasses("neutral")}>
            Kullanım <span className="font-semibold text-[color:var(--ui-text-primary)]">{tablesUsageText}</span>
          </span>
        </div>
      </section>
      <TableManager
        enabledFeatures={Array.from(entitlements.features)}
        restaurants={restaurants}
        tables={tables.map((t) => ({
          id: t.id,
          tableNo: t.tableNo,
          publicCode: t.publicCode,
          isActive: t.isActive,
          restaurantId: t.restaurantId,
          restaurantName: t.restaurant.name,
          hasActiveOrders: tableIdsWithActiveOrders.has(t.id),
          hasOpenBillRequest: billRequestTableIds.has(t.id),
          hasOpenWaiterCall: waiterCallTableIds.has(t.id),
          isBlocked: blockedTableIds.has(t.id),
          outstandingAmount: tableBillingMap.get(t.id)?.totalUnpaid ?? 0,
        }))}
      />
    </div>
  );
}
