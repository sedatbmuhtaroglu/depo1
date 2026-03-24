"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";

type CallRow = {
  id: number;
  tableNo: number;
  tableId: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  status: string;
  responseMinutes: number | null;
  staffName: string | null;
};

const SECTION_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });

const FILTER_FIELD_CLASS = fieldClasses({ size: "md" });

const statusLabel: Record<string, string> = {
  PENDING: "Bekliyor",
  ACKNOWLEDGED: "Alındı",
  RESOLVED: "Çözüldü",
};

function statusBadgeClass(status: string): Parameters<typeof badgeClasses>[0] {
  if (status === "PENDING") return "warning";
  if (status === "ACKNOWLEDGED") return "info";
  if (status === "RESOLVED") return "success";
  return "neutral";
}

function responseBadgeClass(responseMinutes: number | null): Parameters<typeof badgeClasses>[0] {
  if (responseMinutes == null) return "neutral";
  if (responseMinutes <= 2) return "success";
  if (responseMinutes <= 5) return "info";
  return "warning";
}

function formatDateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function WaiterCallsLogView({
  calls,
  tables,
  flaggedTableIds,
  defaultFrom,
  defaultTo,
  defaultTableId,
  defaultStatus,
}: {
  calls: CallRow[];
  tables: { id: number; tableNo: number }[];
  flaggedTableIds: number[];
  defaultFrom: string;
  defaultTo: string;
  defaultTableId: string;
  defaultStatus: string;
}) {
  const router = useRouter();

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const from = (form.querySelector('[name="from"]') as HTMLInputElement)?.value;
    const to = (form.querySelector('[name="to"]') as HTMLInputElement)?.value;
    const tableId = (form.querySelector('[name="tableId"]') as HTMLSelectElement)?.value;
    const status = (form.querySelector('[name="status"]') as HTMLSelectElement)?.value;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (tableId) params.set("tableId", tableId);
    if (status) params.set("status", status);
    router.push(`/restaurant/waiter-calls?${params.toString()}`);
  };

  const totalCalls = calls.length;
  const resolvedCalls = calls.filter((c) => c.status === "RESOLVED").length;
  const responseMinutes = calls
    .map((c) => c.responseMinutes)
    .filter((value): value is number => value != null);
  const avgResponseMinutes =
    responseMinutes.length > 0
      ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length)
      : null;
  const attendedStaffCount = new Set(
    calls.map((c) => c.staffName?.trim()).filter((value): value is string => Boolean(value)),
  ).size;

  return (
    <div className="space-y-4">
      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Arama ve Filtreleme</h3>
            <p className="mt-1 text-xs text-[#6B7280]">
              Tarih, masa ve durum filtresiyle çağrı loglarını operasyonel görünümde daraltın.
            </p>
          </div>
          <span className={badgeClasses("neutral", "px-2.5 py-1 text-xs font-medium")}>
            Seçim: {defaultFrom} - {defaultTo}
          </span>
        </div>

        <form onSubmit={handleFilter} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Başlangıç</label>
            <input type="date" name="from" defaultValue={defaultFrom} className={FILTER_FIELD_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Bitiş</label>
            <input type="date" name="to" defaultValue={defaultTo} className={FILTER_FIELD_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Masa</label>
            <select name="tableId" defaultValue={defaultTableId} className={FILTER_FIELD_CLASS}>
              <option value="">Tümü</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Masa {t.tableNo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6B7280]">Durum</label>
            <select name="status" defaultValue={defaultStatus} className={FILTER_FIELD_CLASS}>
              <option value="">Tümü</option>
              <option value="PENDING">Bekliyor</option>
              <option value="ACKNOWLEDGED">Alındı</option>
              <option value="RESOLVED">Çözüldü</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className={buttonClasses({
                variant: "primary",
                size: "md",
                fullWidth: true,
                className: "h-10",
              })}
            >
              Uygula
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-3.5" })}>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Toplam çağrı kaydı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{totalCalls}</p>
        </article>
        <article className={cardClasses({ tone: "subtle", className: "p-3.5" })}>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#4B5563]">Çözülen çağrı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{resolvedCalls}</p>
        </article>
        <article className={cardClasses({ className: "p-3.5" })}>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Ort. yanıt süresi</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">
            {avgResponseMinutes != null ? `${avgResponseMinutes} dk` : "-"}
          </p>
        </article>
        <article className={cardClasses({ className: "p-3.5" })}>
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">İlgilenen personel</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]">{attendedStaffCount}</p>
        </article>
      </section>

      <section className={cardClasses({ className: "overflow-hidden p-0" })}>
        <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-[#E6EAF0] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Çağrı Kayıt Tablosu</h3>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Masa bazında çağrı zamanı, yanıt hızı ve sorumlu personel dağılımı.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={badgeClasses("neutral", "px-2.5 py-1 text-xs font-medium")}>
              {calls.length} kayıt
            </span>
            {flaggedTableIds.length > 0 ? (
              <span className={badgeClasses("warning", "px-2.5 py-1 text-xs font-semibold")}>
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                Yoğun çağrı: {flaggedTableIds.length}
              </span>
            ) : null}
          </div>
        </div>

        {calls.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-[#111827]">Seçilen aralıkta çağrı kaydı yok</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Filtreyi genişleterek veya farklı masa/durum seçerek yeni kayıtları görüntüleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr className="border-b border-[#E6EAF0]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280] sm:px-5">
                    Masa
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280] sm:px-5">
                    Çağrı zamanı
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280] sm:px-5">
                    Yanıt zamanı
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280] sm:px-5">
                    Yanıt süresi
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280] sm:px-5">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280] sm:px-5">
                    İlgilenen
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => {
                  const created = formatDateParts(c.createdAt);
                  const acknowledged = formatDateParts(c.acknowledgedAt);
                  const isFlagged = flaggedTableIds.includes(c.tableId);

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[#EEF1F4] transition-colors hover:bg-[#FAFBFD]"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-semibold text-[#111827]">Masa {c.tableNo}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#6B7280]">
                          <span>Çağrı #{c.id}</span>
                          {isFlagged ? (
                            <span
                              className={badgeClasses("warning", "px-2 py-0.5 text-[10px] uppercase font-bold")}
                              title="Aynı masadan kısa sürede birden fazla çağrı"
                            >
                              Çok çağrı
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {created ? (
                          <>
                            <p className="font-medium tabular-nums text-[#111827]">{created.day}</p>
                            <p className="mt-0.5 text-xs tabular-nums text-[#6B7280]">{created.time}</p>
                          </>
                        ) : (
                          <span className="text-[#6B7280]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {acknowledged ? (
                          <>
                            <p className="font-medium tabular-nums text-[#111827]">{acknowledged.day}</p>
                            <p className="mt-0.5 text-xs tabular-nums text-[#6B7280]">{acknowledged.time}</p>
                          </>
                        ) : (
                          <span className={badgeClasses("neutral", "px-2.5 py-1 text-[11px] font-medium")}>
                            Bekleniyor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={badgeClasses(
                            responseBadgeClass(c.responseMinutes),
                            "px-2.5 py-1 text-[11px] font-semibold"
                          )}
                        >
                          {c.responseMinutes != null ? `${c.responseMinutes} dk` : "Veri yok"}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={badgeClasses(
                            statusBadgeClass(c.status),
                            "px-2.5 py-1 text-[11px] font-semibold"
                          )}
                        >
                          {statusLabel[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {c.staffName ? (
                          <p className="font-medium text-[#111827]">{c.staffName}</p>
                        ) : (
                          <span className={badgeClasses("neutral", "px-2.5 py-1 text-[11px] font-medium")}>
                            Atanmamış
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

