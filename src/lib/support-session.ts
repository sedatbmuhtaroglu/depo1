import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SupportSessionAssumedRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";

export const SUPPORT_SESSION_COOKIE_NAME = "support_session";

const COOKIE_MAX_AGE_CAP_SECONDS = 60 * 60; // 60 dk üst sınır (iş kuralı ile uyumlu)

export type SupportPanelContext = {
  sessionId: number;
  hqAdminUserId: number;
  hqAdminUsername: string;
  reason: string;
  note: string | null;
  expiresAt: Date;
  tenantName: string;
  tenantSlug: string;
  assumedRole: SupportSessionAssumedRole;
  durationMinutes: number;
};

type SupportCookiePayload = {
  sid: number;
  tok: string;
  tid: number;
  exp: number;
};

function getSupportSessionSecret() {
  const secret = process.env.SUPPORT_SESSION_SECRET?.trim();
  if (secret && secret.length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPPORT_SESSION_SECRET must be set in production.");
  }
  const fallback = process.env.ADMIN_SESSION_SECRET?.trim();
  if (fallback && fallback.length > 0) {
    return `${fallback}:support-fallback-dev-only`;
  }
  return "support-local-session-secret-change-me";
}

function signValue(value: string) {
  return createHmac("sha256", getSupportSessionSecret()).update(value).digest("hex");
}

