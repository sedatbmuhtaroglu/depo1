"use server";

import { Prisma, type CashMovementCategory, type CashMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";
import { logServerError } from "@/lib/server-error-log";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import {
  CASH_MOVEMENT_CATEGORY_OPTIONS,
  ensureCashRegisterDay,
  recomputeCashRegisterDay,
} from "@/lib/cash-register";
import { getTurkeyDateString } from "@/lib/turkey-time";

const MAX_NOTE_LENGTH = 500;
const MAX_CLOSING_NOTE_LENGTH = 1000;

const ALLOWED_TYPES = new Set<CashMovementType>(["IN", "OUT"]);
const ALLOWED_CATEGORIES = new Set<CashMovementCategory>(
  CASH_MOVEMENT_CATEGORY_OPTIONS.map((option) => option.value),
);

function normalizeOptionalNote(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function parseAmount(value: string | number, options?: { allowZero?: boolean }) {
  const raw = typeof value === "number" ? String(value) : String(value ?? "");
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false as const, message: "Tutar formatı geçersiz." };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false as const, message: "Tutar geçersiz." };
  }
  if (options?.allowZero ? parsed < 0 : parsed <= 0) {
    return {
      ok: false as const,
      message: options?.allowZero
        ? "Tutar negatif olamaz."
        : "Tutar sıfırdan büyük olmalı.",
    };
  }

  return { ok: true as const, value: new Prisma.Decimal(parsed.toFixed(2)) };
}

async function getManagerContext() {
  await assertPrivilegedServerActionOrigin();
  const { username, tenantId } = await requireManagerSession();
  const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
  if (tenantId !== ctxTenantId) {
    return { ok: false as const, message: "Yetkisiz." };
  }

  const actor = await prisma.tenantStaff.findFirst({
    where: { tenantId, username },
    select: { id: true },
  });

  return {
    ok: true as const,
    tenantId,
    username,
    actorUserId: actor?.id ?? null,
  };
}

async function assertRestaurantBelongsToTenant(tenantId: number, restaurantId: number) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: restaurantId, tenantId },
    select: { id: true },
  });
  return Boolean(restaurant);
}

export async function createCashMovement(input: {
  restaurantId: number;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: string | number;
  note?: string | null;
  businessDate?: string;
}) {
  try {
    const context = await getManagerContext();
    if (!context.ok) {
      return { success: false, message: context.message };
    }

    const restaurantId = Number(input.restaurantId);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return { success: false, message: "Geçerli restoran seçin." };
    }

    if (!ALLOWED_TYPES.has(input.type)) {
      return { success: false, message: "İşlem tipi geçersiz." };
    }
    if (!ALLOWED_CATEGORIES.has(input.category)) {
      return { success: false, message: "Kategori geçersiz." };
    }

    const amountResult = parseAmount(input.amount);
    if (!amountResult.ok) {
      return { success: false, message: amountResult.message };
    }

    const hasRestaurant = await assertRestaurantBelongsToTenant(context.tenantId, restaurantId);
    if (!hasRestaurant) {
      return { success: false, message: "Restoran bulunamadı." };
    }

    const businessDate = input.businessDate ?? getTurkeyDateString();
    const day = await ensureCashRegisterDay({
      tenantId: context.tenantId,
      restaurantId,
      businessDate,
    });

    if (day.closedAt) {
      return {
        success: false,
        message: "Bu gün sonu kapanmış. Yeni işlem için yeni gün seçin.",
      };
    }

    const note = normalizeOptionalNote(input.note, MAX_NOTE_LENGTH);
    const created = await prisma.cashMovement.create({
      data: {
        tenantId: context.tenantId,
        restaurantId,
        createdByUserId: context.actorUserId,
        type: input.type,
        category: input.category,
        amount: amountResult.value,
        note,
      },
      select: { id: true },
    });

    await recomputeCashRegisterDay({
      tenantId: context.tenantId,
      restaurantId,
      businessDate,
    });

    await writeAuditLog({
      tenantId: context.tenantId,
      actor: { type: "admin", id: context.username },
      actionType: "CASH_MOVEMENT_CREATE",
      entityType: "CashMovement",
      entityId: String(created.id),
      description: `type=${input.type}; category=${input.category}; amount=${amountResult.value.toString()}`,
    });

    revalidatePath("/restaurant/cash-register");
    revalidatePath("/restaurant/reports");
    return { success: true };
  } catch (error) {
    logServerError("cash-register:create-movement", error);
    return { success: false, message: "İşlem kaydedilemedi." };
  }
}

