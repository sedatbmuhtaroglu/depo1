import type { StaffRole, Weekday } from "@prisma/client";
import { evaluateStaffAvailability } from "@/lib/staff-availability";

export type StaffPostLoginTarget =
  | { kind: "redirect"; path: string }
  | { kind: "blocked"; errorCode: "staff_not_available" | "inactive" };

/**
 * Login / set-password sonrası ve /glidragiris "session var" dallarında tek kaynak:
 * mustSetPassword, rol ve vardiya uygunluğuna göre hedef route veya bloklama.
 */
export function resolveStaffPostLoginTarget(staff: {
  isActive: boolean;
  mustSetPassword: boolean;
  role: StaffRole;
  workingDays: Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
  weeklyShiftSchedule?: unknown | null;
}): StaffPostLoginTarget {
  if (!staff.isActive) {
    return { kind: "blocked", errorCode: "inactive" };
  }
  if (staff.mustSetPassword) {
    return { kind: "redirect", path: "/staff/set-password" };
  }
  if (staff.role === "MANAGER") {
    return { kind: "redirect", path: "/restaurant" };
  }
  if (staff.role === "WAITER" || staff.role === "KITCHEN") {
    const availability = evaluateStaffAvailability({
      isActive: staff.isActive,
      workingDays: staff.workingDays,
      shiftStart: staff.shiftStart,
      shiftEnd: staff.shiftEnd,
      weeklyShiftSchedule: staff.weeklyShiftSchedule ?? null,
    });
    if (!availability.allowed) {
      return { kind: "blocked", errorCode: "staff_not_available" };
    }
    return {
      kind: "redirect",
      path: staff.role === "WAITER" ? "/waiter" : "/kitchen",
    };
  }
  return { kind: "redirect", path: "/restaurant" };
}

export function staffPostLoginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "staff_not_available") {
    return "Şu anda garson/mutfak paneline erişim saatinizde değilsiniz (vardiya / çalışma günü). Yöneticinizle iletişime geçin veya uygun saatte tekrar deneyin.";
  }
  if (code === "inactive") {
    return "Bu hesap aktif değil.";
  }
  return null;
}
