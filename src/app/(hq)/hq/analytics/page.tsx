import Link from "next/link";
import { badgeClasses, cardClasses, fieldClasses, selectClasses } from "@/lib/ui/button-variants";
import { getHqAnalyticsData } from "@/modules/hq/server/analytics-queries";
import {
  getPerformanceLabelText,
  getPerformanceLabelVariant,
} from "@/modules/hq/server/analytics-health";
import type { AnalyticsSortKey } from "@/modules/hq/server/analytics-types";
import { LifecycleBadge } from "@/modules/hq/components/lifecycle-badge";

function formatCount(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatMoney(value: number): string {
  return `${formatDecimal(value)} TL`;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "Sipariş yok";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function buildSortHref(
  current: {
    range: string;
    from: string;
    to: string;
    status: string;
    plan: string;
    q: string;
    sort: string;
    dir: string;
  },
  key: AnalyticsSortKey,
): string {
  const params = new URLSearchParams({
    range: current.range,
    from: current.from,
    to: current.to,
    status: current.status,
    plan: current.plan,
    q: current.q,
    sort: key,
    dir: current.sort === key && current.dir === "desc" ? "asc" : "desc",
  });
  return `/hq/analytics?${params.toString()}`;
}

function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  const width = 128;
  const height = 42;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const polyline = points
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? "h-10 w-32"}>
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--ui-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendChart({
  title,
  dates,
  values,
  valueFormatter,
}: {
  title: string;
  dates: string[];
  values: number[];
  valueFormatter: (value: number) => string;
}) {
  const width = 760;
  const height = 220;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const latest = values[values.length - 1] ?? 0;

  return (
    <article className={cardClasses({ tone: "subtle", className: "p-4 shadow-none" })}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ui-text-primary)]">{title}</p>
        <span className="text-xs text-[var(--ui-text-secondary)]">Son değer: {valueFormatter(latest)}</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 min-w-[540px] w-full">
          <path d={path} fill="none" stroke="var(--ui-accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--ui-text-muted)]">
        <span>{dates[0]}</span>
        <span>-</span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </article>
  );
}

