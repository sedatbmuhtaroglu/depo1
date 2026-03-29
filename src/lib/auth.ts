import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma, type StaffRole } from "@prisma/client";
import type { Capability } from "@/core/authz/capabilities";
import {
  createHqAdminActor,
  createHqSupportActor,
  createStaffActor,
} from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { prisma } from "@/lib/prisma";
import { evaluateStaffAvailability } from "@/lib/staff-availability";
import {
  isCashCollectionRole,
  resolveRestaurantHomePath,
} from "@/lib/restaurant-panel-access";
import { resolveStaffPostLoginTarget } from "@/lib/staff-post-login-redirect";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";
import type { SupportPanelContext } from "@/lib/support-session";
import { resolveActiveSupportSessionForTenant } from "@/lib/support-session";

const AUTH_COOKIE_NAME = "glidra_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AdminSessionPayload = {
  username: string;
  tenantId: number | null;
  issuedAt: number;
  jti: string;
  sessionVersion: number;
};

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET must be set in production.");
  }
  return "glidra-local-session-secret-change-me";
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function encodePayload(payload: AdminSessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(rawPayload: string): AdminSessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(rawPayload, "base64url").toString("utf8"),
    ) as Partial<AdminSessionPayload>;

    if (
      typeof parsed.username !== "string" ||
      parsed.username.trim() === "" ||
      typeof parsed.issuedAt !== "number" ||
      !Number.isFinite(parsed.issuedAt) ||
      typeof parsed.jti !== "string" ||
      parsed.jti.trim().length < 16 ||
      typeof parsed.sessionVersion !== "number" ||
      !Number.isInteger(parsed.sessionVersion) ||
      parsed.sessionVersion < 1 ||
      (parsed.tenantId !== null &&
        parsed.tenantId !== undefined &&
        (!Number.isInteger(parsed.tenantId) || parsed.tenantId <= 0))
    ) {
      return null;
    }

    return {
      username: parsed.username,
      tenantId:
        parsed.tenantId == null
          ? null
          : Number(parsed.tenantId),
      issuedAt: parsed.issuedAt,
      jti: parsed.jti,
      sessionVersion: parsed.sessionVersion,
    };
  } catch {
    return null;
  }
}

function decodeLegacyPayload(rawPayload: string): AdminSessionPayload | null {
  const parts = rawPayload.split(".");
  if (parts.length < 2) return null;

  const timestampRaw = parts.at(-1);
  const username = parts.slice(0, -1).join(".");
  const issuedAt = Number(timestampRaw);

  if (!username || !Number.isFinite(issuedAt)) {
    return null;
  }

  return {
    username,
    tenantId: null,
    issuedAt,
    jti: randomBytes(8).toString("hex"),
    sessionVersion: 1,
  };
}

function isSessionExpired(issuedAt: number) {
  const ageMs = Date.now() - issuedAt;
  return ageMs > SESSION_MAX_AGE_SECONDS * 1000;
}

export async function createAdminSession(params: {
  username: string;
  tenantId: number | null;
}) {
  const cookieStore = await cookies();
  const sessionVersion =
    params.tenantId == null
      ? (
          await prisma.adminUser.findUnique({
            where: { username: params.username },
            select: { sessionVersion: true },
          })
        )?.sessionVersion ?? 1
      : (
          await prisma.tenantStaff.findFirst({
            where: { tenantId: params.tenantId, username: params.username },
            select: { sessionVersion: true },
          })
        )?.sessionVersion ?? 1;
  const payload = encodePayload({
    username: params.username,
    tenantId: params.tenantId,
    issuedAt: Date.now(),
    jti: randomBytes(16).toString("hex"),
    sessionVersion,
  });
  const signature = signValue(payload);

  cookieStore.set(AUTH_COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function isCookieMutationNotAllowedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Cookies can only be modified in a Server Action or Route Handler")
  );
}

