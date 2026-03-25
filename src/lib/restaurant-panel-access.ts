import type { StaffRole } from "@prisma/client";

type CashierCapability =
  | "cash.view"
  | "cash.collect"
  | "cash.settle"
  | "billrequest.view"
  | "table.open_balance.view";

const CASHIER_CAPABILITIES = new Set<CashierCapability>([
  "cash.view",
  "cash.collect",
  "cash.settle",
  "billrequest.view",
  "table.open_balance.view",
]);

export function resolveRestaurantHomePath(role: StaffRole): string {
  if (role === "CASHIER") return "/restaurant/cash";
  return "/restaurant";
}

export function normalizeRestaurantPathname(pathname: string | null | undefined): string {
  const raw = (pathname ?? "").trim();
  if (!raw) return "/";
  const withoutQuery = raw.split("?")[0]?.split("#")[0] ?? "/";
  let normalized = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || "/";
}

export function getRestaurantPanelRoleTitle(role: StaffRole): string {
  if (role === "CASHIER") return "Kasiyer";
  return "Restoran Muduru";
}

function hasCashierCapability(capability: CashierCapability): boolean {
  return CASHIER_CAPABILITIES.has(capability);
}

function requiredCapabilityForRestaurantPath(pathname: string): CashierCapability | null {
  const normalizedPath = normalizeRestaurantPathname(pathname);
  if (
    normalizedPath === "/restaurant/cash" ||
    normalizedPath.startsWith("/restaurant/cash/receipt")
  ) {
    return "cash.view";
  }
  return null;
}

export function canAccessRestaurantPath(params: { role: StaffRole; pathname: string }): boolean {
  const normalizedPath = normalizeRestaurantPathname(params.pathname);
  if (params.role === "MANAGER") return true;
  if (params.role !== "CASHIER") return false;
  const required = requiredCapabilityForRestaurantPath(normalizedPath);
  if (!required) return false;
  return hasCashierCapability(required);
}

export function canAccessRestaurantNavItem(params: {
  role: StaffRole;
  href: string;
}): boolean {
  return canAccessRestaurantPath({
    role: params.role,
    pathname: params.href,
  });
}

export function isCashCollectionRole(role: StaffRole): boolean {
  return role === "MANAGER" || role === "CASHIER";
}
