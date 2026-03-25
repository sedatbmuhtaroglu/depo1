"use server";

import { randomBytes } from "node:crypto";
import { Prisma, type Weekday } from "@prisma/client";
import { createStaffActor } from "@/core/authz/actors";
import {
  EntitlementLimitExceededError,
  assertWithinLimit,
} from "@/core/entitlements/engine";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import type { WeeklyShiftDayEntry } from "@/lib/weekly-shift-schedule";
import {
  deriveLegacyFieldsFromWeekly,
  validateWeeklyShiftScheduleInput,
} from "@/lib/weekly-shift-schedule";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-error-log";
import {
  clearAdminSession,
  getAuthenticatedAdminSession,
  requireManagerSession,
} from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { hashPassword } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";
import { consumeStaffSetPasswordToken } from "@/lib/staff-set-password-token";

type CreateStaffRoleInput = "RESTAURANT_MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";
type StaffRoleInput = CreateStaffRoleInput;
type ActionResult = { success: true; message: string } | { success: false; message: string; fieldErrors?: Record<string, string> };

const ROLE_MAP = {
  RESTAURANT_MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  WAITER: "WAITER",
  KITCHEN: "KITCHEN",
} as const;
function normalizeRole(role: StaffRoleInput) {
  return ROLE_MAP[role];
}

