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

export async function getCurrentTenantOrThrow(): Promise<TenantContext> {
  const ctx = getTenantContext();
  if (ctx) {
    return ctx;
  }

  const h = await headers();
  const headerSlug = h.get("x-tenant-slug");

  // Validate slug format: allow only alphanumeric, hyphens, and underscores
  const slugPattern = /^[a-zA-Z0-9_-]+$/;
  if (headerSlug && !slugPattern.test(headerSlug)) {
    throw new TenantResolutionError("INVALID_TENANT_SLUG");
  }

  const effectiveSlug = headerSlug;

  if (effectiveSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: effectiveSlug },
    });

    if (!tenant) {
      throw new TenantResolutionError("TENANT_NOT_FOUND");
    }

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
    return {
      tenantId: sessionTenant.id,
      slug: sessionTenant.slug ?? undefined,
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