async function clearAdminSessionBestEffort() {
  try {
    await clearAdminSession();
  } catch (error) {
    // Session guards run in both Server Components and Server Actions.
    // In Server Components cookie mutation is disallowed; redirect is still enough to block access.
    if (isCookieMutationNotAllowedError(error)) {
      return;
    }
    throw error;
  }
}

export async function getAuthenticatedAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  const splitIndex = sessionCookie.lastIndexOf(".");
  if (splitIndex <= 0) {
    return null;
  }

  const payload = sessionCookie.slice(0, splitIndex);
  const signature = sessionCookie.slice(splitIndex + 1);
  if (!signature) {
    return null;
  }

  const expectedSignature = signValue(payload);
  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const decoded = decodePayload(payload) ?? decodeLegacyPayload(payload);
  if (!decoded) {
    return null;
  }

  if (isSessionExpired(decoded.issuedAt)) {
    return null;
  }

  const subjectState =
    decoded.tenantId == null
      ? await prisma.adminUser.findUnique({
          where: { username: decoded.username },
          select: { sessionVersion: true, sessionRevokedAfter: true },
        })
      : await prisma.tenantStaff.findFirst({
          where: { tenantId: decoded.tenantId, username: decoded.username },
          select: { sessionVersion: true, sessionRevokedAfter: true },
        });

  if (!subjectState) {
    return null;
  }

  if (decoded.sessionVersion !== subjectState.sessionVersion) {
    return null;
  }

  if (
    subjectState.sessionRevokedAfter &&
    decoded.issuedAt <= subjectState.sessionRevokedAfter.getTime()
  ) {
    return null;
  }

  return decoded;
}

export async function revokeSessionsForUser(params: {
  username: string;
  tenantId: number | null;
}) {
  const now = new Date();
  if (params.tenantId == null) {
    await prisma.adminUser.updateMany({
      where: { username: params.username },
      data: {
        sessionVersion: { increment: 1 },
        sessionRevokedAfter: now,
      },
    });
    return;
  }

  await prisma.tenantStaff.updateMany({
    where: { tenantId: params.tenantId, username: params.username },
    data: {
      sessionVersion: { increment: 1 },
      sessionRevokedAfter: now,
    },
  });
}

export async function revokeCurrentAuthenticatedSession() {
  const session = await getAuthenticatedAdminSession();
  if (!session?.username) return;
  await revokeSessionsForUser({
    username: session.username,
    tenantId: session.tenantId,
  });
}

export async function getAuthenticatedAdmin() {
  const session = await getAuthenticatedAdminSession();
  return session?.username ?? null;
}

export async function requireAdminSession() {
  await assertPrivilegedServerActionOrigin();
  const session = await getAuthenticatedAdminSession();

  if (!session?.username) {
    redirect("/glidragiris");
  }

  return session.username;
}

export async function requireHqSession() {
  await assertPrivilegedServerActionOrigin();
  const session = await getAuthenticatedAdminSession();

  if (!session?.username) {
    redirect("/glidragiris");
  }

  if (session.tenantId != null) {
    const staff = await loadTenantStaffForAuth(session.tenantId, session.username);
    if (staff?.role) {
      const target = resolveStaffPostLoginTarget({
        isActive: staff.isActive,
        mustSetPassword: staff.mustSetPassword,
        role: staff.role,
        workingDays: staff.workingDays,
        shiftStart: staff.shiftStart,
        shiftEnd: staff.shiftEnd,
        weeklyShiftSchedule: staff.weeklyShiftSchedule,
      });
      if (target.kind === "redirect") {
        redirect(target.path);
      }
    }

    await clearAdminSessionBestEffort();
    redirect("/glidragiris?error=hq_requires_central_session");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { username: session.username },
    select: { username: true },
  });
  if (!admin) {
    await clearAdminSessionBestEffort();
    redirect("/glidragiris?error=hq_forbidden");
  }

  const tenantStaff = await prisma.tenantStaff.findFirst({
    where: { username: session.username },
    select: { id: true },
  });
  if (tenantStaff) {
    await clearAdminSessionBestEffort();
    redirect("/glidragiris?error=hq_forbidden");
  }

  try {
    await assertSurfaceGuard({
      surface: "hq-private",
      actor: createHqAdminActor(session.username),
      operation: "interactive",
    });
  } catch {
    await clearAdminSessionBestEffort();
    redirect("/glidragiris?error=hq_forbidden");
  }

  return {
    username: session.username,
    role: "HQ_ADMIN" as const,
  };
}

