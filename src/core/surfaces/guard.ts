import type { Capability } from "@/core/authz/capabilities";
import type { AuthorizationActor } from "@/core/authz/actors";
import { assertActorCapability } from "@/core/authz/policy";
import {
  assertFeatureEnabled,
  type EntitlementFeature,
} from "@/core/entitlements/engine";
import {
  assertTenantLifecycleSurfaceAccess,
  type TenantLifecycleSnapshot,
} from "@/core/tenancy/lifecycle-policy";
import type { SecuritySurface, SurfaceAccessOperation } from "@/core/surfaces/types";

const SURFACE_ACCESS_CAPABILITY: Record<SecuritySurface, Capability | null> = {
  "marketing-public": null,
  "hq-private": "SURFACE_HQ_ACCESS",
  "ops-private": "SURFACE_OPS_ACCESS",
  "waiter-private": "SURFACE_WAITER_ACCESS",
  "kitchen-private": "SURFACE_KITCHEN_ACCESS",
  "storefront-public": "SURFACE_STOREFRONT_ACCESS",
  "payment-webhook": "PAYMENT_WEBHOOK_PROCESS",
  "internal-admin": "SURFACE_OPS_ACCESS",
};

export class SurfaceGuardError extends Error {
  readonly code:
    | "SURFACE_ACCESS_DENIED"
    | "CAPABILITY_REQUIRED"
    | "TENANT_LIFECYCLE_BLOCKED"
    | "FEATURE_DISABLED";

  constructor(
    code:
      | "SURFACE_ACCESS_DENIED"
      | "CAPABILITY_REQUIRED"
      | "TENANT_LIFECYCLE_BLOCKED"
      | "FEATURE_DISABLED",
    message: string,
  ) {
    super(message);
    this.name = "SurfaceGuardError";
    this.code = code;
  }
}

export async function assertSurfaceGuard(input: {
  surface: SecuritySurface;
  actor: AuthorizationActor;
  operation: SurfaceAccessOperation;
  tenantId?: number;
  requiredCapability?: Capability;
  requiredFeature?: EntitlementFeature;
}): Promise<{ lifecycle?: TenantLifecycleSnapshot }> {
  const surfaceCapability = SURFACE_ACCESS_CAPABILITY[input.surface];
  try {
    if (surfaceCapability) {
      assertActorCapability(input.actor, surfaceCapability);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      throw new SurfaceGuardError("SURFACE_ACCESS_DENIED", error.message);
    }
    throw error;
  }

  if (input.requiredCapability) {
    try {
      assertActorCapability(input.actor, input.requiredCapability);
    } catch (error) {
      if (error instanceof Error && error.name === "AuthorizationError") {
        throw new SurfaceGuardError("CAPABILITY_REQUIRED", error.message);
      }
      throw error;
    }
  }

  let lifecycle: TenantLifecycleSnapshot | undefined;
  if (input.tenantId != null) {
    try {
      lifecycle = await assertTenantLifecycleSurfaceAccess({
        tenantId: input.tenantId,
        surface: input.surface,
        operation: input.operation,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TenantLifecycleAccessError") {
        throw new SurfaceGuardError("TENANT_LIFECYCLE_BLOCKED", error.message);
      }
      throw error;
    }
  }

  if (input.requiredFeature && input.tenantId != null) {
    try {
      await assertFeatureEnabled(input.tenantId, input.requiredFeature);
    } catch (error) {
      if (error instanceof Error && error.name === "EntitlementFeatureDisabledError") {
        throw new SurfaceGuardError("FEATURE_DISABLED", error.message);
      }
      throw error;
    }
  }

  return { lifecycle };
}
