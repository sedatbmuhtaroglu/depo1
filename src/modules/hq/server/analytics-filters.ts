import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";
import type {
  AnalyticsDatePreset,
  AnalyticsFilters,
  AnalyticsSortDirection,
  AnalyticsSortKey,
  AnalyticsStatusFilter,
} from "@/modules/hq/server/analytics-types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  if (!DATE_RE.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function shiftDate(value: string, days: number): string {
  const parts = parseDateParts(value);
  if (!parts) return value;
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day);
  return new Date(utc + days * DAY_MS).toISOString().slice(0, 10);
}

function startOfMonth(value: string): string {
  const parts = parseDateParts(value);
  if (!parts) return value;
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-01`;
}

function normalizeDatePreset(input: string | undefined): AnalyticsDatePreset {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "today") return "today";
  if (value === "last_7_days") return "last_7_days";
  if (value === "last_30_days") return "last_30_days";
  if (value === "this_month") return "this_month";
  if (value === "custom") return "custom";
  return "last_7_days";
}

function normalizeStatus(input: string | undefined): AnalyticsStatusFilter {
  const value = (input ?? "").trim().toUpperCase();
  if (value === "ACTIVE" || value === "TRIAL" || value === "SUSPENDED") return value;
  return "ALL";
}

function normalizeSortKey(input: string | undefined): AnalyticsSortKey {
  const value = (input ?? "").trim();
  if (value === "revenue" || value === "orders" || value === "lastActivity" || value === "name") {
    return value;
  }
  return "revenue";
}

function normalizeSortDirection(input: string | undefined): AnalyticsSortDirection {
  return (input ?? "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

export function resolveAnalyticsFilters(searchParams: {
  range?: string;
  from?: string;
  to?: string;
  status?: string;
  plan?: string;
  q?: string;
  sort?: string;
  dir?: string;
}): AnalyticsFilters {
  const today = getTurkeyDateString();
  const datePreset = normalizeDatePreset(searchParams.range);

  let fromDate = today;
  let toDate = today;

  if (datePreset === "last_7_days") {
    fromDate = shiftDate(today, -6);
  } else if (datePreset === "last_30_days") {
    fromDate = shiftDate(today, -29);
  } else if (datePreset === "this_month") {
    fromDate = startOfMonth(today);
  } else if (datePreset === "custom") {
    const from = searchParams.from && DATE_RE.test(searchParams.from) ? searchParams.from : today;
    const to = searchParams.to && DATE_RE.test(searchParams.to) ? searchParams.to : from;
    fromDate = from <= to ? from : to;
    toDate = from <= to ? to : from;
  }

  const verifiedFrom = getTurkeyDayRange(fromDate).date;
  const verifiedTo = getTurkeyDayRange(toDate).date;

  return {
    datePreset,
    fromDate: verifiedFrom <= verifiedTo ? verifiedFrom : verifiedTo,
    toDate: verifiedFrom <= verifiedTo ? verifiedTo : verifiedFrom,
    status: normalizeStatus(searchParams.status),
    planCode: (searchParams.plan ?? "").trim().toUpperCase(),
    search: (searchParams.q ?? "").trim(),
    sortBy: normalizeSortKey(searchParams.sort),
    sortDirection: normalizeSortDirection(searchParams.dir),
  };
}

export function buildLast7DaysDateKeys(endDate: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDate(endDate, -6 + index));
}

export function buildDateRangeKeys(fromDate: string, toDate: string): string[] {
  const keys: string[] = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    keys.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return keys;
}
