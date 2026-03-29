import type { StaffRole } from "@prisma/client";
import type { EntitlementFeature } from "@/core/entitlements/engine";

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

type RestaurantPathGate = {
  feature: EntitlementFeature;
  label: string;
  matches: (normalizedPath: string) => boolean;
};

const RESTAURANT_PATH_FEATURE_GATES: RestaurantPathGate[] = [
  {
    feature: "QR_MENU_VIEW",
    label: "QR Menu",
    matches: (path) =>
      path === "/restaurant/menu" || (path.startsWith("/restaurant/menu/") && !path.startsWith("/restaurant/menu/showcase")),
  },
  {
    feature: "SHOWCASE_RAILS",
    label: "Populer / Sik Tuketilenler",
    matches: (path) => path.startsWith("/restaurant/menu/showcase/"),
  },
  {
    feature: "QR_ORDERING",
    label: "QR Siparis",
    matches: (path) => path.startsWith("/restaurant/orders"),
  },
  {
    feature: "ORDER_CANCELLATIONS",
    label: "Iptaller",
    matches: (path) => path.startsWith("/restaurant/cancellations"),
  },
  {
    feature: "BILLING_RECEIPTS",
    label: "Fatura / Fis",
    matches: (path) => path.startsWith("/restaurant/invoicing"),
  },
  {
    feature: "CASH_OPERATIONS",
    label: "Kasa",
    matches: (path) =>
      path === "/restaurant/cash" ||
      path.startsWith("/restaurant/cash/") ||
      path.startsWith("/restaurant/cash-register"),
  },
  {
    feature: "STOCK_MANAGEMENT",
    label: "Stok / Envanter",
    matches: (path) => path.startsWith("/restaurant/stocks"),
  },
  {
    feature: "STOCK_MANAGEMENT",
    label: "Alerjenler",
    matches: (path) => path.startsWith("/restaurant/allergens"),
  },
  {
    feature: "WAITER_CALL_LOGS",
    label: "Garson Cagri Loglari",
    matches: (path) => path.startsWith("/restaurant/waiter-calls"),
  },
  {
    feature: "STAFF_PERFORMANCE",
    label: "Personel Performansi",
    matches: (path) => path.startsWith("/restaurant/performance"),
  },
  {
    feature: "ADVANCED_REPORTS",
    label: "Raporlar",
    matches: (path) => path.startsWith("/restaurant/reports"),
  },
];

export function resolveFeatureGateForRestaurantPath(pathname: string): {
  feature: EntitlementFeature;
  label: string;
} | null {
  const normalizedPath = normalizeRestaurantPathname(pathname);
  const matched = RESTAURANT_PATH_FEATURE_GATES.find((gate) => gate.matches(normalizedPath));
  if (!matched) return null;
  return { feature: matched.feature, label: matched.label };
}

export function isRestaurantPathFeatureEnabled(params: {
  pathname: string;
  enabledFeatures: Set<string>;
}): boolean {
  const gate = resolveFeatureGateForRestaurantPath(params.pathname);
  if (!gate) return true;
  return params.enabledFeatures.has(gate.feature);
}

export function canAccessRestaurantPath(params: { role: StaffRole; pathname: string }): boolean {
  const normalizedPath = normalizeRestaurantPathname(params.pathname);
  if (params.role === "MANAGER") return true;
  if (params.role !== "CASHIER") return false;
  const required = requiredCapabilityForRestaurantPath(normalizedPath);
  if (!required) return false;
  return hasCashierCapability(required);
}

export function canAccessRestaurantPathWithFeatures(params: {
  role: StaffRole;
  pathname: string;
  enabledFeatures: Set<string>;
}):
  | { allowed: true }
  | { allowed: false; reason: "ROLE" | "FEATURE"; featureLabel?: string } {
  const normalizedPath = normalizeRestaurantPathname(params.pathname);
  const roleAccess = canAccessRestaurantPath({
    role: params.role,
    pathname: normalizedPath,
  });
  if (!roleAccess) {
    return { allowed: false, reason: "ROLE" };
  }

  const gate = resolveFeatureGateForRestaurantPath(normalizedPath);
  if (!gate) {
    return { allowed: true };
  }

  if (!params.enabledFeatures.has(gate.feature)) {
    return { allowed: false, reason: "FEATURE", featureLabel: gate.label };
  }

  return { allowed: true };
}

export function canAccessRestaurantNavItem(params: {
  role: StaffRole;
  href: string;
  enabledFeatures?: Set<string>;
}): boolean {
  if (!params.enabledFeatures) {
    return canAccessRestaurantPath({ role: params.role, pathname: params.href });
  }
  return canAccessRestaurantPathWithFeatures({
    role: params.role,
    pathname: params.href,
    enabledFeatures: params.enabledFeatures,
  }).allowed;
}

export function isCashCollectionRole(role: StaffRole): boolean {
  return role === "MANAGER" || role === "CASHIER";
}

export function resolveStorefrontFeatureAccess(enabledFeatures: Set<string>): {
  orderingEnabled: boolean;
  waiterCallEnabled: boolean;
  billRequestEnabled: boolean;
} {
  return {
    orderingEnabled: enabledFeatures.has("QR_ORDERING"),
    waiterCallEnabled:
      enabledFeatures.has("WAITER_CALL_LOGS") || enabledFeatures.has("WAITER_CALL"),
    billRequestEnabled:
      enabledFeatures.has("BILLING_RECEIPTS") || enabledFeatures.has("INVOICING"),
  };
}

export function canManageMenuComplianceFromFeatures(
  enabledFeatures: Set<string>,
): boolean {
  return enabledFeatures.has("MENU") || enabledFeatures.has("QR_ORDERING");
}
