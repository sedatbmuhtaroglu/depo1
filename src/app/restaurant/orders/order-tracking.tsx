"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  LayoutGrid,
  List,
  Search,
  Timer,
} from "lucide-react";
import {
  getOrderPaymentMethodLabel,
  getOrderPaymentStateLabel,
} from "@/lib/order-payment-visibility";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  selectClasses,
} from "@/lib/ui/button-variants";

type OrderItem = {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  cancelledQuantity?: number;
  adjustedQuantity?: number;
  effectiveQuantity?: number;
};

type Order = {
  id: number;
  tableNo: number;
  status: string;
  totalPrice: string;
  createdAt: Date;
  readyAt: Date | null;
  preparingStartedAt: Date | null;
  deliveredAt: Date | null;
  note: string | null;
  items: OrderItem[];
  originalTotalPrice?: number;
  effectiveTotalPrice?: number;
  cancellationCount?: number;
  cashAdjustmentCount?: number;
  isRiskFlagged?: boolean;
  riskScore?: number;
  riskLevel?: string | null;
  riskReasons?: string[];
  requestedPaymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentProvider?: string | null;
  refundStatus?: string | null;
};

type DisplayStatusKey =
  | "WAITING"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUND"
  | "PAYMENT_ISSUE";

type ChannelKey =
  | "ONLINE"
  | "CASH"
  | "CARD"
  | "MEAL_CARD"
  | "LATER_PAY"
  | "OTHER";

type AttentionLevel = "NORMAL" | "MEDIUM" | "HIGH" | "CRITICAL";
type TimeFilter = "ALL" | "TODAY" | "LAST_3H" | "LAST_24H";
type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

type DecoratedOrder = {
  order: Order;
  status: { key: DisplayStatusKey; label: string };
  channel: { key: ChannelKey; label: string };
  queueMinutes: number;
  attentionLevel: AttentionLevel;
  paymentMethodLabel: string;
  paymentStateLabel: string;
  riskReasons: string[];
  riskLevel: "low" | "medium" | "high";
};

const PANEL_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });
const SECTION_CARD_CLASS = cardClasses({ className: "p-3.5 sm:p-4" });
const INPUT_CLASS = fieldClasses({ size: "md" });
const SELECT_CLASS = selectClasses({ size: "md" });

const displayStatusOptions: Array<{ key: DisplayStatusKey; label: string }> = [
  { key: "WAITING", label: "Bekliyor" },
  { key: "PREPARING", label: "Hazırlanıyor" },
  { key: "READY", label: "Hazır" },
  { key: "DELIVERED", label: "Teslim edildi" },
  { key: "CANCELLED", label: "İptal" },
  { key: "REFUND", label: "İade" },
  { key: "PAYMENT_ISSUE", label: "Ödeme sorunu" },
];

function normalizeRiskLevel(level?: string | null): "low" | "medium" | "high" {
  const normalized = level?.toLowerCase();
  if (normalized === "high" || normalized === "medium") return normalized;
  return "low";
}

