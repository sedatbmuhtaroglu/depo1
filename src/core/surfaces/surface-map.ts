import type { AppSurface } from "@/core/routing/app-surface";
import type { SecuritySurface } from "@/core/surfaces/types";

export const APP_TO_SECURITY_SURFACE: Record<AppSurface, SecuritySurface> = {
  marketing: "marketing-public",
  hq: "hq-private",
  "restaurant-ops": "ops-private",
  waiter: "waiter-private",
  kitchen: "kitchen-private",
  storefront: "storefront-public",
  unknown: "internal-admin",
};

export function mapAppSurfaceToSecuritySurface(surface: AppSurface): SecuritySurface {
  return APP_TO_SECURITY_SURFACE[surface];
}
