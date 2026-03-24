export const APP_SURFACES = [
  "marketing",
  "hq",
  "restaurant-ops",
  "waiter",
  "kitchen",
  "storefront",
  "unknown",
] as const;

export type AppSurface = (typeof APP_SURFACES)[number];

const ROUTE_PREFIXES: Record<AppSurface, string[]> = {
  marketing: ["/", "/pricing", "/contact", "/about"],
  hq: ["/hq"],
  "restaurant-ops": ["/restaurant", "/glidragiris", "/staff", "/admin"],
  waiter: ["/waiter"],
  kitchen: ["/kitchen"],
  storefront: ["/m", "/menu", "/payment", "/order-success"],
  unknown: [],
};

const TENANT_AWARE_SURFACES = new Set<AppSurface>([
  "restaurant-ops",
  "waiter",
  "kitchen",
  "storefront",
  "hq",
]);

const PUBLIC_ATTACK_SURFACES = new Set<AppSurface>(["marketing", "storefront"]);

function normalizePath(pathname: string): string {
  if (!pathname.startsWith("/")) return `/${pathname}`;
  return pathname;
}

function matchesPrefix(pathname: string, prefix: string) {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveAppSurface(pathname: string): AppSurface {
  const normalized = normalizePath(pathname);
  if (/^\/\d+$/.test(normalized)) {
    return "storefront";
  }

  const orderedSurfaces: AppSurface[] = [
    "hq",
    "restaurant-ops",
    "waiter",
    "kitchen",
    "storefront",
    "marketing",
  ];

  for (const surface of orderedSurfaces) {
    if (ROUTE_PREFIXES[surface].some((prefix) => matchesPrefix(normalized, prefix))) {
      return surface;
    }
  }

  return "unknown";
}

export function isTenantAwareSurface(surface: AppSurface): boolean {
  return TENANT_AWARE_SURFACES.has(surface);
}

export function isPublicAttackSurface(surface: AppSurface): boolean {
  return PUBLIC_ATTACK_SURFACES.has(surface);
}
