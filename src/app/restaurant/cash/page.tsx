import Link from "next/link";
import type { PaymentMethod } from "@prisma/client";
import { ArrowRight, CreditCard, ReceiptText, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatTryCurrency } from "@/lib/currency";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { parseCancellationCustomReason } from "@/lib/order-cancellation-finance";
import { classifyFinancialRefund } from "@/lib/report-order-metrics";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";

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

function toIsoLocalTime(iso: Date): string {
  return iso.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoLocalDateTime(iso: Date): string {
  return iso.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: "SETTLED" | "ACKNOWLEDGED" | "PENDING" | "DIRECT") {
  if (status === "SETTLED") return badgeClasses("success");
  if (status === "ACKNOWLEDGED") return badgeClasses("warning");
  if (status === "PENDING") return badgeClasses("warning");
  return badgeClasses("neutral");
}

function getStatusLabel(status: "SETTLED" | "ACKNOWLEDGED" | "PENDING" | "DIRECT") {
  if (status === "SETTLED") return "Hesap kapandi";
  if (status === "ACKNOWLEDGED") return "Hesap alindi";
  if (status === "PENDING") return "Beklemede";
  return "Ara tahsilat";
}

export default async function RestaurantCashPage({
  searchParams,
}: {
  searchParams?: Promise<CashPageSearchParams>;
}) {
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

  const paymentWhere = {
    tenantId,
    createdAt: { gte: rangeStartUtc, lt: rangeEndUtc },
    ...(selectedMethod !== "ALL" ? { method: selectedMethod } : {}),
  } as const;

  const [
    paymentRows,
    recentPaymentRows,
    cancellationRows,
    totalOrderCount,
    completedOrderCount,
    settledBillCount,
    activeTables,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      select: {
        amount: true,
        method: true,
        gatewayProvider: true,
      },
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        amount: true,
        method: true,
        note: true,
        createdAt: true,
        billRequestId: true,
        table: { select: { tableNo: true } },
        billRequest: {
          select: {
            id: true,
            status: true,
            acknowledgedByStaff: {
              select: {
                displayName: true,
                username: true,
              },
            },
          },
        },
      },
    }),
    prisma.orderItemCancellation.findMany({
      where: {
        tenantId,
        createdAt: { gte: rangeStartUtc, lt: rangeEndUtc },
      },
      select: {
        orderId: true,
        customReason: true,
        order: {
          select: {
            deliveredAt: true,
          },
        },
      },
    }),
    prisma.order.count({
      where: {
        table: { restaurant: { tenantId } },
        createdAt: { gte: rangeStartUtc, lt: rangeEndUtc },
      },
    }),
    prisma.order.count({
      where: {
        table: { restaurant: { tenantId } },
        createdAt: { gte: rangeStartUtc, lt: rangeEndUtc },
        status: "COMPLETED",
      },
    }),
    prisma.billRequest.count({
      where: {
        tenantId,
        status: "SETTLED",
        settledAt: { gte: rangeStartUtc, lt: rangeEndUtc },
      },
    }),
    prisma.table.findMany({
      where: {
        isActive: true,
        restaurant: { tenantId },
      },
      orderBy: { tableNo: "asc" },
      select: {
        id: true,
        tableNo: true,
        orders: {
          where: {
            status: { in: ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING", "COMPLETED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true },
        },
        payments: {
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true },
        },
        billRequests: {
          where: { tenantId, status: { in: ["PENDING", "ACKNOWLEDGED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true, updatedAt: true },
        },
      },
    }),
  ]);

  const refundImpact = cancellationRows.reduce((sum, row) => {
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

  const breakdown = PAYMENT_METHODS.reduce(
    (acc, method) => ({ ...acc, [method]: { count: 0, total: 0 } }),
    {} as Record<PaymentMethod, { count: number; total: number }>,
  );

  let grossCollected = 0;
  let cashCollected = 0;
  let cardOnlineCollected = 0;
  for (const payment of paymentRows) {
    const amount = toNumber(payment.amount);
    grossCollected += amount;
    breakdown[payment.method].count += 1;
    breakdown[payment.method].total += amount;

    if (payment.method === "CASH") cashCollected += amount;
    if (payment.method === "CREDIT_CARD" || payment.gatewayProvider === "IYZICO") {
      cardOnlineCollected += amount;
    }
  }
  const netCollected = grossCollected - refundImpact;

  const openTableRowsRaw = await Promise.all(
    activeTables.map(async (table) => {
      const billing = await getTableBillingSnapshot({
        tenantId,
        tableId: table.id,
      });

      const openBill = table.billRequests[0] ?? null;
      const latestOrder = table.orders[0]?.createdAt ?? null;
      const latestPayment = table.payments[0]?.createdAt ?? null;
      const latestBillUpdate = openBill?.updatedAt ?? openBill?.createdAt ?? null;
      const lastActionAt = [latestOrder, latestPayment, latestBillUpdate]
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      return {
        tableId: table.id,
        tableNo: table.tableNo,
        openBill,
        totalFromOrders: billing.totalFromOrders,
        remainingAmount: billing.remainingAmount,
        lastActionAt,
      };
    }),
  );

  const openTableRows = openTableRowsRaw
    .filter((row) => row.remainingAmount > 0 || row.openBill != null)
    .sort((a, b) => {
      if (!a.lastActionAt && !b.lastActionAt) return 0;
      if (!a.lastActionAt) return 1;
      if (!b.lastActionAt) return -1;
      return b.lastActionAt.getTime() - a.lastActionAt.getTime();
    });

  const averageCheckAmount =
    settledBillCount > 0 ? grossCollected / settledBillCount : null;

  return (
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-5 sm:p-6" })}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Operasyonel Kasa
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">
              Kasa Ekrani
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Gun ici tahsilat, odeme hareketleri ve kapanmayi bekleyen masalari tek ekrandan yonetin.
            </p>
          </div>
          <span className={badgeClasses("neutral")}>
            {from === to ? from : `${from} - ${to}`}
          </span>
        </div>

        <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
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
          <div className="flex items-end gap-2">
            <button type="submit" className={buttonClasses({ variant: "primary", size: "md", className: "h-10 px-4" })}>
              Uygula
            </button>
            <Link
              href={`/restaurant/cash?from=${today}&to=${today}&method=ALL`}
              className={buttonClasses({ variant: "secondary", size: "md", className: "h-10 px-4" })}
            >
              Bugun
            </Link>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className={cardClasses({ className: "p-3.5" })}>
          <p className="text-xs text-[color:var(--ui-text-secondary)]">Toplam tahsilat</p>
          <p className="mt-1.5 text-xl font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(grossCollected)}</p>
        </article>
        <article className={cardClasses({ tone: "success", className: "p-3.5" })}>
          <p className="text-xs text-[color:var(--ui-text-secondary)]">Nakit tahsilat</p>
          <p className="mt-1.5 text-xl font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(cashCollected)}</p>
        </article>
        <article className={cardClasses({ className: "p-3.5" })}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-[color:var(--ui-text-secondary)]">Kart / online tahsilat</p>
              <p className="mt-1.5 text-xl font-semibold text-[color:var(--ui-text-primary)]">
                {formatTryCurrency(cardOnlineCollected)}
              </p>
            </div>
            <CreditCard className="h-5 w-5 text-[color:var(--ui-primary)]" />
          </div>
        </article>
        <article className={cardClasses({ tone: "warning", className: "p-3.5" })}>
          <p className="text-xs text-[color:var(--ui-text-secondary)]">Kapanmamis masa</p>
          <p className="mt-1.5 text-xl font-semibold text-[color:var(--ui-text-primary)]">{openTableRows.length}</p>
        </article>
        <article className={cardClasses({ tone: refundImpact > 0 ? "danger" : "subtle", className: "p-3.5" })}>
          <p className="text-xs text-[color:var(--ui-text-secondary)]">Net tahsilat (iade etkisi sonrasi)</p>
          <p className="mt-1.5 text-xl font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(netCollected)}</p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Iptal / iade etkisi: {formatTryCurrency(refundImpact)}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.4fr]">
        <article className={cardClasses({ className: "p-0" })}>
          <div className="border-b border-[color:var(--ui-border)] px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Odeme yontemi kirilimi</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Yontem bazli adet ve tahsilat toplami.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Yontem</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Adet</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--ui-border)]">
                {PAYMENT_METHODS.map((method) => (
                  <tr key={method}>
                    <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">{method}</td>
                    <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">{breakdown[method].count}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[color:var(--ui-text-primary)]">
                      {formatTryCurrency(breakdown[method].total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className={cardClasses({ className: "p-0" })}>
          <div className="border-b border-[color:var(--ui-border)] px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Son odeme hareketleri</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">En yeni tahsilat kayitlari.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Saat</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Masa</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Iliski</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Yontem</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Tutar</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Alan personel</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Durum</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Not</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--ui-border)]">
                {recentPaymentRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[color:var(--ui-text-secondary)]">
                      Secili filtrelerde odeme hareketi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  recentPaymentRows.map((row) => {
                    const statusKey =
                      row.billRequest?.status === "SETTLED"
                        ? "SETTLED"
                        : row.billRequest?.status === "ACKNOWLEDGED"
                          ? "ACKNOWLEDGED"
                          : row.billRequest?.status === "PENDING"
                            ? "PENDING"
                            : "DIRECT";
                    const collector =
                      row.billRequest?.acknowledgedByStaff?.displayName?.trim() ||
                      row.billRequest?.acknowledgedByStaff?.username?.trim() ||
                      "-";

                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">{toIsoLocalTime(row.createdAt)}</td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">Masa {row.table.tableNo}</td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">
                          {row.billRequestId ? `Hesap #${row.billRequestId}` : "Masa tahsilati"}
                        </td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">{METHOD_LABELS[row.method]}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[color:var(--ui-text-primary)]">
                          {formatTryCurrency(row.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">{collector}</td>
                        <td className="px-4 py-2.5">
                          <span className={getStatusBadge(statusKey)}>{getStatusLabel(statusKey)}</span>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2.5 text-[color:var(--ui-text-secondary)]" title={row.note ?? "-"}>
                          {row.note ?? "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <article className={cardClasses({ className: "p-0" })}>
          <div className="border-b border-[color:var(--ui-border)] px-4 py-3 sm:px-5">
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Acik masa / kapanmayi bekleyen hesaplar</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Aktif masalarda kalan borc ve son hareket bilgisi.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Masa</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Hesap istendi</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Tahmini / kalan</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Son islem</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Hizli git</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--ui-border)]">
                {openTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-[color:var(--ui-text-secondary)]">
                      Kapanmayi bekleyen acik hesap bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  openTableRows.map((row) => (
                    <tr key={row.tableId}>
                      <td className="px-4 py-2.5 font-medium text-[color:var(--ui-text-primary)]">Masa {row.tableNo}</td>
                      <td className="px-4 py-2.5">
                        <span className={badgeClasses(row.openBill ? "warning" : "neutral")}>
                          {row.openBill ? "Evet" : "Hayir"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">
                        {formatTryCurrency(row.totalFromOrders)} / {formatTryCurrency(Math.max(0, row.remainingAmount))}
                      </td>
                      <td className="px-4 py-2.5 text-[color:var(--ui-text-secondary)]">
                        {row.lastActionAt ? toIsoLocalDateTime(row.lastActionAt) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link href="/restaurant/tables" className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8 px-2.5" })}>
                            Masaya git
                          </Link>
                          <Link href="/restaurant/orders" className={buttonClasses({ variant: "outline", size: "xs", className: "h-8 px-2.5" })}>
                            Siparisler
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className={cardClasses({ className: "p-4 sm:p-5" })}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Gun sonu ozeti</p>
              <h3 className="mt-1 text-base font-semibold text-[color:var(--ui-text-primary)]">Kapanis kutusu</h3>
            </div>
            <ReceiptText className="h-5 w-5 text-[color:var(--ui-text-secondary)]" />
          </div>

          <div className="mt-4 space-y-2.5">
            <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2.5 shadow-none" })}>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">Toplam siparis</span>
              <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{totalOrderCount}</span>
            </div>
            <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2.5 shadow-none" })}>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">Tamamlanan siparis</span>
              <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{completedOrderCount}</span>
            </div>
            <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2.5 shadow-none" })}>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">Tahsil edilen toplam</span>
              <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(grossCollected)}</span>
            </div>
            <div className={cardClasses({ tone: refundImpact > 0 ? "danger" : "subtle", className: "flex items-center justify-between px-3 py-2.5 shadow-none" })}>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">Iptal / iade etkisi</span>
              <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(refundImpact)}</span>
            </div>
            <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2.5 shadow-none" })}>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">Ortalama hesap tutari</span>
              <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                {averageCheckAmount == null ? "-" : formatTryCurrency(averageCheckAmount)}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-[color:var(--ui-text-secondary)]">Net tahsilat</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(netCollected)}</p>
              </div>
              <Wallet className="h-5 w-5 text-[color:var(--ui-primary)]" />
            </div>
            <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
              Ortalama hesap, secili araliktaki kapanan hesap adedi ({settledBillCount}) baz alinarak hesaplandi.
            </p>
          </div>

          <div className="mt-4">
            <Link href="/restaurant/reports" className={buttonClasses({ variant: "outline", size: "md", className: "h-10 w-full justify-center" })}>
              Raporlara gec
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
