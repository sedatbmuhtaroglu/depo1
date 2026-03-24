"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";

const NAV_SECTIONS = [
  {
    title: "Operasyon",
    items: [
      { href: "/hq", label: "Overview" },
      { href: "/hq/tenants", label: "Tenantlar" },
      { href: "/hq/leads", label: "Sales / Leadler" },
    ],
  },
  {
    title: "Muhasebe",
    items: [
      { href: "/hq/accounting", label: "Genel Bakis" },
      { href: "/hq/accounting/records", label: "Ticari Kayitlar" },
      { href: "/hq/accounting/payments", label: "Tahsilatlar" },
    ],
  },
  {
    title: "Pazarlama",
    items: [
      { href: "/hq/marketing/settings", label: "Genel Ayarlar" },
      { href: "/hq/marketing/homepage", label: "Ana Sayfa Icerigi" },
      { href: "/hq/marketing/categories", label: "Kategoriler / Alt Kategoriler" },
      { href: "/hq/marketing/submissions", label: "Form Basvurulari" },
    ],
  },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/hq") return pathname === "/hq";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HqSideNav() {
  const pathname = usePathname();

  return (
    <nav className={cardClasses({ className: "space-y-3 p-2" })}>
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  active
                    ? "bg-[var(--ui-accent)]/10 text-[var(--ui-accent)]"
                    : "text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