function formatCurrency(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function dateToMs(value: Date | string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  return ms;
}

function minutesSince(date: Date | string | null | undefined, nowMs: number) {
  const ms = dateToMs(date);
  if (ms == null) return 0;
  return Math.max(0, Math.floor((nowMs - ms) / 60000));
}

function getDisplayStatus(order: Order): { key: DisplayStatusKey; label: string } {
  if (order.status === "REJECTED") {
    return { key: "CANCELLED", label: "İptal" };
  }

  if (order.refundStatus && order.refundStatus !== "NONE") {
    if (order.refundStatus === "REFUND_PENDING") {
      return { key: "REFUND", label: "İade bekliyor" };
    }
    if (order.refundStatus === "REFUND_FAILED") {
      return { key: "PAYMENT_ISSUE", label: "İade hatası" };
    }
    return { key: "REFUND", label: "İade edildi" };
  }

  if (order.paymentStatus === "FAILED") {
    return { key: "PAYMENT_ISSUE", label: "Ödeme sorunlu" };
  }

  if (order.status === "COMPLETED") {
    if (order.readyAt && !order.deliveredAt) {
      return { key: "READY", label: "Hazır" };
    }
    return { key: "DELIVERED", label: "Teslim edildi" };
  }

  if (order.status === "PREPARING") {
    return { key: "PREPARING", label: "Hazırlanıyor" };
  }

  return { key: "WAITING", label: "Bekliyor" };
}

function getStatusBadgeVariant(status: DisplayStatusKey): BadgeVariant {
  if (status === "WAITING") return "warning";
  if (status === "PREPARING") return "info";
  if (status === "READY") return "success";
  if (status === "DELIVERED") return "neutral";
  if (status === "CANCELLED") return "danger";
  if (status === "REFUND") return "warning";
  return "danger";
}

function getOrderChannel(order: Order): { key: ChannelKey; label: string } {
  if (order.paymentProvider === "IYZICO") {
    return { key: "ONLINE", label: "Online" };
  }

  if (order.requestedPaymentMethod === "CASH") {
    return { key: "CASH", label: "Nakit" };
  }
  if (order.requestedPaymentMethod === "CREDIT_CARD") {
    return { key: "CARD", label: "Kart" };
  }
  if (
    order.requestedPaymentMethod === "SODEXO" ||
    order.requestedPaymentMethod === "MULTINET" ||
    order.requestedPaymentMethod === "TICKET" ||
    order.requestedPaymentMethod === "METROPOL"
  ) {
    return { key: "MEAL_CARD", label: "Yemek kartı" };
  }
  if (order.requestedPaymentMethod === "LATER_PAY") {
    return { key: "LATER_PAY", label: "Sonra öde" };
  }
  return { key: "OTHER", label: "Diğer" };
}

function getQueueMinutes(order: Order, status: DisplayStatusKey, nowMs: number) {
  if (status === "PREPARING" || status === "READY") {
    return minutesSince(order.preparingStartedAt ?? order.createdAt, nowMs);
  }
  return minutesSince(order.createdAt, nowMs);
}

function getAttentionLevel(
  order: Order,
  status: DisplayStatusKey,
  queueMinutes: number,
  riskLevel: "low" | "medium" | "high",
) {
  if (status === "PAYMENT_ISSUE") return "CRITICAL";
  if (status === "REFUND" && order.refundStatus === "REFUND_PENDING") return "HIGH";
  if (status === "WAITING" && queueMinutes >= 18) return "HIGH";
  if (status === "PREPARING" && queueMinutes >= 25) return "HIGH";
  if (status === "READY" && queueMinutes >= 10) return "HIGH";
  if (riskLevel === "high") return "HIGH";
  if (status === "WAITING" && queueMinutes >= 10) return "MEDIUM";
  if (status === "PREPARING" && queueMinutes >= 15) return "MEDIUM";
  if (riskLevel === "medium") return "MEDIUM";
  return "NORMAL";
}

function getAttentionRank(level: AttentionLevel) {
  if (level === "CRITICAL") return 4;
  if (level === "HIGH") return 3;
  if (level === "MEDIUM") return 2;
  return 1;
}

function getAttentionText(level: AttentionLevel, queueMinutes: number, status: DisplayStatusKey) {
  if (level === "CRITICAL") return "Kritik";
  if (level === "HIGH" || level === "MEDIUM") {
    if (status === "WAITING") return `Bekleme ${queueMinutes} dk`;
    if (status === "PREPARING") return `Hazırlık ${queueMinutes} dk`;
    if (status === "READY") return `Hazır ${queueMinutes} dk`;
    return "İnceleme gerekli";
  }
  return `${queueMinutes} dk`;
}

function getAttentionBadgeVariant(level: AttentionLevel): BadgeVariant {
  if (level === "CRITICAL") return "danger";
  if (level === "HIGH") return "warning";
  if (level === "MEDIUM") return "info";
  return "neutral";
}

function getSummaryTone(tone: BadgeVariant): "default" | "subtle" | "warning" | "danger" | "success" {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "danger") return "danger";
  if (tone === "info") return "subtle";
  return "default";
}