async function requireTenantBoundAdminSession(expectedTenantId: number) {
  await assertPrivilegedServerActionOrigin();
  const session = await getAuthenticatedAdminSession();

  if (!session?.username) {
    redirect("/glidragiris");
  }

  if (session.tenantId == null || session.tenantId !== expectedTenantId) {
    await clearAdminSessionBestEffort();
    redirect("/glidragiris");
  }

  return session;
}

async function loadWeeklyShiftScheduleByStaffId(staffId: number): Promise<unknown | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ weeklyShiftSchedule: unknown }>>(
      Prisma.sql`SELECT "weeklyShiftSchedule" FROM "TenantStaff" WHERE "id" = ${staffId} LIMIT 1`,
    );
    return rows[0]?.weeklyShiftSchedule ?? null;
  } catch {
    return null;
  }
}

export type TenantStaffAuthRow = {
  id: number;
  role: StaffRole;
  isActive: boolean;
  mustSetPassword: boolean;
  displayName: string | null;
  workingDays: import("@prisma/client").Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
  weeklyShiftSchedule: unknown | null;
  passwordHash?: string;
};

/**
 * tenantId + username ile staff. Prisma 6'da findUnique(bileşik) ile oluşan doğrulama sorunlarından kaçınmak için findFirst kullanılır.
 * weeklyShiftSchedule, istemci/şema uyumsuzluğunda select hatası vermemesi için ayrı okunur.
 */
export async function loadTenantStaffForAuth(
  tenantId: number,
  username: string,
  options?: { includePasswordHash?: boolean },
): Promise<TenantStaffAuthRow | null> {
  const staff = await prisma.tenantStaff.findFirst({
    where: { tenantId, username },
    select: {
      id: true,
      role: true,
      isActive: true,
      mustSetPassword: true,
      displayName: true,
      workingDays: true,
      shiftStart: true,
      shiftEnd: true,
      ...(options?.includePasswordHash ? { passwordHash: true } : {}),
    },
  });
  if (!staff) return null;
  const weeklyShiftSchedule = await loadWeeklyShiftScheduleByStaffId(staff.id);
  return { ...staff, weeklyShiftSchedule };
}

/**
 * Tenant + username ile staff kaydı varsa rolünü döner.
 * Staff kaydı yoksa artık varsayılan MANAGER yetkisi verilmez.
 */
export async function getStaffRoleForTenant(
  tenantId: number,
  username: string,
): Promise<{
  role: StaffRole | null;
  staffId: number | null;
  isActive: boolean;
  mustSetPassword: boolean;
}> {
  const staff = await prisma.tenantStaff.findFirst({
    where: { tenantId, username },
    select: {
      id: true,
      role: true,
      isActive: true,
      mustSetPassword: true,
      workingDays: true,
      shiftStart: true,
      shiftEnd: true,
    },
  });
  if (staff) {
    return {
      role: staff.role,
      staffId: staff.id,
      isActive: staff.isActive,
      mustSetPassword: staff.mustSetPassword,
    };
  }
  return { role: null, staffId: null, isActive: false, mustSetPassword: false };
}

