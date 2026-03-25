import React from "react";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { getEndOfDayReportForTenant } from "@/lib/end-of-day-report";
import { getTurkeyDateString } from "@/lib/turkey-time";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatMinutes(value: number | null): string {
  if (value == null) return "-";
  return `${value} dk`;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Nakit",
  IYZICO: "Online (Iyzico)",
  CREDIT_CARD: "Kredi Kartı",
  SODEXO: "Sodexo",
  MULTINET: "Multinet",
  TICKET: "Ticket",
  METROPOL: "Metropol",
};

export default async function DayEndPdfPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { tenantId } = await getCurrentTenantOrThrow();
  const params = await searchParams;
  const day =
    params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
      ? params.day
      : getTurkeyDateString();

  const report = await getEndOfDayReportForTenant({
    tenantId,
    date: day,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white p-8 text-neutral-900 print:p-4">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-2xl font-bold">Gün Sonu Raporu</h1>
        <p className="mt-1 text-sm text-neutral-600">Tarih: {report.date}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Net Ciro
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Brüt Ciro
          </p>
          <p className="mt-2 text-xl font-bold">
            {formatCurrency(report.grossRevenueBeforeCashAdjustments)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            İade Tutarı
          </p>
          <p className="mt-2 text-xl font-bold text-red-800">
            {formatCurrency(report.financialRefundDeduction)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Nakit Kısmı Düşüm
          </p>
          <p className="mt-2 text-xl font-bold text-red-800">
            {formatCurrency(report.cashAdjustmentDeduction)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Nakit
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.cashRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            İyzico
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.iyzicoRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Kredi Kartı
          </p>
          <p className="mt-2 text-xl font-bold">
            {formatCurrency(report.creditCardRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sodexo
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.sodexoRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Multinet
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.multinetRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Ticket
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.ticketRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Metropol
          </p>
          <p className="mt-2 text-xl font-bold">{formatCurrency(report.metropolRevenue)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Ort. Teslim
          </p>
          <p className="mt-2 text-xl font-bold">
            {formatMinutes(report.averageDeliveryMinutes)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Ort. Hazırlama
          </p>
          <p className="mt-2 text-xl font-bold">
            {formatMinutes(report.averagePreparationMinutes)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Ödeme Yöntemi Kırılımı</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-600">
                <th className="pb-2 pr-4">Yöntem</th>
                <th className="pb-2 pr-4">Adet</th>
                <th className="pb-2">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {report.paymentMethodBreakdown.map((row) => (
                <tr key={row.method} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">{METHOD_LABELS[row.method] ?? row.method}</td>
                  <td className="py-2 pr-4">{row.count}</td>
                  <td className="py-2 font-semibold">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Garson Performansı</h2>
        {report.waiterAverages.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Veri bulunmuyor.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-600">
                  <th className="pb-2 pr-4">Personel</th>
                  <th className="pb-2 pr-4">Ortalama Süre</th>
                  <th className="pb-2">Örnek</th>
                </tr>
              </thead>
              <tbody>
                {report.waiterAverages.map((row) => (
                  <tr key={row.staffId} className="border-b border-neutral-100">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4">{formatMinutes(row.averageMinutes)}</td>
                    <td className="py-2">{row.sampleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-700">
        <p className="font-semibold">Metrik Tanımları</p>
        <p className="mt-1">{report.definitions.longestDelivery}</p>
        <p className="mt-1">{report.definitions.deliveryAverage}</p>
        <p className="mt-1">{report.definitions.preparationAverage}</p>
        <p className="mt-1">{report.definitions.waiterResponseAverage}</p>
        <p className="mt-1">{report.definitions.revenueInclusion}</p>
      </section>
    </div>
  );
}
