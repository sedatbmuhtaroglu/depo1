"use server";

import { randomBytes } from "node:crypto";
import { PlanCode, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  buildStaffSetPasswordLink,
  issueStaffSetPasswordToken,
  StaffSetPasswordTokenError,
} from "@/lib/staff-set-password-token";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import {
  isSalesLeadStatusTransitionAllowed,
  parseSalesLeadSource,
  parseSalesLeadStatus,
} from "@/modules/hq/server/lead-status";
import {
  normalizeTenantSlug,
  parsePlanCode,
  provisionTenantTx,
  resolveAvailableTenantSlug,
  TenantProvisioningError,
} from "@/modules/hq/server/tenant-provisioning";
import { resolveLifecycleTransitionPatch } from "@/modules/hq/server/tenant-status";

type ActionResult = { success: true; message: string } | { success: false; message: string };
type ActionResultWithLead =
  | { success: true; message: string; leadId: number }
  | { success: false; message: string };
type ActionResultWithTenant =
  | {
      success: true;
      message: string;
      tenantId: number;
      leadId: number;
      adminUsername: string;
      setPasswordLink: string;
      setPasswordLinkExpiresAt: string;
      trialEndsAt: string;
      trialDays: 7 | 14 | 30;
    }
  | { success: false; message: string };
type ActionResultWithPasswordLink =
  | {
      success: true;
      message: string;
      adminUsername: string;
      setPasswordLink: string;
      setPasswordLinkExpiresAt: string;
      trialEndsAt: string | null;
    }
  | { success: false; message: string };

function parseLeadId(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeText(value: FormDataEntryValue | null, maxLength: number): string {
  return (value?.toString() ?? "").trim().slice(0, maxLength);
}

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = normalizeText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: FormDataEntryValue | null): string | null {
  const email = normalizeOptionalText(value, 180)?.toLowerCase() ?? null;
  if (!email) return null;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return ok ? email : null;
}

function normalizePhone(value: FormDataEntryValue | null): string | null {
  return normalizeOptionalText(value, 32);
}

function parsePlanOrDefault(value: FormDataEntryValue | null, fallback: PlanCode): PlanCode | null {
  const parsed = parsePlanCode(value?.toString() ?? "");
  return parsed ?? fallback;
}

function parseTrialDays(value: FormDataEntryValue | null): 7 | 14 | 30 | null {
  const parsed = Number(value);
  if (parsed === 7 || parsed === 14 || parsed === 30) return parsed;
  return null;
}

function normalizeStaffUsername(value: FormDataEntryValue | null): string | null {
  const username = (value?.toString() ?? "").trim().toLowerCase();
  if (!username) return null;
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) return null;
  return username;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

async function appendLeadEvent(
  tx: Prisma.TransactionClient,
  input: {
    leadId: number;
    actorUsername: string;
    actionType: string;
    description?: string | null;
  },
) {
  await tx.salesLeadEvent.create({
    data: {
      leadId: input.leadId,
      actorUsername: input.actorUsername,
      actionType: input.actionType,
      description: input.description ?? null,
    },
  });
}

