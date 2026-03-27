import type { TenantComparisonRow, TenantPerformanceLabel } from "@/modules/hq/server/analytics-types";

type TenantHealthInput = {
  lifecycleStatus: string;
  completedOrderCount: number;
  netRevenue: number;
  lastOrderAt: Date | null;
  medianOrders: number;
  medianRevenue: number;
  staleThresholdDate: Date;
};

function isRisky(input: TenantHealthInput): boolean {
  if (input.lifecycleStatus === "ACTIVE" && input.completedOrderCount <= 0) return true;
  if (input.lastOrderAt && input.lastOrderAt.getTime() < input.staleThresholdDate.getTime()) return true;
  return false;
}

function isStrong(input: TenantHealthInput): boolean {
  if (input.completedOrderCount <= 0 || input.netRevenue <= 0) return false;
  return input.completedOrderCount >= input.medianOrders && input.netRevenue >= input.medianRevenue;
}

export function resolvePerformanceLabel(input: TenantHealthInput): TenantPerformanceLabel {
  if (isRisky(input)) return "riskli";
  if (isStrong(input)) return "guclu";
  return "izlenmeli";
}

export function getPerformanceLabelText(label: TenantPerformanceLabel): string {
  if (label === "guclu") return "Güçlü";
  if (label === "riskli") return "Riskli";
  return "İzlenmeli";
}

export function getPerformanceLabelVariant(
  label: TenantPerformanceLabel,
): "success" | "warning" | "danger" {
  if (label === "guclu") return "success";
  if (label === "riskli") return "danger";
  return "warning";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function computeTrendSummary(counts: number[]): string {
  const left = counts.slice(0, Math.floor(counts.length / 2));
  const right = counts.slice(Math.floor(counts.length / 2));
  const leftTotal = left.reduce((sum, value) => sum + value, 0);
  const rightTotal = right.reduce((sum, value) => sum + value, 0);

  if (leftTotal === 0 && rightTotal === 0) return "Hareket yok";
  if (rightTotal > leftTotal) return "Yukarı yönlü";
  if (rightTotal < leftTotal) return "Aşağı yönlü";
  return "Dengeli";
}

export function enrichRowsWithHealth(params: {
  rows: Array<
    Omit<TenantComparisonRow, "performanceLabel" | "trendLast7Days"> & {
      trendLast7DaysCounts: number[];
    }
  >;
  staleThresholdDate: Date;
}): TenantComparisonRow[] {
  const medOrders = median(params.rows.map((row) => row.completedOrderCount));
  const medRevenue = median(params.rows.map((row) => row.netRevenue));

  return params.rows.map((row) => ({
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    slug: row.slug,
    lifecycleStatus: row.lifecycleStatus,
    planCode: row.planCode,
    planName: row.planName,
    restaurantsCount: row.restaurantsCount,
    completedOrderCount: row.completedOrderCount,
    netRevenue: row.netRevenue,
    averageBasket: row.averageBasket,
    lastOrderAt: row.lastOrderAt,
    trendLast7Days: {
      counts: row.trendLast7DaysCounts,
      summaryText: computeTrendSummary(row.trendLast7DaysCounts),
    },
    performanceLabel: resolvePerformanceLabel({
      lifecycleStatus: row.lifecycleStatus,
      completedOrderCount: row.completedOrderCount,
      netRevenue: row.netRevenue,
      lastOrderAt: row.lastOrderAt,
      medianOrders: medOrders,
      medianRevenue: medRevenue,
      staleThresholdDate: params.staleThresholdDate,
    }),
  }));
}

export function sortTenantRows(
  rows: TenantComparisonRow[],
  sortBy: "revenue" | "orders" | "lastActivity" | "name",
  direction: "asc" | "desc",
): TenantComparisonRow[] {
  const dir = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortBy === "revenue") return (a.netRevenue - b.netRevenue) * dir;
    if (sortBy === "orders") return (a.completedOrderCount - b.completedOrderCount) * dir;
    if (sortBy === "lastActivity") {
      const left = a.lastOrderAt?.getTime() ?? 0;
      const right = b.lastOrderAt?.getTime() ?? 0;
      return (left - right) * dir;
    }
    return a.tenantName.localeCompare(b.tenantName, "tr") * dir;
  });
}
