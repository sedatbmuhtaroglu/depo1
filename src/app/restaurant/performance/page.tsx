import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { requireManagerSession } from "@/lib/auth";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";
import { formatStaffDisplayName } from "@/lib/person-display-name";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";
import PerformanceView from "./performance-view";
import { hasFeature } from "@/core/entitlements/engine";

export const dynamic = "force-dynamic";

function normalizeDateParam(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function isInRange(date: Date, fromInclusive: Date, toExclusive: Date) {
  const t = date.getTime();
  return t >= fromInclusive.getTime() && t < toExclusive.getTime();
}

export default async function RestaurantPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();
  const performanceEnabled = await hasFeature(tenantId, "STAFF_PERFORMANCE");
  if (!performanceEnabled) {
    return (
      <section className={cardClasses({ className: "p-5 text-center" })}>
        <h2 className="text-lg font-semibold text-[var(--ui-text-primary)]">Ozellik Kilitli</h2>
        <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
          Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.
        </p>
      </section>
    );
  }
  const params = await searchParams;

  const todayTurkeyDate = getTurkeyDateString();
  const fromDayRaw = normalizeDateParam(params.from, todayTurkeyDate);
  const toDayRaw = normalizeDateParam(params.to, fromDayRaw);
  const fromDay = fromDayRaw <= toDayRaw ? fromDayRaw : toDayRaw;
  const toDay = fromDayRaw <= toDayRaw ? toDayRaw : fromDayRaw;

  const fromRange = getTurkeyDayRange(fromDay);
  const toRange = getTurkeyDayRange(toDay);
  const fromUtc = fromRange.startUtc;
  const toUtcExclusive = toRange.endUtc;

  const staffList = await prisma.tenantStaff.findMany({
    where: {
      tenantId,
      role: { in: ["WAITER", "MANAGER"] },
    },
    select: { id: true, username: true, displayName: true },
    orderBy: { username: "asc" },
  });

  const ordersDelivered = await prisma.order.findMany({
    where: {
      table: { restaurant: { tenantId } },
      deliveredAt: { gte: fromUtc, lt: toUtcExclusive },
    },
    select: {
      id: true,
      tableId: true,
      deliveredAt: true,
      readyAt: true,
      deliveredByStaffId: true,
    },
  });

  const waiterCalls = await prisma.waiterCall.findMany({
    where: {
      tenantId,
      OR: [
        { acknowledgedAt: { gte: fromUtc, lt: toUtcExclusive } },
        {
          acknowledgedAt: null,
          resolvedAt: { gte: fromUtc, lt: toUtcExclusive },
        },
      ],
    },
    select: {
      acknowledgedByStaffId: true,
      tableId: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
    },
  });

  const billRequests = await prisma.billRequest.findMany({
    where: {
      tenantId,
      OR: [
        { acknowledgedAt: { gte: fromUtc, lt: toUtcExclusive } },
        {
          acknowledgedAt: null,
          settledAt: { gte: fromUtc, lt: toUtcExclusive },
        },
      ],
    },
    select: {
      acknowledgedByStaffId: true,
      tableId: true,
      createdAt: true,
      acknowledgedAt: true,
      settledAt: true,
    },
  });

  const metricsByStaff: Record<
    number,
    {
      tablesServed: Set<number>;
      ordersDelivered: number;
      deliveryDurationsMs: number[];
      billResponseDurationsMs: number[];
      callResponseDurationsMs: number[];
    }
  > = {};

  for (const s of staffList) {
    metricsByStaff[s.id] = {
      tablesServed: new Set(),
      ordersDelivered: 0,
      deliveryDurationsMs: [],
      billResponseDurationsMs: [],
      callResponseDurationsMs: [],
    };
  }

  for (const o of ordersDelivered) {
    if (o.deliveredByStaffId == null) continue;
    const m = metricsByStaff[o.deliveredByStaffId];
    if (!m) continue;
    m.tablesServed.add(o.tableId);
    m.ordersDelivered++;
    if (o.readyAt && o.deliveredAt) {
      const durationMs = o.deliveredAt.getTime() - o.readyAt.getTime();
      if (durationMs >= 0) {
        m.deliveryDurationsMs.push(durationMs);
      }
    }
  }

  for (const c of waiterCalls) {
    const handledAt = c.acknowledgedAt ?? c.resolvedAt;
    if (!handledAt || !isInRange(handledAt, fromUtc, toUtcExclusive)) continue;
    if (c.acknowledgedByStaffId == null) continue;
    const m = metricsByStaff[c.acknowledgedByStaffId];
    if (!m) continue;
    m.tablesServed.add(c.tableId);
    const durationMs = handledAt.getTime() - c.createdAt.getTime();
    if (durationMs >= 0) {
      m.callResponseDurationsMs.push(durationMs);
    }
  }

  for (const b of billRequests) {
    const handledAt = b.acknowledgedAt ?? b.settledAt;
    if (!handledAt || !isInRange(handledAt, fromUtc, toUtcExclusive)) continue;
    if (b.acknowledgedByStaffId == null) continue;
    const m = metricsByStaff[b.acknowledgedByStaffId];
    if (!m) continue;
    m.tablesServed.add(b.tableId);
    const durationMs = handledAt.getTime() - b.createdAt.getTime();
    if (durationMs >= 0) {
      m.billResponseDurationsMs.push(durationMs);
    }
  }

  const rows = staffList.map((s) => {
    const m = metricsByStaff[s.id]!;
    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 1000 / 60) : null;
    return {
      staffId: s.id,
      name: formatStaffDisplayName(s),
      tablesServed: m.tablesServed.size,
      ordersDelivered: m.ordersDelivered,
      avgDeliveryMinutes: avg(m.deliveryDurationsMs),
      avgBillResponseMinutes: avg(m.billResponseDurationsMs),
      avgCallResponseMinutes: avg(m.callResponseDurationsMs),
    };
  });

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6B7280]">
              Ekip Operasyon Raporu
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">Personel Performansı</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Garson bazlı teslimat ve yanıt sürelerini seçili tarih aralığında analiz edin.
            </p>
          </div>
          <span className={badgeClasses("neutral", "px-2.5 py-1 text-xs font-medium")}>
            Aralık: {fromDay} - {toDay}
          </span>
        </div>
      </section>

      <PerformanceView rows={rows} defaultFrom={fromDay} defaultTo={toDay} />
    </div>
  );
}
