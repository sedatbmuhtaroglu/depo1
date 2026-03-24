import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicAttackSurface,
  isTenantAwareSurface,
  resolveAppSurface,
} from "@/core/routing/app-surface";
import { mapAppSurfaceToSecuritySurface } from "@/core/surfaces/surface-map";
import { resolveTenantSlugFromRequest } from "@/lib/tenancy/resolve";

export function middleware(request: NextRequest) {
  const surface = resolveAppSurface(request.nextUrl.pathname);
  const securitySurface = mapAppSurfaceToSecuritySurface(surface);
  const slug = resolveTenantSlugFromRequest(request);

  const requestHeaders = new Headers(request.headers);
  if (slug && isTenantAwareSurface(surface)) {
    requestHeaders.set("x-tenant-slug", slug);
  } else {
    requestHeaders.delete("x-tenant-slug");
  }
  requestHeaders.set("x-app-surface", surface);
  requestHeaders.set("x-security-surface", securitySurface);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(self)");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  response.headers.set("X-App-Surface", surface);
  response.headers.set("X-Security-Surface", securitySurface);
  response.headers.set(
    "X-Isolation-Surface-Type",
    isPublicAttackSurface(surface) ? "public-edge" : "tenant-app",
  );

  return response;
}

export const config = {
  matcher: ["/((?!admin|api|_next/static|_next/image|favicon.ico).*)"],
};
