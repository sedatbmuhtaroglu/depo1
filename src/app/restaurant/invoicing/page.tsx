import React from "react";
import { ClipboardList, Receipt, Table2, Wallet } from "lucide-react";
import { assertFeatureEnabled } from "@/core/entitlements/engine";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";

type OrderItem = { productId: number; quantity: number; price: number };
type RefundStatus = "NONE" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED";

const PRIMARY_CARD_CLASS = cardClasses({ className: "shadow-none" });
const SECONDARY_CARD_CLASS = cardClasses({ className: "shadow-none" });

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

export const dynamic = "force-dynamic";

function refundBadgeLabel(status: RefundStatus): string {
  if (status === "REFUND_PENDING") return "İade bekliyor";
  if (status === "REFUNDED") return "İade edildi";
  if (status === "REFUND_FAILED") return "İade başarısız";
  return "Aktif tahsilat";
}

function refundBadgeClass(status: RefundStatus): string {
  if (status === "REFUND_PENDING") return badgeClasses("warning");
  if (status === "REFUNDED") return badgeClasses("warning");
  if (status === "REFUND_FAILED") return badgeClasses("danger");
  return badgeClasses("success");
}

function formatDateCell(date: Date): { day: string; time: string } {
  const parsed = new Date(date);
  return {
    day: parsed.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Istanbul",
    }),
    time: parsed.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    }),
  };
}

function readRefundStatus(order: unknown): RefundStatus {
  const value = (order as { refundStatus?: unknown })?.refundStatus;
  if (value === "REFUND_PENDING" || value === "REFUNDED" || value === "REFUND_FAILED") {
    return value;
  }
  return "NONE";
}

function readRefundedAt(order: unknown): Date | null {
  const value = (order as { refundedAt?: unknown })?.refundedAt;
  return value instanceof Date ? value : null;
}

