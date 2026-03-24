"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import {
  normalizeInitialStatus,
  normalizeTenantSlug,
  parsePlanCode,
  provisionTenant,
  TenantProvisioningError,
} from "@/modules/hq/server/tenant-provisioning";

type CreateTenantResult =
  | { success: true; message: string; tenantId: number }
  | { success: false; message: string };

const TRIAL_CREATE_BLOCK_MESSAGE =
  "Trial tenant olusturmak icin once lead olusturup Lead Detail icinden Trial Baslat kullanilmali.";
const ACTIVE_CREATE_BLOCK_MESSAGE =
  "Tenant ACTIVE edilmeden once ticari kayit olusturulmalidir. Once PENDING_SETUP ile olusturup ticari kaydi girin.";

export async function createTenantAction(formData: FormData): Promise<CreateTenantResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "TENANT_CREATE" });

    const name = formData.get("name")?.toString().trim() ?? "";
    const slugInput = formData.get("slug")?.toString() ?? "";
    const planCode = parsePlanCode(formData.get("planCode")?.toString() ?? "");
    const initialStatus = normalizeInitialStatus(
      formData.get("initialStatus")?.toString().toUpperCase() ?? null,
    );
    const restaurantName = formData.get("restaurantName")?.toString().trim() ?? "";
    const primaryDomain = formData.get("primaryDomain")?.toString().trim().toLowerCase() ?? "";

    if (!name) {
      return { success: false, message: "Tenant adi zorunlu." };
    }

    const slug = normalizeTenantSlug(slugInput);
    if (!slug) {
      return { success: false, message: "Gecerli bir slug girin." };
    }

    if (!planCode) {
      return { success: false, message: "Gecerli plan secin." };
    }

    if (!initialStatus) {
      return { success: false, message: "Gecerli bir baslangic status secin." };
    }
    if (initialStatus === "TRIAL") {
      return { success: false, message: TRIAL_CREATE_BLOCK_MESSAGE };
    }
    if (initialStatus === "ACTIVE") {
      return { success: false, message: ACTIVE_CREATE_BLOCK_MESSAGE };
    }

    const created = await provisionTenant({
      name,
      slug,
      planCode,
      initialStatus,
      restaurantName,
      primaryDomain,
    });

    await writeAuditLog({
      tenantId: created.tenant.id,
      actor: { type: "admin", id: `hq:${hq.username}` },
      actionType: "HQ_TENANT_CREATE",
      entityType: "Tenant",
      entityId: String(created.tenant.id),
      description: `slug=${created.tenant.slug}; plan=${created.planCode}; initial=${created.initialStatus}`,
    });

    revalidatePath("/hq");
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${created.tenant.id}`);

    return {
      success: true,
      message: "Tenant basariyla olusturuldu.",
      tenantId: created.tenant.id,
    };
  } catch (error) {
    if (error instanceof TenantProvisioningError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Tenant olusturulamadi." };
  }
}
