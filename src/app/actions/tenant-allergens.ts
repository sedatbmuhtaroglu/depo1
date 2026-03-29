"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";

const MAX_ALLERGEN_NAME_LENGTH = 80;

function normalizeAllergenName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSortOrder(value: number | null | undefined) {
  if (value === undefined || value === null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export async function createTenantAllergen(input: {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "STOCK_MANAGEMENT");
    if (!featureGate.ok) return { success: false, message: featureGate.message };

    const name = normalizeAllergenName(input.name ?? "");
    if (!name) {
      return { success: false, message: "Alerjen adı gerekli." };
    }
    if (name.length > MAX_ALLERGEN_NAME_LENGTH) {
      return { success: false, message: "Alerjen adı çok uzun (maks 80)." };
    }

    await prisma.tenantAllergen.create({
      data: {
        tenantId,
        name,
        sortOrder: normalizeSortOrder(input.sortOrder),
        isActive: input.isActive ?? true,
      },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "TENANT_SETTINGS_UPDATE",
      entityType: "TenantAllergen",
      description: `Alerjen eklendi: ${name}`,
    });

    revalidatePath("/restaurant/allergens");
    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "Bu alerjen adı zaten kayıtlı." };
    }
    logServerError("tenant-allergens:create", error);
    return { success: false, message: "Alerjen eklenemedi." };
  }
}

export async function updateTenantAllergen(
  allergenId: number,
  input: {
    name?: string;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "STOCK_MANAGEMENT");
    if (!featureGate.ok) return { success: false, message: featureGate.message };

    const existing = await prisma.tenantAllergen.findFirst({
      where: { id: allergenId, tenantId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return { success: false, message: "Alerjen bulunamadı." };
    }

    const updateData: {
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (input.name !== undefined) {
      const name = normalizeAllergenName(input.name);
      if (!name) {
        return { success: false, message: "Alerjen adı gerekli." };
      }
      if (name.length > MAX_ALLERGEN_NAME_LENGTH) {
        return { success: false, message: "Alerjen adı çok uzun (maks 80)." };
      }
      updateData.name = name;
    }
    if (input.sortOrder !== undefined) {
      updateData.sortOrder = normalizeSortOrder(input.sortOrder);
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    await prisma.tenantAllergen.update({
      where: { id: allergenId },
      data: updateData,
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "TENANT_SETTINGS_UPDATE",
      entityType: "TenantAllergen",
      entityId: String(allergenId),
      description: `Alerjen güncellendi: ${updateData.name ?? existing.name}`,
    });

    revalidatePath("/restaurant/allergens");
    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "Bu alerjen adı zaten kayıtlı." };
    }
    logServerError("tenant-allergens:update", error);
    return { success: false, message: "Alerjen güncellenemedi." };
  }
}

export async function deleteTenantAllergen(allergenId: number) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "STOCK_MANAGEMENT");
    if (!featureGate.ok) return { success: false, message: featureGate.message };

    const existing = await prisma.tenantAllergen.findFirst({
      where: { id: allergenId, tenantId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return { success: false, message: "Alerjen bulunamadı." };
    }

    await prisma.tenantAllergen.delete({
      where: { id: allergenId },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "TENANT_SETTINGS_UPDATE",
      entityType: "TenantAllergen",
      entityId: String(allergenId),
      description: `Alerjen silindi: ${existing.name}`,
    });

    revalidatePath("/restaurant/allergens");
    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (error) {
    logServerError("tenant-allergens:delete", error);
    return { success: false, message: "Alerjen silinemedi." };
  }
}
