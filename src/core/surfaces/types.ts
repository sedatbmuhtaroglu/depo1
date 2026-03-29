export const SECURITY_SURFACES = [
  "marketing-public",
  "hq-private",
  "ops-private",
  "waiter-private",
  "kitchen-private",
  "storefront-public",
  "payment-webhook",
  "internal-admin",
] as const;

export type SecuritySurface = (typeof SECURITY_SURFACES)[number];

export type SurfaceAccessOperation = "interactive" | "mutation" | "webhook";
