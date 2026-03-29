"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import { purgeTenantOperationalDataTx } from "@/modules/hq/server/tenant-delete";

type DeleteTenantActionResult =
  | { success: true; message: string; redirectTo: string }
  | { success: false; message: string };

const CONFIRM_PHRASE = "KALICI SIL";

function parseTenantId(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeText(value: FormDataEntryValue | null, maxLength = 160): string {
  return (value?.toString() ?? "").trim().slice(0, maxLength);
}

export async function deleteTenantPermanentlyAction(
  formData: FormData,
): Promise<DeleteTenantActionResult> {
  try {
    const tenantId = parseTenantId(formData.get("tenantId"));
    if (!tenantId) {
      return { success: false, message: "Gecersiz tenant secimi." };
    }

    await assertHqMutationGuard({
      capability: "TENANT_DELETE",
      tenantId,
    });

    const confirmIdentity = normalizeText(formData.get("confirmIdentity"));
    const confirmPhrase = normalizeText(formData.get("confirmPhrase"), 32).toUpperCase();
    const irreversibleAck = formData.get("irreversibleAck")?.toString() === "on";

    if (!confirmIdentity) {
      return { success: false, message: "Onay icin tenant slug veya adini yazmalisiniz." };
    }
    if (confirmPhrase !== CONFIRM_PHRASE) {
      return { success: false, message: `"${CONFIRM_PHRASE}" ifadesi dogru girilmelidir.` };
    }
    if (!irreversibleAck) {
      return { success: false, message: "Geri alinamaz onay kutusu zorunludur." };
    }

    const deletedTenant = await prisma.$transaction(
      async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });
        if (!tenant) {
          throw new Error("TENANT_NOT_FOUND");
        }

        const identityMatched = confirmIdentity === tenant.slug || confirmIdentity === tenant.name;
        if (!identityMatched) {
          throw new Error("CONFIRMATION_MISMATCH");
        }

        await purgeTenantOperationalDataTx(tx, tenant.id);
        return tenant;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/hq");
    revalidatePath("/hq/tenants");
    revalidatePath("/hq/leads");
    revalidatePath("/hq/accounting");
    revalidatePath("/hq/accounting/records");
    revalidatePath("/hq/accounting/payments");

    return {
      success: true,
      message: "Tenant kalici olarak silindi.",
      redirectTo: `/hq/tenants?deleted=${encodeURIComponent(deletedTenant.slug)}`,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "TENANT_NOT_FOUND") {
        return { success: false, message: "Tenant bulunamadi veya daha once silinmis." };
      }
      if (error.message === "CONFIRMATION_MISMATCH") {
        return { success: false, message: "Onay metni tenant adi veya slug ile eslesmiyor." };
      }
    }
    return {
      success: false,
      message:
        "Tenant silinemedi. Islem iptal edildi ve veriler geri alindi. Lutfen tekrar deneyin.",
    };
  }
}
