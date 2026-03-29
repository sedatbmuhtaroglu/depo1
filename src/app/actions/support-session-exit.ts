"use server";

import { redirect } from "next/navigation";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { endSupportSessionByCookie } from "@/lib/support-session";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export async function exitSupportSessionAction() {
  await assertPrivilegedServerActionOrigin();
  const { tenantId } = await getCurrentTenantOrThrow();
  await endSupportSessionByCookie({ tenantId, outcome: "user_exit" });
  redirect(`/hq/tenants/${tenantId}`);
}
