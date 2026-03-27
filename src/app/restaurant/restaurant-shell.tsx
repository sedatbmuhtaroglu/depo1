"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Landmark,
  Receipt,
  Repeat2,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Table2,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  DEFAULT_RESTAURANT_THEME,
  normalizeRestaurantTheme,
  RESTAURANT_THEME_STORAGE_KEY,
  type RestaurantThemeMode,
} from "./theme/restaurant-theme";
import {
  canAccessRestaurantNavItem,
  getRestaurantPanelRoleTitle,
} from "@/lib/restaurant-panel-access";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  group: "Operasyon" | "Menü & Stok" | "Raporlar" | "Sistem & Güvenlik";
  /** Varsayılan `href` önek eşleşmesi yerine özel aktiflik (ör. vitrin alt rotaları). */
  match?: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/restaurant",
    label: "Genel Bakış",
    icon: LayoutDashboard,
    description: "Anlık operasyon özeti ve canlı sipariş akışı",
    group: "Operasyon",
  },
  {
    href: "/restaurant/tables",
    label: "Masalar",
    icon: Table2,
    description: "Masa durumları, QR ve servis yönetimi",
    group: "Operasyon",
  },
  {
    href: "/restaurant/menu",
    label: "Menü",
    icon: UtensilsCrossed,
    description: "Kategori ve ürün düzenleme alanı",
    group: "Menü & Stok",
    match: (pathname) =>
      pathname === "/restaurant/menu" ||
      (pathname.startsWith("/restaurant/menu/") &&
        !pathname.startsWith("/restaurant/menu/showcase")),
  },
  {
    href: "/restaurant/menu/showcase/popular",
    label: "Popüler Ürünler",
    icon: Sparkles,
    description: "Kategori vitrinleri ve otomatik kaydırma ayarları",
    group: "Menü & Stok",
    match: (pathname) =>
      pathname === "/restaurant/menu/showcase/popular" ||
      pathname.startsWith("/restaurant/menu/showcase/popular/"),
  },
  {
    href: "/restaurant/menu/showcase/frequent",
    label: "Sık Tüketilenler",
    icon: Repeat2,
    description: "Genel vitrin konumu ve ürün seçimi",
    group: "Menü & Stok",
    match: (pathname) =>
      pathname === "/restaurant/menu/showcase/frequent" ||
      pathname.startsWith("/restaurant/menu/showcase/frequent/"),
  },
  {
    href: "/restaurant/stocks",
    label: "Stoklar",
    icon: Boxes,
    description: "Stok takibi ve ürün kullanılabilirliği",
    group: "Menü & Stok",
  },
  {
    href: "/restaurant/allergens",
    label: "Alerjenler",
    icon: AlertTriangle,
    description: "Urun icerik uyarilari ve ozel alerjen yonetimi",
    group: "Menü & Stok",
  },
  {
    href: "/restaurant/orders",
    label: "Siparişler",
    icon: ClipboardList,
    description: "Sipariş yaşam döngüsü ve durum geçişleri",
    group: "Operasyon",
  },
  {
    href: "/restaurant/cancellations",
    label: "İptaller",
    icon: XCircle,
    description: "İptal kayıtları ve finansal etkiler",
    group: "Operasyon",
  },
  {
    href: "/restaurant/invoicing",
    label: "Fatura / Fiş",
    icon: Receipt,
    description: "Tahsilat çıktıları ve faturalama",
    group: "Operasyon",
  },
  {
    href: "/restaurant/cash",
    label: "Kasa",
    icon: Landmark,
    description: "Gun ici tahsilatlar, odeme hareketleri ve acik hesaplar",
    group: "Operasyon",
  },
  {
    href: "/restaurant/reports",
    label: "Raporlar",
    icon: BarChart3,
    description: "Günlük ve dönemsel rapor görünümü",
    group: "Raporlar",
  },
  {
    href: "/restaurant/performance",
    label: "Personel Performansı",
    icon: Users,
    description: "Garson ve ekip performans özetleri",
    group: "Raporlar",
  },
  {
    href: "/restaurant/users",
    label: "Kullanıcılar",
    icon: Users,
    description: "Personel ve yetki yönetimi",
    group: "Sistem & Güvenlik",
  },
  {
    href: "/restaurant/waiter-calls",
    label: "Garson Çağrı Logları",
    icon: Phone,
    description: "Masa çağrıları ve yanıt geçmişi",
    group: "Operasyon",
  },
  {
    href: "/restaurant/audit",
    label: "İşlem Geçmişi",
    icon: History,
    description: "Panel içi kritik işlem kayıtları",
    group: "Sistem & Güvenlik",
  },
  {
    href: "/restaurant/security",
    label: "Güvenlik Olayları",
    icon: ShieldAlert,
    description: "Risk, ihlal ve güvenlik bildirimleri",
    group: "Sistem & Güvenlik",
  },
  {
    href: "/restaurant/settings",
    label: "Ayarlar",
    icon: Settings,
    description: "Restoran paneli ayarları",
    group: "Sistem & Güvenlik",
  },
];