export async function voidCashMovement(input: {
  movementId: number;
  restaurantId: number;
  businessDate?: string;
}) {
  try {
    const context = await getManagerContext();
    if (!context.ok) {
      return { success: false, message: context.message };
    }

    const movementId = Number(input.movementId);
    const restaurantId = Number(input.restaurantId);
    if (!Number.isInteger(movementId) || movementId <= 0) {
      return { success: false, message: "Geçerli hareket seçin." };
    }
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return { success: false, message: "Geçerli restoran seçin." };
    }

    const movement = await prisma.cashMovement.findFirst({
      where: {
        id: movementId,
        tenantId: context.tenantId,
        restaurantId,
      },
      select: {
        id: true,
        isVoided: true,
        occurredAt: true,
      },
    });
    if (!movement) {
      return { success: false, message: "İşlem bulunamadı." };
    }
    if (movement.isVoided) {
      return { success: false, message: "Bu işlem zaten iptal edilmiş." };
    }

    const businessDate = input.businessDate ?? getTurkeyDateString(movement.occurredAt);
    const day = await ensureCashRegisterDay({
      tenantId: context.tenantId,
      restaurantId,
      businessDate,
    });

    if (day.closedAt) {
      return { success: false, message: "Günü kapanmış hareketler iptal edilemez." };
    }

    await prisma.cashMovement.update({
      where: { id: movement.id },
      data: {
        isVoided: true,
        voidedAt: new Date(),
      },
    });

    await recomputeCashRegisterDay({
      tenantId: context.tenantId,
      restaurantId,
      businessDate,
    });

    await writeAuditLog({
      tenantId: context.tenantId,
      actor: { type: "admin", id: context.username },
      actionType: "CASH_MOVEMENT_VOID",
      entityType: "CashMovement",
      entityId: String(movement.id),
      description: "isVoided=true",
    });

    revalidatePath("/restaurant/cash-register");
    revalidatePath("/restaurant/reports");
    return { success: true };
  } catch (error) {
    logServerError("cash-register:void-movement", error);
    return { success: false, message: "İşlem iptal edilemedi." };
  }
}

export async function closeCashRegisterDay(input: {
  restaurantId: number;
  countedBalance: string | number;
  closingNote?: string | null;
  businessDate?: string;
}) {
  try {
    const context = await getManagerContext();
    if (!context.ok) {
      return { success: false, message: context.message };
    }

    const restaurantId = Number(input.restaurantId);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return { success: false, message: "Geçerli restoran seçin." };
    }

    const hasRestaurant = await assertRestaurantBelongsToTenant(context.tenantId, restaurantId);
    if (!hasRestaurant) {
      return { success: false, message: "Restoran bulunamadı." };
    }

    const countedResult = parseAmount(input.countedBalance, { allowZero: true });
    if (!countedResult.ok) {
      return { success: false, message: "Sayılan fiziksel kasa tutarı geçersiz." };
    }

    const businessDate = input.businessDate ?? getTurkeyDateString();
    const recomputed = await recomputeCashRegisterDay({
      tenantId: context.tenantId,
      restaurantId,
      businessDate,
    });

    if (recomputed.day.closedAt) {
      return { success: false, message: "Bu gün sonu daha önce kaydedilmiş." };
    }

    const variance = countedResult.value.sub(recomputed.summary.currentBalance);
    const closingNote = normalizeOptionalNote(input.closingNote, MAX_CLOSING_NOTE_LENGTH);

    await prisma.cashRegisterDay.update({
      where: { id: recomputed.day.id },
      data: {
        countedBalance: countedResult.value,
        variance,
        closingNote,
        closedAt: new Date(),
      },
    });

    await writeAuditLog({
      tenantId: context.tenantId,
      actor: { type: "admin", id: context.username },
      actionType: "CASH_DAY_CLOSE",
      entityType: "CashRegisterDay",
      entityId: String(recomputed.day.id),
      description: `counted=${countedResult.value.toString()}; variance=${variance.toString()}`,
    });

    revalidatePath("/restaurant/cash-register");
    revalidatePath("/restaurant/reports");
    return { success: true };
  } catch (error) {
    logServerError("cash-register:close-day", error);
    return { success: false, message: "Gün sonu kaydedilemedi." };
  }
}


