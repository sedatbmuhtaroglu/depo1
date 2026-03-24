import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  ClipboardList,
  Clock3,
  ShieldAlert,
  Table2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import RestaurantOrdersSection from "./orders-section";
import { toggleTableActive } from "@/app/actions/toggle-table-active";
import { STAFF_VISIBLE_ORDER_FILTER } from "@/lib/order-payment-visibility";
import { getTurkeyDateString } from "@/lib/turkey-time";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { getEndOfDayReportForTenant } from "@/lib/end-of-day-report";
import { parseCancellationCustomReason } from "@/lib/order-cancellation-finance";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";
import { formatStaffDisplayName } from "@/lib/person-display-name";
import { badgeClasses, buttonClasses, cardClasses } from "@/lib/ui/button-variants";
import { TenantSetupChecklist } from "@/modules/onboarding/components/tenant-setup-checklist";

const PANEL_CARD_CLASS = cardClasses({ className: "shadow-none" });

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(num);
}

function paymentMethodLabelByKey(method: string | null | undefined) {
  if (!method) return "Bilinmiyor";
  if (method === "IYZICO") return "Online (İyzico)";
  if (method === "CASH") return "Nakit";
  if (method === "LATER_PAY") return "Sonra Öde";
  if (method === "CREDIT_CARD") return "Kredi Kartı";
  if (method === "SODEXO") return "Sodexo";
  if (method === "MULTINET") return "Multinet";
  if (method === "TICKET") return "Ticket";
  if (method === "METROPOL") return "Metropol";
  return method;
}

