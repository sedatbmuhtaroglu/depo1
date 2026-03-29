import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicAttackSurface,
  isTenantAwareSurface,
  resolveAppSurface,
} from "@/core/routing/app-surface";
import { mapAppSurfaceToSecuritySurface } from "@/core/surfaces/surface-map";
import { resolveTenantSlugFromRequest } from "@/lib/tenancy/resolve";

function normalizeHost(rawHost: string | null): string {
  const firstToken = rawHost?.split(",")[0]?.trim().toLowerCase() ?? "";
  return firstToken.replace(/:\d+$/, "");
}

function buildContentSecurityPolicy(): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com/recaptcha/",
  ];
  if (process.env.NODE_ENV !== "production") {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    [
      "connect-src",
      "'self'",
      "https://www.google.com/recaptcha/",
      "https://www.gstatic.com/recaptcha/",
      "https://api.iyzipay.com",
      "https://sandbox-api.iyzipay.com",
    ].join(" "),
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "frame-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "form-action 'self' https://sandbox-merchant.iyzipay.com https://merchant.iyzipay.com https://www.google.com",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

function debugTenancy(event: string, payload: Record<string, unknown>) {
  const debugEnabled =
    process.env.NODE_ENV !== "production" || process.env.TENANCY_DEBUG === "1";
  if (!debugEnabled) return;
  const serialized = JSON.stringify(payload);
  console.info(`[tenancy-debug] middleware:${event} ${serialized}`);
}

function isPathAllowedDuringMaintenance(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => {
    if (prefix === "/") return pathname === "/";
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

async function resolveMaintenancePolicy(request: NextRequest): Promise<{
  active: boolean;
  allowedPathPrefixes: string[];
}> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return { active: false, allowedPathPrefixes: [] };
  }

  const endpoint = new URL("/api/internal/maintenance/active", request.url);
  try {
    const resolved = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-maintenance-resolver": "1",
      },
      cache: "no-store",
    });
    if (!resolved.ok) return { active: false, allowedPathPrefixes: [] };

    const body = (await resolved.json()) as {
      active?: boolean;
      allowedPathPrefixes?: unknown;
    };
    const allowedPathPrefixes = Array.isArray(body.allowedPathPrefixes)
      ? body.allowedPathPrefixes.filter((value): value is string => typeof value === "string")
      : [];
    return {
      active: body.active === true,
      allowedPathPrefixes,
    };
  } catch {
    return { active: false, allowedPathPrefixes: [] };
  }
}

function resolveTenantRootMenuRedirect(request: NextRequest): NextResponse | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.nextUrl.pathname !== "/") return null;

  const slug = resolveTenantSlugFromRequest(request);
  if (!slug) return null;

  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  if (!host || host === "localhost") return null;

  const target = request.nextUrl.clone();
  target.pathname = "/menu";
  return NextResponse.redirect(target, 307);
}

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
  if (
    process.env.NODE_ENV !== "production" &&
    (request.nextUrl.pathname === "/menu" || request.nextUrl.pathname === "/")
  ) {
    debugTenancy("incoming", {
      pathname: request.nextUrl.pathname,
      nextUrlHost: request.nextUrl.host,
      host: normalizeHost(request.headers.get("host")),
      forwardedHost: normalizeHost(request.headers.get("x-forwarded-host")),
      derivedSlug: resolveTenantSlugFromRequest(request),
    });
  }

  const tenantRootRedirect = resolveTenantRootMenuRedirect(request);
  if (tenantRootRedirect) {
    if (process.env.NODE_ENV !== "production") {
      debugTenancy("root-redirect", {
        pathname: request.nextUrl.pathname,
        target: "/menu",
        derivedSlug: resolveTenantSlugFromRequest(request),
      });
    }
    return tenantRootRedirect;
  }

  const redirectResponse = await resolveRedirectResponse(request);
  if (redirectResponse) {
    return redirectResponse;
  }

  const maintenancePolicy = await resolveMaintenancePolicy(request);
  const isMaintenancePath =
    request.nextUrl.pathname === "/maintenance" ||
    request.nextUrl.pathname.startsWith("/maintenance/");
  if (maintenancePolicy.active && !isMaintenancePath) {
    const isAllowedPath = isPathAllowedDuringMaintenance(
      request.nextUrl.pathname,
      maintenancePolicy.allowedPathPrefixes,
    );
    if (!isAllowedPath) {
      const target = request.nextUrl.clone();
      target.pathname = "/maintenance";
      target.search = "";
      return NextResponse.redirect(target, 307);
    }
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
  if (
    process.env.NODE_ENV !== "production" &&
    (request.nextUrl.pathname === "/menu" || request.nextUrl.pathname === "/")
  ) {
    debugTenancy("headers-set", {
      pathname: request.nextUrl.pathname,
      surface,
      derivedSlug: slug,
      xTenantSlugSet: slug && isTenantAwareSurface(surface) ? slug : null,
    });
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
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());

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
  matcher: ["/((?!admin|api|_next|favicon.ico).*)"],
};
