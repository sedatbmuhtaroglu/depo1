import type { TenantSetupStep, TenantSetupStepCode } from "@/core/tenancy/setup-progress";

type SetupStepPresentation = {
  title: string;
  description: string;
  actionLabel: string | null;
  actionHref: string | null;
};

const STEP_PRESENTATION: Record<TenantSetupStepCode, SetupStepPresentation> = {
  tenant_created: {
    title: "Tenant kaydi olusturuldu",
    description: "Merkezi tenant kaydi tamamlandi.",
    actionLabel: null,
    actionHref: null,
  },
  domain_ready: {
    title: "Domain/Subdomain hazir",
    description: "Storefront erisimi icin aktif alan adi ayari olusturulmus olmali.",
    actionLabel: "Domain ayarlarina git",
    actionHref: "/restaurant/settings",
  },
  first_restaurant_created: {
    title: "Ilk restoran kaydi",
    description: "Operasyon yuzeyleri icin en az bir restoran tanimi gerekli.",
    actionLabel: "Restoran ayarlarina git",
    actionHref: "/restaurant/settings",
  },
  menu_seeded_or_created: {
    title: "Menu veya urun girildi",
    description: "Canli siparis akisi icin menu/urun verisi bulunmali.",
    actionLabel: "Menu yonetimine git",
    actionHref: "/restaurant/menu",
  },
  tables_created: {
    title: "Masa kurulumu yapildi",
    description: "QR ve servis akisi icin en az bir masa gerekli.",
    actionLabel: "Masa yonetimine git",
    actionHref: "/restaurant/tables",
  },
  staff_invited_or_created: {
    title: "Personel hesabi eklendi",
    description: "Manager/waiter/kitchen akislari icin personel hesabi tanimlanmali.",
    actionLabel: "Kullanicilara git",
    actionHref: "/restaurant/users",
  },
  payment_configured: {
    title: "Odeme ayari",
    description: "Odeme ve tahsilat akislarini tamamlamak icin odeme ayarlari yapilabilir.",
    actionLabel: "Odeme ayarlarina git",
    actionHref: "/restaurant/settings",
  },
  publishing_ready: {
    title: "Canliya alma hazirligi",
    description: "Storefront yayinina gecmek icin zorunlu adimlar tamamlanmali.",
    actionLabel: "Menuye git",
    actionHref: "/restaurant/menu",
  },
};

export function getSetupStepPresentation(code: TenantSetupStepCode): SetupStepPresentation {
  return STEP_PRESENTATION[code];
}

export function getSetupStatusLabel(step: TenantSetupStep): string {
  if (step.completed) return "Tamamlandi";
  return step.required ? "Eksik" : "Opsiyonel";
}

export function sortSetupStepsForDisplay(steps: TenantSetupStep[]): TenantSetupStep[] {
  const indexByCode = new Map<TenantSetupStepCode, number>(
    (Object.keys(STEP_PRESENTATION) as TenantSetupStepCode[]).map((code, index) => [code, index]),
  );

  return [...steps].sort((a, b) => {
    const aIndex = indexByCode.get(a.code) ?? 999;
    const bIndex = indexByCode.get(b.code) ?? 999;
    return aIndex - bIndex;
  });
}
