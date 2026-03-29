'use client';

import React, { useState } from "react";
import { updateOrderStatus } from "@/app/actions/update-order-status";
import { cancelOrderItem } from "@/app/actions/cancel-order-item";
import { adjustCashOrderItem } from "@/app/actions/adjust-cash-order-item";
import { Check, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";
import {
  getAccountStatusLabel,
  getOrderCancellationMatrix,
  getOrderPaymentMethodLabel,
  getOrderPaymentStateLabel,
  getOrderStatusLabel,
  getVisibleOrderActions,
} from "@/lib/order-payment-visibility";

type OrderItem = {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
};

type CancelPaymentMethod =
  | "IYZICO"
  | "CASH"
  | "CREDIT_CARD"
  | "SODEXO"
  | "MULTINET"
  | "TICKET"
  | "METROPOL"
  | "LATER_PAY";

type CashAdjustmentSelectableItem = {
  lineKey: string;
  productId: number;
  productName: string;
  orderedQuantity: number;
  cancelledQuantity: number;
  adjustedQuantity: number;
  effectiveQuantity: number;
  unitPrice: number;
};

type WaiterOrder = {
  id: number;
  table: { tableNo: number };
  items: OrderItem[];
  totalPrice: string;
  status:
    | "PENDING_WAITER_APPROVAL"
    | "PENDING"
    | "PREPARING"
    | "COMPLETED"
    | "REJECTED";
  createdAt: Date;
  preparingStartedAt?: Date | null;
  readyAt?: Date | null;
  deliveredAt?: Date | null;
  requestedPaymentMethod?: "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL" | null;
  paymentStatus?: "PENDING" | "INITIATED" | "PAID" | "FAILED" | null;
  paymentProvider?: "IYZICO" | null;
  paymentSettled?: boolean;
};

type Cancellation = { orderId: number; productId: number; quantity: number };
type CashAdjustment = {
  orderId: number;
  productId: number;
  adjustedQuantity: number;
  actionType: "PARTIAL_CANCEL" | "PARTIAL_RETURN";
};

type Props = {
  pendingApprovalOrders: WaiterOrder[];
  activeOrders: WaiterOrder[];
  completedOrders: WaiterOrder[];
  rejectedOrders: WaiterOrder[];
  cancellations: Cancellation[];
  cashAdjustments: CashAdjustment[];
};

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPreparingDurationMinutes(
  preparingStartedAt: Date | null | undefined,
  nowMs: number,
) {
  if (!preparingStartedAt) return null;
  const startedAt = new Date(preparingStartedAt).getTime();
  if (Number.isNaN(startedAt)) return null;
  const diff = nowMs - startedAt;
  if (diff < 0) return 0;
  return Math.floor(diff / 60000);
}

const CANCELLATION_REASONS = [
  { value: "CUSTOMER_CHANGED_MIND", label: "Müşteri fikrini değiştirdi" },
  { value: "OUT_OF_STOCK", label: "Stokta yok" },
  { value: "WRONG_ITEM", label: "Yanlış ürün" },
  { value: "OTHER", label: "Diğer" },
] as const;

const CANCEL_PAYMENT_METHOD_OPTIONS: Array<{
  value: CancelPaymentMethod;
  label: string;
}> = [
  { value: "IYZICO", label: "Online (İyzico)" },
  { value: "CASH", label: "Nakit" },
  { value: "LATER_PAY", label: "Sonra Öde" },
  { value: "CREDIT_CARD", label: "Kredi Kartı" },
  { value: "SODEXO", label: "Sodexo" },
  { value: "MULTINET", label: "Multinet" },
  { value: "TICKET", label: "Ticket" },
  { value: "METROPOL", label: "Metropol" },
];

function isCashAdjustmentEligibleOrder(order: WaiterOrder): boolean {
  if (order.status === "REJECTED") return false;
  if (!["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING", "COMPLETED"].includes(order.status)) {
    return false;
  }
  return order.requestedPaymentMethod == null || order.requestedPaymentMethod === "CASH";
}

export default function WaiterOrdersSection({
  pendingApprovalOrders,
  activeOrders,
  completedOrders,
  rejectedOrders,
  cancellations,
  cashAdjustments,
}: Props) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancelModal, setCancelModal] = useState<{
    orderId: number;
    tableNo: number;
    productId: number;
    productName: string;
    unitPrice: number;
    maxQty: number;
    orderTotal: number;
    maxRefundAmount: number;
    mode: "CANCEL" | "REFUND";
    paymentMethodLabel: string;
    paymentStateLabel: string;
    defaultPaymentMethod: CancelPaymentMethod;
  } | null>(null);
  const [ruleBlockModalMessage, setRuleBlockModalMessage] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<(typeof CANCELLATION_REASONS)[number]["value"]>("OTHER");
  const [cancelQty, setCancelQty] = useState(1);
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const [cancelPaymentMethod, setCancelPaymentMethod] =
    useState<CancelPaymentMethod>("LATER_PAY");
  const [refundAmount, setRefundAmount] = useState("");
  const [cashAdjustmentModal, setCashAdjustmentModal] = useState<{
    orderId: number;
    selectableItems: CashAdjustmentSelectableItem[];
    selectedLineKey: string | null;
  } | null>(null);
  const [cashAdjustmentQty, setCashAdjustmentQty] = useState(1);
  const [cashAdjustmentReason, setCashAdjustmentReason] = useState("");
  const [cashAdjustmentType, setCashAdjustmentType] = useState<"PARTIAL_CANCEL" | "PARTIAL_RETURN">(
    "PARTIAL_CANCEL",
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedCashAdjustmentLine =
    cashAdjustmentModal?.selectableItems.find(
      (line) => line.lineKey === cashAdjustmentModal.selectedLineKey,
    ) ?? null;
  const cancellationMap = React.useMemo(
    () => buildOrderItemAdjustmentMap(cancellations),
    [cancellations],
  );
  const cashAdjustmentMap = React.useMemo(
    () =>
      buildOrderItemAdjustmentMap(
        cashAdjustments.map((adjustment) => ({
          orderId: adjustment.orderId,
          productId: adjustment.productId,
          quantity: adjustment.adjustedQuantity,
        })),
      ),
    [cashAdjustments],
  );

  const handleStatusChange = async (
    orderId: number,
    status: "PENDING" | "REJECTED",
  ) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await updateOrderStatus(orderId, status);
      if (result.success) {
        toast.success(`Sipariş #${orderId} durumu güncellendi.`);
        router.refresh();
      } else {
        toast.error(result.message || "Güncelleme başarısız.");
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[waiter-orders] status action failed", error);
      }
      toast.error("İşlem sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openCancelModal = (params: {
    orderId: number;
    tableNo: number;
    productId: number;
    productName: string;
    unitPrice: number;
    maxQty: number;
    orderTotal: number;
    maxRefundAmount: number;
    mode: "CANCEL" | "REFUND";
    paymentMethodLabel: string;
    paymentStateLabel: string;
    defaultPaymentMethod: CancelPaymentMethod;
  }) => {
    setCancelModal(params);
    setCancelQty(Math.min(1, params.maxQty));
    setCancelReason("OTHER");
    setCancelCustomReason("");
    setCancelPaymentMethod(params.defaultPaymentMethod);
    setRefundAmount(
      params.mode === "REFUND" ? String(params.maxRefundAmount.toFixed(2)) : "",
    );
  };

  const openCashAdjustmentModal = (params: {
    order: WaiterOrder;
    item: OrderItem;
  }) => {
    const { order, item } = params;
    const perProduct = new Map<number, CashAdjustmentSelectableItem>();
    order.items.forEach((orderItem, index) => {
      const existing = perProduct.get(orderItem.productId);
      if (!existing) {
        perProduct.set(orderItem.productId, {
          lineKey: `${orderItem.productId}:${index}`,
          productId: orderItem.productId,
          productName: orderItem.productName,
          orderedQuantity: orderItem.quantity,
          cancelledQuantity: 0,
          adjustedQuantity: 0,
          effectiveQuantity: 0,
          unitPrice: orderItem.price,
        });
        return;
      }
      existing.orderedQuantity += orderItem.quantity;
    });

    const selectableItems = [...perProduct.values()]
      .map((line) => {
        const key = `${order.id}:${line.productId}`;
        const cancelledQuantity = cancellationMap.get(key) ?? 0;
        const adjustedQuantity = cashAdjustmentMap.get(key) ?? 0;
        return {
          ...line,
          cancelledQuantity,
          adjustedQuantity,
          effectiveQuantity: getEffectiveOrderItemQuantity({
            orderId: order.id,
            productId: line.productId,
            originalQuantity: line.orderedQuantity,
            cancellationMap,
            cashAdjustmentMap,
          }),
        };
      })
      .filter((line) => line.effectiveQuantity > 0);

    if (selectableItems.length === 0) {
      toast.error("Bu siparişte ayarlanabilir ürün kalemi yok.");
      return;
    }

    const preselected = selectableItems.find((line) => line.productId === item.productId);
    setCashAdjustmentModal({
      orderId: order.id,
      selectableItems,
      selectedLineKey: preselected?.lineKey ?? selectableItems[0].lineKey,
    });
    setCashAdjustmentQty(1);
    setCashAdjustmentReason("");
    setCashAdjustmentType(order.deliveredAt ? "PARTIAL_RETURN" : "PARTIAL_CANCEL");
  };

  const handleCancelItem = async () => {
    if (isProcessing) return;
    if (!cancelModal) return;
    if (cancelQty < 1 || cancelQty > cancelModal.maxQty) {
      toast.error(`Adet 1 ile ${cancelModal.maxQty} arasında olmalı.`);
      return;
    }
    if (cancelReason === "OTHER" && !cancelCustomReason.trim()) {
      toast.error("Diğer nedeni seçtiğinizde açıklama zorunludur.");
      return;
    }
    const parsedRefundAmount =
      refundAmount.trim().length > 0 ? Number(refundAmount.replace(",", ".")) : null;
    if (cancelModal.mode === "REFUND") {
      if (!cancelPaymentMethod) {
        toast.error("Ödeme yöntemi seçmelisiniz.");
        return;
      }
      if (parsedRefundAmount == null || Number.isNaN(parsedRefundAmount)) {
        toast.error("İade edilen tutarı giriniz.");
        return;
      }
      if (parsedRefundAmount <= 0) {
        toast.error("İade edilen tutar 0'dan büyük olmalıdır.");
        return;
      }
      if (parsedRefundAmount > cancelModal.maxRefundAmount) {
        toast.error(
          `İade tutarı en fazla ${formatCurrency(cancelModal.maxRefundAmount)} olabilir.`,
        );
        return;
      }
    }
    setIsProcessing(true);
    try {
      const result = await cancelOrderItem(
        cancelModal.orderId,
        cancelModal.productId,
        cancelQty,
        cancelReason,
        cancelCustomReason.trim() || undefined,
        cancelModal.mode,
        cancelPaymentMethod,
        parsedRefundAmount ?? undefined,
      );
      if (result.success) {
        toast.success("İşlem başarıyla tamamlandı.");
        setCancelModal(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "İşlem başarısız.");
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[waiter-orders] cancel/refund action failed", error);
      }
      toast.error("İşlem sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashAdjustment = async () => {
    if (isProcessing) return;
    if (!cashAdjustmentModal) return;
    if (!selectedCashAdjustmentLine) {
      toast.error("Lütfen bir ürün kalemi seçin.");
      return;
    }
    if (cashAdjustmentQty < 1 || cashAdjustmentQty > selectedCashAdjustmentLine.effectiveQuantity) {
      toast.error(
        `Adet 1 ile ${selectedCashAdjustmentLine.effectiveQuantity} arasinda olmalidir.`,
      );
      return;
    }
    if (!cashAdjustmentReason.trim()) {
      toast.error("Neden alani zorunludur.");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await adjustCashOrderItem({
        orderId: cashAdjustmentModal.orderId,
        orderItemId: selectedCashAdjustmentLine.productId,
        productId: selectedCashAdjustmentLine.productId,
        quantity: cashAdjustmentQty,
        reason: cashAdjustmentReason.trim(),
        actionType: cashAdjustmentType,
      });
      if (result.success) {
        toast.success(result.message ?? "Kısmi iptal/iade kaydedildi.");
        setCashAdjustmentModal(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Kısmi iptal/iade işlemi başarısız.");
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[waiter-orders] cash adjustment action failed", error);
      }
      toast.error("Kısmi iptal/iade işleminde beklenmeyen bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveOrderMatrix = (order: WaiterOrder) =>
    getOrderCancellationMatrix({
      status: order.status,
      deliveredAt: order.deliveredAt ?? null,
      paymentStatus: order.paymentStatus ?? null,
      paymentSettled: order.paymentSettled ?? false,
    });

  const orderUiStateMap = React.useMemo(() => {
    const map = new Map<
      number,
      {
        visibleActions: Array<"cancel" | "refund">;
        orderStatusLabel: string;
        accountStatusLabel: string;
        paymentStatusLabel: string;
        paymentMethodLabel: string;
      }
    >();

    const allOrders = [
      ...pendingApprovalOrders,
      ...activeOrders,
      ...completedOrders,
      ...rejectedOrders,
    ];

    for (const order of allOrders) {
      const visibleActions = getVisibleOrderActions({
        status: order.status,
        deliveredAt: order.deliveredAt ?? null,
        paymentStatus: order.paymentStatus ?? null,
        paymentSettled: order.paymentSettled ?? false,
      });
      const orderStatusLabel = getOrderStatusLabel({
        status: order.status,
        readyAt: order.readyAt ?? null,
        deliveredAt: order.deliveredAt ?? null,
      });
      const accountStatusLabel = getAccountStatusLabel({
        paymentSettled: order.paymentSettled ?? false,
      });
      const paymentStatusLabel = getOrderPaymentStateLabel({
        paymentStatus: order.paymentStatus ?? null,
        paymentSettled: order.paymentSettled ?? false,
      });
      const paymentMethodLabel = getOrderPaymentMethodLabel({
        requestedPaymentMethod: order.requestedPaymentMethod ?? null,
        paymentProvider: order.paymentProvider ?? null,
      });

      map.set(order.id, {
        visibleActions,
        orderStatusLabel,
        accountStatusLabel,
        paymentStatusLabel,
        paymentMethodLabel,
      });
    }

    return map;
  }, [pendingApprovalOrders, activeOrders, completedOrders, rejectedOrders]);

  const handleCancelOrRefundClick = (params: {
    order: WaiterOrder;
    item: OrderItem;
    effectiveQuantity: number;
  }) => {
    const { order, item, effectiveQuantity } = params;
    const matrix = resolveOrderMatrix(order);
    if (!matrix.canCancel && !matrix.canRefund) {
      setRuleBlockModalMessage(
        matrix.blockMessage ??
          "SİPARİŞ HAZIRLANIYOR AŞAMASINDA OLDUĞU İÇİN İPTAL VEYA İADE EDİLEMEZ",
      );
      return;
    }

    const mode: "CANCEL" | "REFUND" = matrix.canRefund ? "REFUND" : "CANCEL";
    const defaultPaymentMethod: CancelPaymentMethod =
      order.paymentProvider === "IYZICO"
        ? "IYZICO"
        : (order.requestedPaymentMethod as CancelPaymentMethod | null) ?? "LATER_PAY";
    const maxRefundAmount =
      Math.round(effectiveQuantity * Number(item.price) * 100) / 100;
    openCancelModal({
      orderId: order.id,
      tableNo: order.table.tableNo,
      productId: item.productId,
      productName: item.productName,
      unitPrice: Number(item.price),
      maxQty: effectiveQuantity,
      orderTotal: Number(order.totalPrice),
      maxRefundAmount,
      mode,
      paymentMethodLabel: getOrderPaymentMethodLabel({
        requestedPaymentMethod: order.requestedPaymentMethod ?? null,
        paymentProvider: order.paymentProvider ?? null,
      }),
      paymentStateLabel: getOrderPaymentStateLabel({
        paymentStatus: order.paymentStatus ?? null,
      }),
      defaultPaymentMethod,
    });
  };

  return (
    <section className="waiter-section space-y-6 rounded-2xl p-4">
      {ruleBlockModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] p-4 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-red-700">İşlem Engellendi</h3>
            <p className="text-sm text-neutral-700">{ruleBlockModalMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setRuleBlockModalMessage(null)}
                className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold">
              {cancelModal.mode === "REFUND" ? "Ürün İadesi" : "Ürün İptali"}
            </h3>
            <div className="mb-3 space-y-1 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <p>
                Sipariş: <span className="font-semibold">#{cancelModal.orderId}</span> • Masa{" "}
                <span className="font-semibold">{cancelModal.tableNo}</span>
              </p>
              <p>
                Ürün: <span className="font-semibold">{cancelModal.productName}</span>
              </p>
              <p>
                Birim Fiyat: <span className="font-semibold">{formatCurrency(cancelModal.unitPrice)}</span>
              </p>
              <p>
                Sipariş Toplamı: <span className="font-semibold">{formatCurrency(cancelModal.orderTotal)}</span>
              </p>
              <p>Ödeme Yöntemi (mevcut): {cancelModal.paymentMethodLabel}</p>
              <p>Ödeme Durumu: {cancelModal.paymentStateLabel}</p>
            </div>
            <div className="space-y-2.5">
              <label className="block text-xs font-medium">İşlem Türü</label>
              <input
                type="text"
                value={cancelModal.mode === "REFUND" ? "İade" : "İptal"}
                readOnly
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
              />

              <label className="block text-xs font-medium">Ödeme Yöntemi</label>
              <select
                value={cancelPaymentMethod}
                onChange={(e) => setCancelPaymentMethod(e.target.value as CancelPaymentMethod)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                {CANCEL_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-medium">
                {cancelModal.mode === "REFUND" ? "İade nedeni (zorunlu)" : "İptal nedeni (zorunlu)"}
              </label>
              <select
                value={cancelReason}
                onChange={(e) =>
                  setCancelReason(e.target.value as (typeof CANCELLATION_REASONS)[number]["value"])
                }
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {cancelReason === "OTHER" && (
                <>
                  <label className="block text-xs font-medium">Açıklama (zorunlu)</label>
                  <textarea
                    value={cancelCustomReason}
                    onChange={(e) => setCancelCustomReason(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Nedeni yazın"
                  />
                </>
              )}
              <label className="block text-xs font-medium">
                {cancelModal.mode === "REFUND" ? "İade adedi" : "İptal adedi"}
              </label>
              <input
                type="number"
                min={1}
                max={cancelModal.maxQty}
                value={cancelQty}
                onChange={(e) => {
                  const nextValue = parseInt(e.target.value, 10) || 1;
                  setCancelQty(Math.max(1, Math.min(cancelModal.maxQty, nextValue)));
                }}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-neutral-500">
                Kalan işlenebilir adet: {cancelModal.maxQty}
              </p>

              <label className="block text-xs font-medium">İade Edilen Tutar</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                disabled={cancelModal.mode !== "REFUND"}
                placeholder={
                  cancelModal.mode === "REFUND"
                    ? `Örn: ${cancelModal.maxRefundAmount.toFixed(2)}`
                    : "İptal işleminde finansal iade yok"
                }
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
              />
              {cancelModal.mode === "REFUND" ? (
                <p className="text-[11px] text-neutral-500">
                  Üst limit: {formatCurrency(cancelModal.maxRefundAmount)}
                </p>
              ) : (
                <p className="text-[11px] text-amber-700">Bu işlem cirodan düşülmez.</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                disabled={isProcessing}
                className="rounded-xl border px-3 py-1.5 text-sm"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCancelItem();
                }}
                disabled={isProcessing}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
              >
                {cancelModal.mode === "REFUND" ? "İade Et" : "İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cashAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] p-4 shadow-xl">
            <h3 className="mb-3 text-base font-semibold text-neutral-900">Kısmi İptal / İade</h3>
            <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <p className="font-semibold text-neutral-900">Urun kalemi secin</p>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {cashAdjustmentModal.selectableItems.map((line) => {
                  const isSelected = line.lineKey === cashAdjustmentModal.selectedLineKey;
                  const lineEffect = line.effectiveQuantity * line.unitPrice;
                  return (
                    <button
                      key={line.lineKey}
                      type="button"
                      onClick={() => {
                        setCashAdjustmentModal((prev) =>
                          prev
                            ? { ...prev, selectedLineKey: line.lineKey }
                            : prev,
                        );
                        setCashAdjustmentQty((prevQty) =>
                          Math.min(prevQty, line.effectiveQuantity),
                        );
                      }}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                        isSelected
                          ? "border-[color:var(--ui-success-border)] bg-[color:var(--ui-surface-subtle)]"
                          : "border-neutral-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-neutral-900">{line.productName}</span>
                        <span className="text-[11px] text-neutral-500">
                          {formatCurrency(line.unitPrice)} / birim
                        </span>
                      </div>
                      <p className="mt-1 text-[11px]">
                        Orijinal {line.orderedQuantity} • Onceki iptal {line.cancelledQuantity} •
                        Onceki adjustment {line.adjustedQuantity} • Kalan {line.effectiveQuantity}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-neutral-800">
                        Satir etkisi: {formatCurrency(lineEffect)}
                      </p>
                    </button>
                  );
                })}
              </div>
              {selectedCashAdjustmentLine && (
                <p className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700">
                  Secili kalem: {selectedCashAdjustmentLine.productName} • Kalan efektif adet{" "}
                  {selectedCashAdjustmentLine.effectiveQuantity}
                </p>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-neutral-700">Islem tipi</label>
              <select
                value={cashAdjustmentType}
                onChange={(event) =>
                  setCashAdjustmentType(
                    event.target.value as "PARTIAL_CANCEL" | "PARTIAL_RETURN",
                  )
                }
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="PARTIAL_CANCEL">Kısmi İptal</option>
                <option value="PARTIAL_RETURN">Kısmi Iade</option>
              </select>

              <label className="block text-xs font-medium text-neutral-700">Bu islemde dusulecek adet</label>
              <input
                type="number"
                min={1}
                max={selectedCashAdjustmentLine?.effectiveQuantity ?? 1}
                value={cashAdjustmentQty}
                onChange={(event) => setCashAdjustmentQty(parseInt(event.target.value, 10) || 1)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                disabled={!selectedCashAdjustmentLine}
              />
              {selectedCashAdjustmentLine && (
                <p className="text-[11px] text-neutral-500">
                  Bu islem tutar etkisi:{" "}
                  {formatCurrency(cashAdjustmentQty * selectedCashAdjustmentLine.unitPrice)}
                </p>
              )}

              <label className="block text-xs font-medium text-neutral-700">Neden</label>
              <input
                type="text"
                value={cashAdjustmentReason}
                onChange={(event) => setCashAdjustmentReason(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Orn: Müşteri vazgecti"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setCashAdjustmentModal(null)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
              >
                Vazgec
              </button>
              <button
                type="button"
                disabled={isProcessing || !selectedCashAdjustmentLine}
                onClick={() => {
                  void handleCashAdjustment();
                }}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingApprovalOrders.length > 0 && (
        <div>
          <h2 className="waiter-section-title mb-4 text-lg font-semibold">
            Onay Bekleyen Siparişler
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingApprovalOrders.map((order) => {
              const orderUi = orderUiStateMap.get(order.id);
              const hasVisibleItems = order.items.some((item) => {
                const effective = getEffectiveOrderItemQuantity({
                  orderId: order.id,
                  productId: item.productId,
                  originalQuantity: item.quantity,
                  cancellationMap,
                  cashAdjustmentMap,
                });
                return effective > 0;
              });
              if (!hasVisibleItems) return null;

              return (
                <div
                  key={order.id}
                  className="waiter-card flex flex-col rounded-2xl border-amber-300"
                >
                <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-neutral-900">
                      Masa {order.table.tableNo}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500 px-1.5 py-0.5 bg-neutral-100 rounded">
                      #{order.id}
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    Garson Onayı Bekliyor
                  </span>
                </div>

                <div className="flex-1 px-4 py-3">
                  <ul className="space-y-2 text-sm">
                    {order.items.map((item, idx) => {
                      const effective = getEffectiveOrderItemQuantity({
                        orderId: order.id,
                        productId: item.productId,
                        originalQuantity: item.quantity,
                        cancellationMap,
                        cashAdjustmentMap,
                      });
                      if (effective <= 0) return null;
                      return (
                        <li
                          key={idx}
                          className="flex items-start justify-between border-b border-dashed border-neutral-100 pb-1 last:border-0 last:pb-0"
                        >
                          <div className="flex max-w-[80%] items-start">
                            <span className="mr-2 min-w-[1.5rem] font-bold text-neutral-900">
                              {effective}x
                              {effective < item.quantity && (
                                <span className="ml-1 text-xs text-red-600">
                                  ({item.quantity - effective} iptal)
                                </span>
                              )}
                            </span>
                            <span className="leading-snug text-neutral-800">
                              {item.productName}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              if (isCashAdjustmentEligibleOrder(order)) {
                                openCashAdjustmentModal({ order, item });
                                return;
                              }
                              handleCancelOrRefundClick({
                                order,
                                item,
                                effectiveQuantity: effective,
                              });
                            }}
                            className="rounded border border-red-200 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            {isCashAdjustmentEligibleOrder(order)
                              ? "Kısmi İptal / İade"
                              : orderUi?.visibleActions.includes("refund")
                                ? "İade Et"
                                : "İptal Et"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-auto border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-neutral-500">
                      {formatTime(order.createdAt)}
                    </span>
                    <span className="text-lg font-bold text-neutral-900">
                      {formatCurrency(order.totalPrice)}
                    </span>
                  </div>
                  <p className="mb-1 text-xs text-neutral-500">
                    Sipariş Durumu: {orderUi?.orderStatusLabel ?? "-"}
                  </p>
                  <p className="mb-1 text-xs text-neutral-500">
                    Hesap Durumu: {orderUi?.accountStatusLabel ?? "-"}
                  </p>
                  <p className="mb-1 text-xs text-neutral-500">
                    Odeme Modeli: {orderUi?.paymentMethodLabel ?? "-"}
                  </p>
                  <p className="mb-2 text-xs text-neutral-500">
                    Odeme Durumu: {orderUi?.paymentStatusLabel ?? "-"}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleStatusChange(order.id, "REJECTED")}
                      className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Reddet
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleStatusChange(order.id, "PENDING")}
                      className="rounded-xl bg-[color:var(--ui-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[color:var(--ui-primary-hover)] disabled:opacity-60"
                    >
                      Onayla
                    </button>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeOrders.length > 0 && (
        <div>
          <h2 className="waiter-section-title mb-3 text-base font-semibold">
            Aktif Siparişler
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeOrders.map((order) => {
              const orderUi = orderUiStateMap.get(order.id);
              return (
                <div
                  key={order.id}
                  className="waiter-card flex flex-col rounded-2xl px-3 py-3 text-sm"
                >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500">Masa</p>
                    <p className="text-base font-bold text-neutral-900">
                      {order.table.tableNo}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400">#{order.id}</span>
                </div>
                <p className="mb-2 text-xs text-neutral-500">
                  {formatTime(order.createdAt)}
                </p>
                {order.preparingStartedAt && (
                  <p className="mb-2 text-xs text-neutral-500">
                    Hazırlanmaya başladı: {formatTime(order.preparingStartedAt)} •{" "}
                    {getPreparingDurationMinutes(order.preparingStartedAt, nowMs) ?? 0} dkdır hazırlanıyor
                  </p>
                )}
                <ul className="mb-2 space-y-1">
                  {order.items.map((item, idx) => {
                    const effective = getEffectiveOrderItemQuantity({
                      orderId: order.id,
                      productId: item.productId,
                      originalQuantity: item.quantity,
                      cancellationMap,
                      cashAdjustmentMap,
                    });
                    if (effective <= 0) return null;
                    return (
                      <li key={idx} className="flex justify-between text-xs">
                        <span>
                          {effective}x {item.productName}
                          {effective < item.quantity && (
                            <span className="text-red-600"> ({item.quantity - effective} iptal)</span>
                          )}
                        </span>
                        {order.status === "PENDING" ? (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              if (isCashAdjustmentEligibleOrder(order)) {
                                openCashAdjustmentModal({ order, item });
                                return;
                              }
                              handleCancelOrRefundClick({
                                order,
                                item,
                                effectiveQuantity: effective,
                              });
                            }}
                            className="rounded border border-red-200 px-1 text-red-600 hover:bg-red-50"
                          >
                            {isCashAdjustmentEligibleOrder(order)
                              ? "Kısmi İptal / İade"
                              : orderUi?.visibleActions.includes("refund")
                                ? "İade Et"
                                : "İptal Et"}
                          </button>
                        ) : (
                          <span className="rounded border border-neutral-200 px-1 text-[10px] text-neutral-500">
                            İptal kapalı
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mb-1 text-xs text-neutral-600">
                  <span className="font-semibold">
                    {formatCurrency(order.totalPrice)}
                  </span>
                </p>
                <p className="mb-1 text-xs text-neutral-500">
                  Sipariş Durumu: {orderUi?.orderStatusLabel ?? "-"}
                </p>
                <p className="mb-1 text-xs text-neutral-500">
                  Hesap Durumu: {orderUi?.accountStatusLabel ?? "-"}
                </p>
                <p className="mb-1 text-xs text-neutral-500">
                  Odeme Durumu: {orderUi?.paymentStatusLabel ?? "-"}
                </p>
                <p className="mb-1 text-xs text-neutral-500">
                  Odeme Modeli: {orderUi?.paymentMethodLabel ?? "-"}
                </p>
                <span className="mt-auto inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  {orderUi?.orderStatusLabel ?? "-"}
                </span>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {completedOrders.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Son Tamamlananlar
          </h2>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {completedOrders.slice(0, 8).map((order) => {
              const orderUi = orderUiStateMap.get(order.id);
              const matrix = resolveOrderMatrix(order);
              const delivered = Boolean(order.deliveredAt);
              const cashAdjustmentEligible =
                isCashAdjustmentEligibleOrder(order) && !delivered;
              const hasRefundAction = orderUi?.visibleActions.includes("refund") ?? false;
              const hasCancelAction = orderUi?.visibleActions.includes("cancel") ?? false;
              const hasAnyAction = hasRefundAction || hasCancelAction || cashAdjustmentEligible;

              return (
                <div
                  key={order.id}
                  className="waiter-card waiter-card-muted flex flex-col rounded-2xl px-3 py-3 text-xs"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold">
                      Masa {order.table.tableNo}
                    </span>
                    <span className="text-neutral-500">#{order.id}</span>
                  </div>
                  <p className="mb-1">
                    {order.items.length} ürün •{" "}
                    <span className="font-semibold">
                      {formatCurrency(order.totalPrice)}
                    </span>
                  </p>
                  <p className="mb-1 text-[11px] text-neutral-600">
                    Sipariş Durumu: {orderUi?.orderStatusLabel ?? "-"}
                  </p>
                  <p className="mb-1 text-[11px] text-neutral-600">
                    Hesap Durumu: {orderUi?.accountStatusLabel ?? "-"}
                  </p>
                  <p className="mb-1 text-[11px] text-neutral-600">
                    Odeme Durumu: {orderUi?.paymentStatusLabel ?? "-"}
                  </p>
                  <p className="mb-1 text-[11px] text-neutral-600">
                    Odeme Modeli: {orderUi?.paymentMethodLabel ?? "-"}
                  </p>
                  <ul className="mb-2 space-y-1">
                    {order.items.map((item, idx) => {
                      const effective = getEffectiveOrderItemQuantity({
                        orderId: order.id,
                        productId: item.productId,
                        originalQuantity: item.quantity,
                        cancellationMap,
                        cashAdjustmentMap,
                      });
                      if (effective <= 0) return null;

                      return (
                        <li key={idx} className="flex items-center justify-between gap-2">
                          <span className="text-neutral-700">
                            {effective}x {item.productName}
                          </span>
                          {hasAnyAction ? (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => {
                                if (cashAdjustmentEligible) {
                                  openCashAdjustmentModal({ order, item });
                                  return;
                                }
                                handleCancelOrRefundClick({
                                  order,
                                  item,
                                  effectiveQuantity: effective,
                                });
                              }}
                              className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              {cashAdjustmentEligible
                                ? "Kısmi İptal / İade"
                                : hasRefundAction
                                  ? "İade Et"
                                  : hasCancelAction
                                    ? "İptal Et"
                                    : "Aksiyon Yok"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setRuleBlockModalMessage(
                                  matrix.blockMessage ??
                                    "SİPARİŞ HAZIRLANIYOR AŞAMASINDA OLDUĞU İÇİN İPTAL VEYA İADE EDİLEMEZ",
                                )
                              }
                              className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500"
                            >
                              Teslim bekliyor
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <span className="waiter-status-chip-success mt-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    <Check className="mr-1 h-3 w-3" />
                    Tamamlandı
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rejectedOrders.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Reddedilen / İptal Edilenler
          </h2>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {rejectedOrders.slice(0, 8).map((order) => (
              <div
                key={order.id}
                className="waiter-card waiter-card-muted flex flex-col rounded-2xl border-[color:var(--ui-danger-border)] px-3 py-3 text-xs"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">
                    Masa {order.table.tableNo}
                  </span>
                  <span className="text-neutral-500">#{order.id}</span>
                </div>
                <p className="mb-1">
                  {order.items.length} ürün •{" "}
                  <span className="font-semibold">
                    {formatCurrency(order.totalPrice)}
                  </span>
                </p>
                <span className="mt-auto inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  Reddedildi
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}



