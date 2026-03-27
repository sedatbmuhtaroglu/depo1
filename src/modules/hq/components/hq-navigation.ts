import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CreditCard,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Palette,
  Scale,
  Search,
  Send,
  Users,
  Wrench,
} from "lucide-react";

export type HqNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export const HQ_NAV_SECTIONS: Array<{ title: string; items: HqNavItem[] }> = [
  {
    title: "Operasyon",
    items: [
      { href: "/hq", label: "Genel bakış", icon: LayoutDashboard },
      { href: "/hq/analytics", label: "Çapraz Tenant Analitiği", icon: BarChart3 },
      { href: "/hq/tenants", label: "Tenantlar", icon: Building2 },
      { href: "/hq/packages", label: "Paket ayarlari", icon: Package },
      { href: "/hq/leads", label: "Satış & leadler", icon: Users },
    ],
  },
  {
    title: "Muhasebe",
    items: [
      { href: "/hq/accounting", label: "Genel bakış", icon: Calculator },
      { href: "/hq/accounting/records", label: "Ticari kayıtlar", icon: BarChart3 },
      { href: "/hq/accounting/payments", label: "Tahsilatlar", icon: CreditCard },
    ],
  },
  {
    title: "Pazarlama",
    items: [
      { href: "/hq/marketing", label: "Marketing", icon: Megaphone },
      { href: "/hq/marketing/submissions", label: "Form başvuruları", icon: Send },
    ],
  },
  {
    title: "Tasarım",
    items: [{ href: "/hq/design", label: "Landing tasarımı", icon: Palette }],
  },
  {
    title: "İçerik",
    items: [
      { href: "/hq/content/blog", label: "Blog", icon: BookOpen },
      { href: "/hq/content/pages", label: "Sayfalar", icon: FileText },
      { href: "/hq/content/redirects", label: "Redirectler", icon: ArrowLeftRight },
      { href: "/hq/media", label: "Medya", icon: ImageIcon },
      { href: "/hq/settings/seo", label: "SEO", icon: Search },
      { href: "/hq/settings/maintenance", label: "Planli bakim", icon: Wrench },
      { href: "/hq/settings/legal", label: "Yasal metinler", icon: Scale },
    ],
  },
];

export const HQ_QUICK_NAV_ITEMS: HqNavItem[] = [
  { href: "/hq", label: "Özet", icon: LayoutDashboard },
  { href: "/hq/analytics", label: "Analitik", icon: BarChart3 },
  { href: "/hq/leads", label: "Leadler", icon: Users },
  { href: "/hq/tenants", label: "Tenantlar", icon: Building2 },
  { href: "/hq/marketing", label: "Marketing", icon: Megaphone },
];

