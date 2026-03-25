import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCashierOrManagerSession } from "@/lib/auth";
import { formatTryCurrency } from "@/lib/currency";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { parseCancellationCustomReason } from "@/lib/order-cancellation-finance";
import { classifyFinancialRefund } from "@/lib/report-order-metrics";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";
import CashTerminal, { type CashTerminalTable } from "./cash-terminal";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CREDIT_CARD",
  "SODEXO",
  "MULTINET",
  "TICKET",
  "METROPOL",
];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Karti / Online",
  SODEXO: "Sodexo",
  MULTINET: "Multinet",
  TICKET: "Ticket",
  METROPOL: "Metropol",
};

type CashPageSearchParams = {
  from?: string;
  to?: string;
  method?: string;
};

function normalizeDateParam(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function toNumber(value: number | { toString(): string }): number {
  return Number(value);
}

function extractVariantSummary(item: Record<string, unknown>): string | null {
  const options = item.selectedOptions;
  if (Array.isArray(options)) {
    const labels = options
      .map((row) => {
        if (row && typeof row === "object") {
          const optionName = (row as Record<string, unknown>).optionName;
          const name = (row as Record<string, unknown>).name;
          const label = (row as Record<string, unknown>).label;
          return [optionName, name, label].find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;
        }
        return undefined;
      })
      .filter((value): value is string => Boolean(value));
    if (labels.length > 0) return labels.join(", ");
  }

  const optionLabels = item.optionLabels;
  if (Array.isArray(optionLabels)) {
    const labels = optionLabels.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (labels.length > 0) return labels.join(", ");
  }

  return null;
}

function sanitizeSplitRef(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note.replace(/\s*\[split-ref:[a-zA-Z0-9_-]{10,64}:\d+\]\s*/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export default async function RestaurantCashPage({
  searchParams,
}: {
  searchParams?: Promise<CashPageSearchParams>;
}) {
  const session = await requireCashierOrManagerSession("cash.view");
  const { tenantId } = await getCurrentTenantOrThrow();
  const params = (await searchParams) ?? {};

  const today = getTurkeyDateString();
  const fromRaw = normalizeDateParam(params.from, today);
  const toRaw = normalizeDateParam(params.to, fromRaw);
  const from = fromRaw <= toRaw ? fromRaw : toRaw;
  const to = fromRaw <= toRaw ? toRaw : fromRaw;
  const selectedMethod =
    params.method && PAYMENT_METHODS.includes(params.method as PaymentMethod)
      ? (params.method as PaymentMethod)
      : "ALL";

  const fromRange = getTurkeyDayRange(from);
  const toRange = getTurkeyDayRange(to);
  const rangeStartUtc = fromRange.startUtc;
  const rangeEndUtc = toRange.endUtc;

  const activeTables = await prisma.table.findMany({
    where: {
      isActive: true,
      restaurant: { tenantId },
    },
    select: { id: true, tableNo: true },
    orderBy: { tableNo: "asc" },
  });

  const terminalRowsRaw = await Promise.all(
    activeTables.map(async (table): Promise<CashTerminalTable | null> => {
      const billing = await getTableBillingSnapshot({
        tenantId,
        tableId: table.id,
      });
      const cycleTimestampFilter = billing.cycleStartAt
        ? {
            OR: [
              { createdAt: { gt: billing.cycleStartAt } },
              { readyAt: { gt: billing.cycleStartAt } },
              { deliveredAt: { gt: billing.cycleStartAt } },
            ],
          }
        : {};

      const [orders, payments, openBillRequest] = await Promise.all([
        prisma.order.findMany({
          where: {
            tableId: table.id,
            table: { restaurant: { tenantId } },
            status: { in: ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING", "COMPLETED"] },
            ...cycleTimestampFilter,
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            readyAt: true,
            deliveredAt: true,
            note: true,
            items: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.payment.findMany({
          where: {
            tenantId,
            tableId: table.id,
            ...(billing.cycleStartAt ? { createdAt: { gt: billing.cycleStartAt } } : {}),
          },
          select: {
            id: true,
            amount: true,
            method: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        prisma.billRequest.findFirst({
          where: {
            tenantId,
            tableId: table.id,
            status: { in: ["PENDING", "ACKNOWLEDGED"] },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const orderIds = orders.map((order) => order.id);
      const [cancellations, cashAdjustments] = await Promise.all([
        orderIds.length > 0
          ? prisma.orderItemCancellation.findMany({
              where: {
                tenantId,
                orderId: { in: orderIds },
              },
              select: {
                orderId: true,
                productId: true,
                quantity: true,
                customReason: true,
                order: { select: { deliveredAt: true } },
              },
            })
          : Promise.resolve([]),
        orderIds.length > 0
          ? prisma.cashOrderAdjustment.findMany({
              where: {
                tenantId,
                orderId: { in: orderIds },
              },
              select: {
                orderId: true,
                productId: true,
                adjustedQuantity: true,
              },
            })
          : Promise.resolve([]),
      ]);

      const productIds = new Set<number>();
      for (const order of orders) {
        const rows = Array.isArray(order.items)
          ? (order.items as Array<{ productId?: unknown }>)
          : [];
        for (const row of rows) {
          const productId = Number(row.productId);
          if (Number.isFinite(productId) && productId > 0) {
            productIds.add(productId);
          }
        }
      }

      const products =
        productIds.size > 0
          ? await prisma.product.findMany({
              where: { id: { in: [...productIds] } },
              select: { id: true, nameTR: true },
            })
          : [];
      const productNameMap = new Map(products.map((product) => [product.id, product.nameTR]));

      const cancellationMap = new Map<string, number>();
      for (const cancellation of cancellations) {
        const key = `${cancellation.orderId}:${cancellation.productId}`;
        cancellationMap.set(key, (cancellationMap.get(key) ?? 0) + cancellation.quantity);
      }
      const adjustmentMap = new Map<string, number>();
      for (const adjustment of cashAdjustments) {
        const key = `${adjustment.orderId}:${adjustment.productId}`;
        adjustmentMap.set(key, (adjustmentMap.get(key) ?? 0) + adjustment.adjustedQuantity);
      }

      const items: CashTerminalTable["items"] = [];
      for (const order of orders) {
        const rows = Array.isArray(order.items)
          ? (order.items as Array<Record<string, unknown>>)
          : [];
        for (const row of rows) {
          const productId = Number(row.productId);
          const quantity = Number(row.quantity);
          const unitPrice = Number(row.price);
          if (
            !Number.isFinite(productId) ||
            !Number.isFinite(quantity) ||
            !Number.isFinite(unitPrice) ||
            productId <= 0 ||
            quantity <= 0
          ) {
            continue;
          }

          const key = `${order.id}:${productId}`;
          const cancelledQty = cancellationMap.get(key) ?? 0;
          const adjustedQty = adjustmentMap.get(key) ?? 0;
          const effectiveQty = Math.max(0, quantity - cancelledQty - adjustedQty);
          if (effectiveQty <= 0) continue;

          items.push({
            key: `${key}:${extractVariantSummary(row) ?? "-"}`,
            productName: productNameMap.get(productId) ?? `Urun #${productId}`,
            variantSummary: extractVariantSummary(row),
            quantity: effectiveQty,
            unitPrice,
            lineTotal: effectiveQty * unitPrice,
            note: order.note?.trim() || null,
          });
        }
      }

      const cancellationImpact = cancellations.reduce((sum, row) => {
        const parsed = parseCancellationCustomReason(row.customReason);
        const refund = classifyFinancialRefund({
          orderId: row.orderId,
          deliveredAt: row.order.deliveredAt,
          operationType: parsed.operationType,
          paymentSettled: parsed.paymentSettled,
          refundedAmount: parsed.refundedAmount,
        });
        return sum + refund.effectiveRefundAmount;
      }, 0);

      const hasActiveOrder = orders.length > 0;
      const hasOpenBillRequest = Boolean(openBillRequest);
      const hasPartialPayment =
        billing.netPaidAmount > 0 && billing.remainingAmount > 0;
      const waitingClose = hasOpenBillRequest && billing.remainingAmount > 0;

      const lastActionAt = [
        orders.at(-1)?.createdAt ?? null,
        payments[0]?.createdAt ?? null,
        openBillRequest?.updatedAt ?? openBillRequest?.createdAt ?? null,
      ]
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      if (!hasActiveOrder && !hasOpenBillRequest && billing.remainingAmount <= 0) {
        return null;
      }

      return {
        tableId: table.id,
        tableNo: table.tableNo,
        lastActionAtIso: lastActionAt?.toISOString() ?? null,
        statusBadges: {
          hasActiveOrder,
          hasOpenBillRequest,
          hasPartialPayment,
          waitingClose,
        },
        finance: {
          subtotal: billing.totalFromOrders,
          cancellationImpact,
          collectedAmount: billing.netPaidAmount,
          remainingAmount: Math.max(0, billing.remainingAmount),
          accountStatus:
            billing.remainingAmount <= 0
              ? "Hesap kapali"
              : waitingClose
                ? "Kapatilmayi bekliyor"
                : hasPartialPayment
                  ? "Kismi tahsilat var"
                  : hasActiveOrder
                    ? "Aktif siparis var"
                    : "Acik hesap",
          openBillRequestId: openBillRequest?.id ?? null,
          openBillRequestStatus:
            openBillRequest?.status === "PENDING" || openBillRequest?.status === "ACKNOWLEDGED"
              ? openBillRequest.status
              : null,
        },
        items,
        payments: payments.map((payment) => ({
          id: payment.id,
          createdAtIso: payment.createdAt.toISOString(),
          amount: toNumber(payment.amount),
          method: METHOD_LABELS[payment.method],
          note: sanitizeSplitRef(payment.note ?? null),
        })),
      };
    }),
  );

  const terminalRows = terminalRowsRaw.filter((row): row is CashTerminalTable => row != null);

  const paymentWhere = {
    tenantId,
    createdAt: { gte: rangeStartUtc, lt: rangeEndUtc },
    ...(selectedMethod !== "ALL" ? { method: selectedMethod } : {}),
  } as const;
  const [filteredPayments, recentPayments] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      select: { method: true, amount: true },
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        method: true,
        amount: true,
        table: { select: { tableNo: true } },
      },
    }),
  ]);

  const breakdown = PAYMENT_METHODS.reduce(
    (acc, method) => ({ ...acc, [method]: { count: 0, total: 0 } }),
    {} as Record<PaymentMethod, { count: number; total: number }>,
  );
  for (const payment of filteredPayments) {
    breakdown[payment.method].count += 1;
    breakdown[payment.method].total += toNumber(payment.amount);
  }

  const openAccounts = terminalRows.filter((row) => row.finance.remainingAmount > 0).length;
  const totalCollectible = terminalRows.reduce(
    (sum, row) => sum + Math.max(0, row.finance.remainingAmount),
    0,
  );

  return (
    <div className="space-y-5">
      <CashTerminal
        role={session.role}
        tables={terminalRows}
      />

      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Ikincil Ozet
            </p>
            <h3 className="mt-1 text-base font-semibold text-[color:var(--ui-text-primary)]">
              Gun ici gorunum
            </h3>
          </div>
          <span className={badgeClasses("neutral")}>{from === to ? from : `${from} - ${to}`}</span>
        </div>

        <form className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Baslangic</span>
            <input type="date" name="from" defaultValue={from} className={fieldClasses({ size: "md" })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Bitis</span>
            <input type="date" name="to" defaultValue={to} className={fieldClasses({ size: "md" })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Odeme yontemi</span>
            <select name="method" defaultValue={selectedMethod} className={fieldClasses({ size: "md" })}>
              <option value="ALL">Tum yontemler</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={buttonClasses({ variant: "secondary", size: "md", className: "h-10 self-end px-4" })}
          >
            Uygula
          </button>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
            <p className="text-xs text-[color:var(--ui-text-secondary)]">Acik hesapli masa</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">{openAccounts}</p>
          </article>
          <article className={cardClasses({ tone: "warning", className: "p-3.5 shadow-none" })}>
            <p className="text-xs text-[color:var(--ui-text-secondary)]">Toplam tahsil edilecek</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(totalCollectible)}</p>
          </article>
          <article className={cardClasses({ className: "p-3.5 shadow-none sm:col-span-2" })}>
            <p className="text-xs text-[color:var(--ui-text-secondary)]">Odeme yontemi kirilimi</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <span key={method} className={badgeClasses("neutral")}>
                  {METHOD_LABELS[method]}: {breakdown[method].count}
                </span>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[color:var(--ui-border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[color:var(--ui-surface-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Saat</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Masa</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Yontem</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ui-border)]">
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-[color:var(--ui-text-secondary)]">
                    Odeme kaydi bulunmuyor.
                  </td>
                </tr>
              ) : (
                recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2.5 text-[color:var(--ui-text-primary)]">
                      {payment.createdAt.toLocaleTimeString("tr-TR", {
                        timeZone: "Europe/Istanbul",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--ui-text-primary)]">Masa {payment.table.tableNo}</td>
                    <td className="px-3 py-2.5 text-[color:var(--ui-text-primary)]">{METHOD_LABELS[payment.method]}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[color:var(--ui-text-primary)]">
                      {formatTryCurrency(payment.amount)}
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
