import type { Capability } from "@/core/authz/capabilities";
import type { AuthorizationActor } from "@/core/authz/actors";

const STAFF_ROLE_CAPABILITIES = {
  MANAGER: [
    "SURFACE_OPS_ACCESS",
    "SURFACE_WAITER_ACCESS",
    "SURFACE_KITCHEN_ACCESS",
    "STAFF_MANAGE",
    "RESTAURANT_SETTINGS_MANAGE",
    "CUSTOM_DOMAIN_MANAGE",
    "cash.view",
    "cash.collect",
    "cash.settle",
    "billrequest.view",
    "table.open_balance.view",
  ],
  CASHIER: [
    "SURFACE_OPS_ACCESS",
    "cash.view",
    "cash.collect",
    "cash.settle",
    "billrequest.view",
    "table.open_balance.view",
  ],
  WAITER: ["SURFACE_WAITER_ACCESS"],
  KITCHEN: ["SURFACE_KITCHEN_ACCESS"],
} as const satisfies Record<string, readonly Capability[]>;

const HQ_ADMIN_CAPABILITIES: readonly Capability[] = [
  "SURFACE_HQ_ACCESS",
  "SURFACE_OPS_ACCESS",
  "TENANT_CREATE",
  "TENANT_PLAN_MANAGE",
  "TENANT_FEATURE_MANAGE",
  "TENANT_LIMIT_MANAGE",
  "TENANT_STATUS_MANAGE",
  "TENANT_DELETE",
  "SALES_LEAD_MANAGE",
  "SALES_TRIAL_CONVERT",
  "MARKETING_CONTENT_MANAGE",
];

const STOREFRONT_GUEST_CAPABILITIES: readonly Capability[] = [
  "SURFACE_STOREFRONT_ACCESS",
  "REQUEST_WAITER",
];

const SYSTEM_CAPABILITIES: readonly Capability[] = ["PAYMENT_WEBHOOK_PROCESS"];

export class AuthorizationError extends Error {
  readonly code: "CAPABILITY_REQUIRED";
  readonly capability: Capability;

  constructor(capability: Capability) {
    super(`Actor does not have capability: ${capability}`);
    this.name = "AuthorizationError";
    this.code = "CAPABILITY_REQUIRED";
    this.capability = capability;
  }
}

export function getActorCapabilities(actor: AuthorizationActor): Set<Capability> {
  switch (actor.kind) {
    case "STAFF":
      return new Set(STAFF_ROLE_CAPABILITIES[actor.role] ?? []);
    case "HQ_SUPPORT":
      return new Set(STAFF_ROLE_CAPABILITIES.MANAGER);
    case "HQ_ADMIN":
      return new Set(HQ_ADMIN_CAPABILITIES);
    case "STOREFRONT_GUEST":
      return new Set(STOREFRONT_GUEST_CAPABILITIES);
    case "SYSTEM":
      return new Set(SYSTEM_CAPABILITIES);
    case "ANONYMOUS":
      return new Set();
    default:
      return new Set();
  }
}

export function actorHasCapability(
  actor: AuthorizationActor,
  capability: Capability,
): boolean {
  return getActorCapabilities(actor).has(capability);
}

export function assertActorCapability(
  actor: AuthorizationActor,
  capability: Capability,
): void {
  if (!actorHasCapability(actor, capability)) {
    throw new AuthorizationError(capability);
  }
}
