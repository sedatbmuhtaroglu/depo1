"use server";

import { createStaffActor } from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";

export async function addTenantDomain(domain: string) {
  try {
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    await assertSurfaceGuard({
      surface: "ops-private",
      actor: createStaffActor({
        tenantId,
        username,
        role: "MANAGER",
      }),
      tenantId,
      operation: "mutation",
      requiredCapability: "CUSTOM_DOMAIN_MANAGE",
      requiredFeature: "CUSTOM_DOMAIN",
    });
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed) {
      return { success: false, message: "Domain girin." };
    }

    const existing = await prisma.tenantDomain.findFirst({
      where: { tenantId, domain: trimmed },
    });
    if (existing) {
      return { success: false, message: "Bu domain zaten kayıtlı." };
    }

    const count = await prisma.tenantDomain.count({ where: { tenantId } });
    await prisma.tenantDomain.create({
      data: {
        tenantId,
        domain: trimmed,
        type: "CUSTOM",
        isPrimary: count === 0,
        isVerified: false,
      },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "DOMAIN_ADD",
      entityType: "TenantDomain",
      description: trimmed,
    });

    revalidatePath("/restaurant/settings");
    return { success: true };
  } catch (e) {
    logServerError("tenant-domain", e);
    return { success: false, message: "Domain eklenemedi." };
  }
}

export async function removeTenantDomain(domainId: number) {
  try {
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    await assertSurfaceGuard({
      surface: "ops-private",
      actor: createStaffActor({
        tenantId,
        username,
        role: "MANAGER",
      }),
      tenantId,
      operation: "mutation",
      requiredCapability: "CUSTOM_DOMAIN_MANAGE",
      requiredFeature: "CUSTOM_DOMAIN",
    });
    const row = await prisma.tenantDomain.findFirst({
      where: { id: domainId, tenantId },
    });
    if (!row) {
      return { success: false, message: "Domain bulunamadı." };
    }

    await prisma.tenantDomain.delete({ where: { id: domainId } });
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "DOMAIN_REMOVE",
      entityType: "TenantDomain",
      entityId: String(domainId),
      description: row.domain,
    });
    revalidatePath("/restaurant/settings");
    return { success: true };
  } catch (e) {
    logServerError("tenant-domain", e);
    return { success: false, message: "Domain kaldırılamadı." };
  }
}
