"use client";

import { useCallback, useMemo, useState } from "react";
import type { Weekday } from "@prisma/client";
import { fieldClasses } from "@/lib/ui/button-variants";
import {
  STAFF_WEEKDAYS_ORDERED,
  summarizeWeeklyScheduleCompact,
  type WeeklyShiftDayEntry,
} from "@/lib/weekly-shift-schedule";
import { STAFF_WEEKDAY_LABEL_TR } from "@/lib/staff-availability";

const INPUT_CLASS = fieldClasses({ size: "md" });

const ROW_BTN =
  "flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-[#111827] transition-colors hover:bg-[#FAFBFD]";

const PANEL_CLASS = "border-t border-[#EEF1F4] bg-[#F8FAFC] px-3 py-3";

type Props = {
  value: WeeklyShiftDayEntry[];
  onChange: (next: WeeklyShiftDayEntry[]) => void;
  disabled?: boolean;
  /** Modal içinde: daha kompakt satırlar + gün listesi için sınırlı yükseklik + iç scroll */
  variant?: "default" | "modal";
};

function cloneDay(from: WeeklyShiftDayEntry, toDay: Weekday): WeeklyShiftDayEntry {
  return {
    dayOfWeek: toDay,
    enabled: from.enabled,
    startTime: from.startTime,
    endTime: from.endTime,
  };
}

export default function WeeklyShiftEditor({ value, onChange, disabled, variant = "default" }: Props) {
  const isModal = variant === "modal";
  const [openDay, setOpenDay] = useState<Weekday | null>(null);

  const summary = useMemo(() => summarizeWeeklyScheduleCompact(value), [value]);

  const updateDay = useCallback(
    (day: Weekday, patch: Partial<WeeklyShiftDayEntry>) => {
      onChange(
        value.map((row) =>
          row.dayOfWeek === day ? { ...row, ...patch, dayOfWeek: day } : row,
        ),
      );
    },
    [onChange, value],
  );

  const applyMondayToAll = useCallback(() => {
    const mon = value.find((r) => r.dayOfWeek === "MONDAY");
    if (!mon) return;
    onChange(value.map((row) => cloneDay(mon, row.dayOfWeek)));
  }, [onChange, value]);

  const applyMondayToWeekdays = useCallback(() => {
    const mon = value.find((r) => r.dayOfWeek === "MONDAY");
    if (!mon) return;
    const weekdays: Weekday[] = ["TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    onChange(
      value.map((row) =>
        weekdays.includes(row.dayOfWeek) ? cloneDay(mon, row.dayOfWeek) : row,
      ),
    );
  }, [onChange, value]);

  return (
    <div className={isModal ? "space-y-2" : "space-y-3"}>
      <div
        className={
          isModal
            ? "rounded-md border border-[#E8EBF0] bg-[#F8FAFC] p-2.5"
            : "rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 shadow-sm"
        }
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
          Haftalık özet
        </p>
        <p className="mt-0.5 text-xs font-medium leading-snug text-[#111827] sm:text-sm">
          {summary}
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={applyMondayToWeekdays}
          className="rounded-lg border border-[#D0D8E4] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#374151] shadow-sm transition hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          Pzt → Pzt–Cum
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={applyMondayToAll}
          className="rounded-lg border border-[#D0D8E4] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#374151] shadow-sm transition hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          Pzt → tüm günlere
        </button>
      </div>

      <div
        className={
          isModal
            ? "max-h-[min(38vh,240px)] min-h-0 divide-y divide-[#EEF1F4] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border border-[#E5E7EB] sm:max-h-[min(42vh,280px)]"
            : "divide-y divide-[#EEF1F4] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
        }
      >
        {STAFF_WEEKDAYS_ORDERED.map((day) => {
          const row = value.find((r) => r.dayOfWeek === day)!;
          const isOpen = openDay === day;
          const short = STAFF_WEEKDAY_LABEL_TR[day];
          const status = !row.enabled
            ? "Kapalı"
            : row.startTime && row.endTime
              ? `${row.startTime} – ${row.endTime}`
              : "Saat eksik";

          return (
            <div key={day} className="bg-[#FFFFFF]">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setOpenDay(isOpen ? null : day)}
                className={ROW_BTN}
                aria-expanded={isOpen}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-[#111827]">
                    {short}
                  </span>
                  <span className="min-w-0 truncate text-[11px] text-[#6B7280] sm:text-xs">
                    {status}
                  </span>
                </span>
                <span className="shrink-0 text-[#9CA3AF] p-1">
                  {isOpen ? "▴" : "▾"}
                </span>
              </button>
              {isOpen ? (
                <div className={PANEL_CLASS}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#111827]">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={disabled}
                      onChange={(e) => {
                        const en = e.target.checked;
                        updateDay(day, {
                          enabled: en,
                          startTime: en ? row.startTime ?? "09:00" : null,
                          endTime: en ? row.endTime ?? "18:00" : null,
                        });
                      }}
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#223356] focus:ring-[#223356]"
                    />
                    Bu gün çalışıyor
                  </label>
                  {row.enabled ? (
                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <label className="mb-0.5 block text-[10px] font-medium text-[#6B7280]">
                          Başlangıç
                        </label>
                        <input
                          type="time"
                          value={row.startTime ?? ""}
                          disabled={disabled}
                          onChange={(e) => updateDay(day, { startTime: e.target.value || null })}
                          className={`${INPUT_CLASS} w-full`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="mb-0.5 block text-[10px] font-medium text-[#6B7280]">
                          Bitiş
                        </label>
                        <input
                          type="time"
                          value={row.endTime ?? ""}
                          disabled={disabled}
                          onChange={(e) => updateDay(day, { endTime: e.target.value || null })}
                          className={`${INPUT_CLASS} w-full`}
                        />
                      </div>
                    </div>
                  ) : null}
                  <p
                    className={
                      isModal
                        ? "mt-1.5 text-[10px] leading-snug text-[#6B7280]"
                        : "mt-2 text-[11px] text-[#6B7280]"
                    }
                  >
                    Gece vardiyası: bitiş başlangıçtan küçük olabilir (ör. 22:00 → 02:00).
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