function getOrderCardTone(level: AttentionLevel): "default" | "subtle" | "warning" | "danger" {
  if (level === "CRITICAL") return "danger";
  if (level === "HIGH") return "warning";
  if (level === "MEDIUM") return "subtle";
  return "default";
}

function matchesTimeFilter(createdAt: Date, filter: TimeFilter, nowMs: number) {
  if (filter === "ALL") return true;
  const createdMs = new Date(createdAt).getTime();
  const diffHours = (nowMs - createdMs) / 3600000;
  if (filter === "LAST_3H") return diffHours <= 3;
  if (filter === "LAST_24H") return diffHours <= 24;

  const now = new Date(nowMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return createdMs >= todayStart;
}

type OrderTrackingProps = {
  orders: Order[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export default function OrderTracking({
  orders,
  page,
  pageSize,
  totalCount,
}: OrderTrackingProps) {
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState<DisplayStatusKey | "">("");
  const [filterChannel, setFilterChannel] = useState<ChannelKey | "">("");
  const [filterTable, setFilterTable] = useState<string>("");
  const [filterOps, setFilterOps] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");
  const [compactView, setCompactView] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<number, boolean>>({});
  const [nowMs, setNowMs] = useState(0);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  const decoratedOrders = useMemo<DecoratedOrder[]>(() => {
    return orders.map((order) => {
      const status = getDisplayStatus(order);
      const riskLevel = normalizeRiskLevel(order.riskLevel);
      const channel = getOrderChannel(order);
      const queueMinutes = getQueueMinutes(order, status.key, nowMs);
      const attentionLevel = getAttentionLevel(order, status.key, queueMinutes, riskLevel);

      const paymentMethodLabel = getOrderPaymentMethodLabel({
        requestedPaymentMethod: (order.requestedPaymentMethod as
          | "CASH"
          | "CREDIT_CARD"
          | "SODEXO"
          | "MULTINET"
          | "TICKET"
          | "METROPOL"
          | null) ?? null,
        paymentProvider: (order.paymentProvider as "IYZICO" | null) ?? null,
      });

      const paymentStateLabel = getOrderPaymentStateLabel({
        paymentStatus: (order.paymentStatus as
          | "PENDING"
          | "INITIATED"
          | "PAID"
          | "FAILED"
          | null) ?? null,
      });

      return {
        order,
        status,
        channel,
        queueMinutes,
        attentionLevel,
        paymentMethodLabel,
        paymentStateLabel,
        riskReasons: order.riskReasons ?? [],
        riskLevel,
      };
    });
  }, [orders, nowMs]);

  const tableOptions = useMemo(
    () => [...new Set(decoratedOrders.map((row) => row.order.tableNo))].sort((a, b) => a - b),
    [decoratedOrders],
  );

  const channelOptions = useMemo(
    () => [...new Set(decoratedOrders.map((row) => row.channel.key))],
    [decoratedOrders],
  );

  const filteredOrders = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return decoratedOrders
      .filter((row) => {
        if (filterStatus && row.status.key !== filterStatus) return false;
        if (filterChannel && row.channel.key !== filterChannel) return false;
        if (filterTable && row.order.tableNo !== Number(filterTable)) return false;
        if (!matchesTimeFilter(row.order.createdAt, timeFilter, nowMs)) return false;

        if (filterOps === "HAS_CANCELLATION" && (row.order.cancellationCount ?? 0) <= 0) {
          return false;
        }
        if (filterOps === "HAS_ADJUSTMENT" && (row.order.cashAdjustmentCount ?? 0) <= 0) {
          return false;
        }
        if (
          filterOps === "REFUND_PROCESS" &&
          !["REFUND_PENDING", "REFUNDED", "REFUND_FAILED"].includes(
            row.order.refundStatus ?? "NONE",
          )
        ) {
          return false;
        }

        if (!query) return true;

        const textBlob = [
          `#${row.order.id}`,
          `masa ${row.order.tableNo}`,
          row.status.label,
          row.channel.label,
          row.paymentMethodLabel,
          ...row.order.items.map((item) => item.productName),
        ]
          .join(" ")
          .toLowerCase();

        return textBlob.includes(query);
      })
      .sort((a, b) => {
        const attentionDiff = getAttentionRank(b.attentionLevel) - getAttentionRank(a.attentionLevel);
        if (attentionDiff !== 0) return attentionDiff;
        if (b.queueMinutes !== a.queueMinutes) return b.queueMinutes - a.queueMinutes;
        return new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime();
      });
  }, [
    decoratedOrders,
    filterStatus,
    filterChannel,
    filterTable,
    filterOps,
    timeFilter,
    nowMs,
    searchText,
  ]);

  const summary = useMemo(() => {
    return {
      total: decoratedOrders.length,
      waiting: decoratedOrders.filter((row) => row.status.key === "WAITING").length,
      preparing: decoratedOrders.filter((row) => row.status.key === "PREPARING").length,
      ready: decoratedOrders.filter((row) => row.status.key === "READY").length,
      attention: decoratedOrders.filter((row) => getAttentionRank(row.attentionLevel) >= 3).length,
    };
  }, [decoratedOrders]);

  const sections = useMemo(() => {
    const waiting = filteredOrders.filter((row) => row.status.key === "WAITING");
    const preparing = filteredOrders.filter((row) => row.status.key === "PREPARING");
    const ready = filteredOrders.filter((row) => row.status.key === "READY");
    const delivered = filteredOrders.filter((row) => row.status.key === "DELIVERED");
    const cancelled = filteredOrders.filter((row) => row.status.key === "CANCELLED");
    const issues = filteredOrders.filter(
      (row) => row.status.key === "REFUND" || row.status.key === "PAYMENT_ISSUE",
    );

    return [
      { key: "WAITING", title: "Bekleyen", orders: waiting },
      { key: "PREPARING", title: "Hazırlanan", orders: preparing },
      { key: "READY", title: "Hazır", orders: ready },
      { key: "DELIVERED", title: "Teslim", orders: delivered },
      { key: "CANCELLED", title: "İptal", orders: cancelled },
      { key: "ISSUES", title: "İade / Sorun", orders: issues },
    ].filter((section) => section.orders.length > 0);
  }, [filteredOrders]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleExpand = (orderId: number) => {
    setExpandedOrderIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <SummaryPill label="Toplam" value={summary.total} />
            <SummaryPill label="Bekleyen" value={summary.waiting} tone="warning" />
            <SummaryPill label="Hazırlık" value={summary.preparing} tone="info" />
            <SummaryPill label="Hazır" value={summary.ready} tone="success" />
            <SummaryPill label="İnceleme" value={summary.attention} tone="danger" />
          </div>

          <div className="inline-flex rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-1">
            <button
              type="button"
              onClick={() => setCompactView(false)}
              className={buttonClasses({
                variant: !compactView ? "secondary" : "ghost",
                size: "xs",
                className: "h-7 px-2.5",
              })}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kart
            </button>
            <button
              type="button"
              onClick={() => setCompactView(true)}
              className={buttonClasses({
                variant: compactView ? "secondary" : "ghost",
                size: "xs",
                className: "h-7 px-2.5",
              })}
            >
              <List className="h-3.5 w-3.5" />
              Kompakt
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 xl:grid-cols-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ui-text-secondary)]" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Sipariş no, masa veya ürün ara"
              className={`${INPUT_CLASS} pl-9`}
            />
          </label>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as DisplayStatusKey | "")}
            className={SELECT_CLASS}
          >
            <option value="">Tüm durumlar</option>
            {displayStatusOptions.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={filterChannel}
            onChange={(event) => setFilterChannel(event.target.value as ChannelKey | "")}
            className={SELECT_CLASS}
          >
            <option value="">Tüm kanallar</option>
            {channelOptions.includes("ONLINE") && <option value="ONLINE">Online</option>}
            {channelOptions.includes("CASH") && <option value="CASH">Nakit</option>}
            {channelOptions.includes("CARD") && <option value="CARD">Kart</option>}
            {channelOptions.includes("MEAL_CARD") && <option value="MEAL_CARD">Yemek kartı</option>}
            {channelOptions.includes("LATER_PAY") && <option value="LATER_PAY">Sonra öde</option>}
            {channelOptions.includes("OTHER") && <option value="OTHER">Diğer</option>}
          </select>
        </div>

        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          <select
            value={filterTable}
            onChange={(event) => setFilterTable(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Tüm masalar</option>
            {tableOptions.map((tableNo) => (
              <option key={tableNo} value={tableNo}>
                Masa {tableNo}
              </option>
            ))}
          </select>

          <select
            value={filterOps}
            onChange={(event) => setFilterOps(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Tüm operasyonlar</option>
            <option value="HAS_CANCELLATION">İptal kaydı olan</option>
            <option value="HAS_ADJUSTMENT">Nakit düzeltme olan</option>
            <option value="REFUND_PROCESS">İade süreci olan</option>
          </select>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TimeFilterChip
              active={timeFilter === "ALL"}
              label="Tümü"
              onClick={() => setTimeFilter("ALL")}
            />
            <TimeFilterChip
              active={timeFilter === "TODAY"}
              label="Bugün"
              onClick={() => setTimeFilter("TODAY")}
            />
            <TimeFilterChip
              active={timeFilter === "LAST_3H"}
              label="Son 3s"
              onClick={() => setTimeFilter("LAST_3H")}
            />
            <TimeFilterChip
              active={timeFilter === "LAST_24H"}
              label="Son 24s"
              onClick={() => setTimeFilter("LAST_24H")}
            />
          </div>
        </div>
      </section>

      {filteredOrders.length === 0 ? (
        <section className={cardClasses({ tone: "subtle", className: "px-4 py-10 text-center" })}>
          <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] text-[color:var(--ui-text-secondary)]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
            Bu filtrede sipariş yok
          </p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
            Filtreyi değiştirip tekrar bakabilirsiniz.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <section key={section.key} className={SECTION_CARD_CLASS}>
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{section.title}</h3>
                <span className="text-xs text-[color:var(--ui-text-secondary)]">
                  {section.orders.length} sipariş
                </span>
              </div>

              <div className={compactView ? "space-y-2" : "space-y-2.5"}>
                {section.orders.map((row) => (
                  <OrderCard
                    key={row.order.id}
                    row={row}
                    compact={compactView}
                    expanded={Boolean(expandedOrderIds[row.order.id])}
                    onToggleDetails={() => toggleExpand(row.order.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className={`${cardClasses({ className: "px-3 py-2.5" })} flex flex-wrap items-center justify-between gap-2`}>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8 px-2.5" })}
          >
            Önceki
          </button>
          <span className="min-w-0 text-xs text-[color:var(--ui-text-secondary)]">
            Sayfa {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8 px-2.5" })}
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}

function OrderCard({
  row,
  compact,
  expanded,
  onToggleDetails,
}: {
  row: DecoratedOrder;
  compact: boolean;
  expanded: boolean;
  onToggleDetails: () => void;
}) {
  const { order, status, attentionLevel, queueMinutes } = row;

  const operationSummary =
    order.items.length === 0
      ? "Ürün kaydı yok"
      : order.items
          .slice(0, 2)
          .map((item) => `${item.quantity}x ${item.productName}`)
          .join(" • ");

  const extraItemCount = Math.max(0, order.items.length - 2);
  const signalNotes: string[] = [];

  if ((order.cancellationCount ?? 0) > 0) {
    signalNotes.push(`${order.cancellationCount} kalem iptal`);
  }

  if ((order.cashAdjustmentCount ?? 0) > 0) {
    signalNotes.push(`${order.cashAdjustmentCount} nakit düzeltme`);
  }

  if (row.riskReasons.length > 0) {
    const riskLabel =
      row.riskLevel === "high" ? "Yüksek risk" : row.riskLevel === "medium" ? "Orta risk" : "Düşük risk";
    signalNotes.push(riskLabel);
  }

  const shouldHighlightAttention = getAttentionRank(attentionLevel) >= 3;

  return (
    <article className={cardClasses({ tone: getOrderCardTone(attentionLevel), className: "px-3.5 py-3" })}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Sipariş #{order.id}</p>
            <span className={badgeClasses(getStatusBadgeVariant(status.key))}>{status.label}</span>
          </div>
          <p className="text-xs text-[color:var(--ui-text-secondary)]">
            Masa {order.tableNo} • {row.channel.label} • {formatDateTime(order.createdAt)}
          </p>
        </div>

        {shouldHighlightAttention ? (
          <span className={badgeClasses(getAttentionBadgeVariant(attentionLevel))}>
            <Timer className="h-3 w-3" />
            {getAttentionText(attentionLevel, queueMinutes, status.key)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--ui-text-secondary)]">
            <Timer className="h-3 w-3" />
            {getAttentionText(attentionLevel, queueMinutes, status.key)}
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <InfoLine label="Tutar" value={formatCurrency(order.totalPrice)} />
        <InfoLine label="Ödeme durumu" value={row.paymentStateLabel} />
        <InfoLine label="Ödeme yöntemi" value={row.paymentMethodLabel} />
        <InfoLine label="Süre" value={`${queueMinutes} dk`} />
      </dl>

      {!compact && (
        <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
          Operasyon özeti: {operationSummary}
          {extraItemCount > 0 ? ` • +${extraItemCount} kalem` : ""}
        </p>
      )}

      {signalNotes.length > 0 && (
        <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
          Operasyon notu: {signalNotes.join(" • ")}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/restaurant"
            className={buttonClasses({ variant: "primary", size: "sm", className: "h-9 text-xs" })}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Durumu güncelle
          </Link>

          <button
            type="button"
            onClick={onToggleDetails}
            className={buttonClasses({ variant: "secondary", size: "sm", className: "h-9 text-xs" })}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Detayı gizle
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Detaylar
              </>
            )}
          </button>
        </div>

        {expanded && (
          <div className={cardClasses({ tone: "subtle", className: "space-y-2 px-3 py-2.5" })}>
            <ul className="space-y-1 text-xs text-[color:var(--ui-text-secondary)]">
              {order.items.map((item, index) => (
                <li key={`${order.id}-${item.productId}-${index}`}>
                  <span className="break-words">
                    {item.quantity}x {item.productName}
                  </span>
                  {(item.cancelledQuantity ?? 0) > 0 || (item.adjustedQuantity ?? 0) > 0 ? (
                    <span>
                      {" "}• iptal {item.cancelledQuantity ?? 0} • duzeltme {item.adjustedQuantity ?? 0} •
                      etkili miktar {item.effectiveQuantity ?? item.quantity}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            {order.note && (
              <p className="break-words text-xs text-[color:var(--ui-text-secondary)]">Not: {order.note}</p>
            )}

            <p className="text-xs text-[color:var(--ui-text-secondary)]">
              Hazirlik baslangici: {formatDateTime(order.preparingStartedAt)}
            </p>
            <p className="text-xs text-[color:var(--ui-text-secondary)]">
              Hazir olma: {formatDateTime(order.readyAt)} • Teslim: {formatDateTime(order.deliveredAt)}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function SummaryPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: BadgeVariant;
}) {
  const toneClass = getSummaryTone(tone);
  return (
    <span className={cardClasses({ tone: toneClass, className: "inline-flex items-center gap-1 px-2.5 py-1 text-xs shadow-none" })}>
      <span className="text-[color:var(--ui-text-secondary)]">{label}</span>
      <span className="font-semibold text-[color:var(--ui-text-primary)]">{value}</span>
    </span>
  );
}

function TimeFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClasses({
        variant: active ? "primary" : "secondary",
        size: "xs",
        className: "h-7 px-2.5",
      })}
    >
      {label}
    </button>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[color:var(--ui-text-secondary)]">{label}</dt>
      <dd className="truncate font-semibold text-[color:var(--ui-text-primary)]">{value}</dd>
    </div>
  );
}
