import type { Weekday } from "@prisma/client";

const SHIFT_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseShiftMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!SHIFT_TIME_PATTERN.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

export const STAFF_WEEKDAYS_ORDERED: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const STAFF_WEEKDAY_LABEL_TR: Record<Weekday, string> = {
  MONDAY: "Pzt",
  TUESDAY: "Sal",
  WEDNESDAY: "Çar",
  THURSDAY: "Per",
  FRIDAY: "Cum",
  SATURDAY: "Cmt",
  SUNDAY: "Paz",
};

export type WeeklyShiftDayEntry = {
  dayOfWeek: Weekday;
  /** false = kapalı / çalışmıyor */
  enabled: boolean;
  /** HH:MM — kapalı günlerde null */
  startTime: string | null;
  endTime: string | null;
};

export function createEmptyWeeklySchedule(): WeeklyShiftDayEntry[] {
  return STAFF_WEEKDAYS_ORDERED.map((day) => ({
    dayOfWeek: day,
    enabled: false,
    startTime: null,
    endTime: null,
  }));
}

/** Eski workingDays + tek vardiya → haftalık satırlar (aynı saat tüm çalışma günlerine). */
export function weeklyFromLegacy(params: {
  workingDays: Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
}): WeeklyShiftDayEntry[] {
  const unique = [...new Set(params.workingDays)];
  return STAFF_WEEKDAYS_ORDERED.map((day) => {
    const enabled = unique.includes(day);
    return {
      dayOfWeek: day,
      enabled,
      startTime: enabled ? params.shiftStart : null,
      endTime: enabled ? params.shiftEnd : null,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** DB JSON veya bilinmeyen → güvenli haftalık program; geçersizse legacy fallback. */
export function parseWeeklyShiftSchedule(
  raw: unknown,
  legacy: { workingDays: Weekday[]; shiftStart: string | null; shiftEnd: string | null },
): WeeklyShiftDayEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return weeklyFromLegacy(legacy);
  }
  const byDay = new Map<Weekday, WeeklyShiftDayEntry>();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const day = item.dayOfWeek;
    if (typeof day !== "string" || !STAFF_WEEKDAYS_ORDERED.includes(day as Weekday)) continue;
    const enabled = Boolean(item.enabled);
    const startTime = typeof item.startTime === "string" ? item.startTime.trim() || null : null;
    const endTime = typeof item.endTime === "string" ? item.endTime.trim() || null : null;
    byDay.set(day as Weekday, {
      dayOfWeek: day as Weekday,
      enabled,
      startTime,
      endTime,
    });
  }
  if (byDay.size === 0) {
    return weeklyFromLegacy(legacy);
  }
  return STAFF_WEEKDAYS_ORDERED.map((day) => {
    const found = byDay.get(day);
    if (found) return found;
    return { dayOfWeek: day, enabled: false, startTime: null, endTime: null };
  });
}

function timesValidAndOrdered(start: string, end: string): boolean {
  const s = parseShiftMinutes(start);
  const e = parseShiftMinutes(end);
  if (s == null || e == null) return false;
  if (s === e) return false;
  return true;
}

/**
 * Kayıt öncesi doğrulama: kapalı günlerde saat zorunlu değil; açık günlerde HH:MM ve aralık geçerli olmalı.
 * Gece vardiyası: end < start kabul edilir.
 */
export function validateWeeklyShiftScheduleInput(
  entries: WeeklyShiftDayEntry[],
): { ok: true } | { ok: false; message: string } {
  if (entries.length !== 7) {
    return { ok: false, message: "Haftalık program 7 gün içermelidir." };
  }
  const seen = new Set<Weekday>();
  for (const e of entries) {
    if (seen.has(e.dayOfWeek)) {
      return { ok: false, message: "Yinelenen gün satırı var." };
    }
    seen.add(e.dayOfWeek);
  }
  if (seen.size !== 7) {
    return { ok: false, message: "Eksik gün satırı var." };
  }

  let anyEnabled = false;
  for (const e of entries) {
    if (!e.enabled) {
      continue;
    }
    anyEnabled = true;
    const start = e.startTime?.trim() ?? "";
    const end = e.endTime?.trim() ?? "";
    if (!start || !end) {
      return { ok: false, message: "Açık günlerde başlangıç ve bitiş saati zorunludur." };
    }
    if (!SHIFT_TIME_PATTERN.test(start) || !SHIFT_TIME_PATTERN.test(end)) {
      return { ok: false, message: "Saat formatı HH:MM olmalıdır." };
    }
    if (!timesValidAndOrdered(start, end)) {
      return {
        ok: false,
        message:
          "Başlangıç ve bitiş farklı olmalıdır. Aynı gün içinde bitiş başlangıçtan sonra olmalı; gece vardiyasında bitiş ertesi güne taşınır (ör. 22:00–02:00).",
      };
    }
  }

  if (!anyEnabled) {
    return { ok: true };
  }
  return { ok: true };
}

/** Kayıt için legacy kolonları doldur: tüm açık günler aynı saatlere sahipse shiftStart/shiftEnd + workingDays; değilse null. */
export function deriveLegacyFieldsFromWeekly(entries: WeeklyShiftDayEntry[]): {
  workingDays: Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
} {
  const enabledRows = entries.filter((e) => e.enabled);
  if (enabledRows.length === 0) {
    return { workingDays: [], shiftStart: null, shiftEnd: null };
  }
  const first = enabledRows[0];
  const s = first.startTime?.trim() ?? "";
  const en = first.endTime?.trim() ?? "";
  const allSame =
    s &&
    en &&
    enabledRows.every(
      (r) => (r.startTime?.trim() ?? "") === s && (r.endTime?.trim() ?? "") === en,
    );
  return {
    workingDays: enabledRows.map((r) => r.dayOfWeek),
    shiftStart: allSame ? s : null,
    shiftEnd: allSame ? en : null,
  };
}

export function summarizeWeeklyScheduleCompact(entries: WeeklyShiftDayEntry[]): string {
  const enabled = entries.filter((e) => e.enabled);
  if (enabled.length === 0) return "Vardiya tanımlanmadı";
  const groups = new Map<string, Weekday[]>();
  for (const e of enabled) {
    const key = `${e.startTime ?? ""}-${e.endTime ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(e.dayOfWeek);
    groups.set(key, list);
  }
  if (groups.size === 1) {
    const e = enabled[0];
    const range =
      e.startTime && e.endTime
        ? `${e.startTime}–${e.endTime}`
        : "—";
    if (enabled.length === 7) return `Her gün ${range}`;
    return `${enabled.map((d) => STAFF_WEEKDAY_LABEL_TR[d.dayOfWeek]).join(", ")} · ${range}`;
  }
  const parts = enabled.map((e) => {
    const r = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : "—";
    return `${STAFF_WEEKDAY_LABEL_TR[e.dayOfWeek]} ${r}`;
  });
  return parts.slice(0, 3).join(" · ") + (parts.length > 3 ? "…" : "");
}
