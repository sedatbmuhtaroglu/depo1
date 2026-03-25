import { prisma } from "@/lib/prisma";

export type RedirectStatusCode = 301 | 302;

export function normalizeRedirectFromPath(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  try {
    const asUrl = new URL(raw);
    const normalizedPath = asUrl.pathname.trim();
    return normalizeRedirectFromPath(normalizedPath);
  } catch {
    // no-op, value is expected to be a relative path
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutHash = path.split("#", 1)[0] ?? path;
  const withoutQuery = withoutHash.split("?", 1)[0] ?? withoutHash;

  if (!withoutQuery.startsWith("/")) return null;
  const compact = withoutQuery.replace(/\/+/g, "/").trim();
  if (!compact) return null;
  if (compact === "/") return "/";

  const trimmed = compact.endsWith("/") ? compact.slice(0, -1) : compact;
  if (!trimmed.startsWith("/")) return null;
  return trimmed || "/";
}

export function normalizeRedirectToPath(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return normalizeRedirectFromPath(raw);
  }
}

export function parseRedirectStatusCode(value: string | null | undefined): RedirectStatusCode {
  return value?.toString().trim() === "302" ? 302 : 301;
}

export function isInternalRedirectPath(value: string): boolean {
  return value.startsWith("/");
}

export async function resolveActiveRedirectRule(pathname: string) {
  const normalized = normalizeRedirectFromPath(pathname);
  if (!normalized) return null;

  const rule = await prisma.redirectRule.findFirst({
    where: {
      fromPath: normalized,
      isActive: true,
    },
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      statusCode: true,
      updatedAt: true,
    },
  });

  if (!rule) return null;

  return {
    id: rule.id,
    fromPath: rule.fromPath,
    toPath: rule.toPath,
    statusCode: rule.statusCode === 302 ? 302 : 301,
    updatedAt: rule.updatedAt,
  };
}

export async function hasRedirectChainRisk(fromPath: string, toPath: string, ignoreId?: number): Promise<boolean> {
  if (!isInternalRedirectPath(toPath)) return false;

  const nextRule = await prisma.redirectRule.findFirst({
    where: {
      fromPath: toPath,
      isActive: true,
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: {
      id: true,
      toPath: true,
    },
  });

  if (!nextRule) return false;
  if (!isInternalRedirectPath(nextRule.toPath)) return false;

  const loop = normalizeRedirectFromPath(nextRule.toPath) === normalizeRedirectFromPath(fromPath);
  if (loop) return true;

  return true;
}