export async function getPrivilegedSessionForTenant(tenantId: number): Promise<{
  username: string;
  role: "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";
  staffId: number | null;
} | null> {
  const session = await getAuthenticatedAdminSession();
  if (!session?.username) return null;
  if (session.tenantId == null || session.tenantId !== tenantId) return null;

  const staff = await getStaffRoleForTenant(tenantId, session.username);
  if (!staff.isActive || !staff.role) return null;
  if (
    staff.role !== "MANAGER" &&
    staff.role !== "CASHIER" &&
    staff.role !== "WAITER" &&
    staff.role !== "KITCHEN"
  ) {
    return null;
  }

  return {
    username: session.username,
    role: staff.role,
    staffId: staff.staffId,
  };
}

async function ensureActiveRoleSession(params: {
  isActive: boolean;
  hasRole: boolean;
  mustSetPassword: boolean;
  role: StaffRole | null;
  workingDays: import("@prisma/client").Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
  weeklyShiftSchedule: unknown | null;
}) {
  if (!params.isActive || !params.hasRole) {
    await clearAdminSessionBestEffort();
    redirect("/glidragiris");
  }
  if (params.mustSetPassword) {
    redirect("/staff/set-password");
  }
  if (params.role === "WAITER" || params.role === "KITCHEN") {
    const availability = evaluateStaffAvailability({
      isActive: params.isActive,
      workingDays: params.workingDays,
      shiftStart: params.shiftStart,
      shiftEnd: params.shiftEnd,
      weeklyShiftSchedule: params.weeklyShiftSchedule,
    });
    if (!availability.allowed) {
      await clearAdminSessionBestEffort();
      redirect("/glidragiris?error=staff_not_available");
    }
  }
  if (params.isActive && params.hasRole) return;
  await clearAdminSessionBestEffort();
  redirect("/glidragiris");
}

async function assertStaffSurfaceOrRedirect(input: {
  tenantId: number;
  username: string;
  role: StaffRole;
  surface: "ops-private" | "waiter-private" | "kitchen-private";
  operation: "interactive" | "mutation";
}) {
  try {
    const actor = createStaffActor({
      tenantId: input.tenantId,
      username: input.username,
      role: input.role,
    });
    await assertSurfaceGuard({
      surface: input.surface,
      actor,
      tenantId: input.tenantId,
      operation: input.operation,
    });
  } catch {
    await clearAdminSessionBestEffort();
    redirect("/glidragiris?error=tenant_access_blocked");
  }
}

/** Müdür paneli: sadece MANAGER. */
export async function requireManagerSession(): Promise<{
  username: string;
  tenantId: number;
  role: "MANAGER";
  staffId: number | null;
  authMode: "staff" | "support";
  supportContext?: SupportPanelContext;
}> {
  const { getCurrentTenantOrThrow } = await import("@/lib/tenancy/context");
  const { tenantId } = await getCurrentTenantOrThrow();

  const support = await resolveActiveSupportSessionForTenant(tenantId);
  if (support) {
    await assertSurfaceGuard({
      surface: "ops-private",
      actor: createHqSupportActor({
        tenantId,
        hqUsername: support.hqAdminUsername,
        supportSessionId: support.sessionId,
      }),
      tenantId,
      operation: "interactive",
    });
    return {
      username: support.hqAdminUsername,
      tenantId,
      role: "MANAGER",
      staffId: null,
      authMode: "support",
      supportContext: support,
    };
  }

  const session = await requireTenantBoundAdminSession(tenantId);

  const staff = await loadTenantStaffForAuth(tenantId, session.username);
  const role = staff?.role ?? null;
  await ensureActiveRoleSession({
    isActive: Boolean(staff?.isActive),
    hasRole: role != null,
    mustSetPassword: Boolean(staff?.mustSetPassword),
    role,
    workingDays: staff?.workingDays ?? [],
    shiftStart: staff?.shiftStart ?? null,
    shiftEnd: staff?.shiftEnd ?? null,
    weeklyShiftSchedule: staff?.weeklyShiftSchedule ?? null,
  });

  if (role !== "MANAGER") {
    if (role === "CASHIER") {
      redirect("/restaurant/cash");
    }
    if (role === "WAITER") {
      redirect("/waiter");
    }
    redirect("/kitchen");
  }

  await assertStaffSurfaceOrRedirect({
    tenantId,
    username: session.username,
    role: "MANAGER",
    surface: "ops-private",
    operation: "interactive",
  });

  return {
    username: session.username,
    tenantId,
    role: "MANAGER" as const,
    staffId: staff?.id ?? null,
    authMode: "staff",
  };
}

