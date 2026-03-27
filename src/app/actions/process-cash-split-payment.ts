"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCashierWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { writeAuditLog } from "@/lib/audit-log";
import { NON_FISCAL_DISCLAIMER } from "@/lib/cash-device";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";

type SplitMode = "PARTIAL" | "FULL";
type AllowedMethod = Extract<
  PaymentMethod,
  "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL"
>;

export type SplitPaymentLineInput = {
  method: AllowedMethod;
  amount: number;
  note?: string | null;
};

export type SplitPaymentReceiptView = {
  receiptId: string;
  title: string;
  restaurantName: string;
  tableNo: number;
  issuedAtIso: string;
  reference: string;
  cashierName: string;
  lines: Array<{
    method: AllowedMethod;
    amount: number;
    note: string | null;
  }>;
  transactionTotal: number;
  remainingBefore: number;
  remainingAfter: number;
  disclaimer: string;
};

const ALLOWED_METHODS = new Set<AllowedMethod>([
  "CASH",
  "CREDIT_CARD",
  "SODEXO",
  "MULTINET",
  "TICKET",
  "METROPOL",
]);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeLineNote(input: string | null | undefined): string | null {
  const normalized = (input ?? "").trim();
  return normalized.length > 0 ? normalized.slice(0, 280) : null;
}

function withSplitRef(note: string | null, clientMutationId: string, index: number): string {
  const ref = `[split-ref:${clientMutationId}:${index}]`;
  if (!note) return ref;
  return `${note} ${ref}`;
}

function parseMutationId(input: string): string | null {
  const normalized = input.trim();
  if (!/^[a-zA-Z0-9_-]{10,64}$/.test(normalized)) return null;
  return normalized;
}

type LockedBill = {
  id: number;
  status: "PENDING" | "ACKNOWLEDGED" | "SETTLED" | "CANCELED";
  acknowledgedAt: Date | null;
  acknowledgedByStaffId: number | null;
};

