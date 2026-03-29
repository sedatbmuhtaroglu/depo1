"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatTryCurrency } from "@/lib/currency";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
} from "@/lib/ui/button-variants";

type ByMethod = { method: string; label: string; total: number; count: number };
type ByReason = { reason: string; label: string; count: number };
type ByPerformedBy = { name: string; count: number; quantity: number };
type TopProduct = { productId: number; name: string; quantity: number; revenue: number };
type IyzicoPaidOrder = {
  orderId: number;
  tableNo: number;
  createdAt: string;
  amount: number;
  itemSummary: string;
  refundStatus: "NONE" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED";
};

type DayEndReport = {
  date: string;
  completedOrderCount: number;
  longestDeliveryOrder: {
    orderId: number;
    tableNo: number;
    durationMinutes: number;
    completedAtIso: string;
  } | null;
  averageDeliveryMinutes: number | null;
  averagePreparationMinutes: number | null;
  averageWaiterResponseMinutes: number | null;
  averageOrderAmount: number | null;
  totalRevenue: number;
  cashRevenue: number;
  iyzicoRevenue: number;
  creditCardRevenue: number;
  sodexoRevenue: number;
  multinetRevenue: number;
  ticketRevenue: number;
  metropolRevenue: number;
  paymentMethodBreakdown: Array<{
    method: string;
    total: number;
    count: number;
  }>;
  waiterAverages: Array<{
    staffId: number;
    name: string;
    averageMinutes: number | null;
    sampleCount: number;
  }>;
  definitions: {
    longestDelivery: string;
    deliveryAverage: string;
    preparationAverage: string;
    waiterResponseAverage: string;
    revenueInclusion: string;
  };
};

const DAY_END_METHOD_LABELS: Record<string, string> = {
  CASH: "Nakit",
  IYZICO: "Online (Iyzico)",
  CREDIT_CARD: "Kredi Kartı",
  SODEXO: "Sodexo",
  MULTINET: "Multinet",
  TICKET: "Ticket",
  METROPOL: "Metropol",
};

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

const SECTION_CARD_CLASS = cardClasses({ className: "p-5 sm:p-6" });
const SECTION_CARD_COMPACT_CLASS = cardClasses({ className: "p-4 sm:p-5" });
const INPUT_CLASS = fieldClasses({ size: "md", className: "sm:min-w-40" });
const PRIMARY_BUTTON_CLASS = buttonClasses({
  variant: "primary",
  size: "md",
  className: "h-10 px-4",
});
const SECONDARY_BUTTON_CLASS = buttonClasses({
  variant: "secondary",
  size: "md",
  className: "h-10 px-4",
});
const QUICK_BUTTON_CLASS = buttonClasses({
  variant: "secondary",
  size: "sm",
  className: "h-9 px-3",
});

const TABLE_WRAP_CLASS =
  "overflow-x-auto rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)]";
const TABLE_CLASS = "min-w-full text-sm";
const TABLE_HEAD_ROW_CLASS = "border-b border-[color:var(--ui-border)]";
const TABLE_HEAD_CELL_CLASS =
  "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]";
const TABLE_ROW_CLASS =
  "border-b border-[color:var(--ui-border-subtle)] align-top transition-colors hover:bg-[color:var(--ui-surface-subtle)]";
const TABLE_CELL_CLASS = "px-3 py-3 text-[color:var(--ui-text-primary)]";

