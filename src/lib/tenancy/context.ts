import { AsyncLocalStorage } from "async_hooks";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { ensurePrismaConnectionInDev, prisma } from "@/lib/prisma";
import { TenantResolutionError } from "@/lib/tenancy/tenant-resolution-error";

export type TenantContext = {
  tenantId: number;
  slug?: string;
};

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

export function runWithTenantContext<T>(
  context: TenantContext,
  fn: () => T,
): T {
  return tenantStorage.run(context, fn);
}

function normalizeHostFromHeaders(h: Headers): string {
  const hostRaw = h.get("host") ?? h.get("x-forwarded-host") ?? "";
  const firstToken = hostRaw.split(",")[0]?.trim().toLowerCase() ?? "";
  return firstToken.replace(/:\d+$/, "");
}

function debugTenancy(event: string, payload: Record<string, unknown>) {
  const debugEnabled =
    process.env.NODE_ENV !== "production" || process.env.TENANCY_DEBUG === "1";
  if (!debugEnabled) return;
  const serialized = JSON.stringify(payload);
  console.info(`[tenancy-debug] ${event} ${serialized}`);
}

export async function getCurrentTenantOrThrow(): Promise<TenantContext> {
  const ctx = getTenantContext();
  if (ctx) {
    return ctx;
  }

  const h = await headers();
  const headerSlug = h.get("x-tenant-slug");
  const appSurface = h.get("x-app-surface");
  const requestPathname = h.get("x-request-pathname") ?? "";
  const requestHost = normalizeHostFromHeaders(h);

  // Validate slug format: allow only alphanumeric, hyphens, and underscores
  const slugPattern = /^[a-zA-Z0-9_-]+$/;
  if (headerSlug && !slugPattern.test(headerSlug)) {
    throw new TenantResolutionError("INVALID_TENANT_SLUG");
  }

  const effectiveSlug = headerSlug;
  const isStorefrontMenuPath =
    requestPathname === "/menu" || requestPathname.startsWith("/menu/");

  debugTenancy("request-context", {
    host: requestHost,
    appSurface,
    pathname: requestPathname,
    headerSlug: effectiveSlug,
  });

  if (!effectiveSlug && isStorefrontMenuPath) {
    debugTenancy("fail-closed-missing-slug", {
      host: requestHost,
      pathname: requestPathname,
      fallbackUsed: false,
    });
    throw new TenantResolutionError("TENANT_NOT_FOUND");
  }

  if (!effectiveSlug && requestHost.endsWith(".localhost")) {
    debugTenancy("fail-closed-subdomain-missing-slug", {
      host: requestHost,
      pathname: requestPathname,
      fallbackUsed: false,
    });
    throw new TenantResolutionError("TENANT_NOT_FOUND");
  }

  if (effectiveSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: effectiveSlug },
    });

    if (!tenant) {
      debugTenancy("slug-not-found", {
        host: requestHost,
        derivedSlug: effectiveSlug,
        resolvedTenant: null,
        fallbackUsed: false,
      });
      throw new TenantResolutionError("TENANT_NOT_FOUND");
    }

    debugTenancy("slug-resolved", {
      host: requestHost,
      derivedSlug: effectiveSlug,
      resolvedTenantId: tenant.id,
      resolvedTenantSlug: tenant.slug,
      fallbackUsed: false,
    });

    return {
      tenantId: tenant.id,
      slug: effectiveSlug,
    };
  }

  // Staff surfaces (/restaurant, /waiter, /kitchen) are often slug-less.
  // Resolve tenant from signed session before any development fallback.
  const { getAuthenticatedAdminSession } = await import("@/lib/auth");
  const session = await getAuthenticatedAdminSession();
  if (
    session?.tenantId != null &&
    Number.isInteger(session.tenantId) &&
    session.tenantId > 0
  ) {
    const sessionTenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, slug: true },
    });
    if (!sessionTenant) {
      throw new TenantResolutionError("TENANT_NOT_FOUND");
    }
    debugTenancy("session-resolved", {
      host: requestHost,
      derivedSlug: null,
      resolvedTenantId: sessionTenant.id,
      resolvedTenantSlug: sessionTenant.slug ?? null,
      fallbackUsed: false,
    });
    return {
      tenantId: sessionTenant.id,
      slug: sessionTenant.slug ?? undefined,
    };
  }

  const { tryResolveTenantFromSupportCookie } = await import("@/lib/support-session");
  const supportTenant = await tryResolveTenantFromSupportCookie();
  if (supportTenant) {
    debugTenancy("support-session-resolved", {
      host: requestHost,
      derivedSlug: null,
      resolvedTenantId: supportTenant.tenantId,
      resolvedTenantSlug: supportTenant.slug,
      fallbackUsed: false,
    });
    return {
      tenantId: supportTenant.tenantId,
      slug: supportTenant.slug,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    await ensurePrismaConnectionInDev();

    try {
      const fallbackTenant = await prisma.tenant.findFirst();

      if (!fallbackTenant) {
        throw new TenantResolutionError("TENANT_NOT_FOUND");
      }

      return {
        tenantId: fallbackTenant.id,
        slug: fallbackTenant.slug,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientInitializationError) {
        throw new Error(
          "Tenant context could not be resolved in development because database connection failed. Start Postgres or set x-tenant-slug.",
          { cause: error },
        );
      }

      throw error;
    }
  }

  if (!session?.username || session.tenantId == null) {
    throw new TenantResolutionError("AUTH_REQUIRED");
  }
  throw new TenantResolutionError("TENANT_NOT_FOUND");
}
