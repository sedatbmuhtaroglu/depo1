import type { TenantLifecycleStatus } from "@/core/tenancy/lifecycle-policy";

export type AnalyticsDatePreset = "today" | "last_7_days" | "last_30_days" | "this_month" | "custom";
export type AnalyticsStatusFilter = "ALL" | "ACTIVE" | "TRIAL" | "SUSPENDED";
export type AnalyticsSortKey = "revenue" | "orders" | "lastActivity" | "name";
export type AnalyticsSortDirection = "asc" | "desc";

export type AnalyticsFilters = {
  datePreset: AnalyticsDatePreset;
  fromDate: string;
  toDate: string;
  search: string;
  status: AnalyticsStatusFilter;
  planCode: string;
  sortBy: AnalyticsSortKey;
  sortDirection: AnalyticsSortDirection;
};

export type TenantPerformanceLabel = "guclu" | "izlenmeli" | "riskli";

export type TenantComparisonRow = {
  tenantId: number;
  tenantName: string;
  slug: string;
  lifecycleStatus: TenantLifecycleStatus;
  planCode: string;
  planName: string;
  restaurantsCount: number;
  completedOrderCount: number;
  netRevenue: number;
  averageBasket: number | null;
  lastOrderAt: Date | null;
  trendLast7Days: {
    counts: number[];
    summaryText: string;
  };
  performanceLabel: TenantPerformanceLabel;
};

export type AnalyticsKpi = {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  totalOrders: number;
  totalRevenue: number;
  averageOrdersPerTenant: number;
  averageRevenuePerTenant: number;
  zeroOrderTenantCount: number;
  topRevenueTenantName: string | null;
  lowestPerformanceTenantName: string | null;
};

export type AnalyticsTrendPoint = {
  date: string;
  orders: number;
  revenue: number;
};

export type AnalyticsInsight = {
  id: string;
  title: string;
  description: string;
  tenantRefs: Array<{ tenantId: number; tenantName: string }>;
};

export type HqAnalyticsData = {
  filters: AnalyticsFilters;
  availablePlans: Array<{ code: string; name: string }>;
  kpi: AnalyticsKpi;
  tableRows: TenantComparisonRow[];
  trend: AnalyticsTrendPoint[];
  insights: AnalyticsInsight[];
};
