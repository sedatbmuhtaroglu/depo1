"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  startTransition,
} from "react";
import toast from "react-hot-toast";
import type {
  SerializedCleanOrder,
  WaiterDashboardSnapshotJson,
} from "@/lib/waiter-dashboard-snapshot";
import { diffWaiterCriticalEvents } from "@/lib/waiter-critical-diff";
import { useWaiterPolling } from "@/hooks/use-waiter-polling";
import { refreshWaiterDashboardSnapshot } from "@/app/actions/waiter-dashboard-refresh";
import {
  isOpsSoundEnabled,
  primeOpsSound,
  setOpsSoundEnabled,
} from "@/lib/order-alert-sound";
import {
  playWaiterPanelSoundsSequential,
  primeWaiterPanelSound,
} from "@/lib/waiter-panel-sound";
import WaiterOrdersSection from "./orders-section";
import WaiterCallsSection from "./waiter-calls-section";
import BillRequestsSection from "./bill-requests-section";
import WaiterTableAndOrderSection from "./waiter-table-and-order-section";
import ReadyForPickupSection from "./ready-for-pickup-section";
import MyPerformanceSummary from "./my-performance-summary";
import PaymentResultToaster from "./payment-result-toaster";

type Props = {
  initial: WaiterDashboardSnapshotJson;
  staffId: number | null;
};

type WaiterOrder = React.ComponentProps<typeof WaiterOrdersSection>["pendingApprovalOrders"][number];

function parseWaiterOrder(o: SerializedCleanOrder): WaiterOrder {
  return {
    ...o,
    createdAt: new Date(o.createdAt),
    preparingStartedAt: o.preparingStartedAt ? new Date(o.preparingStartedAt) : null,
    readyAt: o.readyAt ? new Date(o.readyAt) : null,
    deliveredAt: o.deliveredAt ? new Date(o.deliveredAt) : null,
    status: o.status as WaiterOrder["status"],
    requestedPaymentMethod: o.requestedPaymentMethod as WaiterOrder["requestedPaymentMethod"],
    paymentStatus: o.paymentStatus as WaiterOrder["paymentStatus"],
    paymentProvider: o.paymentProvider as WaiterOrder["paymentProvider"],
  };
}

function normalizeSnapshot(s: WaiterDashboardSnapshotJson) {
  const tableRows = s.tableRows.map((row) => ({
    ...row,
    lastOrder: row.lastOrder
      ? {
          ...row.lastOrder,
          createdAt: new Date(row.lastOrder.createdAt),
        }
      : undefined,
  }));

  const pendingApprovalOrders = s.pendingApprovalOrders.map(parseWaiterOrder);
  const activeOrders = s.activeOrders.map(parseWaiterOrder);
  const completedOrders = s.completedOrders.map(parseWaiterOrder);
  const rejectedOrders = s.rejectedOrders.map(parseWaiterOrder);
  const readyForPickup = s.readyForPickup.map(parseWaiterOrder);

  return {
    ...s,
    tableRows,
    pendingApprovalOrders,
    activeOrders,
    completedOrders,
    rejectedOrders,
    readyForPickup,
    waiterCalls: s.waiterCalls.map((c) => ({
      ...c,
      status: c.status as "PENDING" | "ACKNOWLEDGED" | "RESOLVED",
      createdAt: new Date(c.createdAt),
    })),
    billRequests: s.billRequests.map((r) => ({
      ...r,
      status: r.status as "PENDING" | "ACKNOWLEDGED" | "SETTLED" | "CANCELED",
      createdAt: new Date(r.createdAt),
    })),
  };
}

type Normalized = ReturnType<typeof normalizeSnapshot>;

function notifyCriticalToasts(
  diff: ReturnType<typeof diffWaiterCriticalEvents>,
  next: WaiterDashboardSnapshotJson,
) {
  const {
    newPendingApprovalOrderIds,
    newlyApprovedToKitchenIds,
    newActiveOrderIds,
    newWaiterCallIds,
    newBillRequestIds,
    newReadyPickupKeys,
  } = diff;

  if (newPendingApprovalOrderIds.length > 0) {
    toast.success(
      `${newPendingApprovalOrderIds.length} yeni sipariş onayı bekliyor.`,
      { duration: 2800 },
    );
  }

  if (newlyApprovedToKitchenIds.length > 0) {
    const n = newlyApprovedToKitchenIds.length;
    toast.success(
      n === 1 ? "Sipariş mutfağa iletildi." : `${n} sipariş mutfağa iletildi.`,
      { duration: 2800 },
    );
  }

  if (newActiveOrderIds.length > 0) {
    const n = newActiveOrderIds.length;
    toast.success(
      n === 1 ? "Yeni sipariş mutfağa düştü." : `${n} yeni sipariş mutfağa düştü.`,
      { duration: 2800 },
    );
  }

  if (newWaiterCallIds.length > 0) {
    const tables = newWaiterCallIds
      .map((id) => next.waiterCalls.find((c) => c.id === id)?.table.tableNo)
      .filter((n): n is number => typeof n === "number")
      .slice(0, 3);
    const suffix = tables.length ? ` (${tables.map((t) => `Masa ${t}`).join(", ")})` : "";
    toast.success(`${newWaiterCallIds.length} garson çağrısı${suffix}`, { duration: 2800 });
  }

  if (newBillRequestIds.length > 0) {
    toast.success(`${newBillRequestIds.length} yeni hesap isteği`, { duration: 2800 });
  }

  if (newReadyPickupKeys.length > 0) {
    const ids = newReadyPickupKeys.map((k) => Number(k.split(":")[0]));
    const tables = ids
      .map((id) => next.readyForPickup.find((o) => o.id === id)?.table.tableNo)
      .filter((n): n is number => typeof n === "number")
      .slice(0, 3);
    const suffix = tables.length ? `: ${tables.map((t) => `Masa ${t}`).join(", ")}` : "";
    toast.success(`${newReadyPickupKeys.length} sipariş hazır${suffix}.`, { duration: 3000 });
  }
}

