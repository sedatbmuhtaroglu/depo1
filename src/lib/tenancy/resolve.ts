import type { NextRequest } from "next/server";

function normalizeTenantSlug(raw: string | null): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return null;
  return slug;
}

export function resolveTenantSlugFromRequest(request: NextRequest): string | null {
  const url = request.nextUrl;
  const pathname = url.pathname;

  // Lokal geliştirme: her path'te ?tenant=slug.
  if (process.env.NODE_ENV !== "production") {
    const queryTenant = normalizeTenantSlug(url.searchParams.get("tenant"));
    if (queryTenant) {
      return queryTenant;
    }
  } else {
    // Production: ?tenant= yalnızca giriş / şifre akışında (path bazlı); staff login için slug bağlamı.
    const allowQueryTenant =
      pathname === "/glidragiris" || pathname.startsWith("/staff/");
    if (allowQueryTenant) {
      const queryTenant = normalizeTenantSlug(url.searchParams.get("tenant"));
      if (queryTenant) {
        return queryTenant;
      }
    }
  }

  // /menu/[tenantSlug]/... pattern'inden slug çıkarma.
  if (pathname.startsWith("/menu/")) {
    const slugSegment = pathname.split("/")[2] ?? null;
    return normalizeTenantSlug(slugSegment);
  }

  return null;
}