function normalizeShift(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function validatePasswordComplexity(password: string): { ok: boolean; message?: string } {
  if (password.length < 8) {
    return { ok: false, message: "Şifre en az 8 karakter olmalı." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, message: "Şifre en az bir büyük harf içermeli." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Şifre en az bir rakam içermeli." };
  }
  return { ok: true };
}

async function assertNotLastManager(params: { tenantId: number; userId: number; nextRole?: "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN"; nextIsActive?: boolean }) {
  const target = await prisma.tenantStaff.findUnique({
    where: { id: params.userId },
    select: { id: true, tenantId: true, role: true, isActive: true },
  });
  if (!target || target.tenantId !== params.tenantId) {
    throw new Error("Kullanıcı bulunamadı.");
  }
  const resultingRole = params.nextRole ?? target.role;
  const resultingActive = params.nextIsActive ?? target.isActive;
  if (target.role !== "MANAGER") return;
  if (resultingRole === "MANAGER" && resultingActive) return;
  const managerCount = await prisma.tenantStaff.count({
    where: { tenantId: params.tenantId, role: "MANAGER", isActive: true, NOT: { id: target.id } },
  });
  if (managerCount < 1) {
    throw new Error("Son aktif müdür hesabında bu işlem yapılamaz.");
  }
}

async function buildManagerTenantContext() {
  const { username: actorUsername, tenantId } = await requireManagerSession();
  const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
  if (ctxTenantId !== tenantId) {
    throw new Error("Yetkisiz.");
  }
  await assertSurfaceGuard({
    surface: "ops-private",
    actor: createStaffActor({
      tenantId,
      username: actorUsername,
      role: "MANAGER",
    }),
    tenantId,
    operation: "mutation",
    requiredCapability: "STAFF_MANAGE",
  });
  return { actorUsername, tenantId };
}

export async function createTenantStaffUser(data: {
  displayName: string;
  username: string;
  temporaryPassword: string;
  role: CreateStaffRoleInput;
  /** Haftalık program; verilmezse vardiya null (girişte fail-closed). */
  weeklyShiftSchedule?: WeeklyShiftDayEntry[] | null;
  notes?: string | null;
}) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { actorUsername, tenantId } = await buildManagerTenantContext();

    const displayName = (data.displayName ?? "").trim();
    const username = (data.username ?? "").trim().toLowerCase();
    const temporaryPassword = (data.temporaryPassword ?? "").trim();
    const role = normalizeRole(data.role);
    const weekly = data.weeklyShiftSchedule ?? null;
    const notes = normalizeShift(data.notes)?.slice(0, 280) ?? null;
    const legacy =
      weekly != null
        ? deriveLegacyFieldsFromWeekly(weekly)
        : { workingDays: [] as Weekday[], shiftStart: null as string | null, shiftEnd: null as string | null };

    const missingFields: Array<"displayName" | "username" | "temporaryPassword"> = [];
    if (!displayName) missingFields.push("displayName");
    if (!username) missingFields.push("username");
    if (!temporaryPassword) missingFields.push("temporaryPassword");

    if (missingFields.length > 0) {
      const fieldLabelMap: Record<string, string> = {
        displayName: "Ad Soyad",
        username: "Kullanıcı Adı",
        temporaryPassword: "Geçici Şifre",
      };
      const pretty = missingFields.map((field) => fieldLabelMap[field]).join(", ");
      return {
        success: false,
        message: `Şu alanlar zorunlu: ${pretty}.`,
        fieldErrors: Object.fromEntries(
          missingFields.map((field) => [field, "Bu alan zorunludur."]),
        ),
      };
    }

    const passwordStatus = validatePasswordComplexity(temporaryPassword);
    if (!passwordStatus.ok) {
      return {
        success: false,
        message: passwordStatus.message!,
        fieldErrors: { temporaryPassword: passwordStatus.message! },
      };
    }

    if (!role) {
      return {
        success: false,
        message: "Geçersiz rol seçildi.",
        fieldErrors: { role: "Geçersiz rol seçildi." },
      };
    }
    if (weekly != null) {
      const scheduleValidation = validateWeeklyShiftScheduleInput(weekly);
      if (!scheduleValidation.ok) {
        return {
          success: false,
          message: scheduleValidation.message,
          fieldErrors: { weeklyShiftSchedule: scheduleValidation.message },
        };
      }
    }

    const [existingStaff, existingAdminUser] = await Promise.all([
      prisma.tenantStaff.findUnique({
        where: {
          tenantId_username: {
            tenantId,
            username,
          },
        },
        select: { id: true },
      }),
      prisma.adminUser.findUnique({
        where: { username },
        select: { id: true },
      }),
    ]);

    if (existingStaff) {
      return {
        success: false,
        message: "Bu kullanıcı adı bu tenant içinde zaten kullanılıyor.",
        fieldErrors: { username: "Bu kullanıcı adı bu tenant içinde zaten kullanılıyor." },
      };
    }

    if (existingAdminUser) {
      return {
        success: false,
        message: "Bu kullanıcı adı sistemde rezerve. Başka bir ad deneyin.",
        fieldErrors: { username: "Bu kullanıcı adı sistemde rezerve. Başka bir ad deneyin." },
      };
    }

    const passwordHash = await hashPassword(temporaryPassword);

    const created = await prisma.$transaction(
      async (tx) => {
        const activeUsers = await tx.tenantStaff.count({
          where: { tenantId, isActive: true },
        });
        await assertWithinLimit({
          tenantId,
          resource: "USERS",
          used: activeUsers,
          client: tx,
        });

        return tx.tenantStaff.create({
          data: {
            tenantId,
            username,
            passwordHash,
            mustSetPassword: true,
            role,
            displayName,
            isActive: true,
            workingDays: legacy.workingDays,
            shiftStart: legacy.shiftStart,
            shiftEnd: legacy.shiftEnd,
            weeklyShiftSchedule:
              weekly != null ? (weekly as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            notes,
          },
          select: { id: true, username: true, role: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: actorUsername },
      actionType: "STAFF_CREATE",
      entityType: "TenantStaff",
      entityId: String(created.id),
      description: `role=${created.role}; username=${created.username}`,
    });

    revalidatePath("/restaurant/users");
    return { success: true, message: "Kullanıcı oluşturuldu." };
  } catch (error) {
    if (error instanceof EntitlementLimitExceededError) {
      return {
        success: false,
        message: error.message,
        limit: {
          resource: error.resource,
          used: error.used,
          max: error.max,
        },
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          success: false,
          message: "Bu kullanıcı adı bu tenant içinde zaten kullanılıyor.",
          fieldErrors: { username: "Bu kullanıcı adı bu tenant içinde zaten kullanılıyor." },
        };
      }
      if (error.code === "P2034") {
        return {
          success: false,
          message: "İşlem yoğunluğu nedeniyle kullanıcı oluşturulamadı. Lütfen tekrar deneyin.",
        };
      }
    }

    logServerError("staff-users:create", error);
    return { success: false, message: "Kullanıcı oluşturulamadı." };
  }
}

export async function updateTenantStaffUser(data: {
  id: number;
  displayName: string;
  role: StaffRoleInput;
  isActive: boolean;
  weeklyShiftSchedule: WeeklyShiftDayEntry[];
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    await assertPrivilegedServerActionOrigin();
    const { actorUsername, tenantId } = await buildManagerTenantContext();
    const role = normalizeRole(data.role);
    if (!role) return { success: false, message: "Geçersiz rol seçildi." };
    const notes = normalizeShift(data.notes)?.slice(0, 280) ?? null;
    const scheduleValidation = validateWeeklyShiftScheduleInput(data.weeklyShiftSchedule);
    if (!scheduleValidation.ok) {
      return {
        success: false,
        message: scheduleValidation.message,
        fieldErrors: { weeklyShiftSchedule: scheduleValidation.message },
      };
    }
    const legacy = deriveLegacyFieldsFromWeekly(data.weeklyShiftSchedule);
    await assertNotLastManager({
      tenantId,
      userId: data.id,
      nextRole: role,
      nextIsActive: Boolean(data.isActive),
    });
    const updated = await prisma.tenantStaff.updateMany({
      where: { id: data.id, tenantId },
      data: {
        displayName: (data.displayName ?? "").trim() || null,
        role,
        isActive: Boolean(data.isActive),
        workingDays: legacy.workingDays,
        shiftStart: legacy.shiftStart,
        shiftEnd: legacy.shiftEnd,
        weeklyShiftSchedule: data.weeklyShiftSchedule as unknown as Prisma.InputJsonValue,
        notes,
      },
    });
    if (updated.count === 0) {
      return { success: false, message: "Kullanıcı bulunamadı." };
    }
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: actorUsername },
      actionType: "STAFF_UPDATE",
      entityType: "TenantStaff",
      entityId: String(data.id),
      description: `role=${role}; isActive=${Boolean(data.isActive)}`,
    });
    revalidatePath("/restaurant/users");
    return { success: true, message: "Kullanıcı bilgileri güncellendi." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Kullanıcı güncellenemedi." };
  }
}