export const dynamic = "force-dynamic";

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function endOfTodayUTC() {
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export default async function RestaurantDashboardPage() {
  const { tenantId } = await getCurrentTenantOrThrow();
  const todayStart = startOfTodayUTC();
  const todayEnd = endOfTodayUTC();
  const todayTurkeyDate = getTurkeyDateString();

  const dayEndReport = await getEndOfDayReportForTenant({
    tenantId,
    date: todayTurkeyDate,
  });

  const [
    tables,
    orders,
    activeSessions,
    billRequests,
    todayPayments,
    todayOrders,
    settledBillsToday,
    productNames,
    openWaiterCalls,
    recentCancellationEvents,
  ] = await Promise.all([
    prisma.table.findMany({
      where: {
        restaurant: {
          tenantId,
        },
      },
      include: {
        restaurant: true,
      },
      orderBy: { tableNo: "asc" },
    }),
    prisma.order.findMany({
      where: {
        table: {
          restaurant: {
            tenantId,
          },
        },
        AND: [STAFF_VISIBLE_ORDER_FILTER],
      },
      include: {
        table: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.tableSession.findMany({
      where: {
        tenantId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    }),
    prisma.billRequest.findMany({
      where: {
        tenantId,
        status: {
          in: ["PENDING", "ACKNOWLEDGED"],
        },
      },
      include: {
        table: true,
        acknowledgedByStaff: {
          select: { displayName: true, username: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.order.findMany({
      where: {
        table: { restaurant: { tenantId } },
        createdAt: { gte: todayStart, lt: todayEnd },
        AND: [STAFF_VISIBLE_ORDER_FILTER],
      },
      select: { id: true, items: true },
    }),
    prisma.billRequest.findMany({
      where: {
        tenantId,
        status: "SETTLED",
        settledAt: { gte: todayStart, lt: todayEnd },
      },
      select: { createdAt: true, settledAt: true },
    }),
    prisma.product.findMany({
      where: {
        category: { restaurant: { tenantId } },
      },
      select: { id: true, nameTR: true },
    }),
    prisma.waiterCall.findMany({
      where: {
        tenantId,
        status: {
          in: ["PENDING", "ACKNOWLEDGED"],
        },
      },
      include: {
        table: true,
        acknowledgedByStaff: {
          select: { displayName: true, username: true },
        },
      },
    }),
    prisma.orderItemCancellation.findMany({
      where: {
        tenantId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      select: {
        id: true,
        orderId: true,
        productId: true,
        quantity: true,
        reason: true,
        customReason: true,
        createdAt: true,
        order: {
          select: {
            table: { select: { tableNo: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const todayOrderCount = todayOrders.length;
  const todayRevenue = dayEndReport.totalRevenue;
  const avgTableTimeMinutes =
    settledBillsToday.length > 0
      ? settledBillsToday.reduce(
          (acc, b) =>
            acc +
            (b.settledAt && b.createdAt
              ? (b.settledAt.getTime() - b.createdAt.getTime()) / 60000
              : 0),
          0,
        ) / settledBillsToday.length
      : null;
  const productIdCount: Record<number, number> = {};
  const todayOrderIds = todayOrders.map((order) => order.id);
  const [todayCancellations, todayAdjustments] = await Promise.all([
    todayOrderIds.length > 0
      ? prisma.orderItemCancellation.findMany({
          where: {
            tenantId,
            orderId: { in: todayOrderIds },
            createdAt: { gte: todayStart, lt: todayEnd },
          },
          select: { orderId: true, productId: true, quantity: true },
        })
      : Promise.resolve([]),
    todayOrderIds.length > 0
      ? prisma.cashOrderAdjustment.findMany({
          where: {
            tenantId,
            orderId: { in: todayOrderIds },
            createdAt: { gte: todayStart, lt: todayEnd },
          },
          select: { orderId: true, productId: true, adjustedQuantity: true },
        })
      : Promise.resolve([]),
  ]);
  const todayCancellationMap = buildOrderItemAdjustmentMap(todayCancellations);
  const todayAdjustmentMap = buildOrderItemAdjustmentMap(
    todayAdjustments.map((row) => ({
      orderId: row.orderId,
      productId: row.productId,
      quantity: row.adjustedQuantity,
    })),
  );

  for (const order of todayOrders) {
    const items = order.items as { productId: number; quantity: number }[];
    for (const it of items) {
      const effectiveQty = getEffectiveOrderItemQuantity({
        orderId: order.id,
        productId: it.productId,
        originalQuantity: it.quantity,
        cancellationMap: todayCancellationMap,
        cashAdjustmentMap: todayAdjustmentMap,
      });
      productIdCount[it.productId] = (productIdCount[it.productId] || 0) + effectiveQty;
    }
  }
  const topProductId = Object.entries(productIdCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topProductName = topProductId
    ? productNames.find((p) => p.id === Number(topProductId))?.nameTR ?? "-"
    : "-";
  const paymentsByMethod: Record<string, number> = {};
  for (const p of todayPayments) {
    const m = p.method;
    paymentsByMethod[m] = (paymentsByMethod[m] || 0) + Number(p.amount);
  }

  const activeTableIds = new Set(activeSessions.map((s) => s.tableId));
  const blockedTableIds = new Set(
    activeSessions
      .filter((s) => s.blockedUntil && s.blockedUntil > new Date())
      .map((s) => s.tableId),
  );

  const pendingApprovalOrders = orders.filter(
    (order) => order.status === "PENDING_WAITER_APPROVAL",
  );
  const preparingOrders = orders.filter((order) => order.status === "PREPARING");
  const completedOrders = orders.filter((order) => order.status === "COMPLETED");
  const readyForPickupCount = orders.filter(
    (order) =>
      order.status === "COMPLETED" &&
      order.readyAt != null &&
      order.deliveredAt == null,
  ).length;

  const activeTablesCount = tables.filter((t) => t.isActive).length;

  const tableLastOrderMap = new Map<
    number,
    {
      status: string;
      createdAt: Date;
      totalPrice: string;
      id: number;
    }
  >();

  for (const order of orders) {
    const existing = tableLastOrderMap.get(order.tableId);
    if (!existing || order.createdAt > existing.createdAt) {
      tableLastOrderMap.set(order.tableId, {
        status: order.status,
        createdAt: order.createdAt,
        totalPrice: order.totalPrice.toString(),
        id: order.id,
      });
    }
  }

  const waitingApproval = orders.filter(
    (order) => order.status === "PENDING_WAITER_APPROVAL",
  );

  const activeOrderStatuses = ["PENDING", "PREPARING"];
  const activeOrders = orders.filter((order) =>
    activeOrderStatuses.includes(order.status),
  );

  const rejectedOrders = orders.filter((order) => order.status === "REJECTED");

  const billRequestTableIds = new Set(
    billRequests
      .filter((request) => request.table.isActive)
      .map((request) => request.tableId),
  );

  const tableBillingMap = new Map(
    await Promise.all(
      tables.map(async (table) => [
        table.id,
        await getTableBillingSnapshot({
          tenantId,
          tableId: table.id,
        }),
      ] as const),
    ),
  );

  const waiterCallsByTableId = new Map<number, typeof openWaiterCalls[0]>();
  for (const call of openWaiterCalls) {
    waiterCallsByTableId.set(call.tableId, call);
  }

  const productNameMap = new Map(productNames.map((product) => [product.id, product.nameTR]));
  const managerFinancialNotifications = recentCancellationEvents.map((event) => {
    const parsed = parseCancellationCustomReason(event.customReason);
    const eventType =
      parsed.operationType === "REFUND"
        ? "İade"
        : parsed.operationType === "CANCEL"
          ? "İptal"
          : "İptal";
    const amountText =
      parsed.operationType === "REFUND" && parsed.refundedAmount != null && parsed.refundedAmount > 0
        ? formatCurrency(parsed.refundedAmount)
        : "-";
    return {
      id: event.id,
      orderId: event.orderId,
      tableNo: event.order.table.tableNo,
      productName: productNameMap.get(event.productId) ?? `Ürün #${event.productId}`,
      quantity: event.quantity,
      eventKind: parsed.operationType,
      eventType,
      paymentMethod: paymentMethodLabelByKey(parsed.selectedPaymentMethod),
      refundedAmount: amountText,
      createdAt: event.createdAt,
    };
  });

  const hasReadyForPickup = readyForPickupCount > 0;
  const hasBillRequests = billRequests.length > 0;
  const hasHeavyQueue = pendingApprovalOrders.length > 3 || billRequests.length > 3;
  const hasBlockedTables = blockedTableIds.size > 0;
  const hasIssues = hasBlockedTables || hasHeavyQueue;
  const pendingOrderCount = waitingApproval.length + activeOrders.length;

  const waitingApprovalForClient = waitingApproval.map((order) => ({
    id: order.id,
    table: { tableNo: order.table.tableNo },
    totalPrice: order.totalPrice.toString(),
    status: order.status,
    createdAt: order.createdAt,
    preparingStartedAt: order.preparingStartedAt,
  }));

  const activeOrdersForClient = activeOrders.map((order) => ({
    id: order.id,
    table: { tableNo: order.table.tableNo },
    totalPrice: order.totalPrice.toString(),
    status: order.status,
    createdAt: order.createdAt,
    preparingStartedAt: order.preparingStartedAt,
  }));

  const rejectedOrdersForClient = rejectedOrders.map((order) => ({
    id: order.id,
    table: { tableNo: order.table.tableNo },
    totalPrice: order.totalPrice.toString(),
    status: order.status,
    createdAt: order.createdAt,
    preparingStartedAt: order.preparingStartedAt,
  }));

  const paymentMethodSummary = Object.entries(paymentsByMethod).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-6 pb-1">
      <TenantSetupChecklist tenantId={tenantId} />

      <section className={`${PANEL_CARD_CLASS} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Dashboard
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">
              Operasyon Özeti
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Masa, sipariş ve finans akışını tek ekranda canlı takip edin.
            </p>
          </div>
          <Link
            href={`/restaurant/reports?day=${todayTurkeyDate}&from=${todayTurkeyDate}&to=${todayTurkeyDate}`}
            className={buttonClasses({ variant: "primary", size: "md", className: "h-10 px-4" })}
          >
            Gün Sonu Al
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Aktif Masa"
            value={activeTablesCount}
            helper={`Toplam ${tables.length} masanın ${activeTablesCount} tanesi aktif`}
            icon={Table2}
          />
          <KpiCard
            label="Bekleyen Sipariş"
            value={pendingOrderCount}
            helper={`Onay: ${pendingApprovalOrders.length} â€¢ Hazırlık: ${preparingOrders.length}`}
            icon={ClipboardList}
            tone="warning"
          />
          <KpiCard
            label="Bugünkü Ciro"
            value={formatCurrency(todayRevenue)}
            helper={`Bugün ${todayOrderCount} sipariş tamamlandı`}
            icon={Wallet}
            tone="success"
          />
          <KpiCard
            label="Hesap İsteyen Masa"
            value={billRequestTableIds.size}
            helper={`Açık hesap talebi: ${billRequests.length}`}
            icon={BellRing}
            tone="danger"
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <RestaurantOrdersSection
            waitingApproval={waitingApprovalForClient}
            activeOrders={activeOrdersForClient}
            rejectedOrders={rejectedOrdersForClient}
          />

          <div className={`${PANEL_CARD_CLASS} p-4 sm:p-5`}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[color:var(--ui-text-primary)]">
                  Canlı Masa Operasyonu
                </h3>
                <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                  Masa bazında anlık akış ve servis yükü
                </p>
              </div>
              <span className={badgeClasses("neutral")}>
                {tables.length} masa
              </span>
            </div>

            {tables.length === 0 ? (
              <EmptyState
                title="Masa bulunamadı"
                description="Yeni masa eklendiğinde burada canlı durum kartı görüntülenecek."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {tables.map((table) => {
                  const lastOrder = tableLastOrderMap.get(table.id);
                  const isActive = activeTableIds.has(table.id);
                  const isBlocked = blockedTableIds.has(table.id);
                  const hasOpenBillRequest =
                    isActive && billRequestTableIds.has(table.id);
                  const billing = tableBillingMap.get(table.id);
                  const totalFromOrders = billing?.totalFromOrders ?? 0;
                  const unpaid = billing?.totalUnpaid ?? 0;
                  const activeOrderCount = orders.filter(
                    (order) =>
                      order.tableId === table.id &&
                      ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING"].includes(
                        order.status,
                      ),
                  ).length;
                  const billInfo = billRequests.find((b) => b.tableId === table.id);
                  const callInfo = waiterCallsByTableId.get(table.id);

                  const tone = isBlocked
                    ? {
                        card: "border-[color:var(--ui-danger-border)] bg-[color:var(--ui-danger-soft)]",
                        badge: "border-[color:var(--ui-danger-border)] bg-[color:var(--ui-danger-soft)] text-[color:var(--ui-danger)]",
                        text: "Güvenlik blokajı",
                      }
                    : hasOpenBillRequest
                      ? {
                          card: "border-[color:var(--ui-warning-border)] bg-[color:var(--ui-warning-soft)]",
                          badge: "border-[color:var(--ui-warning-border)] bg-[color:var(--ui-warning-soft)] text-[color:var(--ui-warning)]",
                          text: "Hesap bekliyor",
                        }
                      : isActive
                        ? {
                            card: "border-[color:var(--ui-success-border)] bg-[color:var(--ui-success-soft)]",
                            badge: "border-[color:var(--ui-success-border)] bg-[color:var(--ui-success-soft)] text-[color:var(--ui-success)]",
                            text: "Oturum aktif",
                          }
                        : {
                            card: "border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)]",
                            badge: "border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] text-[color:var(--ui-text-secondary)]",
                            text: "Oturum yok",
                          };

                  return (
                    <div
                      key={table.id}
                      className={`rounded-xl border px-3.5 py-3.5 ${tone.card}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                            Masa
                          </p>
                          <p className="text-lg font-semibold text-[color:var(--ui-text-primary)]">
                            {table.tableNo}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.badge}`}
                        >
                          {tone.text}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-[color:var(--ui-text-secondary)]">
                        <p>
                          Durum:{" "}
                          <span className="font-semibold text-[color:var(--ui-text-primary)]">
                            {isActive
                              ? activeOrderCount > 0
                                ? "Açık (sipariş var)"
                                : "Açık (boş)"
                              : "Kapalı"}
                          </span>
                        </p>
                        <p>
                          Aktif sipariş:{" "}
                          <span className="font-semibold text-[color:var(--ui-text-primary)]">
                            {activeOrderCount}
                          </span>
                        </p>
                        <p>
                          Hesap isteği:{" "}
                          <span className="font-semibold text-[color:var(--ui-text-primary)]">
                            {billInfo ? "Var" : "Yok"}
                          </span>
                          {billInfo?.acknowledgedByStaff && (
                            <span className="ml-1">
                              â€¢ İlgilenen:{" "}
                              {formatStaffDisplayName(billInfo.acknowledgedByStaff)}
                            </span>
                          )}
                        </p>
                        <p>
                          Garson çağrısı:{" "}
                          <span className="font-semibold text-[color:var(--ui-text-primary)]">
                            {callInfo ? "Var" : "Yok"}
                          </span>
                          {callInfo?.acknowledgedByStaff && (
                            <span className="ml-1">
                              â€¢ İlgilenen:{" "}
                              {formatStaffDisplayName(callInfo.acknowledgedByStaff)}
                            </span>
                          )}
                        </p>
                        <p>
                          Borç:{" "}
                          <span className="font-semibold text-[color:var(--ui-text-primary)]">
                            {formatCurrency(totalFromOrders)}
                          </span>{" "}
                          <span>(Kalan: {formatCurrency(unpaid)})</span>
                        </p>
                        {lastOrder ? (
                          <p>
                            Son sipariş:{" "}
                            <span className="font-semibold text-[color:var(--ui-text-primary)]">
                              #{lastOrder.id} â€¢ {formatCurrency(lastOrder.totalPrice)}
                            </span>
                          </p>
                        ) : (
                          <p>Bu masadan henüz sipariş yok.</p>
                        )}
                      </div>

                      <form
                        className="mt-3"
                        action={async () => {
                          "use server";
                          await toggleTableActive(table.id, !table.isActive);
                        }}
                      >
                        <button
                          type="submit"
                          className={buttonClasses({
                            variant: table.isActive ? "primary" : "secondary",
                            size: "xs",
                            className: "h-8 w-full",
                          })}
                        >
                          {table.isActive ? "Masayı Kapat" : "Masayı Aç"}
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-5">
          <div className={`${PANEL_CARD_CLASS} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Dikkat Gerektiren Alanlar
              </h3>
              <span
                className={badgeClasses(hasIssues ? "danger" : "success")}
              >
                {hasIssues ? "Takip Et" : "Stabil"}
              </span>
            </div>
            <div className="space-y-2">
              <QuickMetricRow
                label="Bekleyen sipariş"
                value={pendingOrderCount}
                note={`Onay: ${pendingApprovalOrders.length} â€¢ Hazırlık: ${preparingOrders.length}`}
                icon={Activity}
              />
              <QuickMetricRow
                label="Teslim bekleyen hazır sipariş"
                value={readyForPickupCount}
                note={hasReadyForPickup ? "Anlık teslim bekliyor" : "Bekleyen yok"}
                icon={Clock3}
              />
              <QuickMetricRow
                label="Hesap isteyen masa"
                value={billRequestTableIds.size}
                note={hasBillRequests ? "Servis aksiyonu bekliyor" : "Talep yok"}
                icon={BellRing}
              />
              <QuickMetricRow
                label="Bloklu masa"
                value={blockedTableIds.size}
                note={hasBlockedTables ? "Güvenlik kontrolü gerekli" : "Blokaj yok"}
                icon={ShieldAlert}
              />
            </div>
          </div>

          <div className={`${PANEL_CARD_CLASS} p-4`}>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Bugünkü Kısa Durum</h3>
            <div className="mt-3 grid gap-2">
              <div className={cardClasses({ className: "rounded-xl px-3 py-2 shadow-none" })}>
                <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Toplam Sipariş</p>
                <p className="mt-0.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">{todayOrderCount}</p>
              </div>
              <div className={cardClasses({ className: "rounded-xl px-3 py-2 shadow-none" })}>
                <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">
                  Tamamlanan Sipariş
                </p>
                <p className="mt-0.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {completedOrders.length}
                </p>
              </div>
              <div className={cardClasses({ className: "rounded-xl px-3 py-2 shadow-none" })}>
                <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">
                  Ortalama Masa Süresi
                </p>
                <p className="mt-0.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                  {avgTableTimeMinutes != null
                    ? `${Math.round(avgTableTimeMinutes)} dk`
                    : "-"}
                </p>
              </div>
              <div className={cardClasses({ className: "rounded-xl px-3 py-2 shadow-none" })}>
                <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">
                  En Çok Sipariş Edilen
                </p>
                <p className="mt-0.5 truncate text-base font-semibold text-[color:var(--ui-text-primary)]">
                  {topProductName}
                </p>
              </div>
            </div>
          </div>

          <div className={`${PANEL_CARD_CLASS} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Tahsilat Dağılımı</h3>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">{formatCurrency(todayRevenue)}</span>
            </div>

            {paymentMethodSummary.length === 0 ? (
              <EmptyState
                title="Bugün tahsilat kaydı yok"
                description="Ödeme alındığında yöntem bazlı dağılım burada görünecek."
              />
            ) : (
              <div className="space-y-2">
                {paymentMethodSummary.map(([method, amount]) => (
                  <div
                    key={method}
                    className={cardClasses({
                      className: "flex items-center justify-between rounded-xl px-3 py-2 shadow-none",
                    })}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-[color:var(--ui-text-secondary)]" />
                      <span className="text-xs font-medium text-[color:var(--ui-text-secondary)]">
                        {paymentMethodLabelByKey(method)}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`${PANEL_CARD_CLASS} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Finansal İşlem Bildirimleri
              </h3>
              <span className="text-xs text-[color:var(--ui-text-secondary)]">Bugün</span>
            </div>

            {managerFinancialNotifications.length === 0 ? (
              <EmptyState
                title="Bugün finansal bildirim yok"
                description="İptal veya iade işlemleri oluştuğunda burada listelenir."
              />
            ) : (
              <div className="space-y-2">
                {managerFinancialNotifications.slice(0, 6).map((event) => (
                  <div
                    key={event.id}
                    className={cardClasses({ className: "rounded-xl px-3 py-2 shadow-none" })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[color:var(--ui-text-primary)]">
                        {event.eventType} â€¢ Sipariş #{event.orderId} â€¢ Masa {event.tableNo}
                      </p>
                      <span className={badgeClasses(event.eventKind === "REFUND" ? "danger" : "warning")}>
                        {event.eventType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                      Ürün: <span className="font-medium text-[color:var(--ui-text-primary)]">{event.productName}</span>{" "}
                      â€¢ Adet: <span className="font-medium text-[color:var(--ui-text-primary)]">{event.quantity}</span>
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                      Ödeme: <span className="font-medium text-[color:var(--ui-text-primary)]">{event.paymentMethod}</span>{" "}
                      â€¢ İade: <span className="font-medium text-[color:var(--ui-text-primary)]">{event.refundedAmount}</span>
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                      {event.createdAt.toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))}
                {managerFinancialNotifications.length > 6 && (
                  <p className="text-center text-xs text-[color:var(--ui-text-secondary)]">
                    +{managerFinancialNotifications.length - 6} kayıt daha var
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "success" | "danger";
};

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: KpiCardProps) {
  const iconTone =
    tone === "warning"
      ? "text-[color:var(--ui-warning)]"
      : tone === "success"
        ? "text-[color:var(--ui-success)]"
        : tone === "danger"
          ? "text-[color:var(--ui-danger)]"
          : "text-[color:var(--ui-text-secondary)]";

  return (
    <article className={cardClasses({ className: "p-4 shadow-none" })}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-[color:var(--ui-text-primary)]">{value}</p>
        </div>
        <div className={cardClasses({ tone: "subtle", className: "inline-flex h-9 w-9 items-center justify-center rounded-xl p-0 shadow-none" })}>
          <Icon className={`h-4.5 w-4.5 ${iconTone}`} />
        </div>
      </div>
      <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">{helper}</p>
    </article>
  );
}

type QuickMetricRowProps = {
  label: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
};

function QuickMetricRow({ label, value, note, icon: Icon }: QuickMetricRowProps) {
  return (
    <div className={cardClasses({ className: "px-3 py-2 shadow-none" })}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[color:var(--ui-text-secondary)]" />
          <p className="truncate text-xs font-medium text-[color:var(--ui-text-secondary)]">{label}</p>
        </div>
        <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{value}</p>
      </div>
      <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{note}</p>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description: string;
};

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className={cardClasses({ tone: "subtle", className: "border-dashed px-4 py-5 text-center shadow-none" })}>
      <AlertTriangle className="mx-auto h-4 w-4 text-[color:var(--ui-text-secondary)]" />
      <p className="mt-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">{description}</p>
    </div>
  );
}

