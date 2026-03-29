import type { AppSurface } from "@/core/routing/app-surface";

export type ModuleName =
  | "marketing"
  | "hq"
  | "restaurant-ops"
  | "waiter"
  | "kitchen"
  | "storefront"
  | "core"
  | "shared";

export type ModuleBoundary = {
  module: ModuleName;
  primarySurface: AppSurface;
  ownedRoutePrefixes: string[];
  tenantScoped: boolean;
  publicAttackSurface: boolean;
  allowedInternalDependencies: ModuleName[];
  summary: string;
};

export const MODULE_BOUNDARIES: Record<ModuleName, ModuleBoundary> = {
  marketing: {
    module: "marketing",
    primarySurface: "marketing",
    ownedRoutePrefixes: ["/", "/pricing", "/contact", "/about"],
    tenantScoped: false,
    publicAttackSurface: true,
    allowedInternalDependencies: ["core", "shared"],
    summary: "Public site and lead capture. Must not call tenant operations directly.",
  },
  hq: {
    module: "hq",
    primarySurface: "hq",
    ownedRoutePrefixes: ["/hq"],
    tenantScoped: false,
    publicAttackSurface: false,
    allowedInternalDependencies: ["core", "shared"],
    summary:
      "Cross-tenant control plane. Can manage tenant lifecycle but should use core policies.",
  },
  "restaurant-ops": {
    module: "restaurant-ops",
    primarySurface: "restaurant-ops",
    ownedRoutePrefixes: ["/restaurant", "/glidragiris", "/staff"],
    tenantScoped: true,
    publicAttackSurface: false,
    allowedInternalDependencies: ["core", "shared"],
    summary: "Manager workflows, tenant configuration, operational reporting.",
  },
  waiter: {
    module: "waiter",
    primarySurface: "waiter",
    ownedRoutePrefixes: ["/waiter"],
    tenantScoped: true,
    publicAttackSurface: false,
    allowedInternalDependencies: ["core", "shared", "restaurant-ops"],
    summary: "Waiter dashboard and table-side order lifecycle interactions.",
  },
  kitchen: {
    module: "kitchen",
    primarySurface: "kitchen",
    ownedRoutePrefixes: ["/kitchen"],
    tenantScoped: true,
    publicAttackSurface: false,
    allowedInternalDependencies: ["core", "shared", "restaurant-ops"],
    summary: "Kitchen queue execution, prep status, and fulfillment handoff.",
  },
  storefront: {
    module: "storefront",
    primarySurface: "storefront",
    ownedRoutePrefixes: ["/m", "/menu", "/payment", "/order-success"],
    tenantScoped: true,
    publicAttackSurface: true,
    allowedInternalDependencies: ["core", "shared"],
    summary: "Customer ordering plane. Strictly isolated from back-office actions.",
  },
  core: {
    module: "core",
    primarySurface: "unknown",
    ownedRoutePrefixes: [],
    tenantScoped: false,
    publicAttackSurface: false,
    allowedInternalDependencies: ["shared"],
    summary:
      "Cross-cutting server rules: auth, tenancy, permissions, entitlements, audit, billing.",
  },
  shared: {
    module: "shared",
    primarySurface: "unknown",
    ownedRoutePrefixes: [],
    tenantScoped: false,
    publicAttackSurface: false,
    allowedInternalDependencies: [],
    summary:
      "Truly reusable primitives only: UI kit, design tokens, types, pure helpers without domain logic.",
  },
};
