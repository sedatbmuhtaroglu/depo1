"use server";

import { revalidatePath } from "next/cache";
import { landingBrand } from "@/content/landing";
import { buildDefaultLegalPublicPages } from "@/content/legal-default-html";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  LEGAL_PUBLIC_PAGES_VERSION,
  type LegalPublicPagesV1,
} from "@/modules/marketing/legal-public-pages";
import { sanitizeRichTextHtml } from "@/modules/marketing/server/rich-text";
import { ensureMainMarketingSiteId } from "@/modules/marketing/server/landing-content";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";

type ActionResult = { success: true; message: string } | { success: false; message: string };

const HTML_MAX = 500_000;

function normalizeLegalHtml(value: FormDataEntryValue | null): string {
  return sanitizeRichTextHtml(value?.toString() ?? "", HTML_MAX);
}

export async function saveLegalPublicPagesAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const kullaniciSozlesmesiHtml = normalizeLegalHtml(formData.get("kullaniciHtml"));
    const kvkkHtml = normalizeLegalHtml(formData.get("kvkkHtml"));
    const gizlilikHtml = normalizeLegalHtml(formData.get("gizlilikHtml"));

    if (!kullaniciSozlesmesiHtml.trim() || !kvkkHtml.trim() || !gizlilikHtml.trim()) {
      return { success: false, message: "Uc metin alani da dolu olmalidir." };
    }

    const payload: LegalPublicPagesV1 = {
      version: LEGAL_PUBLIC_PAGES_VERSION,
      kullaniciSozlesmesiHtml,
      kvkkHtml,
      gizlilikHtml,
    };

    const siteId = await ensureMainMarketingSiteId();
    await prisma.marketingSiteConfig.update({
      where: { id: siteId },
      data: { legalPublicPages: payload as unknown as Prisma.InputJsonValue },
    });

    revalidatePath("/");
    revalidatePath("/legal/kullanici-sozlesmesi");
    revalidatePath("/legal/kvkk");
    revalidatePath("/legal/gizlilik");
    revalidatePath("/hq/settings/legal");

    return { success: true, message: "Yasal metinler kaydedildi." };
  } catch (e) {
    console.error("[saveLegalPublicPagesAction]", e);
    return { success: false, message: "Yasal metinler kaydedilemedi." };
  }
}

export async function resetLegalPublicPagesToDefaultsAction(): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const siteId = await ensureMainMarketingSiteId();
    const defaults = buildDefaultLegalPublicPages(landingBrand.name);

    await prisma.marketingSiteConfig.update({
      where: { id: siteId },
      data: { legalPublicPages: defaults as unknown as Prisma.InputJsonValue },
    });

    revalidatePath("/");
    revalidatePath("/legal/kullanici-sozlesmesi");
    revalidatePath("/legal/kvkk");
    revalidatePath("/legal/gizlilik");
    revalidatePath("/hq/settings/legal");

    return { success: true, message: "Varsayilan metinlere donuldu." };
  } catch (e) {
    console.error("[resetLegalPublicPagesToDefaultsAction]", e);
    return { success: false, message: "Sifirlama basarisiz." };
  }
}