function revalidateLeadPaths(leadId: number, tenantId?: number | null) {
  revalidatePath("/hq");
  revalidatePath("/hq/leads");
  revalidatePath(`/hq/leads/${leadId}`);
  if (tenantId) {
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${tenantId}`);
  }
}

export async function createSalesLeadAction(formData: FormData): Promise<ActionResultWithLead> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_LEAD_MANAGE" });

    const businessName = normalizeText(formData.get("businessName"), 160);
    const contactName = normalizeText(formData.get("contactName"), 120);
    const phone = normalizePhone(formData.get("phone"));
    const email = normalizeEmail(formData.get("email"));
    const city = normalizeOptionalText(formData.get("city"), 120);
    const notes = normalizeOptionalText(formData.get("notes"), 2000);
    const assignedTo = normalizeOptionalText(formData.get("assignedTo"), 120);
    const source = parseSalesLeadSource(formData.get("source")?.toString() ?? "") ?? "MANUAL";

    if (!businessName) return { success: false, message: "Isletme adi zorunlu." };
    if (!contactName) return { success: false, message: "Iletisim kisisi zorunlu." };
    if (!phone && !email) {
      return { success: false, message: "Telefon veya e-posta bilgisinden biri zorunlu." };
    }
    if (formData.get("email")?.toString().trim() && !email) {
      return { success: false, message: "Gecerli bir e-posta girin." };
    }

    const created = await prisma.$transaction(async (tx) => {
      const lead = await tx.salesLead.create({
        data: {
          businessName,
          contactName,
          phone,
          email,
          city,
          notes,
          source,
          status: "NEW",
          assignedTo,
        },
        select: { id: true },
      });
      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "LEAD_CREATED",
        description: `source=${source}`,
      });
      return lead;
    });

    revalidateLeadPaths(created.id);
    return { success: true, message: "Lead olusturuldu.", leadId: created.id };
  } catch {
    return { success: false, message: "Lead olusturulamadi." };
  }
}

export async function updateSalesLeadAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_LEAD_MANAGE" });
    const leadId = parseLeadId(formData.get("leadId"));
    if (!leadId) return { success: false, message: "Gecersiz lead." };

    const businessName = normalizeText(formData.get("businessName"), 160);
    const contactName = normalizeText(formData.get("contactName"), 120);
    const phone = normalizePhone(formData.get("phone"));
    const email = normalizeEmail(formData.get("email"));
    const city = normalizeOptionalText(formData.get("city"), 120);
    const notes = normalizeOptionalText(formData.get("notes"), 2000);
    const assignedTo = normalizeOptionalText(formData.get("assignedTo"), 120);
    const source = parseSalesLeadSource(formData.get("source")?.toString() ?? "");

    if (!businessName) return { success: false, message: "Isletme adi zorunlu." };
    if (!contactName) return { success: false, message: "Iletisim kisisi zorunlu." };
    if (!phone && !email) {
      return { success: false, message: "Telefon veya e-posta bilgisinden biri zorunlu." };
    }
    if (formData.get("email")?.toString().trim() && !email) {
      return { success: false, message: "Gecerli bir e-posta girin." };
    }
    if (!source) return { success: false, message: "Gecerli bir kaynak secin." };

    const updated = await prisma.$transaction(async (tx) => {
      const lead = await tx.salesLead.update({
        where: { id: leadId },
        data: {
          businessName,
          contactName,
          phone,
          email,
          city,
          notes,
          source,
          assignedTo,
        },
        select: { id: true, tenantId: true },
      });
      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "LEAD_UPDATED",
        description: `source=${source}`,
      });
      return lead;
    });

    revalidateLeadPaths(updated.id, updated.tenantId);
    return { success: true, message: "Lead bilgileri guncellendi." };
  } catch {
    return { success: false, message: "Lead guncellenemedi." };
  }
}

export async function updateSalesLeadStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_LEAD_MANAGE" });
    const leadId = parseLeadId(formData.get("leadId"));
    const targetStatus = parseSalesLeadStatus(formData.get("status")?.toString() ?? "");

    if (!leadId || !targetStatus) {
      return { success: false, message: "Gecersiz lead veya status secimi." };
    }

    if (targetStatus === "TRIAL_STARTED" || targetStatus === "WON") {
      return {
        success: false,
        message: "Trial/WON statusleri yalnizca donusum aksiyonlari ile degistirilebilir.",
      };
    }

    const lead = await prisma.salesLead.findUnique({
      where: { id: leadId },
      select: { id: true, status: true, tenantId: true },
    });
    if (!lead) return { success: false, message: "Lead bulunamadi." };

    if (
      !isSalesLeadStatusTransitionAllowed({
        currentStatus: lead.status,
        targetStatus,
      })
    ) {
      return { success: false, message: "Bu status gecisi izinli degil." };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.salesLead.update({
        where: { id: lead.id },
        data: {
          status: targetStatus,
          ...(targetStatus === "LOST"
            ? { lostAt: new Date() }
            : {
                ...(lead.status === "LOST" ? { lostAt: null, lostReason: null } : {}),
              }),
        },
        select: { id: true, tenantId: true },
      });
      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "LEAD_STATUS_UPDATED",
        description: `${lead.status} -> ${targetStatus}`,
      });
      return next;
    });

    revalidateLeadPaths(updated.id, updated.tenantId);
    return { success: true, message: "Lead status guncellendi." };
  } catch {
    return { success: false, message: "Lead status guncellenemedi." };
  }
}

export async function startLeadTrialAction(formData: FormData): Promise<ActionResultWithTenant> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_TRIAL_CONVERT" });
    const leadId = parseLeadId(formData.get("leadId"));
    if (!leadId) return { success: false, message: "Gecersiz lead." };

    const planCode = parsePlanOrDefault(formData.get("planCode"), "MINI");
    if (!planCode) return { success: false, message: "Gecerli bir trial plani secin." };

    const trialDays = parseTrialDays(formData.get("trialDays"));
    if (!trialDays) return { success: false, message: "Trial suresi 7, 14 veya 30 gun olmali." };

    const requestedSlug = normalizeTenantSlug(formData.get("tenantSlug")?.toString() ?? "");
    const tenantNameInput = normalizeText(formData.get("tenantName"), 160);
    const restaurantNameInput = normalizeOptionalText(formData.get("restaurantName"), 140);
    const primaryDomain = normalizeOptionalText(formData.get("primaryDomain"), 180);

    const managerDisplayName = normalizeText(formData.get("initialManagerName"), 120);
    if (!managerDisplayName) {
      return { success: false, message: "Ilk yonetici adi zorunlu." };
    }

    const managerUsername = normalizeStaffUsername(formData.get("initialManagerUsername"));
    if (!managerUsername) {
      return {
        success: false,
        message: "Ilk yonetici kullanici adi en az 3 karakter olmali ve sadece a-z, 0-9, . _ - icerebilir.",
      };
    }

    const managerEmailRaw = (formData.get("initialManagerEmail")?.toString() ?? "").trim();
    const managerEmailInput = normalizeEmail(formData.get("initialManagerEmail"));
    if (managerEmailRaw && !managerEmailInput) {
      return { success: false, message: "Ilk yonetici icin gecerli bir e-posta girin." };
    }
    const managerPhoneInput = normalizePhone(formData.get("initialManagerPhone"));

    const lead = await prisma.salesLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        status: true,
        tenantId: true,
      },
    });
    if (!lead) return { success: false, message: "Lead bulunamadi." };
    if (lead.tenantId) return { success: false, message: "Bu lead zaten bir tenant ile bagli." };
    if (lead.status === "WON") {
      return { success: false, message: "WON lead icin yeniden trial baslatilamaz." };
    }

    const existingAdminUser = await prisma.adminUser.findUnique({
      where: { username: managerUsername },
      select: { id: true },
    });
    if (existingAdminUser) {
      return {
        success: false,
        message: "Ilk yonetici kullanici adi sistemde rezerve. Baska bir ad secin.",
      };
    }

    const tenantName = tenantNameInput || lead.businessName;
    if (!tenantName) {
      return { success: false, message: "Tenant/restoran adi zorunlu." };
    }

    const tenantSlug =
      requestedSlug ?? (await resolveAvailableTenantSlug(`${tenantName}-trial`));
    const restaurantName = restaurantNameInput ?? `${tenantName} Merkez`;

    const trialStartedAt = new Date();
    const trialEndsAt = addDays(trialStartedAt, trialDays);
    const randomInitialPassword = randomBytes(48).toString("base64url");
    const passwordHash = await hashPassword(randomInitialPassword);

    const created = await prisma.$transaction(async (tx) => {
      const provisioned = await provisionTenantTx(tx, {
        name: tenantName,
        slug: tenantSlug,
        planCode,
        initialStatus: "TRIAL",
        restaurantName,
        primaryDomain,
        trialStartedAt,
        trialEndsAt,
      });

      const createdManager = await tx.tenantStaff.create({
        data: {
          tenantId: provisioned.tenant.id,
          username: managerUsername,
          passwordHash,
          mustSetPassword: true,
          passwordInitializedAt: null,
          role: "MANAGER",
          displayName: managerDisplayName,
          email: managerEmailInput ?? lead.email ?? null,
          phone: managerPhoneInput ?? lead.phone ?? null,
          isActive: true,
          workingDays: [],
          shiftStart: null,
          shiftEnd: null,
          notes: null,
        },
        select: {
          id: true,
          username: true,
        },
      });

      const issued = await issueStaffSetPasswordToken({
        tenantStaffId: createdManager.id,
        createdBy: `hq:${hq.username}`,
        client: tx,
      });

      await tx.salesLead.update({
        where: { id: lead.id },
        data: {
          tenantId: provisioned.tenant.id,
          status: "TRIAL_STARTED",
          trialStartedAt,
          trialEndsAt,
          trialAdminUsername: createdManager.username,
          lostAt: null,
          lostReason: null,
        },
      });

      await tx.commercialRecord.updateMany({
        where: {
          leadId: lead.id,
          tenantId: null,
        },
        data: {
          tenantId: provisioned.tenant.id,
        },
      });

      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "TRIAL_STARTED",
        description: `tenant=${provisioned.tenant.slug}; plan=${planCode}; trialDays=${trialDays}; manager=${createdManager.username}`,
      });

      return {
        provisioned,
        managerUsername: createdManager.username,
        token: issued.token,
        tokenExpiresAt: issued.expiresAt,
        tenantSlug: issued.tenantSlug,
      };
    });

    await writeAuditLog({
      tenantId: created.provisioned.tenant.id,
      actor: { type: "admin", id: `hq:${hq.username}` },
      actionType: "HQ_TRIAL_STARTED_FROM_LEAD",
      entityType: "Tenant",
      entityId: String(created.provisioned.tenant.id),
      description: `leadId=${lead.id}; plan=${created.provisioned.planCode}; trialDays=${trialDays}; manager=${created.managerUsername}`,
    });

    const setPasswordLink = buildStaffSetPasswordLink({
      token: created.token,
      tenantSlug: created.tenantSlug,
    });

    revalidateLeadPaths(lead.id, created.provisioned.tenant.id);
    return {
      success: true,
      message: "Trial tenant ve ilk yonetici hesabi olusturuldu.",
      tenantId: created.provisioned.tenant.id,
      leadId: lead.id,
      adminUsername: created.managerUsername,
      setPasswordLink,
      setPasswordLinkExpiresAt: created.tokenExpiresAt.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      trialDays,
    };
  } catch (error) {
    if (error instanceof TenantProvisioningError || error instanceof StaffSetPasswordTokenError) {
      return { success: false, message: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "Ilk yonetici kullanici adi bu tenant icin zaten kullanimda." };
    }
    return { success: false, message: "Trial baslatilamadi." };
  }
}

export async function regenerateLeadTrialManagerPasswordLinkAction(
  formData: FormData,
): Promise<ActionResultWithPasswordLink> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_TRIAL_CONVERT" });
    const leadId = parseLeadId(formData.get("leadId"));
    if (!leadId) return { success: false, message: "Gecersiz lead." };

    const lead = await prisma.salesLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        tenantId: true,
        trialEndsAt: true,
        trialAdminUsername: true,
      },
    });

    if (!lead || !lead.tenantId) {
      return { success: false, message: "Bu lead icin trial tenant bulunamadi." };
    }
    if (!lead.trialAdminUsername) {
      return {
        success: false,
        message: "Ilk yonetici kaydi bulunamadi. Once trial akisini yeni formatta baslatin.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const manager = await tx.tenantStaff.findFirst({
        where: {
          tenantId: lead.tenantId as number,
          username: lead.trialAdminUsername as string,
        },
        select: {
          id: true,
          username: true,
          mustSetPassword: true,
          isActive: true,
          tenant: {
            select: {
              slug: true,
            },
          },
        },
      });

      if (!manager) {
        throw new StaffSetPasswordTokenError("STAFF_NOT_FOUND", "Ilk yonetici hesabi bulunamadi.");
      }
      if (!manager.isActive) {
        throw new StaffSetPasswordTokenError("STAFF_INACTIVE", "Ilk yonetici hesabi aktif degil.");
      }

      let forcedReset = false;
      if (!manager.mustSetPassword) {
        const randomInvalidPassword = randomBytes(32).toString("hex");
        const forcedPasswordHash = await hashPassword(randomInvalidPassword);
        await tx.tenantStaff.update({
          where: { id: manager.id },
          data: {
            passwordHash: forcedPasswordHash,
            mustSetPassword: true,
            passwordInitializedAt: null,
          },
        });
        forcedReset = true;
      }

      const issued = await issueStaffSetPasswordToken({
        tenantStaffId: manager.id,
        createdBy: `hq:${hq.username}`,
        client: tx,
      });

      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "TRIAL_MANAGER_PASSWORD_LINK_REGENERATED",
        description: `manager=${manager.username}; forcedReset=${forcedReset ? "1" : "0"}`,
      });

      return {
        username: manager.username,
        token: issued.token,
        tokenExpiresAt: issued.expiresAt,
        tenantSlug: manager.tenant.slug,
      };
    });

    const setPasswordLink = buildStaffSetPasswordLink({
      token: result.token,
      tenantSlug: result.tenantSlug,
    });

    revalidateLeadPaths(lead.id, lead.tenantId);
    return {
      success: true,
      message: "Yeni sifre belirleme linki olusturuldu.",
      adminUsername: result.username,
      setPasswordLink,
      setPasswordLinkExpiresAt: result.tokenExpiresAt.toISOString(),
      trialEndsAt: lead.trialEndsAt ? lead.trialEndsAt.toISOString() : null,
    };
  } catch (error) {
    if (error instanceof StaffSetPasswordTokenError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Set-password linki yenilenemedi." };
  }
}

export async function convertTrialToWonAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_TRIAL_CONVERT" });
    const leadId = parseLeadId(formData.get("leadId"));
    const planCode = parsePlanCode(formData.get("planCode")?.toString() ?? "");

    if (!leadId || !planCode) {
      return { success: false, message: "Lead veya plan secimi gecersiz." };
    }

    const plan = await prisma.plan.findUnique({
      where: { code: planCode },
      select: { id: true, code: true, isActive: true },
    });
    if (!plan || !plan.isActive) {
      return { success: false, message: "Plan bulunamadi veya pasif." };
    }

    const lead = await prisma.salesLead.findUnique({
      where: { id: leadId },
      select: { id: true, tenantId: true, status: true },
    });
    if (!lead) return { success: false, message: "Lead bulunamadi." };
    if (!lead.tenantId) return { success: false, message: "Bu lead icin trial tenant bulunamadi." };
    if (lead.status === "LOST") return { success: false, message: "LOST lead dogrudan WON yapilamaz." };

    const activePatch = resolveLifecycleTransitionPatch("ACTIVE");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: lead.tenantId as number },
        data: {
          planId: plan.id,
          status: activePatch.status,
          setupCompleted: activePatch.setupCompleted,
        },
      });

      await tx.setupProgress.upsert({
        where: { tenantId: lead.tenantId as number },
        update: {
          currentStep: activePatch.setupStep,
          completedAt: activePatch.setupCompleted ? new Date() : null,
        },
        create: {
          tenantId: lead.tenantId as number,
          currentStep: activePatch.setupStep,
          completedAt: activePatch.setupCompleted ? new Date() : null,
        },
      });

      const nextLead = await tx.salesLead.update({
        where: { id: lead.id },
        data: {
          status: "WON",
          wonAt: new Date(),
          lostAt: null,
          lostReason: null,
        },
        select: { id: true, tenantId: true },
      });

      await tx.commercialRecord.updateMany({
        where: {
          leadId: lead.id,
          tenantId: null,
        },
        data: {
          tenantId: lead.tenantId,
        },
      });

      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "LEAD_CONVERTED_WON",
        description: `plan=${plan.code}`,
      });

      return nextLead;
    });

    await writeAuditLog({
      tenantId: lead.tenantId as number,
      actor: { type: "admin", id: `hq:${hq.username}` },
      actionType: "HQ_TRIAL_CONVERTED_TO_ACTIVE",
      entityType: "Tenant",
      entityId: String(lead.tenantId),
      description: `leadId=${lead.id}; plan=${plan.code}`,
    });

    revalidateLeadPaths(updated.id, updated.tenantId);
    return { success: true, message: "Trial musteriye donusturuldu." };
  } catch {
    return { success: false, message: "Trial donusumu tamamlanamadi." };
  }
}

export async function markLeadLostAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_LEAD_MANAGE" });
    const leadId = parseLeadId(formData.get("leadId"));
    const lostReason = normalizeOptionalText(formData.get("lostReason"), 280);
    if (!leadId) return { success: false, message: "Gecersiz lead." };

    const lead = await prisma.salesLead.findUnique({
      where: { id: leadId },
      select: { id: true, status: true, tenantId: true },
    });
    if (!lead) return { success: false, message: "Lead bulunamadi." };
    if (lead.status === "WON") return { success: false, message: "WON lead LOST yapilamaz." };

    const updated = await prisma.$transaction(async (tx) => {
      const nextLead = await tx.salesLead.update({
        where: { id: lead.id },
        data: {
          status: "LOST",
          lostAt: new Date(),
          lostReason,
        },
        select: { id: true, tenantId: true },
      });
      await appendLeadEvent(tx, {
        leadId: lead.id,
        actorUsername: hq.username,
        actionType: "LEAD_MARKED_LOST",
        description: lostReason ?? null,
      });
      return nextLead;
    });

    revalidateLeadPaths(updated.id, updated.tenantId);
    return { success: true, message: "Lead kaybedildi olarak isaretlendi." };
  } catch {
    return { success: false, message: "Lead kaybedildi olarak isaretlenemedi." };
  }
}
