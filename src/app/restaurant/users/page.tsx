import React from "react";
import { prisma } from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { cardClasses } from "@/lib/ui/button-variants";
import UsersManager from "./users-manager";
import { getTenantLimitUsageSummary } from "@/lib/tenant-limits";

export const dynamic = "force-dynamic";

export default async function RestaurantUsersPage() {
  await requireManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();

  const [users, limitSummary] = await Promise.all([
    prisma.tenantStaff.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        username: true,
        role: true,
        isActive: true,
        workingDays: true,
        shiftStart: true,
        shiftEnd: true,
        weeklyShiftSchedule: true,
        notes: true,
        mustSetPassword: true,
        createdAt: true,
      },
    }),
    getTenantLimitUsageSummary(tenantId),
  ]);

  const usersUsageText =
    limitSummary.usage.users.max == null
      ? `${limitSummary.usage.users.used}/∞`
      : `${limitSummary.usage.users.used}/${limitSummary.usage.users.max}`;
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const managerCount = users.filter((user) => user.role === "MANAGER").length;
  const cashierCount = users.filter((user) => user.role === "CASHIER").length;
  const waiterCount = users.filter((user) => user.role === "WAITER").length;
  const kitchenCount = users.filter((user) => user.role === "KITCHEN").length;
  const usersMax = limitSummary.usage.users.max;
  const usagePercent =
    usersMax == null || usersMax <= 0
      ? null
      : Math.min(100, Math.round((limitSummary.usage.users.used / usersMax) * 100));

  return (
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-5 shadow-none" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Personel ve Yetki Yönetimi
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Kullanıcılar</h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Restoran personel hesaplarını, rollerini ve aktiflik durumlarını bu ekrandan yönetin.
            </p>
          </div>
          <div
            className={cardClasses({
              tone: "subtle",
              className: "min-w-[220px] rounded-xl px-3.5 py-2.5 shadow-none",
            })}
          >
            <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Aktif kullanıcı kullanımı</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{usersUsageText}</p>
            {usagePercent != null ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--ui-border)]">
                <div
                  className="h-full rounded-full bg-[color:var(--ui-text-primary)]"
                  style={{ width: `${usagePercent}%` }}
                  aria-hidden="true"
                />
              </div>
            ) : (
              <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Sınırsız kullanıcı planı</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Toplam kullanıcı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{totalUsers}</p>
        </article>
        <article className={cardClasses({ tone: "success", className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-success)]">Aktif kullanıcı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{activeUsers}</p>
        </article>
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Müdür hesabı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{managerCount}</p>
        </article>
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Rol dağılımı</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">
            Kasiyer {cashierCount} · Garson {waiterCount} · Mutfak {kitchenCount}
          </p>
        </article>
      </section>

      <UsersManager
        users={users.map((user) => ({
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          workingDays: user.workingDays,
          shiftStart: user.shiftStart,
          shiftEnd: user.shiftEnd,
          weeklyShiftSchedule: user.weeklyShiftSchedule,
          notes: user.notes,
          mustSetPassword: user.mustSetPassword,
          createdAt: user.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
