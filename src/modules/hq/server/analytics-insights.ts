import type { AnalyticsInsight, TenantComparisonRow } from "@/modules/hq/server/analytics-types";

type SetupSignal = {
  tenantId: number;
  setupCompleted: boolean;
  restaurantsCount: number;
};

function makeTenantRefs(rows: TenantComparisonRow[]) {
  return rows.slice(0, 5).map((row) => ({ tenantId: row.tenantId, tenantName: row.tenantName }));
}

export function buildAnalyticsInsights(params: {
  rows: TenantComparisonRow[];
  setupSignals: SetupSignal[];
  startDate: Date;
  endDate: Date;
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  const setupMap = new Map(params.setupSignals.map((signal) => [signal.tenantId, signal]));

  const activeNoOrders = params.rows.filter(
    (row) => row.lifecycleStatus === "ACTIVE" && row.completedOrderCount === 0,
  );
  if (activeNoOrders.length > 0) {
    insights.push({
      id: "active-no-orders",
      title: "Son 7 günde sipariş almayan aktif tenantlar",
      description: `${activeNoOrders.length} aktif tenant seçili pencerede sipariş üretmedi.`,
      tenantRefs: makeTenantRefs(activeNoOrders),
    });
  }

  const highActivityTrials = params.rows.filter(
    (row) => row.lifecycleStatus === "TRIAL" && row.completedOrderCount >= 15,
  );
  if (highActivityTrials.length > 0) {
    insights.push({
      id: "high-activity-trials",
      title: "Aktivitesi yüksek trial tenantlar",
      description: `${highActivityTrials.length} trial tenant yüksek sipariş hacmine ulaştı; dönüşüm için uygun.`,
      tenantRefs: makeTenantRefs(highActivityTrials),
    });
  }

  const staleActive = params.rows.filter(
    (row) =>
      row.lifecycleStatus === "ACTIVE" &&
      row.lastOrderAt &&
      row.lastOrderAt.getTime() < new Date(params.endDate.getTime() - 14 * 24 * 60 * 60 * 1000).getTime(),
  );
  if (staleActive.length > 0) {
    insights.push({
      id: "stale-active",
      title: "Aktif ama uzun süredir sipariş almayan tenantlar",
      description: `${staleActive.length} tenantın son siparişi 14 günden daha eski.`,
      tenantRefs: makeTenantRefs(staleActive),
    });
  }

  const growthCandidates = params.rows.filter(
    (row) =>
      row.trendLast7Days.counts.length >= 7 &&
      row.trendLast7Days.counts.slice(4).reduce((sum, v) => sum + v, 0) >
        row.trendLast7Days.counts.slice(0, 3).reduce((sum, v) => sum + v, 0),
  );
  if (growthCandidates.length > 0) {
    insights.push({
      id: "growth",
      title: "Ciro/sipariş ivmesi yükselen tenantlar",
      description: `${growthCandidates.length} tenant son günlerde artış trendi gösteriyor.`,
      tenantRefs: makeTenantRefs(growthCandidates),
    });
  }

  const lowUsageAfterSetup = params.rows.filter((row) => {
    const setup = setupMap.get(row.tenantId);
    if (!setup) return false;
    if (!setup.setupCompleted || setup.restaurantsCount <= 0) return false;
    return row.completedOrderCount <= 2 && row.netRevenue <= 1000;
  });
  if (lowUsageAfterSetup.length > 0) {
    insights.push({
      id: "low-usage-after-setup",
      title: "Kurulumu tamam ama kullanımı düşük tenantlar",
      description: `${lowUsageAfterSetup.length} tenant kurulum sonrası düşük kullanım gösteriyor.`,
      tenantRefs: makeTenantRefs(lowUsageAfterSetup),
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "steady-state",
      title: "Dikkat gerektiren sinyal bulunamadı",
      description: "Seçili aralıkta kritik eşiklere takılan tenant görünmüyor.",
      tenantRefs: [],
    });
  }

  return insights.slice(0, 5);
}