function buildSoundQueue(diff: ReturnType<typeof diffWaiterCriticalEvents>): Array<"waiter" | "order"> {
  const hasWaiterSide =
    diff.newWaiterCallIds.length > 0 || diff.newBillRequestIds.length > 0;
  const hasOrderSide =
    diff.newPendingApprovalOrderIds.length > 0 ||
    diff.newlyApprovedToKitchenIds.length > 0 ||
    diff.newActiveOrderIds.length > 0 ||
    diff.newReadyPickupKeys.length > 0;
  // Sipariş (order-alert.mp3) önce: aynı poll'da garson/hesap ile birlikte olsa bile yanlış ilk izlenim olmasın.
  const q: Array<"waiter" | "order"> = [];
  if (hasOrderSide) q.push("order");
  if (hasWaiterSide) q.push("waiter");
  return q;
}

export default function WaiterDashboardClient({ initial, staffId }: Props) {
  const [rawSnapshot, setRawSnapshot] = useState<WaiterDashboardSnapshotJson>(initial);
  const [view, setView] = useState<Normalized>(() => normalizeSnapshot(initial));
  const prevRawRef = useRef<WaiterDashboardSnapshotJson>(initial);

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

  // router.refresh() from child actions delivers a new server snapshot; keep client state aligned.
  useEffect(() => {
    startTransition(() => {
      setRawSnapshot(initial);
      setView(normalizeSnapshot(initial));
      prevRawRef.current = initial;
    });
  }, [initial]);

  const handlePollResult = useCallback((next: WaiterDashboardSnapshotJson) => {
    const prev = prevRawRef.current;
    const diff = diffWaiterCriticalEvents(prev, next);

    const hasAnything =
      diff.newPendingApprovalOrderIds.length > 0 ||
      diff.newlyApprovedToKitchenIds.length > 0 ||
      diff.newActiveOrderIds.length > 0 ||
      diff.newWaiterCallIds.length > 0 ||
      diff.newBillRequestIds.length > 0 ||
      diff.newReadyPickupKeys.length > 0;

    if (hasAnything) {
      notifyCriticalToasts(diff, next);
      const queue = buildSoundQueue(diff);
      if (queue.length > 0 && isOpsSoundEnabled()) {
        void playWaiterPanelSoundsSequential(queue);
      }
    }

    prevRawRef.current = next;
    setRawSnapshot(next);
    setView(normalizeSnapshot(next));
  }, []);

  const onPollTick = useCallback(async () => {
    const next = await refreshWaiterDashboardSnapshot();
    handlePollResult(next);
  }, [handlePollResult]);

  useWaiterPolling(onPollTick, 3000);

  const handleEnableSound = async () => {
    const primed =
      (await primeWaiterPanelSound()) || (await primeOpsSound());
    if (!primed) {
      toast.error("Tarayıcı sesi engelledi. Lütfen tekrar deneyin.");
      return;
    }
    setOpsSoundEnabled(true);
    toast.success("Bildirim sesi aktif.");
  };

  return (
    <div className="relative space-y-6 pb-20">
      {!soundEnabled && (
        <button
          type="button"
          onClick={() => {
            void handleEnableSound();
          }}
          className="fixed bottom-4 right-4 z-40 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow"
        >
          Bildirim sesini etkinleştir
        </button>
      )}

      {staffId != null && view.myMetrics != null && (
        <MyPerformanceSummary
          ordersDelivered={view.myMetrics.ordersDelivered}
          callResponseAvgMinutes={view.myMetrics.callResponseAvgMinutes}
          billResponseAvgMinutes={view.myMetrics.billResponseAvgMinutes}
        />
      )}

      <WaiterTableAndOrderSection
        tableRows={view.tableRows}
        tableSummaries={view.tableSummaries}
        tables={view.tables}
        products={view.productsWithPrice}
        categories={view.categories}
        iyzicoEnabled={view.iyzicoEnabled}
      />

      <ReadyForPickupSection
        orders={view.readyForPickup.map((order) => ({
          id: order.id,
          table: order.table,
          totalPrice: order.totalPrice,
          readyAt: order.readyAt ?? null,
          deliveredAt: order.deliveredAt ?? null,
        }))}
      />

      <WaiterCallsSection calls={view.waiterCalls} />

      <PaymentResultToaster />

      <BillRequestsSection iyzicoEnabled={view.iyzicoEnabled} requests={view.billRequests} />

      <WaiterOrdersSection
        pendingApprovalOrders={view.pendingApprovalOrders}
        activeOrders={view.activeOrders}
        completedOrders={view.completedOrders}
        rejectedOrders={view.rejectedOrders}
        cancellations={rawSnapshot.cancellations}
        cashAdjustments={rawSnapshot.cashAdjustments}
      />
    </div>
  );
}
