export const TURKEY_TIMEZONE = "Europe/Istanbul";
export const TURKEY_UTC_OFFSET_MINUTES = 3 * 60;

const TURKEY_OFFSET_MS = TURKEY_UTC_OFFSET_MINUTES * 60 * 1000;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateString(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function toTurkeyShiftedDate(date: Date): Date {
  return new Date(date.getTime() + TURKEY_OFFSET_MS);
}

export function getTurkeyDateString(date: Date = new Date()): string {
  return toTurkeyShiftedDate(date).toISOString().slice(0, 10);
}

function createUtcFromTurkeyParts(parts: DateParts, endExclusive = false): Date {
  const utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day + (endExclusive ? 1 : 0),
    0,
    0,
    0,
    0,
  );
  return new Date(utc - TURKEY_OFFSET_MS);
}

export function getTurkeyDayRange(dateString?: string | null): {
  date: string;
  startUtc: Date;
  endUtc: Date;
} {
  const normalizedDate = dateString && parseDateString(dateString)
    ? dateString
    : getTurkeyDateString();
  const parts = parseDateString(normalizedDate);
  if (!parts) {
    const fallback = getTurkeyDateString();
    const fallbackParts = parseDateString(fallback)!;
    return {
      date: fallback,
      startUtc: createUtcFromTurkeyParts(fallbackParts, false),
      endUtc: createUtcFromTurkeyParts(fallbackParts, true),
    };
  }

  return {
    date: normalizedDate,
    startUtc: createUtcFromTurkeyParts(parts, false),
    endUtc: createUtcFromTurkeyParts(parts, true),
  };
}

export function getTurkeyCurrentMinutes(date: Date = new Date()): number {
  const shifted = toTurkeyShiftedDate(date);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function getTurkeyWeekdayIndex(date: Date = new Date()): number {
  const shifted = toTurkeyShiftedDate(date);
  return shifted.getUTCDay();
}
