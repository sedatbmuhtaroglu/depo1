import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireCashierOrManagerSession } from "@/lib/auth";
import RefreshPolling from "@/components/refresh-polling";
import AdminLogoutButton from "@/components/admin-logout-button";
import RestaurantToaster from "./restaurant-toaster";
import RestaurantShell from "./restaurant-shell";
import SupportModeBanner from "./support-mode-banner";
import { buttonClasses } from "@/lib/ui/button-variants";
import {
  DEFAULT_RESTAURANT_THEME,
  RESTAURANT_THEME_STORAGE_KEY,
} from "./theme/restaurant-theme";
import {
  canAccessRestaurantPathWithFeatures,
  normalizeRestaurantPathname,
} from "@/lib/restaurant-panel-access";
import { getTenantEntitlements } from "@/core/entitlements/engine";
import { FEATURE_LOCKED_MESSAGE } from "@/lib/tenant-feature-enforcement";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireCashierOrManagerSession();
  const { role, homePath } = session;
  const entitlements = await getTenantEntitlements(session.tenantId);
  const enabledFeatures = new Set(Array.from(entitlements.features));
  const reqHeaders = await headers();
  const requestedPath = normalizeRestaurantPathname(
    reqHeaders.get("x-request-pathname") ?? homePath,
  );
  const normalizedHomePath = normalizeRestaurantPathname(homePath);
  const isCashReceiptRoute = requestedPath.startsWith("/restaurant/cash/receipt");

  const routeAccess = canAccessRestaurantPathWithFeatures({
    role,
    pathname: requestedPath,
    enabledFeatures,
  });

  if (!routeAccess.allowed && routeAccess.reason === "ROLE" && requestedPath !== normalizedHomePath) {
    redirect(homePath);
  }

  if (isCashReceiptRoute) {
    return (
      <div
        className="restaurant-panel min-h-screen bg-[var(--ui-bg-canvas)] print:bg-white"
        data-restaurant-theme={DEFAULT_RESTAURANT_THEME}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key=${JSON.stringify(
              RESTAURANT_THEME_STORAGE_KEY,
            )};var val=localStorage.getItem(key);if(val!==\"day\"&&val!==\"night\"){val=${JSON.stringify(
              DEFAULT_RESTAURANT_THEME,
            )};}var root=document.currentScript&&document.currentScript.parentElement;if(root){root.setAttribute(\"data-restaurant-theme\",val);}}catch(_){}})();`,
          }}
        />
        <RestaurantToaster />
        <main className="mx-auto w-full max-w-2xl px-3 py-3 print:max-w-none print:p-0">{children}</main>
      </div>
    );
  }

  const featureLockMessage =
    !routeAccess.allowed && routeAccess.reason === "FEATURE" ? FEATURE_LOCKED_MESSAGE : null;

  return (
    <div
      className="restaurant-panel min-h-screen bg-[var(--ui-bg-canvas)]"
      data-restaurant-theme={DEFAULT_RESTAURANT_THEME}
      suppressHydrationWarning
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var key=${JSON.stringify(
            RESTAURANT_THEME_STORAGE_KEY,
          )};var val=localStorage.getItem(key);if(val!=="day"&&val!=="night"){val=${JSON.stringify(
            DEFAULT_RESTAURANT_THEME,
          )};}var root=document.currentScript&&document.currentScript.parentElement;if(root){root.setAttribute("data-restaurant-theme",val);}}catch(_){}})();`,
        }}
      />
      <RefreshPolling intervalMs={30000} />
      <RestaurantToaster />
      <RestaurantShell
        role={role}
        enabledFeatures={Array.from(enabledFeatures)}
        supportBanner={
          session.authMode === "support" && session.supportContext ? (
            <SupportModeBanner
              tenantName={session.supportContext.tenantName}
              tenantSlug={session.supportContext.tenantSlug}
              hqAdminUsername={session.supportContext.hqAdminUsername}
              reason={session.supportContext.reason}
              expiresAtMs={session.supportContext.expiresAt.getTime()}
            />
          ) : null
        }
        headerAction={
          <AdminLogoutButton
            className={buttonClasses({
              variant: "outline",
              size: "md",
              className: "px-3",
            })}
          />
        }
      >
        {featureLockMessage ? (
          <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-6 text-center">
            <h2 className="text-lg font-semibold text-[var(--ui-text-primary)]">Ozellik Kilitli</h2>
            <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
              {featureLockMessage}
            </p>
          </div>
        ) : (
          children
        )}
      </RestaurantShell>
    </div>
  );
}
