import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireCashierOrManagerSession } from "@/lib/auth";
import RefreshPolling from "@/components/refresh-polling";
import AdminLogoutButton from "@/components/admin-logout-button";
import RestaurantToaster from "./restaurant-toaster";
import RestaurantShell from "./restaurant-shell";
import { buttonClasses } from "@/lib/ui/button-variants";
import {
  DEFAULT_RESTAURANT_THEME,
  RESTAURANT_THEME_STORAGE_KEY,
} from "./theme/restaurant-theme";
import {
  canAccessRestaurantPath,
  normalizeRestaurantPathname,
} from "@/lib/restaurant-panel-access";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, homePath } = await requireCashierOrManagerSession();
  const reqHeaders = await headers();
  const requestedPath = normalizeRestaurantPathname(
    reqHeaders.get("x-request-pathname") ?? homePath,
  );
  const normalizedHomePath = normalizeRestaurantPathname(homePath);
  const isCashReceiptRoute = requestedPath.startsWith("/restaurant/cash/receipt");

  if (
    !canAccessRestaurantPath({ role, pathname: requestedPath }) &&
    requestedPath !== normalizedHomePath
  ) {
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
        {children}
      </RestaurantShell>
    </div>
  );
}
