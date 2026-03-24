'use client';

import React, {
  useMemo,
  useRef,
  useTransition,
  useState,
  useEffect,
  useSyncExternalStore,
} from "react";
import { updateOrderStatus } from "@/app/actions/update-order-status";
import { Check, ChefHat, Clock, Printer } from "lucide-react";
import toast from "react-hot-toast";
import {
  isOpsSoundEnabled,
  primeOpsSound,
  setOpsSoundEnabled,
} from "@/lib/order-alert-sound";
import { playWaiterPanelSound, primeWaiterPanelSound } from "@/lib/waiter-panel-sound";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";

type OrderItem = {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  tags?: string[];
  effectiveQuantity?: number;
  selectedOptions?: string[];
};

type KitchenOrder = {
  id: number;
  table: { tableNo: number };
  note?: string | null;
  items: OrderItem[];
  totalPrice: string;
  status: "PENDING" | "PREPARING" | "COMPLETED";
  createdAt: Date;
  preparingStartedAt?: Date | null;
};

type Cancellation = { orderId: number; productId: number; quantity: number };
type CashAdjustment = { orderId: number; productId: number; quantity: number };

type WarningMinutes = { yellow: number; orange: number; red: number };
type KitchenSummary = {
  activeOrderCount: number;
  completedTodayCount: number;
  lastUpdatedIso: string;
};

const DEFAULT_WARNING_MINUTES: WarningMinutes = { yellow: 5, orange: 10, red: 15 };
const KITCHEN_SEEN_ORDERS_KEY = "menucy:kitchen:seen-order-keys:v1";
const MAX_SEEN_KEYS = 500;

function loadSeenKeys(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function saveSeenKeys(storageKey: string, keys: Set<string>) {
  if (typeof window === "undefined") return;
  const normalized = [...keys].slice(-MAX_SEEN_KEYS);
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));
}

