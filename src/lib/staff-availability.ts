import type { Weekday } from "@prisma/client";
import { getTurkeyCurrentMinutes, getTurkeyWeekdayIndex } from "@/lib/turkey-time";
import {
  parseWeeklyShiftSchedule,
  validateWeeklyShiftScheduleInput,
  type WeeklyShiftDayEntry,
} from "@/lib/weekly-shift-schedule";

const SHIFT_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const STAFF_WEEKDAYS: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const STAFF_WEEKDAY_LABEL_TR: Record<Weekday, string> = {
  MONDAY: "Pzt",
  TUESDAY: "Sal",
  WEDNESDAY: "Çar",
  THURSDAY: "Per",
  FRIDAY: "Cum",
  SATURDAY: "Cmt",
  SUNDAY: "Paz",
};

export function parseShiftMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!SHIFT_TIME_PATTERN.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

function getTurkeyWeekday(date: Date): Weekday {
  const weekdayIndex = getTurkeyWeekdayIndex(date);
  if (weekdayIndex === 0) return "SUNDAY";
  if (weekdayIndex === 1) return "MONDAY";
  if (weekdayIndex === 2) return "TUESDAY";
  if (weekdayIndex === 3) return "WEDNESDAY";
  if (weekdayIndex === 4) return "THURSDAY";
  if (weekdayIndex === 5) return "FRIDAY";
  return "SATURDAY";
}

function getPrevWeekday(weekday: Weekday): Weekday {
  const idx = STAFF_WEEKDAYS.indexOf(weekday);
  return STAFF_WEEKDAYS[(idx - 1 + STAFF_WEEKDAYS.length) % STAFF_WEEKDAYS.length];
}

export function validateWorkingScheduleInput(params: {
  workingDays: Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
}): { ok: true } | { ok: false; message: string } {
  const uniqueDays = [...new Set(params.workingDays)];
  const start = params.shiftStart?.trim() ?? "";
  const end = params.shiftEnd?.trim() ?? "";

  if ((start && !end) || (!start && end)) {
    return { ok: false, message: "Vardiya başlangıç ve bitiş saatini birlikte girin." };
  }

  if (!start && !end) {
    if (uniqueDays.length > 0) {
      return { ok: false, message: "Çalışma günü seçildiyse vardiya saatleri zorunludur." };
    }
    return { ok: true };
  }

  const startMinutes = parseShiftMinutes(start);
  const endMinutes = parseShiftMinutes(end);
  if (startMinutes == null || endMinutes == null) {
    return { ok: false, message: "Vardiya saat formatı HH:MM olmalıdır." };
  }
  if (startMinutes === endMinutes) {
    return { ok: false, message: "Vardiya başlangıç ve bitiş saati aynı olamaz." };
  }
  if (uniqueDays.length === 0) {
    return { ok: false, message: "Vardiya saatleri girildiyse en az bir çalışma günü seçin." };
  }
  return { ok: true };
}

function evaluateWeeklyShiftWindow(
  entries: WeeklyShiftDayEntry[],
  now: Date,
): { allowed: boolean; reason: "DAY_OFF" | "OUTSIDE_SHIFT" | null } {
  const scheduleValid = validateWeeklyShiftScheduleInput(entries);
  if (!scheduleValid.ok) {
    return { allowed: false, reason: "OUTSIDE_SHIFT" };
  }

  const anyEnabled = entries.some((e) => e.enabled);
  if (!anyEnabled) {
    return { allowed: false, reason: "OUTSIDE_SHIFT" };
  }

  const nowMinutes = getTurkeyCurrentMinutes(now);
  const today = getTurkeyWeekday(now);
  const prevDay = getPrevWeekday(today);

  const byDay = new Map(entries.map((e) => [e.dayOfWeek, e]));

  const prevEntry = byDay.get(prevDay);
  if (prevEntry?.enabled && prevEntry.startTime && prevEntry.endTime) {
    const s = parseShiftMinutes(prevEntry.startTime);
    const e = parseShiftMinutes(prevEntry.endTime);
    if (s != null && e != null && e < s) {
      if (nowMinutes < e) {
        return { allowed: true, reason: null };
      }
    }
  }

  const todayEntry = byDay.get(today);
  if (!todayEntry?.enabled) {
    return { allowed: false, reason: "DAY_OFF" };
  }

  const s = parseShiftMinutes(todayEntry.startTime);
  const e = parseShiftMinutes(todayEntry.endTime);
  if (s == null || e == null) {
    return { allowed: false, reason: "OUTSIDE_SHIFT" };
  }

  if (e >= s) {
    if (nowMinutes < s || nowMinutes >= e) {
      return { allowed: false, reason: "OUTSIDE_SHIFT" };
    }
    return { allowed: true, reason: null };
  }

  if (nowMinutes >= s) {
    return { allowed: true, reason: null };
  }
  return { allowed: false, reason: "OUTSIDE_SHIFT" };
}

/**
 * Haftalık program (weeklyShiftSchedule) doluysa onu kullanır; yoksa eski workingDays+shift* değerlerinden türetilen haftalık satırlar.
 */
export function evaluateStaffAvailability(params: {
  isActive: boolean;
  workingDays: Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
  weeklyShiftSchedule?: unknown | null;
  now?: Date;
}): { allowed: boolean; reason: "INACTIVE" | "DAY_OFF" | "OUTSIDE_SHIFT" | null } {
  if (!params.isActive) {
    return { allowed: false, reason: "INACTIVE" };
  }

  const entries = parseWeeklyShiftSchedule(params.weeklyShiftSchedule ?? null, {
    workingDays: params.workingDays,
    shiftStart: params.shiftStart,
    shiftEnd: params.shiftEnd,
  });

  return evaluateWeeklyShiftWindow(entries, params.now ?? new Date());
}

export function summarizeWorkingDays(days: Weekday[]): string {
  const uniqueDays = STAFF_WEEKDAYS.filter((day) => days.includes(day));
  if (uniqueDays.length === 0) return "Vardiya tanımlanmadı";
  if (uniqueDays.length === STAFF_WEEKDAYS.length) return "Her gün";
  return uniqueDays.map((day) => STAFF_WEEKDAY_LABEL_TR[day]).join(", ");
}

export function summarizeShiftRange(shiftStart: string | null, shiftEnd: string | null): string {
  const start = parseShiftMinutes(shiftStart);
  const end = parseShiftMinutes(shiftEnd);
  if (start == null || end == null) return "Vardiya tanımlanmadı";
  if (end < start) return `${shiftStart} - ${shiftEnd} (ertesi gün biter)`;
  return `${shiftStart} - ${shiftEnd}`;
}