export async function processCashSplitPayment(input: {
  tableId: number;
  mode: SplitMode;
  lines: SplitPaymentLineInput[];
  clientMutationId: string;
}) {
  const { tableId, mode } = input;
  const mutationId = parseMutationId(input.clientMutationId);
  if (!mutationId) {
    return { success: false, message: "Islem kimligi gecersiz." };
  }
  if (!Number.isInteger(tableId) || tableId <= 0) {
    return { success: false, message: "Masa bilgisi gecersiz." };
  }
  if (mode !== "PARTIAL" && mode !== "FULL") {
    return { success: false, message: "Odeme modu gecersiz." };
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { success: false, message: "En az bir odeme satiri gerekli." };
  }
  if (input.lines.length > 8) {
    return { success: false, message: "Tek islemde en fazla 8 odeme satiri girebilirsiniz." };
  }

  const normalizedLines = input.lines.map((line, index) => {
    if (!ALLOWED_METHODS.has(line.method)) {
      throw new Error(`Yontem gecersiz (satir ${index + 1}).`);
    }
    if (!isValidAmount(line.amount)) {
      throw new Error(`Tutar gecersiz (satir ${index + 1}).`);
    }
    return {
      method: line.method,
      amount: roundMoney(line.amount),
      note: normalizeLineNote(line.note),
    };
  });

  const totalEntered = roundMoney(
    normalizedLines.reduce((sum, line) => sum + line.amount, 0),
  );
  if (totalEntered <= 0) {
    return { success: false, message: "Toplam odeme tutari sifirdan buyuk olmali." };
  }

  try {
    const { username, tenantId, staffId } =
      await requireCashierWaiterOrManagerSession("cash.collect");
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "CASH_OPERATIONS");
    if (!featureGate.ok) {
      return { success: false, message: featureGate.message };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const table = await tx.table.findFirst({
          where: { id: tableId, restaurant: { tenantId } },
          select: {
            id: true,
            tableNo: true,
            isActive: true,
            restaurant: { select: { name: true } },
          },
        });
        if (!table) {
          return { success: false as const, message: "Masa bulunamadi." };
        }
        if (!table.isActive) {
          return { success: false as const, message: "Kapali masada tahsilat yapilamaz." };
        }

        const duplicateCount = await tx.payment.count({
          where: {
            tenantId,
            tableId,
            note: { contains: `[split-ref:${mutationId}:` },
          },
        });
        if (duplicateCount > 0) {
          return {
            success: true as const,
            duplicate: true as const,
            tableNo: table.tableNo,
            settled: false,
            totalEntered,
            receipt: null,
          };
        }

        const billing = await getTableBillingSnapshot({
          tenantId,
          tableId,
          prismaClient: tx,
        });
        const remaining = roundMoney(Math.max(0, billing.remainingAmount));
        if (remaining <= 0) {
          return {
            success: false as const,
            message: "Bu masa icin tahsil edilecek tutar bulunmuyor.",
          };
        }

        if (totalEntered > remaining) {
          return {
            success: false as const,
            message: `Girilen toplam (${totalEntered.toFixed(2)}) kalan tutari (${remaining.toFixed(2)}) asamaz.`,
          };
        }

        const difference = roundMoney(remaining - totalEntered);
        if (mode === "FULL" && Math.abs(difference) > 0.009) {
          return {
            success: false as const,
            message: `Tam kapatma icin girilen toplam kalan tutara esit olmali (${remaining.toFixed(2)}).`,
          };
        }
        if (mode === "PARTIAL" && difference <= 0.009) {
          return {
            success: false as const,
            message: "Kismi odemede hesap tamamen kapanamaz. Tam kapatma modunu secin.",
          };
        }

        const currentSession = await tx.tableSession.findFirst({
          where: { tenantId, tableId, isActive: true },
          select: { id: true },
        });

        const openBill = await tx.billRequest.findFirst({
          where: {
            tenantId,
            tableId,
            status: { in: ["PENDING", "ACKNOWLEDGED"] },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            acknowledgedAt: true,
            acknowledgedByStaffId: true,
          },
        });

        const bill = openBill
          ? (openBill as LockedBill)
          : await tx.billRequest.create({
              data: {
                tenantId,
                tableId,
                tableSessionId: currentSession?.id ?? null,
                status: "ACKNOWLEDGED",
                acknowledgedAt: new Date(),
                acknowledgedByStaffId: staffId ?? null,
              },
              select: {
                id: true,
                status: true,
                acknowledgedAt: true,
                acknowledgedByStaffId: true,
              },
            });

        if (bill.status === "SETTLED" || bill.status === "CANCELED") {
          return { success: false as const, message: "Bu hesap zaten kapanmis." };
        }

        await tx.payment.createMany({
          data: normalizedLines.map((line, index) => ({
            tenantId,
            tableId,
            billRequestId: bill.id,
            amount: line.amount,
            method: line.method,
            note: withSplitRef(line.note, mutationId, index),
          })),
        });

        let settled = false;
        if (mode === "FULL") {
          const now = new Date();
          await tx.billRequest.update({
            where: { id: bill.id },
            data: {
              status: "SETTLED",
              settledAt: now,
              ...(bill.acknowledgedAt == null
                ? {
                    acknowledgedAt: now,
                    acknowledgedByStaffId: staffId ?? null,
                  }
                : {}),
            },
          });

          await tx.table.update({
            where: { id: tableId },
            data: { isActive: false },
          });
          await tx.tableSession.updateMany({
            where: { tenantId, tableId, isActive: true },
            data: { isActive: false },
          });
          settled = true;
        }

        return {
          success: true as const,
          duplicate: false as const,
          tableNo: table.tableNo,
          settled,
          totalEntered,
          remainingBefore: remaining,
          remainingAfter: Math.max(0, difference),
          billRequestId: bill.id,
          restaurantName: table.restaurant.name ?? "Restoran",
          receipt:
            mode === "FULL"
              ? ({
                  receiptId: mutationId,
                  title: "Hesap Kapatma Bilgi Fisi",
                  restaurantName: table.restaurant.name ?? "Restoran",
                  tableNo: table.tableNo,
                  issuedAtIso: new Date().toISOString(),
                  reference: `HESAP-${bill.id}`,
                  cashierName: username,
                  lines: normalizedLines.map((line) => ({
                    method: line.method,
                    amount: line.amount,
                    note: line.note ?? null,
                  })),
                  transactionTotal: totalEntered,
                  remainingBefore: remaining,
                  remainingAfter: Math.max(0, difference),
                  disclaimer: NON_FISCAL_DISCLAIMER,
                } satisfies SplitPaymentReceiptView)
              : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.success) {
      return { success: false, message: result.message };
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: result.settled ? "BILL_SETTLED" : "TABLE_PAYMENT",
      entityType: "Table",
      entityId: String(tableId),
      description: result.duplicate
        ? "split_payment_duplicate_ignored"
        : `${mode}_split_total=${result.totalEntered.toFixed(2)}`,
    });

    revalidatePath("/restaurant/cash");
    revalidatePath("/restaurant");
    revalidatePath("/waiter");

    if (result.duplicate) {
      return {
        success: true,
        message: "Ayni islem daha once kaydedildigi icin tekrar uygulanmadi.",
        settled: result.settled,
        receipt: null,
      };
    }

    return {
      success: true,
      message: result.settled
        ? `Masa ${result.tableNo} hesabi kapatildi.`
        : `Kismi odeme kaydedildi. Kalan tutar: ${result.remainingAfter.toFixed(2)} TL`,
      settled: result.settled,
      receipt: result.receipt,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Split tahsilat islenemedi." };
  }
}
