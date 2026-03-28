import type { NextRequest } from "next/server";

type ParsedHost = {
  hostname: string;
  port: number | null;
  normalized: string;
};

type OriginConfig = {
  isProduction: boolean;
  canonicalOrigin: string | null;
  allowedHosts: ParsedHost[];
  wildcardHostSuffixes: string[];
};

const DEFAULT_DEV_BASE_URL = "http://localhost:3000";
const DEV_LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0", "host.docker.internal"];

export type AppOriginSecurityErrorCode =
  | "APP_BASE_URL_REQUIRED"
  | "APP_BASE_URL_INVALID"
  | "ALLOWED_HOSTS_INVALID"
  | "REQUEST_HOST_INVALID"
  | "REQUEST_HOST_NOT_ALLOWED";

export class AppOriginSecurityError extends Error {
  readonly code: AppOriginSecurityErrorCode;

  constructor(code: AppOriginSecurityErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AppOriginSecurityError";
  }
}

function firstHeaderToken(value: string | null): string | null {
  if (!value) return null;
  const token = value
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return token ?? null;
}

function normalizeHostname(rawHostname: string): string | null {
  const normalized = rawHostname.trim().toLowerCase().replace(/\.+$/, "");
  if (!normalized) return null;
  return normalized;
}

function normalizePort(rawPort: string): number | null {
  if (!rawPort) return null;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  if (port === 80 || port === 443) return null;
  return port;
}

function parseHost(input: string): ParsedHost | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return null;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) return null;

  const port = normalizePort(parsed.port);
  if (parsed.port && port === null && parsed.port !== "80" && parsed.port !== "443") {
    return null;
  }

  const normalized = port === null ? hostname : `${hostname}:${port}`;
  return { hostname, port, normalized };
}

function parseCanonicalOrigin(rawValue: string, envName: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new AppOriginSecurityError("APP_BASE_URL_INVALID", `${envName} is empty.`);
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new AppOriginSecurityError("APP_BASE_URL_INVALID", `${envName} is not a valid URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppOriginSecurityError("APP_BASE_URL_INVALID", `${envName} must use http or https.`);
  }

  if (parsed.username || parsed.password) {
    throw new AppOriginSecurityError("APP_BASE_URL_INVALID", `${envName} must not include credentials.`);
  }

  if ((parsed.pathname && parsed.pathname !== "/") || parsed.search || parsed.hash) {
    throw new AppOriginSecurityError(
      "APP_BASE_URL_INVALID",
      `${envName} must include origin only (no path/query/hash).`,
    );
  }

  const host = parseHost(parsed.origin);
  if (!host) {
    throw new AppOriginSecurityError("APP_BASE_URL_INVALID", `${envName} host is invalid.`);
  }

  return `${parsed.protocol}//${host.normalized}`;
}

function parseAllowedHosts(
  rawValue: string | undefined,
  isProduction: boolean,
): { hosts: ParsedHost[]; wildcardHostSuffixes: string[]; invalidEntries: string[] } {
  if (!rawValue?.trim()) {
    return { hosts: [], wildcardHostSuffixes: [], invalidEntries: [] };
  }

  const hosts: ParsedHost[] = [];
  const wildcardHostSuffixes: string[] = [];
  const invalidEntries: string[] = [];

  for (const entry of rawValue.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("*.")) {
      const wildcardRaw = trimmed.slice(2);
      const wildcardParsed = parseHost(wildcardRaw);
      if (!wildcardParsed || wildcardParsed.port !== null) {
        invalidEntries.push(trimmed);
      } else {
        wildcardHostSuffixes.push(wildcardParsed.hostname);
      }
      continue;
    }

    const parsed = parseHost(trimmed);
    if (!parsed) {
      invalidEntries.push(trimmed);
      continue;
    }

    hosts.push(parsed);
  }

  if (isProduction && invalidEntries.length > 0) {
    throw new AppOriginSecurityError(
      "ALLOWED_HOSTS_INVALID",
      "ALLOWED_APP_HOSTS contains invalid host entries.",
    );
  }

  return { hosts, wildcardHostSuffixes, invalidEntries };
}

function dedupeHosts(hosts: ParsedHost[]): ParsedHost[] {
  const seen = new Set<string>();
  const deduped: ParsedHost[] = [];

  for (const host of hosts) {
    if (seen.has(host.normalized)) continue;
    seen.add(host.normalized);
    deduped.push(host);
  }

  return deduped;
}

function dedupeWildcardHostSuffixes(hosts: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const host of hosts) {
    if (seen.has(host)) continue;
    seen.add(host);
    deduped.push(host);
  }
  return deduped;
}

