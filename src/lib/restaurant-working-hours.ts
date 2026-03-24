import type { Weekday } from "@prisma/client";
import { getTurkeyCurrentMinutes, getTurkeyWeekdayIndex } from "@/lib/turkey-time";

export type WeeklyWorkingHourInput = {
  weekday: Weekday;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export const WEEKDAY_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const WEEKDAY_LABEL_TR: Record<Weekday, string> = {
  MONDAY: "Pazartesi",
  TUESDAY: "Sali",
  WEDNESDAY: "Carsamba",
  THURSDAY: "Persembe",
  FRIDAY: "Cuma",
  SATURDAY: "Cumartesi",
  SUNDAY: "Pazar",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHourText(value: string | null | undefined): boolean {
  if (!value) return false;
  return TIME_PATTERN.test(value.trim());
}

export function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!TIME_PATTERN.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

function weekdayFromTurkeyDate(now: Date): Weekday {
  const index = getTurkeyWeekdayIndex(now);
  if (index === 0) return "SUNDAY";
  if (index === 1) return "MONDAY";
  if (index === 2) return "TUESDAY";
  if (index === 3) return "WEDNESDAY";
  if (index === 4) return "THURSDAY";
  if (index === 5) return "FRIDAY";
  return "SATURDAY";
}

export function buildDefaultWeeklyWorkingHours(
  openingHour?: string | null,
  closingHour?: string | null,
): WeeklyWorkingHourInput[] {
  const candidateOpen = isValidHourText(openingHour) ? openingHour!.trim() : "00:00";
  const candidateClose = isValidHourText(closingHour) ? closingHour!.trim() : "23:59";
  const openMinutes = toMinutes(candidateOpen) ?? 0;
  const closeMinutes = toMinutes(candidateClose) ?? (23 * 60 + 59);
  const safeOpen = openMinutes < closeMinutes ? candidateOpen : "00:00";
  const safeClose = openMinutes < closeMinutes ? candidateClose : "23:59";

  return WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    isOpen: true,
    openTime: safeOpen,
    closeTime: safeClose,
  }));
}

export function normalizeWeeklyWorkingHours(
  hours: WeeklyWorkingHourInput[],
): WeeklyWorkingHourInput[] {
  const byDay = new Map<Weekday, WeeklyWorkingHourInput>();
  for (const row of hours) {
    byDay.set(row.weekday, {
      weekday: row.weekday,
      isOpen: Boolean(row.isOpen),
      openTime: row.openTime?.trim() || null,
      closeTime: row.closeTime?.trim() || null,
    });
  }

  return WEEKDAY_ORDER.map((weekday) => {
    const row = byDay.get(weekday);
    if (!row) {
      return {
        weekday,
        isOpen: false,
        openTime: null,
        closeTime: null,
      };
    }

    return {
      weekday,
      isOpen: row.isOpen,
      openTime: row.isOpen ? row.openTime : null,
      closeTime: row.isOpen ? row.closeTime : null,
    };
  });
}

export function validateWeeklyWorkingHoursInput(
  hours: WeeklyWorkingHourInput[],
): { valid: boolean; message?: string } {
  if (!Array.isArray(hours) || hours.length !== WEEKDAY_ORDER.length) {
    return { valid: false, message: "Haftalik calisma saatleri eksik." };
  }

  const normalized = normalizeWeeklyWorkingHours(hours);
  const seen = new Set<Weekday>();
  for (const row of normalized) {
    if (seen.has(row.weekday)) {
      return { valid: false, message: "Ayni gun birden fazla kez gonderildi." };
    }
    seen.add(row.weekday);

    if (!row.isOpen) continue;

    if (!isValidHourText(row.openTime) || !isValidHourText(row.closeTime)) {
      return {
        valid: false,
        message: `${WEEKDAY_LABEL_TR[row.weekday]} icin saat formati HH:MM olmalidir.`,
      };
    }

    const openMinutes = toMinutes(row.openTime);
    const closeMinutes = toMinutes(row.closeTime);
    if (openMinutes == null || closeMinutes == null || openMinutes >= closeMinutes) {
      return {
        valid: false,
        message: `${WEEKDAY_LABEL_TR[row.weekday]} icin acilis saati kapanistan kucuk olmalidir.`,
      };
    }
  }

  return { valid: true };
}

export function evaluateRestaurantOrderingAvailability(params: {
  orderingDisabled: boolean;
  weeklyHours: WeeklyWorkingHourInput[];
  openingHour?: string | null;
  closingHour?: string | null;
  now?: Date;
}): {
  isOpen: boolean;
  todayOpeningHour: string | null;
  todayClosingHour: string | null;
  isClosedDay: boolean;
} {
  const now = params.now ?? new Date();
  if (params.orderingDisabled) {
    return {
      isOpen: false,
      todayOpeningHour: null,
      todayClosingHour: null,
      isClosedDay: false,
    };
  }

  const todayWeekday = weekdayFromTurkeyDate(now);
  const todayMinutes = getTurkeyCurrentMinutes(now);
  const normalized = normalizeWeeklyWorkingHours(params.weeklyHours);
  const todayRow = normalized.find((row) => row.weekday === todayWeekday) ?? null;

  if (todayRow) {
    if (!todayRow.isOpen) {
      return {
        isOpen: false,
        todayOpeningHour: null,
        todayClosingHour: null,
        isClosedDay: true,
      };
    }

    const openMinutes = toMinutes(todayRow.openTime);
    const closeMinutes = toMinutes(todayRow.closeTime);
    if (
      openMinutes == null ||
      closeMinutes == null ||
      openMinutes >= closeMinutes
    ) {
      return {
        isOpen: false,
        todayOpeningHour: todayRow.openTime,
        todayClosingHour: todayRow.closeTime,
        isClosedDay: false,
      };
    }

    return {
      isOpen: todayMinutes >= openMinutes && todayMinutes < closeMinutes,
      todayOpeningHour: todayRow.openTime,
      todayClosingHour: todayRow.closeTime,
      isClosedDay: false,
    };
  }

  const fallbackOpen = toMinutes(params.openingHour);
  const fallbackClose = toMinutes(params.closingHour);
  if (fallbackOpen != null && fallbackClose != null) {
    if (fallbackClose > fallbackOpen) {
      return {
        isOpen: todayMinutes >= fallbackOpen && todayMinutes < fallbackClose,
        todayOpeningHour: params.openingHour ?? null,
        todayClosingHour: params.closingHour ?? null,
        isClosedDay: false,
      };
    }
    return {
      isOpen: todayMinutes >= fallbackOpen || todayMinutes < fallbackClose,
      todayOpeningHour: params.openingHour ?? null,
      todayClosingHour: params.closingHour ?? null,
      isClosedDay: false,
    };
  }

  return {
    isOpen: true,
    todayOpeningHour: params.openingHour ?? null,
    todayClosingHour: params.closingHour ?? null,
    isClosedDay: false,
  };
}
