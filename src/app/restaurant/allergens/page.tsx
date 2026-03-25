import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { cardClasses } from "@/lib/ui/button-variants";
import AllergensManager from "./allergens-manager";

export const dynamic = "force-dynamic";

export default async function RestaurantAllergensPage() {
  const { tenantId } = await getCurrentTenantOrThrow();

  const allergens = await prisma.tenantAllergen.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      isActive: true,
      updatedAt: true,
    },
  });

  const activeCount = allergens.filter((item) => item.isActive).length;

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[color:var(--ui-text-secondary)]">
              Icerik Uyari Yonetimi
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">
              Alerjenler
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Urun duzenleme ekraninda secilebilecek ozel alerjen listesini buradan yonetin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-bg-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            {activeCount}/{allergens.length} aktif
          </span>
        </div>
      </section>

      <AllergensManager
        allergens={allergens.map((item) => ({
          id: item.id,
          name: item.name,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          updatedAt: item.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
