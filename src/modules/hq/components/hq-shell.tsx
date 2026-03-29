"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import AdminLogoutButton from "@/components/admin-logout-button";
import { buttonClasses } from "@/lib/ui/button-variants";
import { HqSideNav } from "@/modules/hq/components/hq-side-nav";

type HqShellProps = {
  username: string;
  children: ReactNode;
};

export function HqShell({ username, children }: HqShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="hq-scope flex min-h-screen flex-col bg-[var(--hq-canvas)] lg:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--hq-sidebar-border)] bg-[var(--hq-sidebar-bg)] px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--hq-sidebar-fg)] transition-colors hover:bg-white/10"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold text-[var(--hq-sidebar-fg)]">Catal App</p>
          <p className="truncate text-[10px] text-[var(--hq-sidebar-muted)]">HQ</p>
        </div>
        <AdminLogoutButton
          className={buttonClasses({
            variant: "outline",
            className:
              "border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[var(--hq-sidebar-fg)] hover:bg-white/10",
          })}
        />
      </header>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          aria-label="Menüyü kapat"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`hq-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(100%,280px)] flex-col border-r border-[var(--hq-sidebar-border)] bg-[var(--hq-sidebar-bg)] transition-transform duration-200 ease-out lg:static lg:z-0 lg:w-60 lg:shrink-0 lg:translate-x-0 xl:w-64 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-white/[0.08] px-4 lg:h-[4.25rem]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--hq-sidebar-muted)]">
              Catal App
            </p>
            <p className="truncate text-sm font-semibold text-[var(--hq-sidebar-fg)]">HQ Console</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--hq-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-[var(--hq-sidebar-fg)] lg:hidden"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 lg:py-4">
          <HqSideNav onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="border-t border-white/[0.08] p-3">
          <p className="truncate px-2 text-[11px] text-[var(--hq-sidebar-muted)]">
            <span className="text-[var(--hq-sidebar-fg)]">Oturum</span> · {username}
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 flex-col lg:min-h-screen">
        <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-end gap-4 border-b border-[var(--ui-border-subtle)] bg-[var(--hq-main-header-bg)] px-6 backdrop-blur-md lg:flex">
          <div className="flex items-center gap-3 text-sm text-[var(--ui-text-secondary)]">
            <span className="hidden text-xs sm:inline">{username}</span>
            <AdminLogoutButton
              className={buttonClasses({
                variant: "outline",
                className: "border-[var(--ui-border)] px-3 py-2 text-xs font-medium",
              })}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
