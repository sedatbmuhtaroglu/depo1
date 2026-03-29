import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { redirect } from "next/navigation";
import { tenantHasFeature } from "@/lib/tenant-plan";
import { buildDefaultWeeklyWorkingHours } from "@/lib/restaurant-working-hours";
import { resolveMenuTheme } from "@/lib/menu-theme";
import { cardClasses } from "@/lib/ui/button-variants";
import SettingsForm from "./settings-form";
import DomainSection from "./domain-section";
import PaymentSettingsSection from "./payment-settings-section";

export const dynamic = "force-dynamic";

export default async function RestaurantSettingsPage() {
  const { tenantId } = await getCurrentTenantOrThrow();

  const [restaurant, domains, hasCustomDomain, paymentConfig, paymentMethods] = await Promise.all([
    prisma.restaurant.findFirst({
      where: { tenantId },
      include: {
        workingHours: {
          orderBy: { weekday: "asc" },
        },
      },
    }),
    prisma.tenantDomain.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    tenantHasFeature(tenantId, "CUSTOM_DOMAIN"),
    prisma.tenantPaymentConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: "IYZICO" } },
    }),
    prisma.tenantPaymentMethod.findMany({
      where: {
        tenantId,
        method: { in: ["CASH", "CREDIT_CARD"] },
      },
    }),
  ]);

  if (!restaurant) {
    redirect("/restaurant");
  }

  const cashActive =
    paymentMethods.find((method) => method.method === "CASH")?.isActive ?? false;
  const creditCardMethodActive =
    paymentMethods.find((method) => method.method === "CREDIT_CARD")?.isActive ?? false;
  const workingHoursForForm =
    restaurant.workingHours.length > 0
      ? restaurant.workingHours.map((row) => ({
          weekday: row.weekday,
          isOpen: row.isOpen,
          openTime: row.openTime,
          closeTime: row.closeTime,
        }))
      : buildDefaultWeeklyWorkingHours(
          restaurant.openingHour,
          restaurant.closingHour,
        );
  const menuTheme = resolveMenuTheme({
    themeColor: restaurant.themeColor,
    menuFontSizePx: restaurant.menuFontSizePx,
    menuTextColor: restaurant.menuTextColor,
    menuBackgroundColor: restaurant.menuBackgroundColor,
    menuButtonBackgroundColor: restaurant.menuButtonBackgroundColor,
    menuHeaderBackgroundColor: restaurant.menuHeaderBackgroundColor,
  });

  return (
    <div className="space-y-6">
      <section className={cardClasses({ className: "p-5 shadow-none" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="rm-section-intro-eyebrow">Restoran Konfigürasyon Merkezi</p>
            <h2 className="rm-section-intro-title">Ayarlar</h2>
            <p className="rm-section-intro-desc">
              Genel bilgiler, marka varlıkları ve operasyon ayarlarını tek ekrandan yönetin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            Yönetici paneli
          </span>
        </div>
      </section>

      <SettingsForm
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          logoUrl: restaurant.logoUrl ?? "",
          workingHours: workingHoursForForm,
          orderingDisabled: restaurant.orderingDisabled,
          locationEnforcementEnabled: restaurant.locationEnforcementEnabled,
          orderRadiusMeters: restaurant.orderRadiusMeters,
          locationLatitude:
            restaurant.locationLatitude != null
              ? Number(restaurant.locationLatitude)
              : null,
          locationLongitude:
            restaurant.locationLongitude != null
              ? Number(restaurant.locationLongitude)
              : null,
          kitchenWarningYellowMin: restaurant.kitchenWarningYellowMin ?? undefined,
          kitchenWarningOrangeMin: restaurant.kitchenWarningOrangeMin ?? undefined,
          kitchenWarningRedMin: restaurant.kitchenWarningRedMin ?? undefined,
          themeColor: restaurant.themeColor,
          menuFontSizePx: menuTheme.fontSizePx,
          menuTextColor: menuTheme.textColor,
          menuBackgroundColor: menuTheme.backgroundColor,
          menuButtonBackgroundColor: menuTheme.buttonBackgroundColor,
          menuHeaderBackgroundColor: menuTheme.headerBackgroundColor,
        }}
      />

      {hasCustomDomain ? (
        <DomainSection
          domains={domains.map((d) => ({
            id: d.id,
            domain: d.domain,
            isPrimary: d.isPrimary,
            isVerified: d.isVerified,
          }))}
        />
      ) : (
        <div className={cardClasses({ tone: "subtle", className: "p-5 text-center shadow-none" })}>
          <p className="text-sm font-medium text-[color:var(--ui-text-primary)]">Özel domain bağlama</p>
          <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
            Bu özellik Kurumsal paket kapsamındadır. Etkinleştirmek için planı yükseltin.
          </p>
        </div>
      )}

      <PaymentSettingsSection
        paymentMethods={{
          cashActive,
          creditCardActive: creditCardMethodActive,
        }}
        iyzico={
          paymentConfig
            ? {
                apiKey: paymentConfig.apiKey,
                secretKeySet: Boolean(paymentConfig.secretKey?.trim()),
                isSandbox: paymentConfig.isSandbox,
                isActive: paymentConfig.isActive,
              }
            : null
        }
      />
    </div>
  );
}