function encodePayload(payload: SupportCookiePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(raw: string): SupportCookiePayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<SupportCookiePayload>;
    if (
      typeof parsed.sid !== "number" ||
      !Number.isInteger(parsed.sid) ||
      parsed.sid <= 0 ||
      typeof parsed.tok !== "string" ||
      parsed.tok.length < 32 ||
      typeof parsed.tid !== "number" ||
      !Number.isInteger(parsed.tid) ||
      parsed.tid <= 0 ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp)
    ) {
      return null;
    }
    return {
      sid: parsed.sid,
      tok: parsed.tok,
      tid: parsed.tid,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function hashSupportToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generateSupportSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function setSupportSessionCookie(params: {
  sessionId: number;
  token: string;
  tenantId: number;
  expiresAt: Date;
}) {
  const cookieStore = await cookies();
  const payload = encodePayload({
    sid: params.sessionId,
    tok: params.token,
    tid: params.tenantId,
    exp: params.expiresAt.getTime(),
  });
  const signature = signValue(payload);
  const maxAgeSeconds = Math.min(
    COOKIE_MAX_AGE_CAP_SECONDS,
    Math.max(1, Math.ceil((params.expiresAt.getTime() - Date.now()) / 1000)),
  );

  cookieStore.set(SUPPORT_SESSION_COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSupportSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SUPPORT_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function clearSupportSessionCookieBestEffort() {
  try {
    await clearSupportSessionCookie();
  } catch {
    // Server Component ortamında cookie silinemeyebilir; guard yine redirect ile fail-closed kalır.
  }
}

async function readVerifiedSupportPayload(): Promise<SupportCookiePayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SUPPORT_SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const splitIndex = raw.lastIndexOf(".");
  if (splitIndex <= 0) return null;

  const payloadRaw = raw.slice(0, splitIndex);
  const signature = raw.slice(splitIndex + 1);
  if (!signature) return null;

  const expectedSignature = signValue(payloadRaw);
  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const decoded = decodePayload(payloadRaw);
  if (!decoded) return null;

  if (decoded.exp <= Date.now()) {
    return null;
  }

  return decoded;
}

export async function tryResolveTenantFromSupportCookie(): Promise<{
  tenantId: number;
  slug?: string;
} | null> {
  const parsed = await readVerifiedSupportPayload();
  if (!parsed) return null;

  const row = await prisma.supportImpersonationSession.findUnique({
    where: { id: parsed.sid },
    select: {
      id: true,
      tokenHash: true,
      tenantId: true,
      expiresAt: true,
      revokedAt: true,
      endedAt: true,
    },
  });

  if (!row) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  if (row.tenantId !== parsed.tid) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  const tokenHash = hashSupportToken(parsed.tok);
  const a = Buffer.from(tokenHash, "hex");
  const b = Buffer.from(row.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  if (row.revokedAt != null || row.endedAt != null || row.expiresAt.getTime() <= Date.now()) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: row.tenantId },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  return { tenantId: tenant.id, slug: tenant.slug ?? undefined };
}

async function auditSupportEvent(params: {
  tenantId: number;
  hqAdminUserId: number;
  supportSessionId: number;
  assumedRole: SupportSessionAssumedRole;
  reason: string;
  durationMinutes: number;
  actionType: string;
  entityId?: string;
  description?: string | null;
}) {
  await writeAuditLog({
    tenantId: params.tenantId,
    actor: { type: "admin", id: String(params.hqAdminUserId) },
    actionType: params.actionType,
    entityType: "supportImpersonationSession",
    entityId: params.entityId ?? String(params.supportSessionId),
    description: params.description ?? null,
  });
}

export async function resolveActiveSupportSessionForTenant(
  tenantId: number,
): Promise<SupportPanelContext | null> {
  const parsed = await readVerifiedSupportPayload();
  if (!parsed) return null;

  if (parsed.tid !== tenantId) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  const row = await prisma.supportImpersonationSession.findUnique({
    where: { id: parsed.sid },
    include: {
      hqAdmin: { select: { id: true, username: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!row) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  if (row.tenantId !== tenantId) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  const tokenHash = hashSupportToken(parsed.tok);
  const a = Buffer.from(tokenHash, "hex");
  const b = Buffer.from(row.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await clearSupportSessionCookieBestEffort();
    return null;
  }

  const now = Date.now();
  if (row.revokedAt != null || row.endedAt != null) {
    await clearSupportSessionCookieBestEffort();
    await auditSupportEvent({
      tenantId: row.tenantId,
      hqAdminUserId: row.hqAdminUserId,
      supportSessionId: row.id,
      assumedRole: row.assumedRole,
      reason: row.reason,
      durationMinutes: row.durationMinutes,
      actionType: "support_session_revoked_or_expired",
      description: JSON.stringify({
        reason: "revoked_or_ended",
        timestamp: new Date().toISOString(),
      }),
    });
    return null;
  }

  if (row.expiresAt.getTime() <= now) {
    await prisma.supportImpersonationSession.update({
      where: { id: row.id },
      data: { endedAt: new Date(Date.now()) },
    });
    await clearSupportSessionCookieBestEffort();
    await auditSupportEvent({
      tenantId: row.tenantId,
      hqAdminUserId: row.hqAdminUserId,
      supportSessionId: row.id,
      assumedRole: row.assumedRole,
      reason: row.reason,
      durationMinutes: row.durationMinutes,
      actionType: "support_session_revoked_or_expired",
      description: JSON.stringify({
        reason: "expired",
        timestamp: new Date().toISOString(),
      }),
    });
    return null;
  }

  const firstTouch = row.lastUsedAt == null;
  const shouldUpdateLastUsed =
    firstTouch ||
    (row.lastUsedAt != null && now - row.lastUsedAt.getTime() > 60_000);

  if (shouldUpdateLastUsed) {
    await prisma.supportImpersonationSession.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date(now) },
    });
  }

  if (firstTouch) {
    await auditSupportEvent({
      tenantId: row.tenantId,
      hqAdminUserId: row.hqAdminUserId,
      supportSessionId: row.id,
      assumedRole: row.assumedRole,
      reason: row.reason,
      durationMinutes: row.durationMinutes,
      actionType: "support_session_entered",
      description: JSON.stringify({
        hqAdminUserId: row.hqAdminUserId,
        tenantId: row.tenantId,
        supportSessionId: row.id,
        assumedRole: row.assumedRole,
        reason: row.reason,
        duration: row.durationMinutes,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  return {
    sessionId: row.id,
    hqAdminUserId: row.hqAdminUserId,
    hqAdminUsername: row.hqAdmin.username,
    reason: row.reason,
    note: row.note,
    expiresAt: row.expiresAt,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    assumedRole: row.assumedRole,
    durationMinutes: row.durationMinutes,
  };
}

export async function endSupportSessionByCookie(params: {
  tenantId: number;
  outcome: "user_exit" | "admin_revoke";
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = await readVerifiedSupportPayload();
  if (!parsed) {
    return { ok: false, reason: "no_session" };
  }

  const row = await prisma.supportImpersonationSession.findUnique({
    where: { id: parsed.sid },
    include: { hqAdmin: { select: { id: true, username: true } } },
  });

  if (!row || row.tenantId !== params.tenantId) {
    await clearSupportSessionCookieBestEffort();
    return { ok: false, reason: "mismatch" };
  }

  const tokenHash = hashSupportToken(parsed.tok);
  const a = Buffer.from(tokenHash, "hex");
  const b = Buffer.from(row.tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await clearSupportSessionCookieBestEffort();
    return { ok: false, reason: "token" };
  }

  const endedAt = new Date();
  await prisma.supportImpersonationSession.update({
    where: { id: row.id },
    data: {
      endedAt,
      revokedAt: params.outcome === "admin_revoke" ? endedAt : row.revokedAt,
    },
  });

  await clearSupportSessionCookie();

  await auditSupportEvent({
    tenantId: row.tenantId,
    hqAdminUserId: row.hqAdminUserId,
    supportSessionId: row.id,
    assumedRole: row.assumedRole,
    reason: row.reason,
    durationMinutes: row.durationMinutes,
    actionType: "support_session_exited",
    description: JSON.stringify({
      hqAdminUserId: row.hqAdminUserId,
      tenantId: row.tenantId,
      supportSessionId: row.id,
      assumedRole: row.assumedRole,
      reason: row.reason,
      duration: row.durationMinutes,
      outcome: params.outcome,
      timestamp: endedAt.toISOString(),
    }),
  });

  return { ok: true };
}
