"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import {
  encryptSecretAtRest,
  isLegacyPlaintextSecret,
} from "@/lib/secret-crypto";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export async function saveIyzicoConfig(options: {
  apiKey: string;
  // Secret bos gonderilirse mevcut deger korunur.
  secretKey?: string;
  isSandbox: boolean;
  isActive: boolean;
}) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const apiKey = options.apiKey?.trim() || null;
    const newSecret = options.secretKey?.trim();
    const encryptedSecret =
      newSecret !== undefined && newSecret !== ""
        ? encryptSecretAtRest(newSecret)
        : undefined;

    const existing = await prisma.tenantPaymentConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: "IYZICO" } },
    });

    const existingLegacySecret = existing?.secretKey?.trim() ?? null;
    const shouldMigrateLegacySecret =
      encryptedSecret === undefined &&
      isLegacyPlaintextSecret(existingLegacySecret);

    const finalSecretForWrite =
      encryptedSecret !== undefined
        ? encryptedSecret
        : shouldMigrateLegacySecret && existingLegacySecret
          ? encryptSecretAtRest(existingLegacySecret)
          : undefined;

    const updatePayload = {
      apiKey,
      isSandbox: options.isSandbox,
      isActive: options.isActive,
      ...(finalSecretForWrite !== undefined && { secretKey: finalSecretForWrite }),
    };

    if (existing) {
      await prisma.tenantPaymentConfig.update({
        where: { tenantId_provider: { tenantId, provider: "IYZICO" } },
        data: updatePayload,
      });
    } else {
      await prisma.tenantPaymentConfig.create({
        data: {
          tenantId,
          provider: "IYZICO",
          apiKey,
          secretKey: finalSecretForWrite || null,
          isSandbox: options.isSandbox,
          isActive: options.isActive,
        },
      });
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "SETTINGS_UPDATE",
      entityType: "TenantPaymentConfig",
      entityId: "IYZICO",
      description: `Odeme ayarlari guncellendi (iyzico): ${
        options.isActive ? "aktif" : "pasif"
      }, test modu: ${options.isSandbox}`,
    });

    revalidatePath("/restaurant/settings");
    revalidatePath("/waiter");

    return { success: true, message: "Odeme ayarlari kaydedildi." };
  } catch (error) {
    const safeErrorMessage = error instanceof Error ? error.message : String(error);
    console.error("Iyzico config save failed:", safeErrorMessage);
    return {
      success: false,
      message: "Odeme ayarlari guvenli sekilde kaydedilemedi.",
    };
  }
}
