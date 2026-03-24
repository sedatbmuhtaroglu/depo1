import React from "react";
import { assertFeatureEnabled } from "@/core/entitlements/engine";
import { requireKitchenOrManagerSession } from "@/lib/auth";
import AdminLogoutButton from "@/components/admin-logout-button";

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireKitchenOrManagerSession();
  try {
    await assertFeatureEnabled(session.tenantId, "KITCHEN_DISPLAY");
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-6 text-center">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-neutral-900">Mutfak Modulu Kapali</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Bu tenant icin KITCHEN_DISPLAY ozelligi HQ tarafinda devre disi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Mutfak Paneli</h1>
            <p className="text-sm text-neutral-500">
              Yeni gelen ve hazirlanan siparisleri yonetin.
            </p>
          </div>
          <AdminLogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
