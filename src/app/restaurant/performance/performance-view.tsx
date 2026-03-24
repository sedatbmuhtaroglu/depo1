"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";

type Row = {
  staffId: number;
  name: string;
  tablesServed: number;
  ordersDelivered: number;
  avgDeliveryMinutes: number | null;
  avgBillResponseMinutes: number | null;
  avgCallResponseMinutes: number | null;
};

const SECTION_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });
const TABLE_WRAP_CLASS = "overflow-x-auto";
const TABLE_CLASS = "min-w-full text-sm";
const TABLE_HEAD_ROW_CLASS = "border-b border-[#E6EAF0]";
const TABLE_HEAD_CELL_CLASS =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]";
const TABLE_ROW_CLASS = "border-b border-[#EEF1F4] transition-colors hover:bg-[#FAFBFD]";
const TABLE_CELL_CLASS = "px-4 py-3 text-[#111827]";

const DATE_INPUT_CLASS = fieldClasses({
  size: "md",
  className:
    "h-10 w-full min-w-0 rounded-xl border-[#D0D8E4] bg-[#FCFDFE] px-3 text-sm focus:border-[#223356] sm:min-w-[170px]",
});
const APPLY_BUTTON_CLASS = buttonClasses({
  variant: "primary",
  size: "md",
  className: "h-10",
});

function getAverage(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function StatValue({ value }: { value: number }) {
  return (
    <span
      className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${
        value === 0
          ? "border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]"
          : "border-[#D8E2F0] bg-[#EAF0F8] text-[#223356]"
      }`}
    >
      {value}
    </span>
  );
}

function DurationValue({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className={badgeClasses("neutral", "px-2.5 py-1 text-[11px] font-medium")}>
        Veri yok
      </span>
    );
  }
  return <span className="font-medium tabular-nums text-[#111827]">{value} dk</span>;
}

export default function PerformanceView({
  rows,
  defaultFrom,
  defaultTo,
}: {
  rows: Row[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const from = (form.querySelector('[name="from"]') as HTMLInputElement)?.value;
    const to = (form.querySelector('[name="to"]') as HTMLInputElement)?.value;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/restaurant/performance?${params.toString()}`);
  };

  const totalStaff = rows.length;
  const totalDeliveredOrders = rows.reduce((sum, row) => sum + row.ordersDelivered, 0);
  const avgDelivery = getAverage(rows.map((row) => row.avgDeliveryMinutes));
  const avgBillResponse = getAverage(rows.map((row) => row.avgBillResponseMinutes));
  const avgCallResponse = getAverage(rows.map((row) => row.avgCallResponseMinutes));

  return (
    <div className="space-y-4">
      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Performans Kontrol Merkezi</h3>
            <p className="mt-1 text-xs text-[#6B7280]">
              Başlangıç ve bitiş tarihine göre ekip performans raporunu filtreleyin.
            </p>
          </div>
        </div>

        <form onSubmit={handleFilter} className="mt-4 flex min-w-0 flex-wrap items-end gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Başlangıç</label>
            <input type="date" name="from" defaultValue={defaultFrom} className={DATE_INPUT_CLASS} />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Bitiş</label>
            <input type="date" name="to" defaultValue={defaultTo} className={DATE_INPUT_CLASS} />
          </div>
          <button type="submit" className={`${APPLY_BUTTON_CLASS} w-full sm:w-auto`}>
            Uygula
          </button>
        </form>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[#111827]">Ekip Özet Bandı</h3>
          <p className="mt-1 text-xs text-[#6B7280]">Seçili aralıkta ölçülen temel performans metrikleri.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article className={cardClasses({ className: "p-3.5" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Toplam personel</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{totalStaff}</p>
          </article>
          <article className={cardClasses({ className: "p-3.5" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Teslim edilen sipariş</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{totalDeliveredOrders}</p>
          </article>
          <article className={cardClasses({ tone: "subtle", className: "p-3.5" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#4B5563]">Ort. teslim süresi</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">
              {avgDelivery != null ? `${avgDelivery} dk` : "-"}
            </p>
          </article>
          <article className={cardClasses({ className: "p-3.5" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Ort. hesap yanıtı</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">
              {avgBillResponse != null ? `${avgBillResponse} dk` : "-"}
            </p>
          </article>
          <article className={cardClasses({ className: "p-3.5" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Ort. çağrı yanıtı</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">
              {avgCallResponse != null ? `${avgCallResponse} dk` : "-"}
            </p>
          </article>
        </div>
      </section>

      <section className={cardClasses({ className: "overflow-hidden p-0" })}>
        <div className="flex items-center justify-between gap-2 border-b border-[#E6EAF0] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Personel Performansı</h3>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Kişi bazlı masa, teslimat ve yanıt süreleri karşılaştırması.
            </p>
          </div>
          <span className={badgeClasses("neutral", "hidden sm:inline-flex px-2.5 py-1 text-xs font-medium")}>
            {rows.length} personel
          </span>
        </div>

        <div className={TABLE_WRAP_CLASS}>
          <table className={TABLE_CLASS}>
            <thead className="bg-[#F8FAFC]">
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className={TABLE_HEAD_CELL_CLASS}>Personel</th>
                <th className={`${TABLE_HEAD_CELL_CLASS} text-right`}>Baktığı masa sayısı</th>
                <th className={`${TABLE_HEAD_CELL_CLASS} text-right`}>Teslim ettiği sipariş</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Ort. teslim süresi</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Ort. hesap yanıtı</th>
                <th className={TABLE_HEAD_CELL_CLASS}>Ort. çağrı yanıtı</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                    Bu tarih aralığında performans metrik verisi yok. Personel eklemek için
                    TenantStaff tablosuna WAITER veya MANAGER rolüyle kayıt ekleyin.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.staffId} className={TABLE_ROW_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <p className="font-semibold text-[#111827]">{row.name}</p>
                      <p className="mt-0.5 text-xs text-[#6B7280]">Personel #{row.staffId}</p>
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-right`}>
                      <StatValue value={row.tablesServed} />
                    </td>
                    <td className={`${TABLE_CELL_CLASS} text-right`}>
                      <StatValue value={row.ordersDelivered} />
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <DurationValue value={row.avgDeliveryMinutes} />
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <DurationValue value={row.avgBillResponseMinutes} />
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <DurationValue value={row.avgCallResponseMinutes} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