export default async function RestaurantInvoicingPage() {
  const { tenantId } = await getCurrentTenantOrThrow();
  try {
    await assertFeatureEnabled(tenantId, "INVOICING");
  } catch {
    return (
      <section className={cardClasses({ tone: "subtle", className: "p-6" })}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
          Modul Kilitli
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">
          Fatura / Fis Ozelligi Bu Tenantta Kapali
        </h2>
        <p className="mt-2 text-sm text-[color:var(--ui-text-secondary)]">
          HQ tarafindan INVOICING ozelligi acildiginda bu ekran tekrar kullanilabilir.
        </p>
      </section>
    );
  }

  const iyzicoPaidOrders = await prisma.order.findMany({
    where: {
      table: { restaurant: { tenantId } },
      status: "COMPLETED",
      requestedPaymentMethod: "CREDIT_CARD",
      paymentStatus: "PAID",
      OR: [{ paymentProvider: "IYZICO" }, { paymentProvider: null }],
    },
    select: {
      id: true,
      createdAt: true,
      totalPrice: true,
      items: true,
      ...(prismaModelHasField("Order", "refundStatus")
        ? ({ refundStatus: true, refundedAt: true } as Record<string, true>)
        : {}),
      table: { select: { tableNo: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const invoiceableOrders = iyzicoPaidOrders.filter((order) => {
    const status = readRefundStatus(order);
    return status !== "REFUND_PENDING" && status !== "REFUNDED";
  });
  const refundedOrders = iyzicoPaidOrders.filter((order) => {
    const status = readRefundStatus(order);
    return status === "REFUND_PENDING" || status === "REFUNDED";
  });

  const productIds = new Set<number>();
  for (const order of iyzicoPaidOrders) {
    const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
    for (const item of items) productIds.add(item.productId);
  }

  const productNames =
    productIds.size > 0
      ? await prisma.product.findMany({
          where: { id: { in: [...productIds] } },
          select: { id: true, nameTR: true },
        })
      : [];
  const nameMap = new Map(productNames.map((product) => [product.id, product.nameTR]));

  const invoiceableCount = invoiceableOrders.length;
  const totalInvoiceableAmount = invoiceableOrders.reduce(
    (sum, order) => sum + Number(order.totalPrice),
    0,
  );
  const totalRefundedAmount = refundedOrders.reduce(
    (sum, order) => sum + Number(order.totalPrice),
    0,
  );
  const uniqueTableCount = new Set(iyzicoPaidOrders.map((order) => order.table.tableNo)).size;
  const refundPendingCount = refundedOrders.filter(
    (order) => readRefundStatus(order) === "REFUND_PENDING",
  ).length;

  const buildItemSummary = (itemsRaw: unknown): { text: string; itemCount: number } => {
    const items = Array.isArray(itemsRaw) ? (itemsRaw as OrderItem[]) : [];
    const text = items
      .map((item) => `${item.quantity}x ${nameMap.get(item.productId) ?? `Ürün #${item.productId}`}`)
      .join(", ");
    return { text, itemCount: items.length };
  };

  return (
    <div className="space-y-6">
      <section className={`${PRIMARY_CARD_CLASS} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Tahsilat ve Evrak Operasyonu
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Fatura / Fiş</h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Tahsilat kayıtlarını ve faturalama/dışlama durumlarını finansal hiyerarşiyle takip edin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            Son 300 kayıt
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Fiş/Fatura Kaydı
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{invoiceableCount}</p>
              </div>
              <span className={cardClasses({ tone: "subtle", className: "inline-flex h-8 w-8 items-center justify-center rounded-lg p-0 shadow-none" })}>
                <Receipt className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Toplam Tahsilat</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {formatCurrency(totalInvoiceableAmount)}
                </p>
              </div>
              <span className={cardClasses({ tone: "subtle", className: "inline-flex h-8 w-8 items-center justify-center rounded-lg p-0 shadow-none" })}>
                <Wallet className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Masa Sayısı</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{uniqueTableCount}</p>
              </div>
              <span className={cardClasses({ tone: "subtle", className: "inline-flex h-8 w-8 items-center justify-center rounded-lg p-0 shadow-none" })}>
                <Table2 className="h-4 w-4" />
              </span>
            </div>
          </article>

          <article className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--ui-text-secondary)]">İade Süreci</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{refundPendingCount}</p>
              </div>
              <span className={cardClasses({ tone: "subtle", className: "inline-flex h-8 w-8 items-center justify-center rounded-lg p-0 shadow-none" })}>
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className={cardClasses({ tone: "subtle", className: "p-5 sm:p-6 shadow-none" })}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-info)]">
              Finansal Özet
            </p>
            <p className="mt-2 text-3xl font-semibold leading-tight text-[color:var(--ui-text-primary)]">
              {formatCurrency(totalInvoiceableAmount)}
            </p>
            <p className="mt-2 text-sm text-[color:var(--ui-text-secondary)]">
              Fiş/fatura adayı {invoiceableCount} kayıt ve iade sürecinde {refundedOrders.length} kayıt bulundu.
            </p>
          </div>
          <div className={cardClasses({ tone: "subtle", className: "rounded-xl px-3.5 py-2.5 text-xs shadow-none" })}>
            <p className="font-semibold">İade Toplamı</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--ui-text-primary)]">
              {formatCurrency(totalRefundedAmount)}
            </p>
          </div>
        </div>
      </section>

      <section className={`${SECONDARY_CARD_CLASS} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Fiş/Fatura Kesilecek Kayıtlar</h3>
            <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">
              Sipariş, masa, ürün, durum ve tutarı tek finansal tabloda izleyin.
            </p>
          </div>
          <span className="hidden rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)] sm:inline-flex">
            {invoiceableCount} kayıt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[color:var(--ui-surface-subtle)]">
              <tr className="border-b border-[color:var(--ui-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Sipariş
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Masa
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Ürün Özeti
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Durum
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Tutar
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  Tarih / Saat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ui-border-subtle)]">
              {invoiceableOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[color:var(--ui-text-secondary)]">
                    Bu aralıkta faturalanabilir İyzico tahsilatı bulunmuyor.
                  </td>
                </tr>
              ) : (
                invoiceableOrders.map((order) => {
                  const refundStatus = readRefundStatus(order);
                  const itemSummary = buildItemSummary(order.items);
                  const dateCell = formatDateCell(order.createdAt);

                  return (
                    <tr key={order.id} className="align-top transition-colors hover:bg-[color:var(--ui-surface-subtle)]">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[color:var(--ui-text-primary)]">#{order.id}</p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">İyzico tahsilatı</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={badgeClasses("info")}>
                          Masa {order.table.tableNo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-xl whitespace-normal break-words font-medium text-[color:var(--ui-text-primary)]">
                          {itemSummary.text || "-"}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{itemSummary.itemCount} ürün</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={refundBadgeClass(refundStatus)}>
                          {refundBadgeLabel(refundStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[color:var(--ui-text-primary)]">
                        {formatCurrency(Number(order.totalPrice))}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[color:var(--ui-text-primary)]">{dateCell.day}</p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{dateCell.time}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {refundedOrders.length > 0 && (
        <section className={cardClasses({ tone: "danger", className: "overflow-hidden shadow-none" })}>
          <div className="border-b border-[color:var(--ui-danger-border)] bg-[color:var(--ui-danger-soft)] px-4 py-3.5 sm:px-5">
            <h3 className="text-sm font-semibold text-[color:var(--ui-danger)]">İade Kayıtları (fatura dışı)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--ui-danger-soft)]">
                <tr className="border-b border-[color:var(--ui-danger-border)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Sipariş
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Masa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Ürün Özeti
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                    Tarih / Saat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--ui-danger-border)]">
                {refundedOrders.map((order) => {
                  const refundStatus = readRefundStatus(order);
                  const refundedAt = readRefundedAt(order);
                  const itemSummary = buildItemSummary(order.items);
                  const dateCell = formatDateCell(refundedAt ?? order.createdAt);

                  return (
                    <tr key={order.id} className="align-top transition-colors hover:bg-[color:var(--ui-danger-soft)]">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-[color:var(--ui-text-primary)]">#{order.id}</p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Fatura dışı kayıt</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={badgeClasses("info")}>
                          Masa {order.table.tableNo}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-xl whitespace-normal break-words font-medium text-[color:var(--ui-text-primary)]">
                          {itemSummary.text || "-"}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{itemSummary.itemCount} ürün</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={refundBadgeClass(refundStatus)}>
                          {refundBadgeLabel(refundStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[color:var(--ui-text-primary)]">
                        {formatCurrency(Number(order.totalPrice))}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[color:var(--ui-text-primary)]">{dateCell.day}</p>
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{dateCell.time}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}


