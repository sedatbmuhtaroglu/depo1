"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import {
  DEFAULT_LANDING_THEME,
  getDefaultLandingSections,
  isLandingSectionType,
  type LandingNavigationItem,
  type LandingSectionConfig,
  type LandingThemeTokens,
} from "@/modules/marketing/landing-cms-schema";

type ActionResult = { success: true; message: string } | { success: false; message: string };

const MARKETING_SITE_KEY = "main";

function normalizeText(value: FormDataEntryValue | null, maxLength: number): string {
  return (value?.toString() ?? "").trim().slice(0, maxLength);
}

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = normalizeText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  const raw = value?.toString().toLowerCase() ?? "";
  return raw === "true" || raw === "on" || raw === "1" || raw === "yes";
}

function isAllowedHref(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  );
}

function normalizeOptionalHref(value: FormDataEntryValue | null, maxLength = 320): string | null {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) return null;
  if (!isAllowedHref(normalized)) return null;
  return normalized;
}

function parseLines(value: FormDataEntryValue | null): string[] {
  return (value?.toString() ?? "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function splitLine(line: string, maxParts: number): string[] {
  return line.split("|").map((part) => part.trim()).slice(0, maxParts);
}

function parseSlug(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,64}$/.test(normalized)) return null;
  return normalized;
}

async function ensureMainSiteId() {
  const site = await prisma.marketingSiteConfig.upsert({
    where: { key: MARKETING_SITE_KEY },
    update: {},
    create: {
      key: MARKETING_SITE_KEY,
      heroTitle: "MENUCY",
      heroDescription: "Landing setup bekleniyor.",
      heroPrimaryCtaLabel: "Iletisim",
      heroPrimaryCtaHref: "#lead-form",
      formSectionTitle: "Satis Formu",
      formSubmitLabel: "Gonder",
    },
    select: { id: true },
  });

  return site.id;
}

function revalidateMarketingPaths() {
  revalidatePath("/");
  revalidatePath("/hq/marketing");
  revalidatePath("/hq/marketing/builder");
  revalidatePath("/hq/marketing/settings");
  revalidatePath("/hq/marketing/homepage");
  revalidatePath("/hq/marketing/categories");
  revalidatePath("/hq/marketing/submissions");
  revalidatePath("/hq/leads");
}

function parseJsonPayload<T>(value: FormDataEntryValue | null, fallback: T): T {
  const raw = value?.toString().trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("LANDING_BUILDER_PAYLOAD");
  }
}

function normalizeThemePayload(input: unknown): LandingThemeTokens {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const keys = Object.keys(DEFAULT_LANDING_THEME) as Array<keyof LandingThemeTokens>;
  const normalized = { ...DEFAULT_LANDING_THEME };
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      normalized[key] = value.trim().slice(0, 16);
    }
  }
  return normalized;
}

