import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { requireManagerSession } from "@/lib/auth";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";
import {
  formatAuditActorDisplayName,
  loadStaffProfilesForAuditLogs,
} from "@/lib/audit-actor-display";
import AuditLogView from "./audit-log-view";

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

export default async function RestaurantAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; action?: string }>;
}) {
  await requireManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();
  const params = await searchParams;

  const today = new Date();
  const fromParam = params.from ? new Date(params.from) : null;
  const toParam = params.to ? new Date(params.to) : null;
  const from = fromParam && !Number.isNaN(fromParam.getTime()) ? startOfDay(fromParam) : startOfDay(today);
  const to = toParam && !Number.isNaN(toParam.getTime()) ? endOfDay(toParam) : endOfDay(today);
  const actionFilter = params.action?.trim() || null;
  const defaultFrom = params.from ?? today.toISOString().slice(0, 10);
  const defaultTo = params.to ?? today.toISOString().slice(0, 10);

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lte: to },
      ...(actionFilter ? { actionType: actionFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actorFields = logs.map((l) => ({
    actorType: l.actorType,
    actorId: l.actorId,
    role: l.role,
  }));
  const staffResolution = await loadStaffProfilesForAuditLogs(tenantId, actorFields);

  const actionTypes = await prisma.auditLog.findMany({
    where: { tenantId },
    select: { actionType: true },
    distinct: ["actionType"],
    orderBy: { actionType: "asc" },
  });

  return (
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Operasyon ve Güvenlik Kayıtları
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">İşlem Geçmişi</h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Yönetim panelinde gerçekleşen işlem geçmişini tarih ve işlem tipine göre denetleyin.
            </p>
          </div>
          <span className={badgeClasses("neutral")}>
            Aralık: {defaultFrom} - {defaultTo}
          </span>
        </div>
      </section>

      <AuditLogView
        logs={logs.map((l) => {
          const actorDisplayName = formatAuditActorDisplayName(
            {
              actorType: l.actorType,
              actorId: l.actorId,
              role: l.role,
            },
            staffResolution,
          );
          return {
            id: l.id,
            actorType: l.actorType,
            actorId: l.actorId ?? undefined,
            role: l.role ?? undefined,
            actorDisplayName,
            actionType: l.actionType,
            entityType: l.entityType,
            entityId: l.entityId ?? undefined,
            description: l.description ?? undefined,
            createdAt: l.createdAt.toISOString(),
          };
        })}
        actionTypes={actionTypes.map((a) => a.actionType)}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        defaultAction={params.action ?? ""}
      />
    </div>
  );
}