function formatShortTime(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPreparingDurationMinutes(
  preparingStartedAt: Date | string | null | undefined,
  nowMs: number | null,
) {
  if (nowMs == null) return null;
  if (!preparingStartedAt) return null;
  const startedAtMs = new Date(preparingStartedAt).getTime();
  if (Number.isNaN(startedAtMs)) return null;
  const diff = nowMs - startedAtMs;
  if (diff < 0) return 0;
  return Math.floor(diff / 60000);
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(num);
}

function printOrderSlip(order: KitchenOrder) {
  const createdAt = new Date(order.createdAt).toLocaleString("tr-TR");
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sipariş #${order.id}</title>
  <style>
    body { font-family: sans-serif; padding: 16px; max-width: 320px; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .meta { color: #666; font-size: 12px; margin-bottom: 12px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 4px 0; border-bottom: 1px dashed #ddd; }
    .note { margin-top: 12px; font-size: 12px; color: #555; }
    .total { font-size: 16px; font-weight: bold; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>Masa ${order.table.tableNo} - Sipariş #${order.id}</h1>
  <div class="meta">${createdAt}</div>
  <ul>${order.items
    .map(
      (item) =>
        `<li>
          <div><strong>${item.effectiveQuantity ?? item.quantity}x</strong> ${item.productName}</div>
          ${
            item.selectedOptions && item.selectedOptions.length > 0
              ? `<div style="margin-left: 16px; margin-top: 2px; color: #555;">${item.selectedOptions
                  .map((option) => `- ${option}`)
                  .join("<br/>")}</div>`
              : ""
          }
        </li>`,
    )
    .join("")}</ul>
  ${order.note ? `<div class="note">Not: ${order.note}</div>` : ""}
  <div class="total">Toplam: ${formatCurrency(order.totalPrice)}</div>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Yazdirma penceresi acilamadi.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

export default function KitchenOrdersList({
  initialOrders,
  cancellations = [],
  cashAdjustments = [],
  warningMinutes = DEFAULT_WARNING_MINUTES,
  summary,
}: {
  initialOrders: KitchenOrder[];
  cancellations?: Cancellation[];
  cashAdjustments?: CashAdjustment[];
  warningMinutes?: WarningMinutes;
  summary?: KitchenSummary;
}) {
  const [isPending, startTransition] = useTransition();
  const [tagFilter, setTagFilter] = useState<string>("");
  const [nowMs, setNowMs] = useState<number | null>(null);
  const orderSeenInitializedRef = useRef(false);
  const soundEnabled = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener("menucy:ops-sound-changed", handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("menucy:ops-sound-changed", handler);
      };
    },
    () => isOpsSoundEnabled(),
    () => false,
  );
  const yellow = Math.max(1, warningMinutes.yellow ?? 5);
  const orange = Math.max(yellow, warningMinutes.orange ?? 10);
  const red = Math.max(orange, warningMinutes.red ?? 15);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const kickoff = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, []);

  const currentKitchenOrderKeys = useMemo(
    () =>
      initialOrders
        .map((order) => `${order.id}:${new Date(order.createdAt).getTime()}`)
        .sort(),
    [initialOrders],
  );

  useEffect(() => {
    const seen = loadSeenKeys(KITCHEN_SEEN_ORDERS_KEY);
    const hadBaseline = seen.size > 0;
    const unseen = currentKitchenOrderKeys.filter((key) => !seen.has(key));

    if (!orderSeenInitializedRef.current) {
      if (!hadBaseline) {
        currentKitchenOrderKeys.forEach((key) => seen.add(key));
        saveSeenKeys(KITCHEN_SEEN_ORDERS_KEY, seen);
      }
      orderSeenInitializedRef.current = true;
      if (!hadBaseline) return;
    }

    if (unseen.length > 0) {
      currentKitchenOrderKeys.forEach((key) => seen.add(key));
      saveSeenKeys(KITCHEN_SEEN_ORDERS_KEY, seen);
      void playWaiterPanelSound("order");
      toast.success(`${unseen.length} yeni sipariş mutfaga dustu.`, { duration: 2500 });
    }
  }, [currentKitchenOrderKeys]);

  const handleEnableSound = async () => {
    const primed = (await primeWaiterPanelSound()) || (await primeOpsSound());
    if (!primed) {
      toast.error("Tarayici sesi engelledi. Lutfen tekrar deneyin.");
      return;
    }
    setOpsSoundEnabled(true);
    toast.success("Mutfak bildirim sesi aktif.");
  };

  const ordersWithEffectiveItems = useMemo(() => {
    const cancellationMap = buildOrderItemAdjustmentMap(cancellations);
    const cashAdjustmentMap = buildOrderItemAdjustmentMap(cashAdjustments);

    return initialOrders
      .map((order) => ({
        ...order,
        items: order.items
          .map((item) => ({
            ...item,
            effectiveQuantity: getEffectiveOrderItemQuantity({
              orderId: order.id,
              productId: item.productId,
              originalQuantity: item.quantity,
              cancellationMap,
              cashAdjustmentMap,
            }),
          }))
          .filter((item) => item.effectiveQuantity > 0),
      }))
      .filter((order) => order.items.length > 0);
  }, [initialOrders, cancellations, cashAdjustments]);

  const ordersFilteredByTag = useMemo(() => {
    if (!tagFilter) return ordersWithEffectiveItems;
    const lower = tagFilter.toLowerCase();
    return ordersWithEffectiveItems.filter((order) =>
      order.items.some((item) =>
        (item.tags ?? []).some((t) => t.toLowerCase() === lower),
      ),
    );
  }, [ordersWithEffectiveItems, tagFilter]);

  const handleStatusChange = (
    orderId: number,
    status: "PREPARING" | "COMPLETED",
  ) => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, status);
      if (result.success) {
        toast.success(`Sipariş #${orderId} durumu guncellendi.`);
      } else {
        toast.error(result.message || "Guncelleme basarisiz.");
      }
    });
  };

  const { pendingOrders, preparingOrders, completedOrders } = useMemo(() => {
    type DelayLevel = "none" | "yellow" | "orange" | "red";
    const pending: (KitchenOrder & { delayLevel: DelayLevel })[] = [];
    const preparing: (KitchenOrder & { delayLevel: DelayLevel })[] = [];
    const completed: KitchenOrder[] = [];

    for (const order of ordersFilteredByTag) {
      const ageMinutes = ((nowMs ?? 0) - new Date(order.createdAt).getTime()) / 60000;
      const delayLevel: DelayLevel =
        ageMinutes >= red ? "red" : ageMinutes >= orange ? "orange" : ageMinutes >= yellow ? "yellow" : "none";

      if (order.status === "PENDING") pending.push({ ...order, delayLevel });
      else if (order.status === "PREPARING") preparing.push({ ...order, delayLevel });
      else if (order.status === "COMPLETED") completed.push(order);
    }

    pending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    preparing.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    completed.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return { pendingOrders: pending, preparingOrders: preparing, completedOrders: completed };
  }, [ordersFilteredByTag, nowMs, yellow, orange, red]);

  return (
    <div className="space-y-8">
      {!soundEnabled && (
        <button
          type="button"
          onClick={() => {
            void handleEnableSound();
          }}
          className="fixed bottom-4 right-4 z-40 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow"
        >
          Mutfak bildirim sesini etkinlestir
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-neutral-600">Filtre:</span>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-xl border border-neutral-200 px-3 py-1.5 text-sm"
        >
          <option value="">Tumu</option>
          <option value="yemek">Yemek</option>
          <option value="icecek">Icecek</option>
        </select>
        <span className="ml-auto text-xs text-neutral-500">
          Son guncelleme: {nowMs != null ? new Date(nowMs).toLocaleTimeString("tr-TR") : "--:--"}
        </span>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium text-neutral-500">Aktif Sipariş</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {pendingOrders.length + preparingOrders.length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium text-neutral-500">Bugun Tamamlanan</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {summary?.completedTodayCount ?? completedOrders.length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs font-medium text-neutral-500">Son Guncelleme</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {nowMs != null
              ? new Date(nowMs).toLocaleTimeString("tr-TR")
              : formatShortTime(summary?.lastUpdatedIso ?? null)}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        {pendingOrders.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-neutral-900">Yeni Gelen Siparişler</h2>
            <OrderGrid
              orders={pendingOrders}
              nowMs={nowMs}
              isPending={isPending}
              onAction={(id) => handleStatusChange(id, "PREPARING")}
              actionLabel="Hazırlamaya Basla"
              actionClass="bg-blue-600 hover:bg-blue-700"
            />
          </>
        )}

        {preparingOrders.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-neutral-900">Hazırlanan Siparişler</h2>
            <OrderGrid
              orders={preparingOrders}
              nowMs={nowMs}
              isPending={isPending}
              onAction={(id) => handleStatusChange(id, "COMPLETED")}
              actionLabel="Hazır / Tamamla"
              actionClass="bg-emerald-600 hover:bg-emerald-700"
            />
          </>
        )}
      </section>

      {pendingOrders.length === 0 && preparingOrders.length === 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white py-12 text-center">
          <p className="text-base font-medium text-neutral-700">Su anda aktif sipariş yok</p>
          <p className="mt-1 text-xs text-neutral-500">
            Son guncelleme:{" "}
            {nowMs != null
              ? new Date(nowMs).toLocaleTimeString("tr-TR")
              : formatShortTime(summary?.lastUpdatedIso ?? null)}
          </p>
        </section>
      )}

      {completedOrders.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Son Tamamlananlar</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {completedOrders.slice(0, 12).map((order) => (
              <div
                key={order.id}
                className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-neutral-800"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">Masa {order.table.tableNo}</span>
                  <span className="text-neutral-500">#{order.id}</span>
                </div>
                <p className="mb-1">
                  Toplam: <span className="font-semibold">{formatCurrency(order.totalPrice)}</span>
                </p>
                <span className="mt-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <Check className="mr-1 h-3 w-3" />
                  Tamamlandi
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OrderGrid({
  orders,
  nowMs,
  isPending,
  onAction,
  actionLabel,
  actionClass,
}: {
  orders: Array<KitchenOrder & { delayLevel: "none" | "yellow" | "orange" | "red" }>;
  nowMs: number | null;
  isPending: boolean;
  onAction: (orderId: number) => void;
  actionLabel: string;
  actionClass: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {orders.map((order) => (
        <div key={order.id} className="flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-neutral-900">Masa {order.table.tableNo}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-500">#{order.id}</span>
            </div>
            <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
              {order.status === "PENDING" ? <Clock className="mr-1 h-3.5 w-3.5" /> : <ChefHat className="mr-1 h-3.5 w-3.5" />}
              {order.status === "PENDING" ? "Beklemede" : "Hazırlaniyor"}
            </span>
          </div>

          <div className="flex-1 px-4 py-3">
            <ul className="space-y-2 text-sm">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-start justify-between border-b border-dashed border-neutral-100 pb-1 last:border-0 last:pb-0">
                  <div className="flex max-w-[80%] items-start">
                    <span className="mr-2 min-w-[1.5rem] font-bold text-neutral-900">{item.effectiveQuantity ?? item.quantity}x</span>
                    <div className="leading-snug text-neutral-800">
                      <div>{item.productName}</div>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                          {item.selectedOptions.map((option, optionIndex) => (
                            <li key={optionIndex}>- {option}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {order.note && <p className="mt-2 text-xs text-neutral-600">Not: {order.note}</p>}
            {order.preparingStartedAt && (
              <div className="mt-2 space-y-0.5 text-xs text-neutral-600">
                <p>Baslangic: <span className="font-medium">{formatShortTime(order.preparingStartedAt)}</span></p>
                <p>Sure: <span className="font-medium">{getPreparingDurationMinutes(order.preparingStartedAt, nowMs) ?? "-"} dk</span></p>
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-600">Toplam:</span>
              <span className="text-lg font-bold text-neutral-900">{formatCurrency(order.totalPrice)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => printOrderSlip(order)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Printer className="h-4 w-4" />
                Yazdir
              </button>
              <button
                disabled={isPending}
                onClick={() => onAction(order.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${actionClass}`}
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

