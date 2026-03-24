"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import {
  assertDistributedAtomicCooldown,
  DistributedRateLimitError,
} from "@/lib/security/distributed-rate-limit";
import { ensureMainMarketingSiteId } from "@/modules/marketing/server/landing-content";

type LandingFormActionResult = {
  ok: boolean;
  message: string;
};

function normalizeText(value: FormDataEntryValue | null, maxLength: number): string {
  return (value?.toString() ?? "").trim().slice(0, maxLength);
}

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = normalizeText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizePhone(value: FormDataEntryValue | null): string | null {
  return normalizeOptionalText(value, 32);
}

function normalizeEmail(value: FormDataEntryValue | null): string | null {
  const email = normalizeOptionalText(value, 180)?.toLowerCase() ?? null;
  if (!email) return null;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? email : null;
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  const raw = value?.toString().toLowerCase() ?? "";
  return raw === "true" || raw === "on" || raw === "1" || raw === "yes";
}

function isLandingSource(value: string | null): value is "LANDING_HOMEPAGE" | "LANDING_CTA" | "LANDING_FOOTER" {
  return value === "LANDING_HOMEPAGE" || value === "LANDING_CTA" || value === "LANDING_FOOTER";
}

async function assertLandingLeadRateLimit(ipHash: string | null): Promise<void> {
  const key = `marketing:landing:lead-submit:ip:${ipHash ?? "unknown"}`;
  await assertDistributedAtomicCooldown({
    key,
    cooldownMs: 10_000,
    messages: {
      cooldown: "Cok hizli deneme yapildi. Lutfen {retryAfter} saniye bekleyin.",
      blocked: "Gecici guvenlik kisiti uygulandi. Lutfen biraz sonra tekrar deneyin.",
      unavailable: "Guvenlik kontrolu su an kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
    },
    action: "MARKETING_LANDING_LEAD_SUBMIT",
    failureMode: "fail-closed",
  });
}

export async function submitLandingLeadFormAction(formData: FormData): Promise<LandingFormActionResult> {
  const contactName = normalizeText(formData.get("contactName"), 120);
  const businessName = normalizeText(formData.get("businessName"), 160);
  const phone = normalizePhone(formData.get("phone"));
  const email = normalizeEmail(formData.get("email"));
  const city = normalizeOptionalText(formData.get("city"), 120);
  const message = normalizeOptionalText(formData.get("message"), 2000);
  const consentGiven = parseBoolean(formData.get("consent"));
  const honeypot = normalizeOptionalText(formData.get("companyWebsite"), 200);
  const sourceRaw = normalizeOptionalText(formData.get("sourceContext"), 40);
  const source = isLandingSource(sourceRaw) ? sourceRaw : "LANDING_HOMEPAGE";

  const utmSource = normalizeOptionalText(formData.get("utmSource"), 120);
  const utmMedium = normalizeOptionalText(formData.get("utmMedium"), 120);
  const utmCampaign = normalizeOptionalText(formData.get("utmCampaign"), 120);
  const utmTerm = normalizeOptionalText(formData.get("utmTerm"), 120);
  const utmContent = normalizeOptionalText(formData.get("utmContent"), 120);
  const landingPath = normalizeOptionalText(formData.get("landingPath"), 220);

  if (!contactName) return { ok: false, message: "Iletisim kisisi zorunlu." };
  if (!businessName) return { ok: false, message: "Isletme adi zorunlu." };
  if (!phone && !email) {
    return { ok: false, message: "Telefon veya e-posta alanlarindan biri zorunludur." };
  }
  if (formData.get("email")?.toString().trim() && !email) {
    return { ok: false, message: "Gecerli bir e-posta girin." };
  }
  if (!consentGiven) {
    return { ok: false, message: "Onay kutusu zorunludur." };
  }

  const requestSecurity = await getRequestSecurityContext();
  const referrer = normalizeOptionalText(formData.get("referrer"), 320);

  try {
    await assertLandingLeadRateLimit(requestSecurity.ipHash);
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Basvuru su an alinamadi. Lutfen tekrar deneyin." };
  }

  const siteConfigId = await ensureMainMarketingSiteId();

  if (honeypot) {
    await prisma.marketingFormSubmission.create({
      data: {
        siteConfigId,
        source,
        status: "SPAM_REJECTED",
        contactName,
        businessName,
        phone,
        email,
        city,
        message,
        consentGiven,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        landingPath,
        referrer,
        ipHash: requestSecurity.ipHash,
        userAgentHash: requestSecurity.userAgentHash,
        failureReason: "honeypot_triggered",
        processedAt: new Date(),
      },
    });

    return { ok: true, message: "Basvurunuz alindi. Kisa surede sizinle iletisime gececegiz." };
  }

  const submission = await prisma.marketingFormSubmission.create({
    data: {
      siteConfigId,
      source,
      status: "RECEIVED",
      contactName,
      businessName,
      phone,
      email,
      city,
      message,
      consentGiven,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      landingPath,
      referrer,
      ipHash: requestSecurity.ipHash,
      userAgentHash: requestSecurity.userAgentHash,
    },
    select: { id: true },
  });

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const createdLead = await tx.salesLead.create({
        data: {
          businessName,
          contactName,
          phone,
          email,
          city,
          notes: message,
          source: "WEBSITE",
          status: "NEW",
        },
        select: { id: true },
      });

      await tx.salesLeadEvent.create({
        data: {
          leadId: createdLead.id,
          actorUsername: "landing-form",
          actionType: "LEAD_CREATED_FROM_LANDING",
          description: `submissionId=${submission.id}; source=${source}`,
        },
      });

      await tx.marketingFormSubmission.update({
        where: { id: submission.id },
        data: {
          status: "LEAD_CREATED",
          leadId: createdLead.id,
          processedAt: new Date(),
        },
      });

      return createdLead;
    });

    revalidatePath("/hq/leads");
    revalidatePath("/hq/marketing/submissions");
    revalidatePath(`/hq/leads/${lead.id}`);
  } catch {
    await prisma.marketingFormSubmission.update({
      where: { id: submission.id },
      data: {
        status: "LEAD_CREATE_FAILED",
        failureReason: "lead_create_failed",
        processedAt: new Date(),
      },
    });
    revalidatePath("/hq/marketing/submissions");
  }

  return { ok: true, message: "Basvurunuz alindi. Kisa surede sizinle iletisime gececegiz." };
}