export default async function HqAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    status?: string;
    plan?: string;
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getHqAnalyticsData(params);
  const current = {
    range: data.filters.datePreset,
    from: data.filters.fromDate,
    to: data.filters.toDate,
    status: data.filters.status,
    plan: data.filters.planCode,
    q: data.filters.search,
    sort: data.filters.sortBy,
    dir: data.filters.sortDirection,
  };

  const kpiCards = [
    { label: "Toplam Tenant", value: formatCount(data.kpi.totalTenants) },
    { label: "Aktif Tenant", value: formatCount(data.kpi.activeTenants) },
    { label: "Trial Tenant", value: formatCount(data.kpi.trialTenants) },
    { label: "Toplam Sipariş", value: formatCount(data.kpi.totalOrders) },
    { label: "Toplam Ciro", value: formatMoney(data.kpi.totalRevenue) },
    { label: "Tenant başı ort. sipariş", value: formatDecimal(data.kpi.averageOrdersPerTenant) },
    { label: "Tenant başı ort. ciro", value: formatMoney(data.kpi.averageRevenuePerTenant) },
    { label: "Sipariş olmayan tenant", value: formatCount(data.kpi.zeroOrderTenantCount) },
    { label: "En yüksek ciro", value: data.kpi.topRevenueTenantName ?? "-" },
    { label: "En düşük performans", value: data.kpi.lowestPerformanceTenantName ?? "-" },
  ];

  const trendDates = data.trend.map((point) => point.date);
  const trendOrders = data.trend.map((point) => point.orders);
  const trendRevenue = data.trend.map((point) => point.revenue);

  return (
    <div className="space-y-6">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Cross-Tenant Analytics</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Tenant performansını tek ekranda karşılaştırın, trendleri izleyin ve risk sinyallerini erken görün.
            </p>
          </div>
          <span className={badgeClasses("info")}>
            Aralık: {data.filters.fromDate} - {data.filters.toDate}
          </span>
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select name="range" defaultValue={data.filters.datePreset} className={selectClasses()}>
            <option value="today">Bugün</option>
            <option value="last_7_days">Son 7 gün</option>
            <option value="last_30_days">Son 30 gün</option>
            <option value="this_month">Bu ay</option>
            <option value="custom">Özel aralık</option>
          </select>
          <input type="date" name="from" defaultValue={data.filters.fromDate} className={fieldClasses()} />
          <input type="date" name="to" defaultValue={data.filters.toDate} className={fieldClasses()} />
          <select name="status" defaultValue={data.filters.status} className={selectClasses()}>
            <option value="ALL">Hepsi</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="TRIAL">TRIAL</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <select name="plan" defaultValue={data.filters.planCode} className={selectClasses()}>
            <option value="">Tüm planlar</option>
            {data.availablePlans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.code} - {plan.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            defaultValue={data.filters.search}
            placeholder="Tenant adı / slug ara"
            className={fieldClasses()}
          />
          <input type="hidden" name="sort" value={data.filters.sortBy} />
          <input type="hidden" name="dir" value={data.filters.sortDirection} />
          <button
            type="submit"
            className="rounded-xl bg-[var(--ui-accent)] px-4 py-2 text-sm font-semibold text-white xl:col-span-6"
          >
            Filtreleri uygula
          </button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <article key={card.label} className={cardClasses({ className: "p-3.5 shadow-none" })}>
            <p className="text-xs font-medium text-[var(--ui-text-secondary)]">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--ui-text-primary)]">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <article className={cardClasses({ className: "space-y-3 p-4" })}>
          <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Trend alanı</h3>
          <TrendChart
            title="Günlük toplam sipariş"
            dates={trendDates}
            values={trendOrders}
            valueFormatter={(value) => formatCount(value)}
          />
          <TrendChart
            title="Günlük toplam ciro"
            dates={trendDates}
            values={trendRevenue}
            valueFormatter={(value) => formatMoney(value)}
          />
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">İçgörü / Attention</h3>
          <div className="mt-3 space-y-2.5">
            {data.insights.map((insight) => (
              <section key={insight.id} className={cardClasses({ tone: "subtle", className: "p-3 shadow-none" })}>
                <p className="text-sm font-semibold text-[var(--ui-text-primary)]">{insight.title}</p>
                <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">{insight.description}</p>
                {insight.tenantRefs.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {insight.tenantRefs.map((tenant) => (
                      <Link
                        key={tenant.tenantId}
                        href={`/hq/tenants/${tenant.tenantId}`}
                        className="rounded-full border border-[var(--ui-border)] px-2 py-0.5 text-xs text-[var(--ui-text-secondary)] hover:text-[var(--ui-accent)]"
                      >
                        {tenant.tenantName}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--ui-border)] px-4 py-3">
          <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Tenant karşılaştırma tablosu</h3>
          <span className="text-xs text-[var(--ui-text-secondary)]">{formatCount(data.tableRows.length)} tenant</span>
        </div>
        {data.tableRows.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">
            Bu filtre kombinasyonunda gösterilecek tenant bulunamadı.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">
                    <Link href={buildSortHref(current, "name")} className="hover:text-[var(--ui-text-primary)]">
                      Tenant
                    </Link>
                  </th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Restoran</th>
                  <th className="px-4 py-3">
                    <Link href={buildSortHref(current, "orders")} className="hover:text-[var(--ui-text-primary)]">
                      Sipariş
                    </Link>
                  </th>
                  <th className="px-4 py-3">
                    <Link href={buildSortHref(current, "revenue")} className="hover:text-[var(--ui-text-primary)]">
                      Ciro
                    </Link>
                  </th>
                  <th className="px-4 py-3">Ort. sepet</th>
                  <th className="px-4 py-3">
                    <Link href={buildSortHref(current, "lastActivity")} className="hover:text-[var(--ui-text-primary)]">
                      Son sipariş
                    </Link>
                  </th>
                  <th className="px-4 py-3">Son 7 gün trend</th>
                  <th className="px-4 py-3">Durum etiketi</th>
                </tr>
              </thead>
              <tbody>
                {data.tableRows.map((row) => (
                  <tr key={row.tenantId} className="border-b border-[var(--ui-border)]/70 align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/hq/tenants/${row.tenantId}`}
                        className="font-semibold text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)]"
                      >
                        {row.tenantName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--ui-text-secondary)]">{row.slug}</td>
                    <td className="px-4 py-3">
                      <LifecycleBadge status={row.lifecycleStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--ui-text-primary)]">{row.planCode}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{row.planName}</p>
                    </td>
                    <td className="px-4 py-3">{formatCount(row.restaurantsCount)}</td>
                    <td className="px-4 py-3">{formatCount(row.completedOrderCount)}</td>
                    <td className="px-4 py-3">{formatMoney(row.netRevenue)}</td>
                    <td className="px-4 py-3">{row.averageBasket != null ? formatMoney(row.averageBasket) : "-"}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ui-text-secondary)]">{formatDateTime(row.lastOrderAt)}</td>
                    <td className="px-4 py-3">
                      <Sparkline points={row.trendLast7Days.counts} />
                      <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">{row.trendLast7Days.summaryText}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={badgeClasses(getPerformanceLabelVariant(row.performanceLabel))}>
                        {getPerformanceLabelText(row.performanceLabel)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
