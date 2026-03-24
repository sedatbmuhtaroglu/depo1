import React from "react";
import { requireManagerSession } from "@/lib/auth";
import RefreshPolling from "@/components/refresh-polling";
import AdminLogoutButton from "@/components/admin-logout-button";
import RestaurantToaster from "./restaurant-toaster";
import RestaurantShell from "./restaurant-shell";
import { buttonClasses } from "@/lib/ui/button-variants";
import {
  DEFAULT_RESTAURANT_THEME,
  RESTAURANT_THEME_STORAGE_KEY,
} from "./theme/restaurant-theme";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireManagerSession();

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
