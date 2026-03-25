import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicAttackSurface,
  isTenantAwareSurface,
  resolveAppSurface,
} from "@/core/routing/app-surface";
import { mapAppSurfaceToSecuritySurface } from "@/core/surfaces/surface-map";
import { resolveTenantSlugFromRequest } from "@/lib/tenancy/resolve";

async function resolveRedirectResponse(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const surface = resolveAppSurface(request.nextUrl.pathname);
  if (surface !== "marketing") return null;

  const searchPath = request.nextUrl.pathname;
  if (!searchPath) return null;
  if (searchPath.startsWith("/uploads/")) return null;
  const lastSegment = searchPath.split("/").pop() ?? "";
  if (lastSegment.includes(".")) return null;

  const endpoint = new URL("/api/internal/redirects/resolve", request.url);
  endpoint.searchParams.set("path", searchPath);

  try {
    const resolved = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-redirect-resolver": "1",
      },
      cache: "no-store",
    });

    if (!resolved.ok) return null;
    const body = (await resolved.json()) as {
      matched?: boolean;
      toPath?: string;
      statusCode?: number;
    };

    if (!body.matched || !body.toPath) return null;

    const target = body.toPath.trim();
    if (!target) return null;
    if (target === request.nextUrl.pathname) return null;

    const targetUrl = new URL(target, request.url);
    if (request.nextUrl.search && !targetUrl.search) {
      targetUrl.search = request.nextUrl.search;
    }

    const statusCode = body.statusCode === 302 ? 302 : 301;
    return NextResponse.redirect(targetUrl, statusCode);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const redirectResponse = await resolveRedirectResponse(request);
  if (redirectResponse) {
    return redirectResponse;
  }

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
  requestHeaders.set("x-request-pathname", request.nextUrl.pathname);

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