const SIDEBAR_OPEN_WIDTH = "lg:w-[280px]";
const SIDEBAR_COLLAPSED_WIDTH = "lg:w-[88px]";

function isActivePath(pathname: string, href: string) {
  if (href === "/restaurant") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.match) return item.match(pathname);
  return isActivePath(pathname, item.href);
}

function getCurrentPageMeta(pathname: string) {
  const active = NAV_ITEMS.find((item) => isNavItemActive(pathname, item));

  function getHeaderTone() {
    if (pathname.startsWith("/restaurant/security")) return "danger";
    if (pathname.startsWith("/restaurant/tables")) return "success";
    if (pathname.startsWith("/restaurant/orders") || pathname.startsWith("/restaurant/cancellations")) return "warning";
    if (pathname.startsWith("/restaurant/audit")) return "info";
    return "neutral";
  }

  function getHeaderPill() {
    if (pathname.startsWith("/restaurant/tables")) return "Masa Operasyonu";
    if (pathname.startsWith("/restaurant/orders")) return "Sipariş Akışı";
    if (pathname.startsWith("/restaurant/cancellations")) return "İptal / İade Yönetimi";
    if (pathname.startsWith("/restaurant/invoicing")) return "Tahsilat / Fiş";
    if (pathname.startsWith("/restaurant/cash")) return "Kasa Operasyonu";
    if (pathname.startsWith("/restaurant/menu/showcase")) return "Vitrin Yönetimi";
    if (pathname.startsWith("/restaurant/menu")) return "Menü & Ürün Düzenleme";
    if (pathname.startsWith("/restaurant/stocks")) return "Stok Takibi";
    if (pathname.startsWith("/restaurant/allergens")) return "Alerjen Yonetimi";
    if (pathname.startsWith("/restaurant/reports")) return "Raporlar";
    if (pathname.startsWith("/restaurant/performance")) return "Personel Performansı";
    if (pathname.startsWith("/restaurant/users")) return "Kullanıcılar & Yetkiler";
    if (pathname.startsWith("/restaurant/audit")) return "İşlem Geçmişi";
    if (pathname.startsWith("/restaurant/security")) return "Güvenlik İzleme";
    if (pathname.startsWith("/restaurant/settings")) return "Restoran Ayarları";
    if (pathname.startsWith("/restaurant/waiter-calls")) return "Garson Çağrıları";
    return "Operasyon Paneli";
  }

  const headerTone = getHeaderTone();
  const headerPill = getHeaderPill();

  if (active) {
    return {
      title: active.label,
      description: active.description,
      headerPill,
      headerTone,
    };
  }

  return {
    title: "Restoran Paneli",
    description: "Operasyonu hızlı ve kontrollü şekilde yönetin",
    headerPill,
    headerTone: "neutral",
  };
}

function applyRestaurantTheme(theme: RestaurantThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>(".restaurant-panel");
  if (!root) return;
  root.setAttribute("data-restaurant-theme", theme);
}

type RestaurantShellProps = {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  role: StaffRole;
  supportBanner?: React.ReactNode;
  enabledFeatures: string[];
};

