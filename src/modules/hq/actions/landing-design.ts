"use server";

import { revalidatePath } from "next/cache";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import {
  type LandingPublicDesignV1,
  type LandingPublicNavItem,
  inferLinkType,
  isValidHref,
  normalizeHex6,
  parseLandingPublicDesign,
  type LandingNavLinkType,
  type LandingPublicPricing,
} from "@/modules/marketing/landing-public-design";
import {
  getLandingPublicDesignForHq,
  saveLandingPublicDesignJson,
} from "@/modules/marketing/server/landing-design";

export type LandingDesignActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateLanding() {
  revalidatePath("/");
  revalidatePath("/hq/design");
  revalidatePath("/hq/design/genel");
  revalidatePath("/hq/design/renkler");
  revalidatePath("/hq/design/header");
  revalidatePath("/hq/design/butonlar");
  revalidatePath("/hq/design/fiyatlandirma");
}

function readTrim(fd: FormData, key: string, max: number): string {
  return (fd.get(key)?.toString() ?? "").trim().slice(0, max);
}

function readBool(fd: FormData, key: string): boolean {
  const v = fd.get(key)?.toString().toLowerCase();
  return v === "on" || v === "true" || v === "1";
}

export async function saveLandingDesignGeneralAction(
  _prev: LandingDesignActionState | undefined,
  formData: FormData,
): Promise<LandingDesignActionState> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const { design: current } = await getLandingPublicDesignForHq();
    const brandName = readTrim(formData, "brandName", 120);
    const brandTagline = readTrim(formData, "brandTagline", 180);
    const showTaglineInHeader = readBool(formData, "showTaglineInHeader");
    if (!brandName) {
      return { ok: false, message: "Marka adı boş olamaz." };
    }
    const next: LandingPublicDesignV1 = {
      ...current,
      general: {
        brandName,
        brandTagline,
        showTaglineInHeader,
      },
    };
    await saveLandingPublicDesignJson(parseLandingPublicDesign(next));
    revalidateLanding();
    return { ok: true, message: "Genel ayarlar kaydedildi." };
  } catch {
    return { ok: false, message: "Kayıt başarısız. Tekrar deneyin." };
  }
}

export async function saveLandingDesignColorsAction(
  _prev: LandingDesignActionState | undefined,
  formData: FormData,
): Promise<LandingDesignActionState> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const { design: current } = await getLandingPublicDesignForHq();
    const keys = [
      "primaryBg",
      "primaryFg",
      "primaryHoverBg",
      "outlineFg",
      "outlineBorder",
      "outlineHoverBg",
    ] as const;
    const colors = { ...current.colors };
    for (const k of keys) {
      const raw = readTrim(formData, k, 32);
      const hex = normalizeHex6(raw);
      if (!hex) {
        return {
          ok: false,
          message: `Geçersiz renk: ${k}. Lütfen # ile başlayan 6 haneli hex girin.`,
        };
      }
      colors[k] = hex;
    }
    const next: LandingPublicDesignV1 = { ...current, colors };
    await saveLandingPublicDesignJson(parseLandingPublicDesign(next));
    revalidateLanding();
    return { ok: true, message: "Renkler kaydedildi." };
  } catch {
    return { ok: false, message: "Kayıt başarısız. Tekrar deneyin." };
  }
}

function parseNavPayload(raw: string): LandingPublicNavItem[] | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    return data as LandingPublicNavItem[];
  } catch {
    return null;
  }
}

export async function saveLandingDesignHeaderAction(
  _prev: LandingDesignActionState | undefined,
  formData: FormData,
): Promise<LandingDesignActionState> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const { design: current } = await getLandingPublicDesignForHq();
    const payload = formData.get("navPayload")?.toString() ?? "";
    const parsed = parseNavPayload(payload);
    if (!parsed) {
      return { ok: false, message: "Menü verisi okunamadı. Sayfayı yenileyip tekrar deneyin." };
    }
    const headerLabel = readTrim(formData, "headerBarLabel", 120);
    const headerHref = readTrim(formData, "headerBarHref", 500);
    const headerEnabled = readBool(formData, "headerBarEnabled");
    const headerType = inferLinkType(headerHref);
    if (!headerLabel) {
      return { ok: false, message: "Üst çubuk CTA metni boş olamaz." };
    }
    if (!isValidHref(headerHref, headerType)) {
      return {
        ok: false,
        message: "Üst çubuk bağlantısı geçersiz. Dahili için / veya # ile; harici için https:// kullanın.",
      };
    }
    for (const item of parsed) {
      const href = item.href.trim();
      const lt: LandingNavLinkType = inferLinkType(href);
      if (!item.id || !item.label?.trim()) {
        return { ok: false, message: "Menüde boş satır var. Düzenleyin veya silin." };
      }
      if (!isValidHref(href, lt)) {
        return {
          ok: false,
          message: `Geçersiz bağlantı: "${item.label}". Dahili (# veya /) veya harici (https://) kullanın.`,
        };
      }
    }
    const next: LandingPublicDesignV1 = {
      ...current,
      nav: parsed.map((item, index) => {
        const href = item.href.trim().slice(0, 500);
        const lt = inferLinkType(href);
        return {
          ...item,
          id: item.id.trim().slice(0, 64),
          label: item.label.trim().slice(0, 80),
          href,
          sortOrder: index + 1,
          isActive: Boolean(item.isActive),
          linkType: lt,
        };
      }),
      headerBarCta: {
        label: headerLabel,
        href: headerHref,
        enabled: headerEnabled,
      },
    };
    await saveLandingPublicDesignJson(parseLandingPublicDesign(next));
    revalidateLanding();
    return { ok: true, message: "Üst menü ve CTA kaydedildi." };
  } catch {
    return { ok: false, message: "Kayıt başarısız. Tekrar deneyin." };
  }
}