/** Kasa paneli: CASHIER veya MANAGER. */
export async function requireCashierOrManagerSession(
  requiredCapability?: Capability,
): Promise<{
  username: string;
  tenantId: number;
  role: "MANAGER" | "CASHIER";
  staffId: number | null;
  homePath: string;
  authMode: "staff" | "support";
  supportContext?: SupportPanelContext;
}> {
  const { getCurrentTenantOrThrow } = await import("@/lib/tenancy/context");
  const { tenantId } = await getCurrentTenantOrThrow();

  const support = await resolveActiveSupportSessionForTenant(tenantId);
  if (support) {
    const actor = createHqSupportActor({
      tenantId,
      hqUsername: support.hqAdminUsername,
      supportSessionId: support.sessionId,
    });
    try {
      await assertSurfaceGuard({
        surface: "ops-private",
        actor,
        tenantId,
        operation: "interactive",
        requiredCapability,
      });
    } catch {
      redirect("/restaurant");
    }
    return {
      username: support.hqAdminUsername,
      tenantId,
      role: "MANAGER",
      staffId: null,
      homePath: "/restaurant",
      authMode: "support",
      supportContext: support,
    };
  }

  const session = await requireTenantBoundAdminSession(tenantId);

  const staff = await loadTenantStaffForAuth(tenantId, session.username);
  const role = staff?.role ?? null;
  const staffId = staff?.id ?? null;
  await ensureActiveRoleSession({
    isActive: Boolean(staff?.isActive),
    hasRole: role != null,
    mustSetPassword: Boolean(staff?.mustSetPassword),
    role,
    workingDays: staff?.workingDays ?? [],
    shiftStart: staff?.shiftStart ?? null,
    shiftEnd: staff?.shiftEnd ?? null,
    weeklyShiftSchedule: staff?.weeklyShiftSchedule ?? null,
  });

  if (!role || !isCashCollectionRole(role)) {
    if (role === "WAITER") {
      redirect("/waiter");
    }
    if (role === "KITCHEN") {
      redirect("/kitchen");
    }
    redirect("/glidragiris");
  }

  const permittedRole = role as "MANAGER" | "CASHIER";

  await assertStaffSurfaceOrRedirect({
    tenantId,
    username: session.username,
    role: permittedRole,
    surface: "ops-private",
    operation: "interactive",
  });

  if (requiredCapability) {
    try {
      await assertSurfaceGuard({
        surface: "ops-private",
        actor: createStaffActor({
          tenantId,
          username: session.username,
          role: permittedRole,
        }),
        tenantId,
        operation: "interactive",
        requiredCapability,
      });
    } catch {
      await clearAdminSessionBestEffort();
      redirect(resolveRestaurantHomePath(permittedRole));
    }
  }

  return {
    username: session.username,
    tenantId,
    role: permittedRole,
    staffId,
    homePath: resolveRestaurantHomePath(permittedRole),
    authMode: "staff",
  };
}

