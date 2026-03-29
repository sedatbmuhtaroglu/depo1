"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HQ_NAV_SECTIONS, HQ_QUICK_NAV_ITEMS } from "@/modules/hq/components/hq-navigation";

function isActive(pathname: string, href: string) {
  if (href === "/hq") return pathname === "/hq";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--hq-sidebar-dim)]">
      {children}
    </p>
  );
}

function IconWrap({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors ${
        active
          ? "border-white/10 bg-white/[0.08] text-[var(--hq-sidebar-fg)]"
          : "text-[var(--hq-sidebar-muted)] group-hover:text-[var(--hq-sidebar-fg)]"
      }`}
    >
      {children}
    </span>
  );
}

type HqSideNavProps = {
  onNavigate?: () => void;
};

export function HqSideNav({ onNavigate }: HqSideNavProps) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-white/[0.12] text-[var(--hq-sidebar-fg)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        : "text-[var(--hq-sidebar-link)] hover:bg-white/[0.06] hover:text-[var(--hq-sidebar-fg)]"
    }`;

  return (
    <div className="space-y-6">
      <div className="space-y-1 lg:hidden">
        <SectionLabel>Hızlı erişim</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {HQ_QUICK_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(active)}>
                <IconWrap active={active}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </IconWrap>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {HQ_NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <SectionLabel>{section.title}</SectionLabel>
          <nav className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClass(active)}>
                  <IconWrap active={active}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </IconWrap>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
