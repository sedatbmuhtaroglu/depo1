"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clearAdminSession, createAdminSession, loadTenantStaffForAuth } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import {
  checkAdminLoginRateLimit,
  clearAdminLoginFailures,
  getAdminLoginClientIp,
  registerAdminLoginFailure,
} from "@/lib/admin-login-rate-limit";
import { resolveStaffPostLoginTarget } from "@/lib/staff-post-login-redirect";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

function isLegacyTenantAdminFallbackEnabled() {
  return (process.env.ALLOW_LEGACY_ADMIN_USER_TENANT_LOGIN ?? "false").toLowerCase() === "true";
}

const INVALID_CREDENTIALS_MESSAGE = "Kullanıcı adı veya şifre hatalı.";

async function resolveTenantIdForLogin() {
  const requestHeaders = await headers();
  const tenantSlug = requestHeaders.get("x-tenant-slug")?.trim().toLowerCase();
  if (!tenantSlug) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });

  return tenant?.id ?? null;
}

async function resolveSingleTenantIdForStaffUsername(username: string) {
  const memberships = await prisma.tenantStaff.findMany({
    where: { username },
    select: { tenantId: true },
    distinct: ["tenantId"],
    take: 2,
  });

  if (memberships.length === 0) return null;
  if (memberships.length > 1) return "AMBIGUOUS" as const;
  return memberships[0].tenantId;
}

type TenantStaffLoginAttempt =
  | { kind: "NOT_FOUND" }
  | { kind: "ERROR"; message: string };

async function attemptTenantStaffLogin(params: {
  tenantId: number;
  username: string;
  password: string;
  clientIp: string;
}): Promise<TenantStaffLoginAttempt> {
  const staffUser = await loadTenantStaffForAuth(params.tenantId, params.username, {
    includePasswordHash: true,
  });

  if (!staffUser?.passwordHash) {
    return { kind: "NOT_FOUND" };
  }

  const isValidStaffPassword = await verifyPassword(params.password, staffUser.passwordHash);
  if (!isValidStaffPassword) {
    await registerAdminLoginFailure({ username: params.username, ip: params.clientIp });
    return { kind: "ERROR", message: INVALID_CREDENTIALS_MESSAGE };
  }

  await clearAdminLoginFailures({ username: params.username, ip: params.clientIp });
  await createAdminSession({ username: params.username, tenantId: params.tenantId });

  const target = resolveStaffPostLoginTarget({
    isActive: staffUser.isActive,
    mustSetPassword: staffUser.mustSetPassword,
    role: staffUser.role,
    workingDays: staffUser.workingDays,
    shiftStart: staffUser.shiftStart,
    shiftEnd: staffUser.shiftEnd,
    weeklyShiftSchedule: staffUser.weeklyShiftSchedule,
  });

  if (target.kind === "blocked") {
    await clearAdminSession();
    if (target.errorCode === "inactive") {
      return { kind: "ERROR", message: "Bu kullanıcı şu anda aktif değil." };
    }
    return { kind: "ERROR", message: "Bu kullanıcı çalışma saatleri dışında." };
  }

  redirect(target.path);
}

export async function adminLogin(_: { error?: string } | undefined, formData: FormData) {
  try {
    await assertPrivilegedServerActionOrigin();
  } catch {
    return { error: "Güvenlik doğrulaması başarısız." };
  }

  const username = formData.get("username")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!username || !password) {
    return { error: "Kullanıcı adı ve şifre zorunludur." };
  }

  const clientIp = await getAdminLoginClientIp();
  const rateLimit = await checkAdminLoginRateLimit({ username, ip: clientIp });
  if (!rateLimit.allowed) {
    if (rateLimit.reason === "infrastructure") {
      return {
        error: "Güvenlik kontrolleri geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.",
      };
    }

    return {
      error: `Çok fazla başarısız giriş denemesi. Lütfen ${rateLimit.retryAfterSeconds} saniye sonra tekrar deneyin.`,
    };
  }

  const tenantId = await resolveTenantIdForLogin();

  if (tenantId != null) {
    const tenantAttempt = await attemptTenantStaffLogin({
      tenantId,
      username,
      password,
      clientIp,
    });
    if (tenantAttempt.kind === "ERROR") {
      return { error: tenantAttempt.message };
    }

    if (!isLegacyTenantAdminFallbackEnabled()) {
      await registerAdminLoginFailure({ username, ip: clientIp });
      return { error: INVALID_CREDENTIALS_MESSAGE };
    }
  }

  if (tenantId == null) {
    const inferredTenantId = await resolveSingleTenantIdForStaffUsername(username);
    if (inferredTenantId === "AMBIGUOUS") {
      await registerAdminLoginFailure({ username, ip: clientIp });
      return {
        error:
          "Bu kullanıcı birden fazla işletmede kayıtlı. Tenant bağlantısı ile giriş yapın.",
      };
    }
    if (typeof inferredTenantId === "number") {
      const inferredAttempt = await attemptTenantStaffLogin({
        tenantId: inferredTenantId,
        username,
        password,
        clientIp,
      });
      if (inferredAttempt.kind === "ERROR") {
        return { error: inferredAttempt.message };
      }
      await registerAdminLoginFailure({ username, ip: clientIp });
      return { error: INVALID_CREDENTIALS_MESSAGE };
    }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { username },
  });

  if (!adminUser) {
    await registerAdminLoginFailure({ username, ip: clientIp });
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  const isValidPassword = await verifyPassword(password, adminUser.passwordHash);

  if (!isValidPassword) {
    await registerAdminLoginFailure({ username, ip: clientIp });
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  await clearAdminLoginFailures({ username, ip: clientIp });
  await createAdminSession({
    username: adminUser.username,
    tenantId,
  });
  if (tenantId == null) {
    redirect("/hq");
  }
  redirect("/restaurant");
}