export default function RestaurantShell({
  children,
  headerAction,
  role,
  supportBanner,
  enabledFeatures,
}: RestaurantShellProps) {
  const enabledFeatureSet = useMemo(() => new Set(enabledFeatures), [enabledFeatures]);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<RestaurantThemeMode>(DEFAULT_RESTAURANT_THEME);

  const pageMeta = useMemo(() => getCurrentPageMeta(pathname), [pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const persisted = normalizeRestaurantTheme(
        window.localStorage.getItem(RESTAURANT_THEME_STORAGE_KEY),
      );
      if (persisted !== theme) {
        window.setTimeout(() => setTheme(persisted), 0);
        return;
      }
    }
    applyRestaurantTheme(theme);
  }, [theme]);

  const setThemeWithPersist = (nextTheme: RestaurantThemeMode) => {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RESTAURANT_THEME_STORAGE_KEY, nextTheme);
    }
  };

  const sidebarBaseClass =
    "restaurant-shell-sidebar hidden lg:flex lg:h-screen lg:flex-col lg:border-r lg:transition-all lg:duration-200";

  const desktopNavItemBase =
    "restaurant-shell-nav-item group flex items-center rounded-xl text-sm font-medium";

  const navGroups = useMemo(() => {
    const visibleItems = NAV_ITEMS.filter((item) =>
      canAccessRestaurantNavItem({ role, href: item.href, enabledFeatures: enabledFeatureSet }),
    );
    const groups: Array<{ label: NavItem["group"]; items: NavItem[] }> = [
      { label: "Operasyon", items: [] },
      { label: "Menü & Stok", items: [] },
      { label: "Raporlar", items: [] },
      { label: "Sistem & Güvenlik", items: [] },
    ];
    const index = new Map(groups.map((g, i) => [g.label, i]));
    for (const item of visibleItems) {
      const i = index.get(item.group);
      if (i == null) continue;
      groups[i]!.items.push(item);
    }
    return groups;
  }, [role, enabledFeatureSet]);

  const renderNavItems = (mode: "desktop" | "mobile") => {
    const isDesktop = mode === "desktop";
    return navGroups.flatMap((group) => {
      const groupNodes = group.items.map((item) => {
        const active = isNavItemActive(pathname, item);
        const Icon = item.icon;

        return (
          <Link
            key={`${mode}-${item.href}`}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            title={collapsed && isDesktop ? item.label : undefined}
            className={[
              desktopNavItemBase,
              isDesktop && collapsed
                ? "h-11 w-11 justify-center"
                : "min-h-11 justify-start gap-3 px-3",
              active ? "restaurant-shell-nav-item-active" : "",
            ].join(" ")}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {(!collapsed || !isDesktop) && (
              <span className="truncate text-[13px]">{item.label}</span>
            )}
          </Link>
        );
      });

      if (!collapsed || !isDesktop) {
        return [
          <div key={`${mode}-${group.label}`} className="mt-4 first:mt-0">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--rm-sidebar-muted)]">
              {group.label}
            </p>
            <div className="space-y-1">{groupNodes}</div>
          </div>,
        ];
      }

      return groupNodes;
    });
  };

  return (
    <div className="restaurant-shell-root">
      <div className="mx-auto flex min-h-screen w-full max-w-[1720px]">
        <aside
          className={[
            sidebarBaseClass,
            collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_OPEN_WIDTH,
          ].join(" ")}
        >
          <div
            className={`flex h-[73px] items-center border-b border-[var(--rm-sidebar-border)] px-4 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            {!collapsed && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rm-sidebar-muted)]">
                  Menucy
                </p>
                <p className="text-sm font-semibold text-[var(--rm-sidebar-foreground)]">
                  {getRestaurantPanelRoleTitle(role)}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="restaurant-shell-control inline-flex h-9 w-9 items-center justify-center rounded-lg"
              aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {renderNavItems("desktop")}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {supportBanner}
          <header
            className={[
              "restaurant-shell-header sticky top-0 z-30 border-b",
              `restaurant-shell-header-tone-${pageMeta.headerTone}`,
            ].join(" ")}
          >
            <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="restaurant-shell-control inline-flex h-9 w-9 items-center justify-center rounded-lg lg:hidden"
                    aria-label="Menüyü aç"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <p className="restaurant-shell-pill rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    {pageMeta.headerPill}
                  </p>
                </div>
                <h1 className="mt-2 truncate text-lg font-semibold tracking-tight text-[var(--ui-text-primary)] sm:text-xl">
                  {pageMeta.title}
                </h1>
                <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-[var(--ui-text-secondary)]">
                  {pageMeta.description}
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
                <div className="restaurant-theme-toggle" role="group" aria-label="Panel tema secimi">
                  <button
                    type="button"
                    className={`restaurant-theme-option ${
                      theme === "day" ? "restaurant-theme-option-active" : ""
                    }`}
                    onClick={() => setThemeWithPersist("day")}
                    aria-pressed={theme === "day"}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Gündüz
                  </button>
                  <button
                    type="button"
                    className={`restaurant-theme-option ${
                      theme === "night" ? "restaurant-theme-option-active" : ""
                    }`}
                    onClick={() => setThemeWithPersist("night")}
                    aria-pressed={theme === "night"}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    Gece
                  </button>
                </div>

                <div
                  className={[
                    "restaurant-shell-pill hidden items-center gap-2 rounded-full px-2.5 py-1 sm:flex",
                    `restaurant-shell-pill-tone-${pageMeta.headerTone}`,
                  ].join(" ")}
                >
                  <span className="restaurant-shell-live-dot h-1.5 w-1.5 shrink-0 rounded-full" />
                  <p className="text-[11px] font-medium text-[var(--ui-text-secondary)]">
                    Canlı yenileme
                  </p>
                  <span className="text-[11px] tabular-nums text-[var(--ui-text-muted)]">30 sn</span>
                </div>
                <div className="w-full sm:w-auto">{headerAction}</div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rm-page">{children}</div>
          </main>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity lg:hidden ${
          mobileMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        className={`restaurant-shell-sidebar fixed inset-y-0 left-0 z-50 w-[300px] max-w-[88vw] border-r transition-transform duration-200 lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[73px] items-center justify-between border-b border-[var(--rm-sidebar-border)] px-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rm-sidebar-muted)]">
              Menucy
            </p>
                <p className="text-sm font-semibold text-[var(--rm-sidebar-foreground)]">
              {getRestaurantPanelRoleTitle(role)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="restaurant-shell-control inline-flex h-9 w-9 items-center justify-center rounded-lg"
            aria-label="Menüyü kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          {renderNavItems("mobile")}
        </nav>
      </aside>
    </div>
  );
}