function formatMinutes(value: number | null): string {
  if (value == null) return "-";
  return `${value} dk`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateAndTime(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: "-", time: "-" };
  return {
    day: date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function refundStatusLabel(status: IyzicoPaidOrder["refundStatus"]): string {
  if (status === "REFUND_PENDING") return "İade bekliyor";
  if (status === "REFUNDED") return "İade tamamlandı";
  if (status === "REFUND_FAILED") return "İade başarısız";
  return "İade yok";
}

function refundStatusVariant(status: IyzicoPaidOrder["refundStatus"]): BadgeVariant {
  if (status === "REFUND_PENDING") return "warning";
  if (status === "REFUNDED") return "warning";
  if (status === "REFUND_FAILED") return "danger";
  return "success";
}

export default function ReportsView({
  day,
  dayEndReport,
  from,
  to,
  revenue,
  orderCount,
  averageOrderAmount,
  metricsScopeSummary,
  byMethod,
  byReason,
  byPerformedBy = [],
  topProducts = [],
  iyzicoPaidOrders = [],
  iyzicoOrdersWithRefundProcess = 0,
  iyzicoCancellationImpact = 0,
  totalRefundAmount = 0,
  operationalUnpaidDeliveredCancelAmount = 0,
  operationalUnpaidDeliveredCancelCount = 0,
  grossRevenueBeforeCashAdjustments = revenue,
  cashAdjustmentDeduction = 0,
  cashAdjustmentCount = 0,
}: {
  day: string;
  dayEndReport: DayEndReport;
  from: string;
  to: string;
  revenue: number;
  orderCount: number;
  averageOrderAmount: number | null;
  metricsScopeSummary: string;
  byMethod: ByMethod[];
  byReason: ByReason[];
  byPerformedBy?: ByPerformedBy[];
  topProducts?: TopProduct[];
  iyzicoPaidOrders?: IyzicoPaidOrder[];
  iyzicoOrdersWithRefundProcess?: number;
  iyzicoCancellationImpact?: number;
  totalRefundAmount?: number;
  operationalUnpaidDeliveredCancelAmount?: number;
  operationalUnpaidDeliveredCancelCount?: number;
  grossRevenueBeforeCashAdjustments?: number;
  cashAdjustmentDeduction?: number;
  cashAdjustmentCount?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, value);
    }
    router.push(`/restaurant/reports?${params.toString()}`);
  };

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fromInput = form.querySelector<HTMLInputElement>('[name="from"]');
    const toInput = form.querySelector<HTMLInputElement>('[name="to"]');
    if (fromInput?.value && toInput?.value) {
      const updates: Record<string, string> = { from: fromInput.value, to: toInput.value };
      if (fromInput.value === toInput.value) {
        updates.day = fromInput.value;
      }
      updateParams(updates);
    }
  };

  const handleDayEnd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const dayInput = form.querySelector<HTMLInputElement>('[name="day"]');
    if (!dayInput?.value) return;

    updateParams({
      day: dayInput.value,
      from: dayInput.value,
      to: dayInput.value,
    });
  };

  const toTurkeyDateInputValue = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);

  const setQuickRange = (fromDate: Date, toDate: Date) => {
    updateParams({
      from: toTurkeyDateInputValue(fromDate),
      to: toTurkeyDateInputValue(toDate),
    });
  };

  const today = new Date();

  const startOfDay = (date: Date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  };

  const endOfDay = (date: Date) => {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
  };

  const startOfWeek = (date: Date) => {
    const value = new Date(date);
    const dayOfWeek = value.getDay();
    const diff = value.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    value.setDate(diff);
    value.setHours(0, 0, 0, 0);
    return value;
  };

  const endOfWeek = (date: Date) => {
    const start = startOfWeek(date);
    const value = new Date(start);
    value.setDate(value.getDate() + 6);
    value.setHours(23, 59, 59, 999);
    return value;
  };

  const startOfMonth = (date: Date) => {
    const value = new Date(date);
    value.setDate(1);
    value.setHours(0, 0, 0, 0);
    return value;
  };

  const endOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  };

  const longestDeliveryText = dayEndReport.longestDeliveryOrder
    ? `Sipariş #${dayEndReport.longestDeliveryOrder.orderId} • Masa ${dayEndReport.longestDeliveryOrder.tableNo} • ${dayEndReport.longestDeliveryOrder.durationMinutes} dk • ${formatTime(dayEndReport.longestDeliveryOrder.completedAtIso)}`
    : "Veri yok";

  const downloadCsv = () => {
    const rows: string[] = [];
    rows.push("Rapor tarih aralığı");
    rows.push(`Başlangıç,${from}`);
    rows.push(`Bitiş,${to}`);
    rows.push("");
    rows.push("Gün sonu");
    rows.push(`Gün,${dayEndReport.date}`);
    rows.push(`En uzun teslim,${longestDeliveryText}`);
    rows.push(`Ortalama teslim,${formatMinutes(dayEndReport.averageDeliveryMinutes)}`);
    rows.push(`Ortalama hazırlama,${formatMinutes(dayEndReport.averagePreparationMinutes)}`);
    rows.push(`Garson yanıt ortalaması,${formatMinutes(dayEndReport.averageWaiterResponseMinutes)}`);
    rows.push(
      `Ortalama sipariş tutarı,${dayEndReport.averageOrderAmount != null ? dayEndReport.averageOrderAmount.toFixed(2) : "-"}`,
    );
    rows.push(`Toplam ciro,${dayEndReport.totalRevenue.toFixed(2)}`);
    rows.push(`Nakit ciro,${dayEndReport.cashRevenue.toFixed(2)}`);
    rows.push(`Online ciro,${dayEndReport.iyzicoRevenue.toFixed(2)}`);
    rows.push(`Kart ciro,${dayEndReport.creditCardRevenue.toFixed(2)}`);
    rows.push(`Sodexo ciro,${dayEndReport.sodexoRevenue.toFixed(2)}`);
    rows.push(`Multinet ciro,${dayEndReport.multinetRevenue.toFixed(2)}`);
    rows.push(`Ticket ciro,${dayEndReport.ticketRevenue.toFixed(2)}`);
    rows.push(`Metropol ciro,${dayEndReport.metropolRevenue.toFixed(2)}`);
    rows.push("");
    rows.push("Donem ozeti");
    rows.push(`Toplam tahsilat,${revenue.toFixed(2)}`);
    rows.push(`Tamamlanan sipariş sayisi,${orderCount}`);
    rows.push(
      `Ortalama sipariş tutarı,${averageOrderAmount != null ? averageOrderAmount.toFixed(2) : "-"}`,
    );

    const csv = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rapor_${from}_${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Gün sonu operasyon özeti
            </p>
            <h3 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Gün sonu raporu</h3>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">Seçili gün: {dayEndReport.date}</p>
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-end gap-2.5 xl:w-auto">
            <form
              onSubmit={handleDayEnd}
              className="flex w-full min-w-0 flex-wrap items-end gap-2.5 xl:w-auto"
            >
              <div className="min-w-0 flex-1 sm:flex-none">
                <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Gün</label>
                <input type="date" name="day" defaultValue={day} className={INPUT_CLASS} />
              </div>
              <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}>
                Gün sonu al
              </button>
            </form>
            <a
              href={`/restaurant/reports/day-end-pdf?day=${encodeURIComponent(dayEndReport.date)}`}
              target="_blank"
              rel="noreferrer"
              className={`${SECONDARY_BUTTON_CLASS} w-full sm:w-auto`}
            >
              PDF görüntüle
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Günluk net ciro"
            value={formatTryCurrency(dayEndReport.totalRevenue)}
            tone="success"
            className="xl:col-span-2"
            valueClassName="text-2xl"
            note="Tahsil edilen ödemelere göre hesaplanır."
          />

          <MetricCard
            label="Ort. teslim süresi"
            value={formatMinutes(dayEndReport.averageDeliveryMinutes)}
            valueClassName="text-xl"
          />

          <MetricCard
            label="Ort. hazırlama süresi"
            value={formatMinutes(dayEndReport.averagePreparationMinutes)}
            valueClassName="text-xl"
          />

          <MetricCard
            label="En uzun teslim"
            value={longestDeliveryText}
            className="xl:col-span-2"
            valueClassName="text-sm"
          />

          <MetricCard
            label="Garson yanıt ort."
            value={formatMinutes(dayEndReport.averageWaiterResponseMinutes)}
            valueClassName="text-xl"
          />

          <MetricCard
            label="Ort. sipariş tutarı"
            value={
              dayEndReport.averageOrderAmount == null
                ? "-"
                : formatTryCurrency(dayEndReport.averageOrderAmount)
            }
            valueClassName="text-xl"
          />

          <MetricCard label="Nakit ciro" value={formatTryCurrency(dayEndReport.cashRevenue)} />
          <MetricCard label="Online ciro" value={formatTryCurrency(dayEndReport.iyzicoRevenue)} />
          <MetricCard label="Kart ciro" value={formatTryCurrency(dayEndReport.creditCardRevenue)} />
          <MetricCard label="Sodexo" value={formatTryCurrency(dayEndReport.sodexoRevenue)} />
          <MetricCard label="Multinet" value={formatTryCurrency(dayEndReport.multinetRevenue)} />
          <MetricCard label="Ticket" value={formatTryCurrency(dayEndReport.ticketRevenue)} />
          <MetricCard label="Metropol" value={formatTryCurrency(dayEndReport.metropolRevenue)} />
        </div>

        {dayEndReport.waiterAverages.length > 0 && (
          <div className={`${cardClasses({ tone: "subtle", className: "mt-5 p-4" })}`}>
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Garson bazlı ortalama yanıt süresi
              </h4>
            </div>
            <div className={TABLE_WRAP_CLASS}>
              <table className={TABLE_CLASS}>
                <thead className="bg-[color:var(--ui-surface-subtle)]">
                  <tr className={TABLE_HEAD_ROW_CLASS}>
                    <th className={TABLE_HEAD_CELL_CLASS}>Personel</th>
                    <th className={TABLE_HEAD_CELL_CLASS}>Ortalama</th>
                    <th className={TABLE_HEAD_CELL_CLASS}>Örnek</th>
                  </tr>
                </thead>
                <tbody>
                  {dayEndReport.waiterAverages.map((row) => (
                    <tr key={row.staffId} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_CELL_CLASS}>
                        <p className="max-w-64 truncate" title={row.name}>
                          {row.name}
                        </p>
                      </td>
                      <td className={TABLE_CELL_CLASS}>{formatMinutes(row.averageMinutes)}</td>
                      <td className={TABLE_CELL_CLASS}>{row.sampleCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className={`${cardClasses({ tone: "subtle", className: "mt-5 p-4" })}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
            Metrik notları
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--ui-text-secondary)]">
            <li>{dayEndReport.definitions.longestDelivery}</li>
            <li>{dayEndReport.definitions.deliveryAverage}</li>
            <li>{dayEndReport.definitions.preparationAverage}</li>
            <li>{dayEndReport.definitions.waiterResponseAverage}</li>
            <li>{dayEndReport.definitions.revenueInclusion}</li>
          </ul>
          <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)]">
            <table className="min-w-full text-xs">
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className="border-b border-[color:var(--ui-border)]">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Yöntem
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Adet
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Tutar
                  </th>
                </tr>
              </thead>
              <tbody>
                {dayEndReport.paymentMethodBreakdown.map((row) => (
                  <tr key={row.method} className="border-b border-[color:var(--ui-border-subtle)]">
                    <td className="px-3 py-2 text-[color:var(--ui-text-primary)]">
                      {DAY_END_METHOD_LABELS[row.method] ?? row.method}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--ui-text-primary)]">{row.count}</td>
                    <td className="px-3 py-2 font-semibold text-[color:var(--ui-text-primary)]">
                      {formatTryCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={SECTION_CARD_COMPACT_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Dönem rapor filtreleri</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Tarih aralığını seçip özet ve tabloları yenileyin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickRange(startOfDay(today), endOfDay(today))}
              className={QUICK_BUTTON_CLASS}
            >
              Bugün
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(startOfWeek(today), endOfWeek(today))}
              className={QUICK_BUTTON_CLASS}
            >
              Bu hafta
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(startOfMonth(today), endOfMonth(today))}
              className={QUICK_BUTTON_CLASS}
            >
              Bu ay
            </button>
          </div>
        </div>

        <form onSubmit={handleFilter} className="mt-4 flex min-w-0 flex-wrap items-end gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Başlangıç</label>
            <input type="date" name="from" defaultValue={from} className={INPUT_CLASS} />
          </div>

          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Bitiş</label>
            <input type="date" name="to" defaultValue={to} className={INPUT_CLASS} />
          </div>

          <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}>
            Uygula
          </button>

          <button type="button" onClick={downloadCsv} className={`${SECONDARY_BUTTON_CLASS} w-full sm:w-auto`}>
            CSV indir
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className={`${SECONDARY_BUTTON_CLASS} w-full sm:w-auto`}
          >
            Yazdır
          </button>
        </form>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Dönem finansal özet</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{metricsScopeSummary}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Brüt ciro"
            value={formatTryCurrency(grossRevenueBeforeCashAdjustments)}
            valueClassName="text-2xl"
          />
          <MetricCard label="İade tutarı" value={formatTryCurrency(totalRefundAmount)} tone="danger" valueClassName="text-2xl" />
          <MetricCard label="Net ciro" value={formatTryCurrency(revenue)} tone="success" valueClassName="text-2xl" />
          <MetricCard label="Tamamlanan sipariş" value={String(orderCount)} valueClassName="text-2xl" />
          <MetricCard
            label="Ort. sipariş tutarı"
            value={averageOrderAmount == null ? "-" : formatTryCurrency(averageOrderAmount)}
            valueClassName="text-2xl"
          />
        </div>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Nakit düzeltme etkisi</h3>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
            Nakit kısmı iptal/iade kayıtlarının ciroya etkisi.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Brüt satış" value={formatTryCurrency(grossRevenueBeforeCashAdjustments)} />
          <MetricCard label="Nakit düşüm" value={formatTryCurrency(cashAdjustmentDeduction)} tone="danger" />
          <MetricCard label="Net satış" value={formatTryCurrency(revenue)} tone="success" />
        </div>
        <p className="mt-3 text-xs text-[color:var(--ui-text-secondary)]">
          Bu aralikta {cashAdjustmentCount} adet nakit düzeltme kaydı bulundu.
        </p>
      </section>

      {byMethod.length > 0 && (
        <section className={SECTION_CARD_CLASS}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Ödeme yöntemine göre dağılım</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Yöntem bazlı adet ve tutar özeti.</p>
          </div>
          <div className={TABLE_WRAP_CLASS}>
            <table className={TABLE_CLASS}>
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CELL_CLASS}>Yöntem</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Adet</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map((row) => (
                  <tr key={row.method} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="max-w-80 whitespace-normal break-words">{row.label}</p>
                    </td>
                    <td className={TABLE_CELL_CLASS}>{row.count}</td>
                    <td className={`${TABLE_CELL_CLASS} font-semibold`}>{formatTryCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {iyzicoCancellationImpact > 0 && (
            <p className="mt-3 text-xs text-[color:var(--ui-danger)]">
              Finansal iade etkisi nedeniyle net cirodan {formatTryCurrency(iyzicoCancellationImpact)} düşüldü.
            </p>
          )}
          {operationalUnpaidDeliveredCancelCount > 0 && (
            <p className="mt-2 text-xs text-[color:var(--ui-warning)]">
              Ödenmemiş + teslim edilmiş iptal kaydı: {operationalUnpaidDeliveredCancelCount} adet, toplam{" "}
              {formatTryCurrency(operationalUnpaidDeliveredCancelAmount)}. Bu tutar cirodan düşülmez.
            </p>
          )}
          <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
            Sonra öde seçimi tahsilat değildir; ödeme alındığında ilgili yönteme yazılır.
          </p>
        </section>
      )}

      {iyzicoPaidOrders.length > 0 && (
        <section className={SECTION_CARD_CLASS}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Online ödeme siparişleri</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Tahsilat ve iade süreci görünümü.</p>
          </div>
          <div className={TABLE_WRAP_CLASS}>
            <table className={TABLE_CLASS}>
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CELL_CLASS}>Siparis</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Masa</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Ürünler</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Tarih / Saat</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>İade durumu</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {iyzicoPaidOrders.map((row) => {
                  const dateCell = formatDateAndTime(row.createdAt);
                  return (
                    <tr key={row.orderId} className={TABLE_ROW_CLASS}>
                      <td className={`${TABLE_CELL_CLASS} font-semibold`}>#{row.orderId}</td>
                      <td className={TABLE_CELL_CLASS}>Masa {row.tableNo}</td>
                      <td className={TABLE_CELL_CLASS}>
                        <p className="max-w-96 whitespace-normal break-words">{row.itemSummary || "-"}</p>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <p className="font-medium text-[color:var(--ui-text-primary)]">{dateCell.day}</p>
                        <p className="text-xs text-[color:var(--ui-text-secondary)]">{dateCell.time}</p>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <span className={badgeClasses(refundStatusVariant(row.refundStatus))}>
                          {refundStatusLabel(row.refundStatus)}
                        </span>
                      </td>
                      <td className={`${TABLE_CELL_CLASS} font-semibold`}>{formatTryCurrency(row.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {iyzicoOrdersWithRefundProcess > 0 && (
            <p className="mt-3 text-xs text-[color:var(--ui-text-secondary)]">
              Bu aralikta {iyzicoOrdersWithRefundProcess} siparişte iade süreci kaydı bulundu.
            </p>
          )}
        </section>
      )}

      {topProducts.length > 0 && (
        <section className={SECTION_CARD_CLASS}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">En çok satan ürünler</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Ürün bazlı adet ve ciro dağılımı.</p>
          </div>
          <div className={TABLE_WRAP_CLASS}>
            <table className={TABLE_CLASS}>
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CELL_CLASS}>Ürün</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Adet</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Ciro</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((row) => (
                  <tr key={row.productId} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="max-w-64 truncate" title={row.name}>
                        {row.name}
                      </p>
                    </td>
                    <td className={TABLE_CELL_CLASS}>{row.quantity}</td>
                    <td className={`${TABLE_CELL_CLASS} font-semibold`}>{formatTryCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {byReason.length > 0 && (
        <section className={SECTION_CARD_CLASS}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">İptal nedenleri</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Neden bazlı iptal adet dağılımı.</p>
          </div>
          <div className={TABLE_WRAP_CLASS}>
            <table className={TABLE_CLASS}>
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CELL_CLASS}>Neden</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Adet</th>
                </tr>
              </thead>
              <tbody>
                {byReason.map((row) => (
                  <tr key={row.reason} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="max-w-80 whitespace-normal break-words">{row.label}</p>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} font-semibold`}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {byPerformedBy.length > 0 && (
        <section className={SECTION_CARD_CLASS}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">İptal yapan personel</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Personel bazlı iptal kaydı ve adet özetleri.</p>
          </div>
          <div className={TABLE_WRAP_CLASS}>
            <table className={TABLE_CLASS}>
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CELL_CLASS}>Kişi</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>İptal kaydı</th>
                  <th className={TABLE_HEAD_CELL_CLASS}>Toplam adet</th>
                </tr>
              </thead>
              <tbody>
                {byPerformedBy.map((row) => (
                  <tr key={row.name} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="max-w-64 truncate" title={row.name}>
                        {row.name}
                      </p>
                    </td>
                    <td className={TABLE_CELL_CLASS}>{row.count}</td>
                    <td className={`${TABLE_CELL_CLASS} font-semibold`}>{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {byMethod.length === 0 &&
        byReason.length === 0 &&
        byPerformedBy.length === 0 &&
        topProducts.length === 0 &&
        revenue === 0 &&
        orderCount === 0 && (
          <section className={cardClasses({ tone: "subtle", className: "p-8" })}>
            <p className="text-center text-sm text-[color:var(--ui-text-secondary)]">
              Seçilen tarih aralığında raporlanacak veri yok.
            </p>
          </section>
        )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
  note,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  note?: string;
  className?: string;
  valueClassName?: string;
}) {
  const cardTone =
    tone === "success"
      ? "success"
      : tone === "warning"
        ? "warning"
        : tone === "danger"
          ? "danger"
          : tone === "info"
            ? "subtle"
            : "default";

  const valueToneClass =
    tone === "success"
      ? "text-[color:var(--ui-success)]"
      : tone === "warning"
        ? "text-[color:var(--ui-warning)]"
        : tone === "danger"
          ? "text-[color:var(--ui-danger)]"
          : tone === "info"
            ? "text-[color:var(--ui-info)]"
            : "text-[color:var(--ui-text-primary)]";

  return (
    <article className={cardClasses({ tone: cardTone, className: `p-3.5 ${className ?? ""}` })}>
      <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">{label}</p>
      <p className={`mt-2 font-semibold ${valueClassName ?? "text-lg"} ${valueToneClass}`}>{value}</p>
      {note ? <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">{note}</p> : null}
    </article>
  );
}
