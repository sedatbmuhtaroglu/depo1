import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma, type StaffRole } from "@prisma/client";
import type { Capability } from "@/core/authz/capabilities";
import { createHqAdminActor, createStaffActor } from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { prisma } from "@/lib/prisma";
import { evaluateStaffAvailability } from "@/lib/staff-availability";
import {
  isCashCollectionRole,
  resolveRestaurantHomePath,
} from "@/lib/restaurant-panel-access";
import { resolveStaffPostLoginTarget } from "@/lib/staff-post-login-redirect";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

const AUTH_COOKIE_NAME = "glidra_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AdminSessionPayload = {
  username: string;
  tenantId: number | null;
  issuedAt: number;
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
  const payload = encodePayload({
    username: params.username,
    tenantId: params.tenantId,
    issuedAt: Date.now(),
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

  return decoded;
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
export async function requireManagerSession() {
  const { getCurrentTenantOrThrow } = await import("@/lib/tenancy/context");
  const { tenantId } = await getCurrentTenantOrThrow();
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

  return { username: session.username, tenantId, role: "MANAGER" as const };
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
}> {
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
