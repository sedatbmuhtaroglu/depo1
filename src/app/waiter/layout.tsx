import React from "react";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import RefreshPolling from "@/components/refresh-polling";
import AdminLogoutButton from "@/components/admin-logout-button";
import WaiterThemeToggle from "./waiter-theme-toggle";
import {
  DEFAULT_RESTAURANT_THEME,
  RESTAURANT_THEME_STORAGE_KEY,
} from "@/app/restaurant/theme/restaurant-theme";

export default async function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWaiterOrManagerSession();

  return (
    <div
      className="restaurant-panel waiter-panel min-h-screen bg-[var(--ui-bg-canvas)]"
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
      <RefreshPolling intervalMs={20000} />
      <header className="waiter-shell-header border-b">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="waiter-hero-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="waiter-hero-pill inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                Servis Operasyon
              </p>
              <h1 className="mt-2 text-xl font-bold text-[color:var(--ui-text-primary)]">Garson Paneli</h1>
              <p className="text-sm text-[color:var(--ui-text-secondary)]">
                Onay bekleyen ve aktif siparişleri tek ekrandan yönetin.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
              <WaiterThemeToggle />
              <AdminLogoutButton />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
