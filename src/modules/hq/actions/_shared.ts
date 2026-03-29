"use server";

import { createHqAdminActor } from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { requireHqSession } from "@/lib/auth";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export async function assertHqMutationGuard(input: {
  capability:
    | "TENANT_CREATE"
    | "TENANT_PLAN_MANAGE"
    | "TENANT_FEATURE_MANAGE"
    | "TENANT_LIMIT_MANAGE"
    | "TENANT_STATUS_MANAGE"
    | "TENANT_DELETE"
    | "SALES_LEAD_MANAGE"
    | "SALES_TRIAL_CONVERT"
    | "MARKETING_CONTENT_MANAGE";
  tenantId?: number;
}) {
  await assertPrivilegedServerActionOrigin();
  const hq = await requireHqSession();
  await assertSurfaceGuard({
    surface: "hq-private",
    actor: createHqAdminActor(hq.username),
    operation: "mutation",
    tenantId: input.tenantId,
    requiredCapability: input.capability,
  });
  return hq;
}
