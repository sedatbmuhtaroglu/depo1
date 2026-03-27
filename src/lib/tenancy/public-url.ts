import { prisma } from "@/lib/prisma";
import { resolveSafeAppBaseUrl } from "@/lib/security/allowed-origins";

type HeaderLike = Pick<Headers, "get">;

function firstHeaderToken(value: string | null): string | null {
  if (!value) return null;
  const token = value
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return token ?? null;
}

function normalizeHost(raw: string | null): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase();
  if (!host) return null;
  return host;
}

function parseHostAndPort(rawHost: string | null): { hostname: string; port: string } | null {
  const normalized = normalizeHost(rawHost);
  if (!normalized) return null;
  const lastColonIndex = normalized.lastIndexOf(":");
  if (lastColonIndex <= 0) {
    return { hostname: normalized, port: "" };
  }
  const hostname = normalized.slice(0, lastColonIndex);
  const portCandidate = normalized.slice(lastColonIndex + 1);
  if (/^\d+$/.test(portCandidate)) {
    return { hostname, port: `:${portCandidate}` };
  }
  return { hostname: normalized, port: "" };
}

function resolvePreferredTenantDomain(
  domains: Array<{ domain: string; isPrimary: boolean; isVerified: boolean }>,
): string | null {
  const primaryVerified = domains.find((row) => row.isPrimary && row.isVerified)?.domain ?? null;
  if (primaryVerified) return primaryVerified;
  const primary = domains.find((row) => row.isPrimary)?.domain ?? null;
  if (primary) return primary;
  return domains.find((row) => row.isVerified)?.domain ?? null;
}

function resolveBaseDomainCandidates(requestHost: string | null): string[] {
  const values = new Set<string>();
  const envBaseDomain = normalizeHost(process.env.APP_BASE_DOMAIN ?? null);
  if (envBaseDomain) values.add(envBaseDomain);

  if (requestHost === "localhost" || requestHost?.endsWith(".localhost")) {
    values.add("localhost");
  }

  return Array.from(values);
}

export async function resolveTenantPublicOrigin(params: {
  tenantId: number;
  headers?: HeaderLike;
}): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      slug: true,
      domains: {
        select: { domain: true, isPrimary: true, isVerified: true },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
  });

  if (!tenant) {
    return resolveSafeAppBaseUrl(params.headers ? { headers: params.headers as Headers } : undefined);
  }

  const safeBase = resolveSafeAppBaseUrl(
    params.headers ? { headers: params.headers as Headers } : undefined,
  );
  const safeBaseUrl = new URL(safeBase);

  const requestHostRaw = params.headers
    ? firstHeaderToken(params.headers.get("host")) ??
      firstHeaderToken(params.headers.get("x-forwarded-host"))
    : null;
  const requestHost = parseHostAndPort(requestHostRaw);

  const preferredDomain = resolvePreferredTenantDomain(tenant.domains);
  if (preferredDomain) {
    const protocol = process.env.NODE_ENV === "production" ? "https" : safeBaseUrl.protocol.replace(":", "");
    return `${protocol}://${preferredDomain}`;
  }

  const baseDomainCandidates = resolveBaseDomainCandidates(requestHost?.hostname ?? null);
  const chosenBaseDomain = baseDomainCandidates[0] ?? null;
  const chosenBaseParsed = parseHostAndPort(chosenBaseDomain);
  const chosenBaseHostname = chosenBaseParsed?.hostname ?? chosenBaseDomain;
  const chosenBaseHasPort = Boolean(chosenBaseParsed?.port);

  if (tenant.slug && chosenBaseDomain) {
    const portPart =
      chosenBaseHasPort
        ? ""
        : chosenBaseHostname === "localhost"
        ? requestHost?.port ||
          (safeBaseUrl.hostname === "localhost" && safeBaseUrl.port
            ? `:${safeBaseUrl.port}`
            : "")
        : "";
    const protocol =
      chosenBaseHostname === "localhost"
        ? requestHost?.hostname === "localhost" || requestHost?.hostname?.endsWith(".localhost")
          ? safeBaseUrl.protocol.replace(":", "")
          : process.env.NODE_ENV === "production"
            ? "https"
            : "http"
        : process.env.NODE_ENV === "production"
          ? "https"
          : safeBaseUrl.protocol.replace(":", "");
    return `${protocol}://${tenant.slug}.${chosenBaseDomain}${portPart}`;
  }

  return safeBase;
}

export async function buildTenantPublicUrl(params: {
  tenantId: number;
  pathname: string;
  headers?: HeaderLike;
}): Promise<string> {
  const origin = await resolveTenantPublicOrigin({
    tenantId: params.tenantId,
    headers: params.headers,
  });
  return new URL(params.pathname, origin).toString();
}
