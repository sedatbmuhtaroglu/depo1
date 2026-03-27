import type { TenantSetupStep, TenantSetupStepCode } from "@/core/tenancy/setup-progress";

type SetupStepPresentation = {
  title: string;
  description: string;
  actionLabel: string | null;
  actionHref: string | null;
};

const STEP_PRESENTATION: Record<TenantSetupStepCode, SetupStepPresentation> = {
  tenant_created: {
    title: "Tenant kaydı oluşturuldu",
    description: "Merkezi tenant kaydı tamamlandı.",
    actionLabel: null,
    actionHref: null,
  },
  domain_ready: {
    title: "Domain/Subdomain hazır",
    description: "Storefront erişimi için aktif alan adı ayarı oluşturulmuş olmalı.",
    actionLabel: "Domain ayarlarına git",
    actionHref: "/restaurant/settings",
  },
  first_restaurant_created: {
    title: "İlk restoran kaydı",
    description: "Operasyon yüzeyleri için en az bir restoran tanımı gerekli.",
    actionLabel: "Restoran ayarlarına git",
    actionHref: "/restaurant/settings",
  },
  menu_seeded_or_created: {
    title: "Menü veya ürün girildi",
    description: "Canlı sipariş akışı için menü/ürün verisi bulunmalı.",
    actionLabel: "Menü yönetimine git",
    actionHref: "/restaurant/menu",
  },
  tables_created: {
    title: "Masa kurulumu yapıldı",
    description: "QR ve servis akışı için en az bir masa gerekli.",
    actionLabel: "Masa yönetimine git",
    actionHref: "/restaurant/tables",
  },
  staff_invited_or_created: {
    title: "Personel hesabı eklendi",
    description: "Manager/waiter/kitchen akışları için personel hesabı tanımlanmalı.",
    actionLabel: "Kullanıcılara git",
    actionHref: "/restaurant/users",
  },
  payment_configured: {
    title: "Ödeme ayarı",
    description: "Ödeme ve tahsilat akışlarını tamamlamak için ödeme ayarları yapılabilir.",
    actionLabel: "Ödeme ayarlarına git",
    actionHref: "/restaurant/settings",
  },
  publishing_ready: {
    title: "Canlıya alma hazırlığı",
    description: "Storefront yayınına geçmek için zorunlu adımlar tamamlanmalı.",
    actionLabel: "Menüye git",
    actionHref: "/restaurant/menu",
  },
};

export function getSetupStepPresentation(code: TenantSetupStepCode): SetupStepPresentation {
  return STEP_PRESENTATION[code];
}

export function getSetupStatusLabel(step: TenantSetupStep): string {
  if (step.completed) return "Tamamlandı";
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