/** Tahsilat islemleri: WAITER, CASHIER veya MANAGER. */
export async function requireCashierWaiterOrManagerSession(requiredCapabilityForCashier?: Capability) {
  const { getCurrentTenantOrThrow } = await import("@/lib/tenancy/context");
  const { tenantId } = await getCurrentTenantOrThrow();
  const session = await requireTenantBoundAdminSession(tenantId);

  const staff = await loadTenantStaffForAuth(tenantId, session.username);
  const role = staff?.role ?? null;
  const staffId = staff?.id ?? null;

  await ensureActiveRoleSession({
    isActive: Boolean(staff?.isActive),
    hasRole: role != null,
    mustSetPassword: Boolean(staff?.mustSetPassword),
    role,
    workingDays: staff?.workingDays ?? [],
    shiftStart: staff?.shiftStart ?? null,
    shiftEnd: staff?.shiftEnd ?? null,
    weeklyShiftSchedule: staff?.weeklyShiftSchedule ?? null,
  });

  if (role === "WAITER" || role === "MANAGER") {
    await assertStaffSurfaceOrRedirect({
      tenantId,
      username: session.username,
      role,
      surface: "waiter-private",
      operation: "interactive",
    });
    return { username: session.username, tenantId, role, staffId };
  }

  if (role === "CASHIER") {
    const cashierSession = await requireCashierOrManagerSession(requiredCapabilityForCashier);
    return {
      username: cashierSession.username,
      tenantId: cashierSession.tenantId,
      role: cashierSession.role,
      staffId: cashierSession.staffId,
    };
  }

  if (role === "KITCHEN") {
    redirect("/kitchen");
  }
  redirect("/glidragiris");
}

/** Garson paneli: WAITER veya MANAGER. */
export async function requireWaiterOrManagerSession() {
  const { getCurrentTenantOrThrow } = await import("@/lib/tenancy/context");
  const { tenantId } = await getCurrentTenantOrThrow();
  const session = await requireTenantBoundAdminSession(tenantId);

  const staff = await loadTenantStaffForAuth(tenantId, session.username);
  const role = staff?.role ?? null;
  const staffId = staff?.id ?? null;
  await ensureActiveRoleSession({
    isActive: Boolean(staff?.isActive),
    hasRole: role != null,
    mustSetPassword: Boolean(staff?.mustSetPassword),
    role,
    workingDays: staff?.workingDays ?? [],
    shiftStart: staff?.shiftStart ?? null,
    shiftEnd: staff?.shiftEnd ?? null,
    weeklyShiftSchedule: staff?.weeklyShiftSchedule ?? null,
  });

  if (role !== "WAITER" && role !== "MANAGER") {
    redirect("/kitchen");
  }

  await assertStaffSurfaceOrRedirect({
    tenantId,
    username: session.username,
    role,
    surface: "waiter-private",
    operation: "interactive",
  });

  return { username: session.username, tenantId, role, staffId };
}

/** Mutfak paneli: KITCHEN veya MANAGER. */
export async function requireKitchenOrManagerSession() {
  const { getCurrentTenantOrThrow } = await import("@/lib/tenancy/context");
  const { tenantId } = await getCurrentTenantOrThrow();
  const session = await requireTenantBoundAdminSession(tenantId);

  const staff = await loadTenantStaffForAuth(tenantId, session.username);
  const role = staff?.role ?? null;
  const staffId = staff?.id ?? null;
  await ensureActiveRoleSession({
    isActive: Boolean(staff?.isActive),
    hasRole: role != null,
    mustSetPassword: Boolean(staff?.mustSetPassword),
    role,
    workingDays: staff?.workingDays ?? [],
    shiftStart: staff?.shiftStart ?? null,
    shiftEnd: staff?.shiftEnd ?? null,
    weeklyShiftSchedule: staff?.weeklyShiftSchedule ?? null,
  });

  if (role !== "KITCHEN" && role !== "MANAGER") {
    redirect("/waiter");
  }

  await assertStaffSurfaceOrRedirect({
    tenantId,
    username: session.username,
    role,
    surface: "kitchen-private",
    operation: "interactive",
  });

  return { username: session.username, tenantId, role, staffId };
}