export async function saveLandingDesignButtonsAction(
  _prev: LandingDesignActionState | undefined,
  formData: FormData,
): Promise<LandingDesignActionState> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const { design: current } = await getLandingPublicDesignForHq();
    const heroPrimaryLabel = readTrim(formData, "heroPrimaryLabel", 120);
    const heroPrimaryHref = readTrim(formData, "heroPrimaryHref", 500);
    const heroPrimaryEnabled = readBool(formData, "heroPrimaryEnabled");
    const heroSecondaryLabel = readTrim(formData, "heroSecondaryLabel", 120);
    const heroSecondaryHref = readTrim(formData, "heroSecondaryHref", 500);
    const heroSecondaryEnabled = readBool(formData, "heroSecondaryEnabled");
    if (!heroPrimaryLabel || !heroSecondaryLabel) {
      return { ok: false, message: "Hero buton metinleri boş bırakılamaz." };
    }
    const pType = inferLinkType(heroPrimaryHref);
    const sType = inferLinkType(heroSecondaryHref);
    if (!isValidHref(heroPrimaryHref, pType)) {
      return { ok: false, message: "Birincil CTA bağlantısı geçersiz." };
    }
    if (!isValidHref(heroSecondaryHref, sType)) {
      return { ok: false, message: "İkincil CTA bağlantısı geçersiz." };
    }
    const next: LandingPublicDesignV1 = {
      ...current,
      heroPrimary: {
        label: heroPrimaryLabel,
        href: heroPrimaryHref,
        enabled: heroPrimaryEnabled,
      },
      heroSecondary: {
        label: heroSecondaryLabel,
        href: heroSecondaryHref,
        enabled: heroSecondaryEnabled,
      },
    };
    await saveLandingPublicDesignJson(parseLandingPublicDesign(next));
    revalidateLanding();
    return { ok: true, message: "Hero butonları kaydedildi." };
  } catch {
    return { ok: false, message: "Kayıt başarısız. Tekrar deneyin." };
  }
}

function parsePricingPayload(raw: string): LandingPublicPricing | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    return data as LandingPublicPricing;
  } catch {
    return null;
  }
}

export async function saveLandingDesignPricingAction(
  _prev: LandingDesignActionState | undefined,
  formData: FormData,
): Promise<LandingDesignActionState> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const { design: current } = await getLandingPublicDesignForHq();
    const payload = formData.get("pricingPayload")?.toString() ?? "";
    const parsed = parsePricingPayload(payload);
    if (!parsed) {
      return { ok: false, message: "Fiyatlandırma verisi okunamadı. Sayfayı yenileyip tekrar deneyin." };
    }
    for (const plan of parsed.plans ?? []) {
      const href = typeof plan.cta?.href === "string" ? plan.cta.href.trim() : "";
      const lt = inferLinkType(href);
      if (!plan.name?.trim()) {
        return { ok: false, message: "Tüm paketlerin adı dolu olmalıdır." };
      }
      if (!isValidHref(href, lt)) {
        return {
          ok: false,
          message: `Geçersiz CTA bağlantısı: "${plan.name}". Dahili (# veya /) veya harici (https://) kullanın.`,
        };
      }
    }
    const next: LandingPublicDesignV1 = {
      ...current,
      pricing: parsed,
    };
    await saveLandingPublicDesignJson(parseLandingPublicDesign(next));
    revalidateLanding();
    return { ok: true, message: "Fiyatlandırma bölümü kaydedildi." };
  } catch {
    return { ok: false, message: "Kayıt başarısız. Tekrar deneyin." };
  }
}