export async function resetTenantStaffPassword(data: {
  id: number;
  newPassword: string;
  /** true ise kullanıcı bir sonraki girişte şifre belirleme ekranına yönlendirilir (geçici şifre senaryosu). */
  requirePasswordSetupOnNextLogin?: boolean;
}): Promise<ActionResult> {
  try {
    await assertPrivilegedServerActionOrigin();
    const { actorUsername, tenantId } = await buildManagerTenantContext();
    const newPassword = (data.newPassword ?? "").trim();
    const passwordStatus = validatePasswordComplexity(newPassword);
    if (!passwordStatus.ok) {
      return {
        success: false,
        message: passwordStatus.message!,
        fieldErrors: { newPassword: passwordStatus.message! },
      };
    }
    const passwordHash = await hashPassword(newPassword);
    const requireSetup = data.requirePasswordSetupOnNextLogin === true;
    const updated = await prisma.tenantStaff.updateMany({
      where: { id: data.id, tenantId },
      data: {
        passwordHash,
        mustSetPassword: requireSetup,
        passwordInitializedAt: requireSetup ? null : new Date(),
      },
    });
    if (updated.count === 0) return { success: false, message: "Kullanıcı bulunamadı." };
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: actorUsername },
      actionType: "STAFF_PASSWORD_SET",
      entityType: "TenantStaff",
      entityId: String(data.id),
      description: "manager_direct_password_set",
    });
    revalidatePath("/restaurant/users");
    return { success: true, message: "Kullanıcının şifresi güncellendi." };
  } catch {
    return { success: false, message: "Şifre güncellenemedi." };
  }
}

export async function forceTenantStaffPasswordReset(data: { id: number }): Promise<ActionResult> {
  try {
    await assertPrivilegedServerActionOrigin();
    const { actorUsername, tenantId } = await buildManagerTenantContext();
    const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
    const updated = await prisma.tenantStaff.updateMany({
      where: { id: data.id, tenantId },
      data: {
        passwordHash,
        mustSetPassword: true,
        passwordInitializedAt: null,
      },
    });
    if (updated.count === 0) return { success: false, message: "Kullanıcı bulunamadı." };
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: actorUsername },
      actionType: "STAFF_FORCE_PASSWORD_RESET",
      entityType: "TenantStaff",
      entityId: String(data.id),
      description: "force_next_login_password_setup",
    });
    revalidatePath("/restaurant/users");
    return {
      success: true,
      message:
        "Eski şifre geçersiz kılındı. Kullanıcı giriş yapabilsin diye geçici şifreyi 'Şifreyi Ayarla' ile verin; isteğe bağlı olarak 'Girişte şifre yenile' seçeneğini işaretleyin.",
    };
  } catch {
    return { success: false, message: "Zorunlu şifre yenileme ayarlanamadı." };
  }
}

export async function deleteTenantStaffUser(data: { id: number }): Promise<ActionResult> {
  try {
    await assertPrivilegedServerActionOrigin();
    const { actorUsername, tenantId } = await buildManagerTenantContext();
    await assertNotLastManager({ tenantId, userId: data.id });
    const deleted = await prisma.tenantStaff.deleteMany({
      where: { id: data.id, tenantId },
    });
    if (deleted.count === 0) return { success: false, message: "Kullanıcı bulunamadı." };
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: actorUsername },
      actionType: "STAFF_DELETE",
      entityType: "TenantStaff",
      entityId: String(data.id),
      description: "hard_deleted_staff_user",
    });
    revalidatePath("/restaurant/users");
    return { success: true, message: "Kullanıcı sistemden silindi." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Kullanıcı silinemedi." };
  }
}

