import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { requireManagerSession } from "@/lib/auth";
import { formatStaffDisplayName } from "@/lib/person-display-name";
import WaiterCallsLogView from "./waiter-calls-log-view";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export default async function RestaurantWaiterCallsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; tableId?: string; status?: string }>;
}) {
  await requireManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();
  const params = await searchParams;

  const today = new Date();
  const fromParam = params.from ? new Date(params.from) : null;
  const toParam = params.to ? new Date(params.to) : null;
  const from = fromParam && !Number.isNaN(fromParam.getTime()) ? startOfDay(fromParam) : startOfDay(today);
  const to = toParam && !Number.isNaN(toParam.getTime()) ? endOfDay(toParam) : endOfDay(today);
  const defaultFrom = params.from ?? today.toISOString().slice(0, 10);
  const defaultTo = params.to ?? today.toISOString().slice(0, 10);
  const tableIdFilter = params.tableId ? parseInt(params.tableId, 10) : null;
  const statusFilter = params.status?.trim() || null;

  const calls = await prisma.waiterCall.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lte: to },
      ...(tableIdFilter && !Number.isNaN(tableIdFilter) ? { tableId: tableIdFilter } : {}),
      ...(statusFilter ? { status: statusFilter as "PENDING" | "ACKNOWLEDGED" | "RESOLVED" } : {}),
    },
    include: {
      table: { select: { id: true, tableNo: true } },
      acknowledgedByStaff: { select: { id: true, displayName: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const tables = await prisma.table.findMany({
    where: { restaurant: { tenantId } },
    select: { id: true, tableNo: true },
    orderBy: { tableNo: "asc" },
  });

  const tableIdsWithRecentCalls = new Set<number>();
  const callRows = calls.map((c) => {
    const responseMinutes =
      c.acknowledgedAt != null
        ? Math.round((c.acknowledgedAt.getTime() - c.createdAt.getTime()) / 60000)
        : null;
    return {
      id: c.id,
      tableNo: c.table.tableNo,
      tableId: c.table.id,
      createdAt: c.createdAt.toISOString(),
      acknowledgedAt: c.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      status: c.status,
      responseMinutes,
      staffName: c.acknowledgedByStaff
        ? formatStaffDisplayName(c.acknowledgedByStaff)
        : null,
    };
  });

  const WINDOW_MIN = 15;
  const MIN_CALLS_FOR_FLAG = 3;
  for (let i = 0; i < callRows.length; i++) {
    const c = callRows[i];
    const t0 = new Date(c.createdAt).getTime();
    let count = 1;
    for (let j = i + 1; j < callRows.length; j++) {
      const c2 = callRows[j];
      if (c2.tableId !== c.tableId) continue;
      const t2 = new Date(c2.createdAt).getTime();
      if ((t0 - t2) / 60000 > WINDOW_MIN) break;
      count++;
    }
    if (count >= MIN_CALLS_FOR_FLAG) {
      tableIdsWithRecentCalls.add(c.tableId);
    }
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6B7280]">
              Çağrı Geçmişi
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">Garson Çağırma Logları</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Masalardan gelen çağrıları, yanıt sürelerini ve ilgilenen personel hareketlerini takip edin.
            </p>
          </div>
          <span className={badgeClasses("neutral", "px-2.5 py-1 text-xs font-medium")}>
            Aralık: {defaultFrom} - {defaultTo}
          </span>
        </div>
      </section>

      <WaiterCallsLogView
        calls={callRows}
        tables={tables}
        flaggedTableIds={Array.from(tableIdsWithRecentCalls)}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        defaultTableId={params.tableId ?? ""}
        defaultStatus={params.status ?? ""}
      />
    </div>
  );
}

