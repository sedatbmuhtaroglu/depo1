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
const PRIMARY_CARD_CLASS = cardClasses({ className: "p-5 shadow-none sm:p-6" });
const SECONDARY_CARD_CLASS = cardClasses({ className: "overflow-hidden p-0 shadow-none" });

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
    <div className="space-y-5">
      <section className={PRIMARY_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="rm-section-intro-eyebrow">İptal ve İade İzleme</p>
            <h2 className="rm-section-intro-title">İptaller</h2>
            <p className="rm-section-intro-desc">
              İptal kayıtlarını, finansal iade etkisini ve operasyonel yoğunluğu tek ekranda takip edin.
            </p>
          </div>
          <span className={badgeClasses("neutral", "shrink-0 px-2.5 py-1 text-xs font-medium")}>
            Son 200 kayıt
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Toplam İptal Kaydı
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {totalCancellationCount}
                </p>
              </div>
              <span className="rm-stat-icon">
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Toplam İptal Adedi
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {totalCancelledQuantity}
                </p>
              </div>
              <span className="rm-stat-icon">
                <Wallet className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Bugün İptal Kaydı
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {todayCancellationCount}
                </p>
              </div>
              <span className="rm-stat-icon">
                <Clock3 className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className={cardClasses({ tone: "subtle", className: "px-3.5 py-3 shadow-none" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Etkilenen Masa
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {affectedTableCount}
                </p>
              </div>
              <span className="rm-stat-icon">
                <Table2 className="h-4 w-4" />
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className={cardClasses({ tone: "subtle", className: "p-4 shadow-none sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Finansal Etki
            </p>
            <p className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-[color:var(--ui-text-primary)]">
              {formatTryCurrency(totalRefundAmount)}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Finansal iade etkisi bulunan {totalFinancialRefundCount} kayıt mevcut.
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3.5 py-2.5 text-xs text-[color:var(--ui-text-secondary)]">
            <p className="font-semibold text-[color:var(--ui-text-primary)]">Bugün etkilenen masa</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--ui-text-primary)]">
              {todayAffectedTableCount}
            </p>
          </div>
        </div>
      </section>

      <section className={SECONDARY_CARD_CLASS}>
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ui-border)] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">İptal Kayıtları</h3>
            <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">
              Ürün, neden, yöntem ve tutar ilişkisini finansal görünümde izleyin.
            </p>
          </div>
          <span
            className={badgeClasses(
              "neutral",
              "hidden shrink-0 sm:inline-flex px-2.5 py-1 text-xs font-medium",
            )}
          >
            {rows.length} kayıt
          </span>
        </div>

        <div className="rm-table-wrap rm-table-wrap--inset">
          <table className="rm-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>İptal Nedeni</th>
                <th>Adet</th>
                <th>İade Yöntemi</th>
                <th>İade Tutarı</th>
                <th>Tarih / Saat</th>
                <th>Masa</th>
                <th>İşlemi Yapan</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="!py-12 text-center text-sm text-[color:var(--ui-text-secondary)]">
                    Henüz iptal kaydı yok.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const dateCell = formatDateCell(row.createdAt);
                  const methodLabel = row.isFinancialRefund ? row.refundMethodLabel : "-";

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="min-w-[150px]">
                          <p className="font-semibold text-[color:var(--ui-text-primary)]">{row.productName}</p>
                          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Kayıt #{row.id}</p>
                        </div>
                      </td>
                      <td>
                        <p className="font-medium text-[color:var(--ui-text-primary)]">{row.reasonLabel}</p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                          {row.isFinancialRefund ? "Finansal iade etkisi var" : "Operasyonel iptal"}
                        </p>
                      </td>
                      <td>
                        <span className="inline-flex min-w-8 items-center justify-center rounded-md border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[color:var(--ui-text-primary)]">
                          {row.quantity}
                        </span>
                      </td>
                      <td>
                        <span
                          className={badgeClasses(
                            refundMethodBadgeClass(methodLabel),
                            "px-2.5 py-1 text-[11px] font-semibold",
                          )}
                        >
                          {methodLabel === "-" ? "İade yok" : methodLabel}
                        </span>
                      </td>
                      <td>
                        <p
                          className={
                            row.isFinancialRefund
                              ? "font-semibold text-[color:var(--ui-text-primary)]"
                              : "text-[color:var(--ui-text-muted)]"
                          }
                        >
                          {row.isFinancialRefund ? formatTryCurrency(row.refundAmount) : "-"}
                        </p>
                      </td>
                      <td>
                        <p className="font-medium text-[color:var(--ui-text-primary)]">{dateCell.dayText}</p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{dateCell.timeText}</p>
                      </td>
                      <td>
                        <span className={badgeClasses("info", "px-2.5 py-1 text-[11px] font-semibold")}>
                          Masa {row.tableNo}
                        </span>
                      </td>
                      <td>
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