function normalizeLandingSectionsPayload(input: unknown): LandingSectionConfig[] {
  const defaults = getDefaultLandingSections();
  if (!Array.isArray(input)) return defaults;

  const byType = new Map<string, LandingSectionConfig>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const typeRaw = candidate.sectionType;
    if (typeof typeRaw !== "string" || !isLandingSectionType(typeRaw)) continue;

    const payload =
      candidate.payload && typeof candidate.payload === "object" && !Array.isArray(candidate.payload)
        ? (candidate.payload as LandingSectionConfig["payload"])
        : {};

    byType.set(typeRaw, {
      sectionType: typeRaw,
      isEnabled: Boolean(candidate.isEnabled),
      sortOrder: Number.isFinite(candidate.sortOrder) ? Number(candidate.sortOrder) : 0,
      eyebrowHtml: typeof candidate.eyebrowHtml === "string" ? candidate.eyebrowHtml : "",
      titleHtml: typeof candidate.titleHtml === "string" ? candidate.titleHtml : "",
      subtitleHtml: typeof candidate.subtitleHtml === "string" ? candidate.subtitleHtml : "",
      bodyHtml: typeof candidate.bodyHtml === "string" ? candidate.bodyHtml : "",
      ctaPrimaryLabelHtml: typeof candidate.ctaPrimaryLabelHtml === "string" ? candidate.ctaPrimaryLabelHtml : "",
      ctaPrimaryHref:
        typeof candidate.ctaPrimaryHref === "string" && isAllowedHref(candidate.ctaPrimaryHref)
          ? candidate.ctaPrimaryHref.slice(0, 320)
          : "",
      ctaSecondaryLabelHtml: typeof candidate.ctaSecondaryLabelHtml === "string" ? candidate.ctaSecondaryLabelHtml : "",
      ctaSecondaryHref:
        typeof candidate.ctaSecondaryHref === "string" && isAllowedHref(candidate.ctaSecondaryHref)
          ? candidate.ctaSecondaryHref.slice(0, 320)
          : "",
      mediaUrl: typeof candidate.mediaUrl === "string" ? candidate.mediaUrl.slice(0, 320) : "",
      mediaAlt: typeof candidate.mediaAlt === "string" ? candidate.mediaAlt.slice(0, 180) : "",
      mediaCaptionHtml: typeof candidate.mediaCaptionHtml === "string" ? candidate.mediaCaptionHtml : "",
      payload,
    });
  }

  return defaults.map((section, index) => {
    const normalized = byType.get(section.sectionType);
    return normalized
      ? {
          ...normalized,
          sortOrder: Number.isFinite(normalized.sortOrder) && normalized.sortOrder > 0 ? normalized.sortOrder : index + 1,
        }
      : section;
  });
}

function normalizeLandingNavigationPayload(input: unknown): LandingNavigationItem[] {
  if (!Array.isArray(input)) return [];
  const seenSlugs = new Set<string>();
  const result: LandingNavigationItem[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const slug = parseSlug(typeof candidate.slug === "string" ? candidate.slug : "");
    if (!slug || seenSlugs.has(slug)) {
      throw new Error("LANDING_BUILDER_NAV_SLUG");
    }
    const hrefRaw = typeof candidate.href === "string" ? candidate.href.trim() : "";
    if (!hrefRaw || !isAllowedHref(hrefRaw)) {
      throw new Error("LANDING_BUILDER_NAV_HREF");
    }

    const children = Array.isArray(candidate.children) ? candidate.children : [];
    const normalizedChildren = children
      .filter((child): child is Record<string, unknown> => Boolean(child) && typeof child === "object")
      .map((child, index) => {
        const childHrefRaw = typeof child.href === "string" ? child.href.trim() : "";
        if (!childHrefRaw || !isAllowedHref(childHrefRaw)) {
          throw new Error("LANDING_BUILDER_NAV_HREF");
        }
        return {
          title: normalizeText(typeof child.title === "string" ? child.title : "", 140),
          href: childHrefRaw.slice(0, 320),
          sortOrder: Number.isFinite(child.sortOrder) && Number(child.sortOrder) > 0 ? Number(child.sortOrder) : index + 1,
          isActive: Boolean(child.isActive),
          badgeText: normalizeOptionalText(typeof child.badgeText === "string" ? child.badgeText : null, 64),
          openInNewTab: Boolean(child.openInNewTab),
        };
      });

    seenSlugs.add(slug);
    result.push({
      title: normalizeText(typeof candidate.title === "string" ? candidate.title : "", 140),
      slug,
      href: hrefRaw.slice(0, 320),
      sortOrder: Number.isFinite(candidate.sortOrder) && Number(candidate.sortOrder) > 0 ? Number(candidate.sortOrder) : result.length + 1,
      isActive: Boolean(candidate.isActive),
      badgeText: normalizeOptionalText(typeof candidate.badgeText === "string" ? candidate.badgeText : null, 64),
      openInNewTab: Boolean(candidate.openInNewTab),
      children: normalizedChildren,
    });
  }

  return result;
}

