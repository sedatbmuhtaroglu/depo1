import React from "react";
import { ClipboardList, Clock3, Table2, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import {
  buildCancellationReasonLabel,
  parseCancellationCustomReason,
} from "@/lib/order-cancellation-finance";
import { classifyFinancialRefund } from "@/lib/report-order-metrics";
import { getOrderPaymentMethodLabel } from "@/lib/order-payment-visibility";
import { formatTryCurrency } from "@/lib/currency";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";

export const dynamic = "force-dynamic";

const reasonLabels: Record<string, string> = {
  CUSTOMER_CHANGED_MIND: "Müşteri fikrini değiştirdi",
  OUT_OF_STOCK: "Stokta yok",
  WRONG_ITEM: "Yanlış ürün",
  OTHER: "Diğer",
};
const PRIMARY_CARD_CLASS = cardClasses({ className: "p-5 sm:p-6" });
const SECONDARY_CARD_CLASS = cardClasses({ className: "overflow-hidden p-0" });

function toTurkeyDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateCell(date: Date): { dayText: string; timeText: string } {
  const parsed = new Date(date);
  return {
    dayText: parsed.toLocaleDateString("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    timeText: parsed.toLocaleTimeString("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function refundMethodBadgeClass(methodLabel: string): Parameters<typeof badgeClasses>[0] {
  if (methodLabel === "-") return "neutral";

  const normalized = methodLabel.toUpperCase();
  if (normalized.includes("NAKIT")) return "success";
  if (normalized.includes("KART") || normalized.includes("IYZICO")) return "info";
  if (
    normalized.includes("SODEXO") ||
    normalized.includes("MULTINET") ||
    normalized.includes("TICKET")
  ) {
    return "warning";
  }
  return "neutral";
}

function mapRefundMethodLabel(input: {
  selectedPaymentMethod: string | null;
  requestedPaymentMethod:
    | "CASH"
    | "CREDIT_CARD"
    | "SODEXO"
    | "MULTINET"
    | "TICKET"
    | "METROPOL"
    | null;
  paymentProvider: "IYZICO" | null;
}): string {
  const selected = input.selectedPaymentMethod;
  if (selected === "IYZICO") return "Kart (Iyzico)";
  if (selected === "LATER_PAY") return "Bilinmiyor";
  if (selected === "CASH") return "Nakit";
  if (selected === "CREDIT_CARD") return "Kart";
  if (selected === "SODEXO") return "Sodexo";
  if (selected === "MULTINET") return "Multinet";
  if (selected === "TICKET") return "Ticket";
  if (selected === "METROPOL") return "Metropol";

  const fallback = getOrderPaymentMethodLabel({
    requestedPaymentMethod: input.requestedPaymentMethod,
    paymentProvider: input.paymentProvider,
  });
  if (fallback === "Online (Iyzico)") return "Kart (Iyzico)";
  if (fallback === "Kredi Karti") return "Kart";
  if (fallback === "Sonra Ode") return "Bilinmiyor";
  return fallback;
}

export default async function RestaurantCancellationsPage() {
  const { tenantId } = await getCurrentTenantOrThrow();

  const cancellations = await prisma.orderItemCancellation.findMany({
    where: { tenantId },
    include: {
      order: {
        select: {
          deliveredAt: true,
          requestedPaymentMethod: true,
          paymentProvider: true,
          table: { select: { tableNo: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const productIds = [...new Set(cancellations.map((c) => c.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, nameTR: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.nameTR]));

  const rows = cancellations.map((c) => {
    const parsed = parseCancellationCustomReason(c.customReason);
    const refund = classifyFinancialRefund({
      orderId: c.orderId,
      deliveredAt: c.order.deliveredAt,
      operationType: parsed.operationType,
      paymentSettled: parsed.paymentSettled,
      refundedAmount: parsed.refundedAmount,
    });

    const isFinancialRefund = refund.affectsBalance;
    const refundAmount = refund.effectiveRefundAmount;
    const refundMethodLabel = isFinancialRefund
      ? mapRefundMethodLabel({
          selectedPaymentMethod: parsed.selectedPaymentMethod,
          requestedPaymentMethod: c.order.requestedPaymentMethod,
          paymentProvider: c.order.paymentProvider,
        })
      : "-";

    return {
      id: c.id,
      productName: productMap[c.productId] ?? "-",
      reasonLabel: buildCancellationReasonLabel({
        reasonCode: c.reason,
        customReasonRaw: c.customReason,
        reasonLabels,
      }),
      quantity: c.quantity,
      createdAt: c.createdAt,
      tableNo: c.order.table.tableNo,
      performedBy: c.performedBy ?? "-",
      isFinancialRefund,
      refundMethodLabel,
      refundAmount,
    };
  });

  const totalRefundAmount = rows
    .filter((row) => row.isFinancialRefund)
    .reduce((sum, row) => sum + row.refundAmount, 0);
  const totalCancellationCount = rows.length;
  const totalCancelledQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalFinancialRefundCount = rows.filter((row) => row.isFinancialRefund).length;
  const affectedTableCount = new Set(rows.map((row) => row.tableNo)).size;

  const todayKey = toTurkeyDateKey(new Date());
  const todayRows = rows.filter((row) => toTurkeyDateKey(row.createdAt) === todayKey);
  const todayCancellationCount = todayRows.length;
  const todayAffectedTableCount = new Set(todayRows.map((row) => row.tableNo)).size;

  return (
    <div className="space-y-4">
      <section className={PRIMARY_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6B7280]">
              İptal ve İade İzleme
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">İptaller</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              İptal kayıtlarını, finansal iade etkisini ve operasyonel yoğunluğu tek ekranda takip edin.
            </p>
          </div>
          <span className={badgeClasses("neutral", "px-2.5 py-1 text-xs font-medium")}>
            Son 200 kayıt
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Toplam İptal Kaydı</p>
                <p className="mt-1 text-lg font-semibold text-[#111827]">{totalCancellationCount}</p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFFFF] border border-[#E5E7EB] text-[#14213D]">
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Toplam İptal Adedi</p>
                <p className="mt-1 text-lg font-semibold text-[#111827]">{totalCancelledQuantity}</p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFFFF] border border-[#E5E7EB] text-[#14213D]">
                <Wallet className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Bugün İptal Kaydı</p>
                <p className="mt-1 text-lg font-semibold text-[#111827]">{todayCancellationCount}</p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFFFF] border border-[#E5E7EB] text-[#14213D]">
                <Clock3 className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Etkilenen Masa</p>
                <p className="mt-1 text-lg font-semibold text-[#111827]">{affectedTableCount}</p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFFFF] border border-[#E5E7EB] text-[#14213D]">
                <Table2 className="h-4 w-4" />
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className={cardClasses({ tone: "subtle", className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#374151]">Finansal Etki</p>
            <p className="mt-2 text-[1.5rem] font-semibold leading-tight text-[#111827]">
              {formatTryCurrency(totalRefundAmount)}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Finansal iade etkisi bulunan {totalFinancialRefundCount} kayıt mevcut.
            </p>
          </div>
          <div className="rounded-xl border border-[#D0D8E4] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#374151]">
            <p className="font-semibold">Bugün etkilenen masa</p>
            <p className="mt-1 text-base font-semibold text-[#111827]">{todayAffectedTableCount}</p>
          </div>
        </div>
      </section>

      <section className={SECONDARY_CARD_CLASS}>
        <div className="flex items-center justify-between border-b border-[#E6EAF0] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">İptal Kayıtları</h3>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Ürün, neden, yöntem ve tutar ilişkisini finansal görünümde izleyin.
            </p>
          </div>
          <span className={badgeClasses("neutral", "hidden sm:inline-flex px-2.5 py-1 text-xs font-medium")}>
            {rows.length} kayıt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F8FAFC]">
              <tr className="border-b border-[#E6EAF0]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">Ürün</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">İptal Nedeni</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">Adet</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">İade Yöntemi</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">İade Tutarı</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">Tarih / Saat</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">Masa</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">İşlemi Yapan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F4]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                    Henüz iptal kaydı yok.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const dateCell = formatDateCell(row.createdAt);
                  const methodLabel = row.isFinancialRefund ? row.refundMethodLabel : "-";

                  return (
                    <tr key={row.id} className="align-top transition-colors hover:bg-[#FAFBFD]">
                      <td className="px-4 py-3.5">
                        <div className="min-w-[150px]">
                          <p className="font-semibold text-[#111827]">{row.productName}</p>
                          <p className="mt-1 text-xs text-[#6B7280]">Kayıt #{row.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[#111827]">{row.reasonLabel}</p>
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {row.isFinancialRefund ? "Finansal iade etkisi var" : "Operasyonel iptal"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex min-w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-xs font-semibold text-[#374151]">
                          {row.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={badgeClasses(
                            refundMethodBadgeClass(methodLabel),
                            "px-2.5 py-1 text-[11px] font-semibold"
                          )}
                        >
                          {methodLabel === "-" ? "İade yok" : methodLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className={row.isFinancialRefund ? "font-semibold text-[#111827]" : "text-[#6B7280]"}>
                          {row.isFinancialRefund ? formatTryCurrency(row.refundAmount) : "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[#111827]">{dateCell.dayText}</p>
                        <p className="mt-1 text-xs text-[#6B7280]">{dateCell.timeText}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={badgeClasses("info", "px-2.5 py-1 text-[11px] font-semibold")}>
                          Masa {row.tableNo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={badgeClasses("neutral", "px-2.5 py-1 text-[11px] font-medium")}>
                          {row.performedBy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