export async function completeInitialStaffPassword(data: {
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  try {
    try {
      await assertPrivilegedServerActionOrigin();
    } catch {
      return { success: false, message: "Güvenlik doğrulaması başarısız." };
    }
    const session = await getAuthenticatedAdminSession();
    if (!session?.username || session.tenantId == null) {
      return { success: false, message: "Oturum bulunamadı." };
    }
    const newPassword = (data.newPassword ?? "").trim();
    const confirmPassword = (data.confirmPassword ?? "").trim();
    const passwordStatus = validatePasswordComplexity(newPassword);
    if (!passwordStatus.ok) {
      return {
        success: false,
        message: passwordStatus.message!,
        fieldErrors: { newPassword: passwordStatus.message! },
      };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, message: "Şifreler birbiriyle eşleşmiyor.", fieldErrors: { confirmPassword: "Şifreler eşleşmiyor." } };
    }
    const staff = await prisma.tenantStaff.findUnique({
      where: { tenantId_username: { tenantId: session.tenantId, username: session.username } },
      select: { id: true, isActive: true, mustSetPassword: true },
    });
    if (!staff || !staff.isActive) {
      await clearAdminSession();
      return { success: false, message: "Bu kullanıcı şu anda aktif değil." };
    }
    if (!staff.mustSetPassword) {
      return { success: true, message: "Şifreniz zaten tanımlı." };
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.tenantStaff.update({
      where: { id: staff.id },
      data: {
        passwordHash,
        mustSetPassword: false,
        passwordInitializedAt: new Date(),
      },
    });
    await writeAuditLog({
      tenantId: session.tenantId,
      actor: { type: "admin", id: session.username },
      actionType: "STAFF_PASSWORD_INITIALIZED",
      entityType: "TenantStaff",
      entityId: String(staff.id),
      description: "initial_password_setup_completed",
    });
    return { success: true, message: "Şifreniz başarıyla oluşturuldu." };
  } catch {
    return { success: false, message: "Şifre belirleme işlemi tamamlanamadı." };
  }
}

function mapSetPasswordTokenErrorMessage(
  code:
    | "INVALID_TOKEN"
    | "TOKEN_NOT_FOUND"
    | "TOKEN_EXPIRED"
    | "TOKEN_ALREADY_USED"
    | "STAFF_INACTIVE"
    | "PASSWORD_ALREADY_INITIALIZED",
): string {
  if (code === "TOKEN_EXPIRED") return "Linkin suresi dolmus. HQ'dan yeni link isteyin.";
  if (code === "TOKEN_ALREADY_USED") return "Bu link daha once kullanilmis veya iptal edilmis.";
  if (code === "STAFF_INACTIVE") return "Bu hesap su anda aktif degil.";
  if (code === "PASSWORD_ALREADY_INITIALIZED") {
    return "Bu hesap sifresini zaten olusturmus. Normal giris yapabilirsiniz.";
  }
  return "Set-password linki gecersiz.";
}

export async function completeInitialStaffPasswordWithToken(data: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  try {
    try {
      await assertPrivilegedServerActionOrigin();
    } catch {
      return { success: false, message: "Guvenlik dogrulamasi basarisiz." };
    }

    const token = (data.token ?? "").trim();
    if (!token) {
      return { success: false, message: "Set-password tokeni zorunlu." };
    }

    const newPassword = (data.newPassword ?? "").trim();
    const confirmPassword = (data.confirmPassword ?? "").trim();
    const passwordStatus = validatePasswordComplexity(newPassword);
    if (!passwordStatus.ok) {
      return {
        success: false,
        message: passwordStatus.message!,
        fieldErrors: { newPassword: passwordStatus.message! },
      };
    }
    if (newPassword !== confirmPassword) {
      return {
        success: false,
        message: "Sifreler birbiriyle eslesmiyor.",
        fieldErrors: { confirmPassword: "Sifreler eslesmiyor." },
      };
    }

    const passwordHash = await hashPassword(newPassword);
    const result = await consumeStaffSetPasswordToken({
      rawToken: token,
      passwordHash,
    });

    if (!result.ok) {
      return { success: false, message: mapSetPasswordTokenErrorMessage(result.code) };
    }

    await writeAuditLog({
      tenantId: result.snapshot.tenantId,
      actor: { type: "admin", id: result.snapshot.username },
      actionType: "STAFF_PASSWORD_INITIALIZED",
      entityType: "TenantStaff",
      entityId: String(result.snapshot.tenantStaffId),
      description: "initial_password_setup_completed_via_token",
    });

    return { success: true, message: "Sifreniz basariyla olusturuldu." };
  } catch {
    return { success: false, message: "Sifre belirleme islemi tamamlanamadi." };
  }
}