export async function saveMarketingGeneralSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const brandName = normalizeText(formData.get("brandName"), 120);
    const brandTagline = normalizeOptionalText(formData.get("brandTagline"), 180);
    const isPublished = parseBoolean(formData.get("isPublished"));
    const seoTitle = normalizeOptionalText(formData.get("seoTitle"), 160);
    const seoDescription = normalizeOptionalText(formData.get("seoDescription"), 320);
    const seoCanonicalUrl = normalizeOptionalHref(formData.get("seoCanonicalUrl"), 320);
    const seoOgTitle = normalizeOptionalText(formData.get("seoOgTitle"), 160);
    const seoOgDescription = normalizeOptionalText(formData.get("seoOgDescription"), 320);
    const seoOgImageUrl = normalizeOptionalHref(formData.get("seoOgImageUrl"), 320);

    if (!brandName) {
      return { success: false, message: "Marka adi zorunludur." };
    }
    if (formData.get("seoCanonicalUrl")?.toString().trim() && !seoCanonicalUrl) {
      return { success: false, message: "Canonical URL gecersiz." };
    }
    if (formData.get("seoOgImageUrl")?.toString().trim() && !seoOgImageUrl) {
      return { success: false, message: "OG gorsel URL gecersiz." };
    }

    const siteId = await ensureMainSiteId();

    await prisma.marketingSiteConfig.update({
      where: { id: siteId },
      data: {
        brandName,
        brandTagline,
        isPublished,
        seoTitle,
        seoDescription,
        seoCanonicalUrl,
        seoOgTitle,
        seoOgDescription,
        seoOgImageUrl,
      },
    });

    revalidateMarketingPaths();
    return { success: true, message: "Genel ayarlar kaydedildi." };
  } catch {
    return { success: false, message: "Genel ayarlar kaydedilemedi." };
  }
}

export async function saveMarketingHomepageContentAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const announcementEnabled = parseBoolean(formData.get("announcementEnabled"));
    const announcementText = normalizeOptionalText(formData.get("announcementText"), 240);
    const announcementCtaLabel = normalizeOptionalText(formData.get("announcementCtaLabel"), 80);
    const announcementCtaHref = normalizeOptionalHref(formData.get("announcementCtaHref"), 220);

    const heroKicker = normalizeOptionalText(formData.get("heroKicker"), 120);
    const heroTitle = normalizeText(formData.get("heroTitle"), 180);
    const heroDescription = normalizeText(formData.get("heroDescription"), 600);
    const heroPrimaryCtaLabel = normalizeText(formData.get("heroPrimaryCtaLabel"), 80);
    const heroPrimaryCtaHref = normalizeOptionalHref(formData.get("heroPrimaryCtaHref"), 220);
    const heroSecondaryCtaLabel = normalizeOptionalText(formData.get("heroSecondaryCtaLabel"), 80);
    const heroSecondaryCtaHref = normalizeOptionalHref(formData.get("heroSecondaryCtaHref"), 220);

    const trustSectionTitle = normalizeOptionalText(formData.get("trustSectionTitle"), 120);
    const trustSectionDescription = normalizeOptionalText(formData.get("trustSectionDescription"), 320);
    const featuresSectionTitle = normalizeOptionalText(formData.get("featuresSectionTitle"), 120);
    const featuresSectionDescription = normalizeOptionalText(
      formData.get("featuresSectionDescription"),
      320,
    );
    const howItWorksSectionTitle = normalizeOptionalText(formData.get("howItWorksSectionTitle"), 120);
    const howItWorksSectionDescription = normalizeOptionalText(
      formData.get("howItWorksSectionDescription"),
      320,
    );
    const categorySectionTitle = normalizeOptionalText(formData.get("categorySectionTitle"), 120);
    const categorySectionDescription = normalizeOptionalText(
      formData.get("categorySectionDescription"),
      320,
    );
    const ctaSectionTitle = normalizeOptionalText(formData.get("ctaSectionTitle"), 140);
    const ctaSectionDescription = normalizeOptionalText(formData.get("ctaSectionDescription"), 320);
    const ctaPrimaryLabel = normalizeOptionalText(formData.get("ctaPrimaryLabel"), 80);
    const ctaPrimaryHref = normalizeOptionalHref(formData.get("ctaPrimaryHref"), 220);
    const faqSectionTitle = normalizeOptionalText(formData.get("faqSectionTitle"), 120);
    const faqSectionDescription = normalizeOptionalText(formData.get("faqSectionDescription"), 320);
    const formSectionTitle = normalizeText(formData.get("formSectionTitle"), 140);
    const formSectionDescription = normalizeOptionalText(formData.get("formSectionDescription"), 320);
    const formSubmitLabel = normalizeText(formData.get("formSubmitLabel"), 80);
    const formConsentText = normalizeOptionalText(formData.get("formConsentText"), 280);

    if (!heroTitle || !heroDescription || !heroPrimaryCtaLabel || !formSectionTitle || !formSubmitLabel) {
      return { success: false, message: "Zorunlu icerik alanlari bos birakilamaz." };
    }
    if (!heroPrimaryCtaHref) {
      return { success: false, message: "Hero birincil CTA linki gecersiz." };
    }
    if (formData.get("heroSecondaryCtaHref")?.toString().trim() && !heroSecondaryCtaHref) {
      return { success: false, message: "Hero ikincil CTA linki gecersiz." };
    }
    if (formData.get("announcementCtaHref")?.toString().trim() && !announcementCtaHref) {
      return { success: false, message: "Announcement CTA linki gecersiz." };
    }
    if (formData.get("ctaPrimaryHref")?.toString().trim() && !ctaPrimaryHref) {
      return { success: false, message: "Kapanis CTA linki gecersiz." };
    }

    const trustBadgeLines = parseLines(formData.get("trustBadgeLines"));
    const logoLines = parseLines(formData.get("logoLines"));
    const featureLines = parseLines(formData.get("featureLines"));
    const howItWorksLines = parseLines(formData.get("howItWorksLines"));
    const faqLines = parseLines(formData.get("faqLines"));

    const trustBadges = trustBadgeLines.map((line, index) => {
      const [label, sublabel = "", iconName = ""] = splitLine(line, 3);
      if (!label) {
        throw new Error(`TRUST_BADGE_LINE_${index + 1}`);
      }
      return {
        label: label.slice(0, 120),
        sublabel: sublabel ? sublabel.slice(0, 220) : null,
        iconName: iconName ? iconName.slice(0, 64) : null,
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const logos = logoLines.map((line, index) => {
      const [name, logoUrl = "", targetUrl = ""] = splitLine(line, 3);
      if (!name || !logoUrl || !isAllowedHref(logoUrl)) {
        throw new Error(`LOGO_LINE_${index + 1}`);
      }
      if (targetUrl && !isAllowedHref(targetUrl)) {
        throw new Error(`LOGO_TARGET_LINE_${index + 1}`);
      }
      return {
        name: name.slice(0, 120),
        logoUrl: logoUrl.slice(0, 320),
        targetUrl: targetUrl ? targetUrl.slice(0, 320) : null,
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const features = featureLines.map((line, index) => {
      const [title, description = "", iconName = "", ctaLabel = "", ctaHref = ""] = splitLine(line, 5);
      if (!title || !description) {
        throw new Error(`FEATURE_LINE_${index + 1}`);
      }
      if (ctaHref && !isAllowedHref(ctaHref)) {
        throw new Error(`FEATURE_CTA_LINE_${index + 1}`);
      }
      return {
        title: title.slice(0, 140),
        description: description.slice(0, 420),
        iconName: iconName ? iconName.slice(0, 64) : null,
        ctaLabel: ctaLabel ? ctaLabel.slice(0, 80) : null,
        ctaHref: ctaHref ? ctaHref.slice(0, 220) : null,
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const howItWorks = howItWorksLines.map((line, index) => {
      const [title, description = ""] = splitLine(line, 2);
      if (!title || !description) {
        throw new Error(`HOW_LINE_${index + 1}`);
      }
      return {
        title: title.slice(0, 140),
        description: description.slice(0, 420),
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const faqs = faqLines.map((line, index) => {
      const [question, answer = ""] = splitLine(line, 2);
      if (!question || !answer) {
        throw new Error(`FAQ_LINE_${index + 1}`);
      }
      return {
        question: question.slice(0, 220),
        answer: answer.slice(0, 3000),
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const siteId = await ensureMainSiteId();

    await prisma.$transaction(async (tx) => {
      await tx.marketingSiteConfig.update({
        where: { id: siteId },
        data: {
          announcementEnabled,
          announcementText,
          announcementCtaLabel,
          announcementCtaHref,
          heroKicker,
          heroTitle,
          heroDescription,
          heroPrimaryCtaLabel,
          heroPrimaryCtaHref,
          heroSecondaryCtaLabel,
          heroSecondaryCtaHref,
          trustSectionTitle,
          trustSectionDescription,
          featuresSectionTitle,
          featuresSectionDescription,
          howItWorksSectionTitle,
          howItWorksSectionDescription,
          categorySectionTitle,
          categorySectionDescription,
          ctaSectionTitle,
          ctaSectionDescription,
          ctaPrimaryLabel,
          ctaPrimaryHref,
          faqSectionTitle,
          faqSectionDescription,
          formSectionTitle,
          formSectionDescription,
          formSubmitLabel,
          formConsentText,
        },
      });

      await tx.marketingTrustBadge.deleteMany({ where: { siteConfigId: siteId } });
      await tx.marketingLogo.deleteMany({ where: { siteConfigId: siteId } });
      await tx.marketingFeature.deleteMany({ where: { siteConfigId: siteId } });
      await tx.marketingHowItWorksStep.deleteMany({ where: { siteConfigId: siteId } });
      await tx.marketingFaq.deleteMany({ where: { siteConfigId: siteId } });

      if (trustBadges.length > 0) {
        await tx.marketingTrustBadge.createMany({ data: trustBadges.map((item) => ({ ...item, siteConfigId: siteId })) });
      }
      if (logos.length > 0) {
        await tx.marketingLogo.createMany({ data: logos.map((item) => ({ ...item, siteConfigId: siteId })) });
      }
      if (features.length > 0) {
        await tx.marketingFeature.createMany({ data: features.map((item) => ({ ...item, siteConfigId: siteId })) });
      }
      if (howItWorks.length > 0) {
        await tx.marketingHowItWorksStep.createMany({
          data: howItWorks.map((item) => ({ ...item, siteConfigId: siteId })),
        });
      }
      if (faqs.length > 0) {
        await tx.marketingFaq.createMany({ data: faqs.map((item) => ({ ...item, siteConfigId: siteId })) });
      }
    });

    revalidateMarketingPaths();
    return { success: true, message: "Ana sayfa icerigi kaydedildi." };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TRUST_BADGE_LINE_")) {
      return { success: false, message: "Trust badge satir formati gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("LOGO_LINE_")) {
      return { success: false, message: "Logo satir formati gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("LOGO_TARGET_LINE_")) {
      return { success: false, message: "Logo hedef linki gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("FEATURE_LINE_")) {
      return { success: false, message: "Feature satir formati gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("FEATURE_CTA_LINE_")) {
      return { success: false, message: "Feature CTA linki gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("HOW_LINE_")) {
      return { success: false, message: "Nasil calisir satir formati gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("FAQ_LINE_")) {
      return { success: false, message: "FAQ satir formati gecersiz." };
    }
    return { success: false, message: "Ana sayfa icerigi kaydedilemedi." };
  }
}

export async function saveMarketingCategoriesAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const categoryLines = parseLines(formData.get("categoryLines"));
    const subcategoryLines = parseLines(formData.get("subcategoryLines"));

    const parsedCategories = categoryLines.map((line, index) => {
      const [slugRaw, title, description = "", iconName = ""] = splitLine(line, 4);
      const slug = parseSlug(slugRaw);
      if (!slug || !title) {
        throw new Error(`CATEGORY_LINE_${index + 1}`);
      }
      return {
        slug,
        title: title.slice(0, 140),
        description: description ? description.slice(0, 320) : null,
        iconName: iconName ? iconName.slice(0, 64) : null,
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const parsedSubcategories = subcategoryLines.map((line, index) => {
      const [categorySlugRaw, slugRaw, title, description = "", ctaLabel = "", ctaHref = ""] = splitLine(
        line,
        6,
      );
      const categorySlug = parseSlug(categorySlugRaw);
      const slug = parseSlug(slugRaw);
      if (!categorySlug || !slug || !title) {
        throw new Error(`SUBCATEGORY_LINE_${index + 1}`);
      }
      if (ctaHref && !isAllowedHref(ctaHref)) {
        throw new Error(`SUBCATEGORY_CTA_LINE_${index + 1}`);
      }
      return {
        categorySlug,
        slug,
        title: title.slice(0, 140),
        description: description ? description.slice(0, 320) : null,
        ctaLabel: ctaLabel ? ctaLabel.slice(0, 80) : null,
        ctaHref: ctaHref ? ctaHref.slice(0, 220) : null,
        sortOrder: index + 1,
        isEnabled: true,
      };
    });

    const siteId = await ensureMainSiteId();

    await prisma.$transaction(async (tx) => {
      const existingCategories = await tx.marketingCategory.findMany({
        where: { siteConfigId: siteId },
        select: { id: true },
      });
      const categoryIds = existingCategories.map((item) => item.id);

      if (categoryIds.length > 0) {
        await tx.marketingSubcategory.deleteMany({
          where: { categoryId: { in: categoryIds } },
        });
      }
      await tx.marketingCategory.deleteMany({ where: { siteConfigId: siteId } });

      const categoryMap = new Map<string, number>();
      for (const category of parsedCategories) {
        const created = await tx.marketingCategory.create({
          data: {
            siteConfigId: siteId,
            slug: category.slug,
            title: category.title,
            description: category.description,
            iconName: category.iconName,
            sortOrder: category.sortOrder,
            isEnabled: category.isEnabled,
          },
          select: { id: true, slug: true },
        });
        categoryMap.set(created.slug, created.id);
      }

      for (const subcategory of parsedSubcategories) {
        const categoryId = categoryMap.get(subcategory.categorySlug);
        if (!categoryId) {
          throw new Error(`SUBCATEGORY_PARENT_${subcategory.categorySlug}`);
        }
        await tx.marketingSubcategory.create({
          data: {
            categoryId,
            slug: subcategory.slug,
            title: subcategory.title,
            description: subcategory.description,
            ctaLabel: subcategory.ctaLabel,
            ctaHref: subcategory.ctaHref,
            sortOrder: subcategory.sortOrder,
            isEnabled: subcategory.isEnabled,
          },
        });
      }
    });

    revalidateMarketingPaths();
    return { success: true, message: "Kategori ve alt kategori icerigi kaydedildi." };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CATEGORY_LINE_")) {
      return { success: false, message: "Kategori satir formati gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("SUBCATEGORY_LINE_")) {
      return { success: false, message: "Alt kategori satir formati gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("SUBCATEGORY_CTA_LINE_")) {
      return { success: false, message: "Alt kategori CTA linki gecersiz." };
    }
    if (error instanceof Error && error.message.startsWith("SUBCATEGORY_PARENT_")) {
      return {
        success: false,
        message: "Alt kategori satirinda tanimsiz categorySlug kullanildi.",
      };
    }
    return { success: false, message: "Kategori icerigi kaydedilemedi." };
  }
}

export async function saveMarketingLandingBuilderAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const brandName = normalizeText(formData.get("brandName"), 120);
    const brandTagline = normalizeOptionalText(formData.get("brandTagline"), 180);
    const isPublished = parseBoolean(formData.get("isPublished"));
    const seoTitle = normalizeOptionalText(formData.get("seoTitle"), 160);
    const seoDescription = normalizeOptionalText(formData.get("seoDescription"), 320);
    const seoCanonicalUrl = normalizeOptionalHref(formData.get("seoCanonicalUrl"), 320);
    const seoOgTitle = normalizeOptionalText(formData.get("seoOgTitle"), 160);
    const seoOgDescription = normalizeOptionalText(formData.get("seoOgDescription"), 320);
    const seoOgImageUrl = normalizeOptionalHref(formData.get("seoOgImageUrl"), 320);

    if (!brandName) {
      return { success: false, message: "Marka adi zorunludur." };
    }
    if (formData.get("seoCanonicalUrl")?.toString().trim() && !seoCanonicalUrl) {
      return { success: false, message: "Canonical URL gecersiz." };
    }
    if (formData.get("seoOgImageUrl")?.toString().trim() && !seoOgImageUrl) {
      return { success: false, message: "OG gorsel URL gecersiz." };
    }

    const theme = normalizeThemePayload(parseJsonPayload(formData.get("themePayload"), DEFAULT_LANDING_THEME));
    const sections = normalizeLandingSectionsPayload(parseJsonPayload(formData.get("sectionsPayload"), getDefaultLandingSections()));
    const navItems = normalizeLandingNavigationPayload(parseJsonPayload(formData.get("navItemsPayload"), []));
    const siteId = await ensureMainSiteId();

    await prisma.$transaction(async (tx) => {
      await tx.marketingSiteConfig.update({
        where: { id: siteId },
        data: {
          brandName,
          brandTagline,
          isPublished,
          seoTitle,
          seoDescription,
          seoCanonicalUrl,
          seoOgTitle,
          seoOgDescription,
          seoOgImageUrl,
        },
      });

      await tx.marketingLandingTheme.upsert({
        where: { siteConfigId: siteId },
        update: theme,
        create: {
          siteConfigId: siteId,
          ...theme,
        },
      });

      await tx.marketingLandingSection.deleteMany({ where: { siteConfigId: siteId } });
      if (sections.length > 0) {
        await tx.marketingLandingSection.createMany({
          data: sections.map((section) => ({
            siteConfigId: siteId,
            sectionType: section.sectionType,
            isEnabled: section.isEnabled,
            sortOrder: section.sortOrder,
            eyebrowHtml: section.eyebrowHtml || null,
            titleHtml: section.titleHtml || null,
            subtitleHtml: section.subtitleHtml || null,
            bodyHtml: section.bodyHtml || null,
            ctaPrimaryLabelHtml: section.ctaPrimaryLabelHtml || null,
            ctaPrimaryHref: section.ctaPrimaryHref || null,
            ctaSecondaryLabelHtml: section.ctaSecondaryLabelHtml || null,
            ctaSecondaryHref: section.ctaSecondaryHref || null,
            mediaUrl: section.mediaUrl || null,
            mediaAlt: section.mediaAlt || null,
            mediaCaptionHtml: section.mediaCaptionHtml || null,
            payload: section.payload,
          })),
        });
      }

      await tx.marketingLandingNavItem.deleteMany({ where: { siteConfigId: siteId } });
      for (const item of navItems) {
        await tx.marketingLandingNavItem.create({
          data: {
            siteConfigId: siteId,
            title: item.title,
            slug: item.slug,
            href: item.href,
            sortOrder: item.sortOrder,
            isActive: item.isActive,
            badgeText: item.badgeText ?? null,
            openInNewTab: item.openInNewTab ?? false,
            subitems: item.children.length
              ? {
                  create: item.children.map((child) => ({
                    title: child.title,
                    href: child.href,
                    sortOrder: child.sortOrder,
                    isActive: child.isActive,
                    badgeText: child.badgeText ?? null,
                    openInNewTab: child.openInNewTab ?? false,
                  })),
                }
              : undefined,
          },
        });
      }
    });

    revalidateMarketingPaths();
    return { success: true, message: "Landing builder ayarlari kaydedildi." };
  } catch (error) {
    if (error instanceof Error && error.message === "LANDING_BUILDER_PAYLOAD") {
      return { success: false, message: "Landing builder payload formati gecersiz." };
    }
    if (error instanceof Error && error.message === "LANDING_BUILDER_NAV_SLUG") {
      return { success: false, message: "Navigation slug degeri gecersiz veya tekrarli." };
    }
    if (error instanceof Error && error.message === "LANDING_BUILDER_NAV_HREF") {
      return { success: false, message: "Navigation link degeri gecersiz." };
    }
    return { success: false, message: "Landing builder ayari kaydedilemedi." };
  }
}
