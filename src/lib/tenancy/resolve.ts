import type { NextRequest } from "next/server";

function normalizeTenantSlug(raw: string | null): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return null;
  return slug;
}

function normalizeHost(rawHost: string | null): string | null {
  if (!rawHost) return null;
  const firstToken = rawHost.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!firstToken) return null;
  return firstToken;
}

function stripPort(host: string | null): string | null {
  if (!host) return null;
  return host.replace(/:\d+$/, "");
}

function collectCandidateHosts(request: NextRequest): string[] {
  const candidates = new Set<string>();
  const directHost = normalizeHost(request.headers.get("host"));
  if (directHost) candidates.add(directHost);
  const headerHost = normalizeHost(request.headers.get("x-forwarded-host"));
  if (headerHost) candidates.add(headerHost);
  const nextHost = normalizeHost(request.nextUrl.host);
  if (nextHost) candidates.add(nextHost);
  const nextHostname = normalizeHost(request.nextUrl.hostname);
  if (nextHostname) candidates.add(nextHostname);
  return Array.from(candidates);
}

function resolveBaseDomainCandidates(resolvedHost: string | null): string[] {
  const candidates = new Set<string>();
  const envBaseDomain = normalizeHost(process.env.APP_BASE_DOMAIN ?? null);
  if (envBaseDomain) {
    candidates.add(envBaseDomain);
  }
  const hostnameOnly = stripPort(resolvedHost);
  if (hostnameOnly === "localhost" || hostnameOnly?.endsWith(".localhost")) {
    candidates.add("localhost");
  }
  if (process.env.NODE_ENV === "production" && candidates.size === 0) {
    candidates.add("catalapp.com");
  }
  return Array.from(candidates);
}

export function resolveTenantSlugFromHostname(rawHost: string | null): string | null {
  const resolvedHost = normalizeHost(rawHost);
  if (!resolvedHost) return null;
  const baseDomains = resolveBaseDomainCandidates(resolvedHost);
  for (const baseDomain of baseDomains) {
    if (!baseDomain || resolvedHost === baseDomain) continue;
    if (!resolvedHost.endsWith(`.${baseDomain}`)) continue;
    const subdomainPart = resolvedHost.slice(0, -(`.${baseDomain}`.length));
    const nearestLabel = subdomainPart.split(".").pop() ?? null;
    const hostSlug = normalizeTenantSlug(nearestLabel);
    if (hostSlug) return hostSlug;
  }
  return null;
}

export function resolveTenantSlugFromRequest(request: NextRequest): string | null {
  const url = request.nextUrl;
  const pathname = url.pathname;
  const candidateHosts = collectCandidateHosts(request);

  for (const resolvedHost of candidateHosts) {
    const hostSlug = resolveTenantSlugFromHostname(resolvedHost);
    if (hostSlug) {
      return hostSlug;
    }
  }

  // Lokal geliştirme: her path'te ?tenant=slug.
  if (process.env.NODE_ENV !== "production") {
    const queryTenant = normalizeTenantSlug(url.searchParams.get("tenant"));
    if (queryTenant) {
      return queryTenant;
    }
  } else {
    // Production: ?tenant= giriş/şifre akışlarında ve personel panellerinde (destek oturumu yönlendirmesi dahil).
    const allowQueryTenant =
      pathname === "/glidragiris" ||
      pathname.startsWith("/staff/") ||
      pathname.startsWith("/restaurant") ||
      pathname.startsWith("/waiter") ||
      pathname.startsWith("/kitchen");
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