function resolveOriginConfig(): OriginConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const canonicalRaw = process.env.APP_BASE_URL;

  if (isProduction && !canonicalRaw?.trim()) {
    throw new AppOriginSecurityError(
      "APP_BASE_URL_REQUIRED",
      "APP_BASE_URL must be configured in production.",
    );
  }

  const canonicalOrigin = canonicalRaw?.trim()
    ? parseCanonicalOrigin(canonicalRaw, "APP_BASE_URL")
    : null;

  const { hosts: allowedFromEnv, wildcardHostSuffixes: wildcardFromEnv } = parseAllowedHosts(
    process.env.ALLOWED_APP_HOSTS,
    isProduction,
  );
  const combined: ParsedHost[] = [...allowedFromEnv];

  if (canonicalOrigin) {
    const canonicalHost = parseHost(canonicalOrigin);
    if (!canonicalHost) {
      throw new AppOriginSecurityError("APP_BASE_URL_INVALID", "APP_BASE_URL host is invalid.");
    }
    combined.push(canonicalHost);
  }

  if (!isProduction) {
    for (const host of DEV_LOCAL_HOSTS) {
      const parsed = parseHost(host);
      if (parsed) {
        combined.push(parsed);
      }
    }
  }

  const allowedHosts = dedupeHosts(combined);
  const wildcardHostSuffixes = dedupeWildcardHostSuffixes(wildcardFromEnv);

  if (isProduction && allowedHosts.length === 0 && wildcardHostSuffixes.length === 0) {
    throw new AppOriginSecurityError(
      "ALLOWED_HOSTS_INVALID",
      "Allowed host list is empty in production.",
    );
  }

  return {
    isProduction,
    canonicalOrigin,
    allowedHosts,
    wildcardHostSuffixes,
  };
}

function isHostAllowed(
  candidate: ParsedHost,
  allowedHosts: ParsedHost[],
  wildcardHostSuffixes: string[],
  isProduction: boolean,
): boolean {
  for (const allowed of allowedHosts) {
    if (allowed.hostname !== candidate.hostname) continue;
    if (allowed.port === null) return true;
    if (allowed.port === candidate.port) return true;
  }

  for (const suffix of wildcardHostSuffixes) {
    if (candidate.hostname.length <= suffix.length) continue;
    if (candidate.hostname.endsWith(`.${suffix}`)) {
      return true;
    }
  }

  if (!isProduction) {
    if (candidate.hostname.endsWith(".localhost")) {
      return true;
    }
  }

  return false;
}

function resolveRequestHost(headers: Headers): ParsedHost | null {
  const forwardedHost = firstHeaderToken(headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const parsedForwardedHost = parseHost(forwardedHost);
    if (!parsedForwardedHost) {
      throw new AppOriginSecurityError("REQUEST_HOST_INVALID", "x-forwarded-host header is invalid.");
    }
    return parsedForwardedHost;
  }

  const host = firstHeaderToken(headers.get("host"));
  if (host) {
    const parsedHost = parseHost(host);
    if (!parsedHost) {
      throw new AppOriginSecurityError("REQUEST_HOST_INVALID", "host header is invalid.");
    }
    return parsedHost;
  }

  return null;
}

function resolveRequestProtocol(headers: Headers, isProduction: boolean): "http" | "https" {
  const proto = firstHeaderToken(headers.get("x-forwarded-proto"))?.toLowerCase();
  if (proto === "http" || proto === "https") {
    return proto;
  }
  return isProduction ? "https" : "http";
}

export function resolveCanonicalAppOrigin(): string {
  const { canonicalOrigin, isProduction } = resolveOriginConfig();
  if (!canonicalOrigin) {
    if (isProduction) {
      throw new AppOriginSecurityError(
        "APP_BASE_URL_REQUIRED",
        "APP_BASE_URL must be configured in production.",
      );
    }

    const fallbackRaw =
      process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (fallbackRaw?.trim()) {
      return parseCanonicalOrigin(fallbackRaw, "development fallback base URL");
    }

    return DEFAULT_DEV_BASE_URL;
  }

  return canonicalOrigin;
}

export function getAllowedAppHosts(): string[] {
  const { allowedHosts, wildcardHostSuffixes } = resolveOriginConfig();
  return [
    ...allowedHosts.map((host) => host.normalized),
    ...wildcardHostSuffixes.map((suffix) => `*.${suffix}`),
  ];
}

export function assertRequestHostAllowed(headers: Headers): void {
  const { allowedHosts, wildcardHostSuffixes, isProduction } = resolveOriginConfig();
  const requestHost = resolveRequestHost(headers);
  if (!requestHost) return;

  if (!isHostAllowed(requestHost, allowedHosts, wildcardHostSuffixes, isProduction)) {
    throw new AppOriginSecurityError("REQUEST_HOST_NOT_ALLOWED", "Request host is not allowed.");
  }
}

export function resolveSafeAppBaseUrl(params?: {
  headers?: Headers;
  request?: Pick<NextRequest, "headers">;
}): string {
  const config = resolveOriginConfig();
  const requestHeaders = params?.headers ?? params?.request?.headers;
  let requestHost: ParsedHost | null = null;

  if (requestHeaders) {
    requestHost = resolveRequestHost(requestHeaders);
    if (
      requestHost &&
      !isHostAllowed(
        requestHost,
        config.allowedHosts,
        config.wildcardHostSuffixes,
        config.isProduction,
      )
    ) {
      throw new AppOriginSecurityError("REQUEST_HOST_NOT_ALLOWED", "Request host is not allowed.");
    }
  }

  if (config.canonicalOrigin) {
    return config.canonicalOrigin;
  }

  if (config.isProduction) {
    throw new AppOriginSecurityError(
      "APP_BASE_URL_REQUIRED",
      "APP_BASE_URL must be configured in production.",
    );
  }

  if (requestHeaders && requestHost) {
    const protocol = resolveRequestProtocol(requestHeaders, false);
    return `${protocol}://${requestHost.normalized}`;
  }

  return resolveCanonicalAppOrigin();
}

export function buildSafeAppUrl(
  pathname: string,
  params?: {
    headers?: Headers;
    request?: Pick<NextRequest, "headers">;
  },
): string {
  const baseUrl = resolveSafeAppBaseUrl(params);
  return new URL(pathname, baseUrl).toString();
}
