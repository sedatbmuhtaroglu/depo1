"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  centsToDecimalString,
  decimalLikeToCents,
  normalizeCommercialCurrency,
  parseMoneyToCents,
  resolveCommercialPaymentState,
} from "@/lib/commercial-record";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import { parsePlanCode } from "@/modules/hq/server/tenant-provisioning";

type ActionResult = { success: true; message: string } | { success: false; message: string };

function parseLeadId(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseTenantId(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseCommercialRecordId(value: FormDataEntryValue | null): number | null {
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

function parseCommercialSaleType(value: FormDataEntryValue | null): "DIRECT_PURCHASE" | "TRIAL_CONVERSION" | null {
  const normalized = (value?.toString() ?? "").trim().toUpperCase();
  if (normalized === "DIRECT_PURCHASE" || normalized === "TRIAL_CONVERSION") return normalized;
  return null;
}

function parseOperationalStatus(value: FormDataEntryValue | null): "DRAFT" | "WON" | "CANCELLED" | null {
  const normalized = (value?.toString() ?? "").trim().toUpperCase();
  if (normalized === "DRAFT" || normalized === "WON" || normalized === "CANCELLED") return normalized;
  return null;
}

function parsePaymentMethod(value: FormDataEntryValue | null): "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER" | null {
  const normalized = (value?.toString() ?? "").trim().toUpperCase();
  if (
    normalized === "CASH" ||
    normalized === "BANK_TRANSFER" ||
    normalized === "CARD" ||
    normalized === "OTHER"
  ) {
    return normalized;
  }
  return null;
}

function parseDateInput(value: FormDataEntryValue | null): Date | null {
  const raw = (value?.toString() ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function revalidateCommercialPaths(input: { leadId: number; tenantId?: number | null }) {
  revalidatePath("/hq");
  revalidatePath("/hq/leads");
  revalidatePath(`/hq/leads/${input.leadId}`);
  revalidatePath("/hq/accounting");
  revalidatePath("/hq/accounting/records");
  revalidatePath("/hq/accounting/payments");
  if (input.tenantId) {
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${input.tenantId}`);
  }
}

export async function upsertLeadCommercialRecordAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_LEAD_MANAGE" });
    const leadId = parseLeadId(formData.get("leadId"));
    const tenantId = parseTenantId(formData.get("tenantId"));
    if (!leadId && !tenantId) {
      return { success: false, message: "Lead veya tenant secimi gerekli." };
    }

    const saleType = parseCommercialSaleType(formData.get("saleType"));
    if (!saleType) {
      return { success: false, message: "Satis tipi secimi gecersiz." };
    }

    const operationalStatus = parseOperationalStatus(formData.get("operationalStatus"));
    if (!operationalStatus) {
      return { success: false, message: "Operasyonel durum secimi gecersiz." };
    }

    const planCodeRaw = formData.get("planCode")?.toString().trim() ?? "";
    const planCode = planCodeRaw ? parsePlanCode(planCodeRaw) : null;
    if (planCodeRaw && !planCode) {
      return { success: false, message: "Plan kodu gecersiz." };
    }

    const currency = normalizeCommercialCurrency(formData.get("currency")?.toString());
    if (!currency) {
      return { success: false, message: "Para birimi 3 harfli olmalidir (ornek: TRY)." };
    }

    const listPriceCents = parseMoneyToCents(formData.get("listPrice"));
    const discountAmountCents = parseMoneyToCents(formData.get("discountAmount"));
    const netSaleAmountCents = parseMoneyToCents(formData.get("netSaleAmount"));
    if (listPriceCents == null || listPriceCents < 0) {
      return { success: false, message: "Liste fiyati gecersiz." };
    }
    if (discountAmountCents == null || discountAmountCents < 0) {
      return { success: false, message: "Indirim tutari gecersiz." };
    }
    if (netSaleAmountCents == null || netSaleAmountCents <= 0) {
      return { success: false, message: "Net satis tutari sifirdan buyuk olmali." };
    }

    const soldAt = parseDateInput(formData.get("soldAt"));
    if (!soldAt) {
      return { success: false, message: "Satis tarihi zorunlu ve gecerli olmalidir." };
    }
    const dueDate = parseDateInput(formData.get("dueDate"));

    const packageName = normalizeOptionalText(formData.get("packageName"), 120);
    const paymentMethodSummary = normalizeOptionalText(formData.get("paymentMethodSummary"), 280);
    const salespersonName = normalizeOptionalText(formData.get("salespersonName"), 120);
    const notes = normalizeOptionalText(formData.get("notes"), 2000);

    const updated = await prisma.$transaction(async (tx) => {
      let lead = null as null | {
        id: number;
        tenantId: number | null;
        commercialRecord: { id: number } | null;
      };

      if (leadId) {
        lead = await tx.salesLead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            tenantId: true,
            commercialRecord: {
              select: {
                id: true,
              },
            },
          },
        });
      } else if (tenantId) {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, name: true },
        });
        if (!tenant) {
          throw new Error("TENANT_NOT_FOUND");
        }

        const existingLead = await tx.salesLead.findFirst({
          where: { tenantId: tenant.id },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            tenantId: true,
            commercialRecord: {
              select: {
                id: true,
              },
            },
          },
        });

        if (existingLead) {
          lead = existingLead;
        } else {
          lead = await tx.salesLead.create({
            data: {
              businessName: tenant.name,
              contactName: tenant.name,
              source: "MANUAL",
              status: "CONTACTED",
              assignedTo: hq.username,
              notes: "Auto-created from tenant detail for commercial record.",
              tenantId: tenant.id,
            },
            select: {
              id: true,
              tenantId: true,
              commercialRecord: {
                select: {
                  id: true,
                },
              },
            },
          });
        }
      }

      if (!lead) {
        throw new Error("LEAD_NOT_FOUND");
      }

      const resolvedLeadId = lead.id;

      const paymentAggregate = await tx.salePayment.aggregate({
        where: {
          commercialRecord: {
            leadId: resolvedLeadId,
          },
        },
        _sum: {
          amount: true,
        },
      });
      const amountCollectedCents = decimalLikeToCents(paymentAggregate._sum.amount ?? 0);
      const paymentState = resolveCommercialPaymentState({
        netSaleAmountCents,
        amountCollectedCents,
      });

      const commercialRecord = await tx.commercialRecord.upsert({
        where: { leadId: resolvedLeadId },
        create: {
          leadId: resolvedLeadId,
          tenantId: lead.tenantId ?? null,
          saleType,
          planCode,
          packageName,
          currency,
          listPrice: centsToDecimalString(listPriceCents),
          discountAmount: centsToDecimalString(discountAmountCents),
          netSaleAmount: centsToDecimalString(netSaleAmountCents),
          amountCollected: centsToDecimalString(paymentState.amountCollectedCents),
          remainingBalance: centsToDecimalString(paymentState.remainingBalanceCents),
          paymentStatus: paymentState.paymentStatus,
          operationalStatus,
          paymentMethodSummary,
          dueDate,
          soldAt,
          salespersonName,
          notes,
        },
        update: {
          ...(lead.tenantId ? { tenantId: lead.tenantId } : {}),
          saleType,
          planCode,
          packageName,
          currency,
          listPrice: centsToDecimalString(listPriceCents),
          discountAmount: centsToDecimalString(discountAmountCents),
          netSaleAmount: centsToDecimalString(netSaleAmountCents),
          amountCollected: centsToDecimalString(paymentState.amountCollectedCents),
          remainingBalance: centsToDecimalString(paymentState.remainingBalanceCents),
          paymentStatus: paymentState.paymentStatus,
          operationalStatus,
          paymentMethodSummary,
          dueDate,
          soldAt,
          salespersonName,
          notes,
        },
        select: {
          id: true,
          leadId: true,
          tenantId: true,
          paymentStatus: true,
          remainingBalance: true,
        },
      });

      await tx.salesLeadEvent.create({
        data: {
          leadId: resolvedLeadId,
          actorUsername: hq.username,
          actionType: lead.commercialRecord
            ? "COMMERCIAL_RECORD_UPDATED"
            : "COMMERCIAL_RECORD_CREATED",
          description: `status=${operationalStatus}; payment=${commercialRecord.paymentStatus}; remaining=${commercialRecord.remainingBalance.toString()}`,
        },
      });

      return commercialRecord;
    });

    if (updated.tenantId) {
      await writeAuditLog({
        tenantId: updated.tenantId,
        actor: { type: "admin", id: `hq:${hq.username}` },
        actionType: "HQ_COMMERCIAL_RECORD_UPSERT",
        entityType: "CommercialRecord",
        entityId: String(updated.id),
        description: `leadId=${updated.leadId}; paymentStatus=${updated.paymentStatus}`,
      });
    }

    revalidateCommercialPaths({
      leadId: updated.leadId,
      tenantId: updated.tenantId,
    });

    return { success: true, message: "Ticari kayit guncellendi." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        message: "Bu tenant icin baska bir ticari kayit zaten bagli. Kayit once esitlenmeli.",
      };
    }
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
      return { success: false, message: "Lead bulunamadi." };
    }
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return { success: false, message: "Tenant bulunamadi." };
    }
    return { success: false, message: "Ticari kayit guncellenemedi." };
  }
}

export async function addCommercialRecordPaymentAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "SALES_LEAD_MANAGE" });
    const commercialRecordId = parseCommercialRecordId(formData.get("commercialRecordId"));
    if (!commercialRecordId) {
      return { success: false, message: "Gecersiz ticari kayit secimi." };
    }

    const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));
    if (!paymentMethod) {
      return { success: false, message: "Odeme yontemi secimi gecersiz." };
    }

    const currency = normalizeCommercialCurrency(formData.get("currency")?.toString());
    if (!currency) {
      return { success: false, message: "Para birimi 3 harfli olmalidir (ornek: TRY)." };
    }

    const amountCents = parseMoneyToCents(formData.get("amount"));
    if (amountCents == null || amountCents <= 0) {
      return { success: false, message: "Odeme tutari sifirdan buyuk olmalidir." };
    }

    const paidAt = parseDateInput(formData.get("paidAt"));
    if (!paidAt) {
      return { success: false, message: "Odeme tarihi zorunlu ve gecerli olmalidir." };
    }

    const note = normalizeOptionalText(formData.get("note"), 280);

    const updated = await prisma.$transaction(async (tx) => {
      const commercialRecord = await tx.commercialRecord.findUnique({
        where: { id: commercialRecordId },
        select: {
          id: true,
          leadId: true,
          tenantId: true,
          currency: true,
          operationalStatus: true,
          netSaleAmount: true,
          lead: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (!commercialRecord) {
        throw new Error("COMMERCIAL_RECORD_NOT_FOUND");
      }
      if (commercialRecord.operationalStatus === "CANCELLED") {
        throw new Error("COMMERCIAL_RECORD_CANCELLED");
      }
      if (commercialRecord.currency !== currency) {
        throw new Error("CURRENCY_MISMATCH");
      }

      await tx.salePayment.create({
        data: {
          commercialRecordId,
          amount: centsToDecimalString(amountCents),
          currency,
          paymentMethod,
          paidAt,
          note,
        },
      });

      const paymentAggregate = await tx.salePayment.aggregate({
        where: { commercialRecordId },
        _sum: { amount: true },
      });
      const amountCollectedCents = decimalLikeToCents(paymentAggregate._sum.amount ?? 0);
      const paymentState = resolveCommercialPaymentState({
        netSaleAmountCents: decimalLikeToCents(commercialRecord.netSaleAmount),
        amountCollectedCents,
      });

      const nextCommercialRecord = await tx.commercialRecord.update({
        where: { id: commercialRecordId },
        data: {
          ...(commercialRecord.tenantId == null && commercialRecord.lead.tenantId
            ? { tenantId: commercialRecord.lead.tenantId }
            : {}),
          amountCollected: centsToDecimalString(paymentState.amountCollectedCents),
          remainingBalance: centsToDecimalString(paymentState.remainingBalanceCents),
          paymentStatus: paymentState.paymentStatus,
        },
        select: {
          id: true,
          leadId: true,
          tenantId: true,
          paymentStatus: true,
          remainingBalance: true,
        },
      });

      await tx.salesLeadEvent.create({
        data: {
          leadId: commercialRecord.leadId,
          actorUsername: hq.username,
          actionType: "COMMERCIAL_PAYMENT_ADDED",
          description: `amount=${centsToDecimalString(amountCents)} ${currency}; payment=${nextCommercialRecord.paymentStatus}; remaining=${nextCommercialRecord.remainingBalance.toString()}`,
        },
      });

      return nextCommercialRecord;
    });

    if (updated.tenantId) {
      await writeAuditLog({
        tenantId: updated.tenantId,
        actor: { type: "admin", id: `hq:${hq.username}` },
        actionType: "HQ_COMMERCIAL_PAYMENT_ADD",
        entityType: "CommercialRecord",
        entityId: String(updated.id),
        description: `paymentStatus=${updated.paymentStatus}; remaining=${updated.remainingBalance.toString()}`,
      });
    }

    revalidateCommercialPaths({
      leadId: updated.leadId,
      tenantId: updated.tenantId,
    });

    return { success: true, message: "Odeme kaydi eklendi." };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "COMMERCIAL_RECORD_NOT_FOUND") {
        return { success: false, message: "Ticari kayit bulunamadi." };
      }
      if (error.message === "COMMERCIAL_RECORD_CANCELLED") {
        return { success: false, message: "Iptal edilmis kayda odeme eklenemez." };
      }
      if (error.message === "CURRENCY_MISMATCH") {
        return { success: false, message: "Odeme para birimi kayit para birimi ile ayni olmali." };
      }
    }
    return { success: false, message: "Odeme kaydi eklenemedi." };
  }
}
