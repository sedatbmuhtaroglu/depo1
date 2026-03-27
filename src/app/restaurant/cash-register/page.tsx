import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import {
  CASH_MOVEMENT_CATEGORY_OPTIONS,
  decimalToNumber,
  getCashRegisterDashboardData,
} from "@/lib/cash-register";
import { cardClasses } from "@/lib/ui/button-variants";
import { getTurkeyDateString } from "@/lib/turkey-time";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";
import CashRegisterView from "./cash-register-view";

export const dynamic = "force-dynamic";

type CashRegisterPageProps = {
  searchParams?: Promise<{
    restaurantId?: string;
  }>;
};

export default async function CashRegisterPage({ searchParams }: CashRegisterPageProps) {
  const { tenantId } = await getCurrentTenantOrThrow();
  const featureGate = await ensureTenantFeatureEnabled(tenantId, "CASH_OPERATIONS");
  if (!featureGate.ok) {
    return (
      <section className={cardClasses({ className: "p-5 text-center" })}>
        <h2 className="text-lg font-semibold text-[var(--ui-text-primary)]">Ozellik Kilitli</h2>
        <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">{featureGate.message}</p>
      </section>
    );
  }
  const params = (await searchParams) ?? {};

  const restaurants = await prisma.restaurant.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  if (restaurants.length === 0) {
    redirect("/restaurant");
  }

  const requestedRestaurantId = Number(params.restaurantId);
  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === requestedRestaurantId) ?? restaurants[0];
  const businessDate = getTurkeyDateString();

  const dashboardData = await getCashRegisterDashboardData({
    tenantId,
    restaurantId: selectedRestaurant.id,
    businessDate,
  });

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--ui-text-secondary)]">
              Nakit Operasyonu
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">
              Kasa Ekranı
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Günlük nakit giriş-çıkış hareketlerini kaydedin, gün sonu farkını tek ekranda
              kontrol edin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-bg-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            {selectedRestaurant.name}
          </span>
        </div>
      </section>

      <CashRegisterView
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurant.id}
        businessDate={businessDate}
        categoryOptions={CASH_MOVEMENT_CATEGORY_OPTIONS}
        summary={{
          businessDate,
          openingBalance: decimalToNumber(dashboardData.summary.openingBalance),
          totalIn: decimalToNumber(dashboardData.summary.totalIn),
          totalOut: decimalToNumber(dashboardData.summary.totalOut),
          currentBalance: decimalToNumber(dashboardData.summary.currentBalance),
          lastMovementAt: dashboardData.summary.lastMovementAt
            ? dashboardData.summary.lastMovementAt.toISOString()
            : null,
          dayClosedAt: dashboardData.summary.dayClosedAt
            ? dashboardData.summary.dayClosedAt.toISOString()
            : null,
          countedBalance:
            dashboardData.summary.countedBalance == null
              ? null
              : decimalToNumber(dashboardData.summary.countedBalance),
          variance:
            dashboardData.summary.variance == null
              ? null
              : decimalToNumber(dashboardData.summary.variance),
          closingNote: dashboardData.summary.closingNote,
        }}
        movements={dashboardData.movements.map((movement) => ({
          id: movement.id,
          occurredAt: movement.occurredAt.toISOString(),
          type: movement.type,
          category: movement.category,
          note: movement.note,
          amount: decimalToNumber(movement.amount),
          isVoided: movement.isVoided,
          actorDisplayName: movement.actorDisplayName,
          actorUsername: movement.actorUsername,
        }))}
      />
    </div>
  );
}
