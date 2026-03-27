import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { GlobalMaintenanceScreen } from "@/components/global-maintenance-screen";
import { getActivePlannedMaintenance } from "@/modules/content/server/content-queries";
import {
  getCurrentTenantOrThrow,
  runWithTenantContext,
} from "@/lib/tenancy/context";
import { resolveTenantSlugFromHostname } from "@/lib/tenancy/resolve";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-request-pathname") ?? "/menu";
  const hostRaw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const hostWithPort = hostRaw.split(",")[0]?.trim().toLowerCase() ?? "";
  const host = hostWithPort.replace(/:\d+$/, "");
  const headerSlug = h.get("x-tenant-slug");

  const maintenance = await getActivePlannedMaintenance();
  if (maintenance) {
    const isAllowedPath = maintenance.allowedPathPrefixes.some((prefix) => {
      if (prefix === "/") return pathname === "/";
      return pathname === prefix || pathname.startsWith(`${prefix}/`);
    });
    if (!isAllowedPath) {
      return (
        <GlobalMaintenanceScreen
          startsAt={maintenance.startsAt}
          endsAt={maintenance.endsAt}
          message={maintenance.message}
        />
      );
    }
  }

  const isPlainLocalhostMenu =
    pathname.startsWith("/menu") && host === "localhost" && !headerSlug;
  if (isPlainLocalhostMenu) {
    return <>{children}</>;
  }

  // Local fallback: if middleware request headers are missing, derive slug from host.
  if (!headerSlug && !pathname) {
    const derivedSlug =
      resolveTenantSlugFromHostname(hostWithPort) ?? resolveTenantSlugFromHostname(host);
    if (derivedSlug) {
      const tenantFromHost = await prisma.tenant.findUnique({
        where: { slug: derivedSlug },
        select: { id: true, slug: true },
      });
      if (tenantFromHost) {
        return runWithTenantContext(
          { tenantId: tenantFromHost.id, slug: tenantFromHost.slug ?? undefined },
          () => <>{children}</>,
        );
      }
    }
  }

  const { tenantId, slug } = await getCurrentTenantOrThrow();

  const restaurant = await prisma.restaurant.findFirst({
    where: { tenantId },
  });

  // Not: rendering hatalarını try/catch ile yakalamak yerine,
  // Next.js error boundary mekanizması kullanılmalıdır.
  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Tenant için restoran bulunamadı.
      </div>
    );
  }

  return runWithTenantContext({ tenantId, slug }, () => <>{children}</>);
}
