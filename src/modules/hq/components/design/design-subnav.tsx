"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/hq/design", label: "Genel bakış" },
  { href: "/hq/design/genel", label: "Marka ve genel" },
  { href: "/hq/design/renkler", label: "Renkler" },
  { href: "/hq/design/header", label: "Üst menü ve CTA" },
  { href: "/hq/design/butonlar", label: "Hero butonları" },
  { href: "/hq/design/fiyatlandirma", label: "Fiyatlandırma" },
] as const;

function isDesignNavActive(pathname: string, href: string) {
  if (href === "/hq/design") return pathname === "/hq/design";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesignSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-[var(--ui-border)] pb-3"
      aria-label="Tasarım ayarları"
    >
      {LINKS.map((item) => {
        const active = isDesignNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--ui-primary-soft)] text-[var(--ui-accent)]"
                : "text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)] hover:text-[var(--ui-text-primary)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
