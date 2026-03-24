import { Prisma } from "@prisma/client";
import type {
  OrderPaymentStatus,
  PaymentGatewayProvider,
  PaymentMethod,
} from "@prisma/client";

export const STAFF_VISIBLE_ORDER_FILTER: Prisma.OrderWhereInput = {
  OR: [
    { requestedPaymentMethod: null },
    { requestedPaymentMethod: { not: "CREDIT_CARD" } },
    { requestedPaymentMethod: "CREDIT_CARD", paymentStatus: "PAID" },
    {
      requestedPaymentMethod: "CREDIT_CARD",
      paymentStatus: null,
      OR: [{ paymentProvider: null }, { paymentProvider: { not: "IYZICO" } }],
    },
  ],
};

export function isOrderAwaitingOnlinePayment(order: {
  requestedPaymentMethod: PaymentMethod | null;
  paymentStatus: OrderPaymentStatus | null;
  paymentProvider?: PaymentGatewayProvider | null;
}): boolean {
  if (order.requestedPaymentMethod !== "CREDIT_CARD") return false;

  const onlineProvider =
    order.paymentProvider === "IYZICO" ||
    (order.paymentProvider == null && order.paymentStatus !== null);

  return onlineProvider && order.paymentStatus !== "PAID";
}

export function isOrderPaidViaIyzico(order: {
  requestedPaymentMethod: PaymentMethod | null;
  paymentStatus: OrderPaymentStatus | null;
  paymentProvider?: PaymentGatewayProvider | null;
}): boolean {
  if (order.requestedPaymentMethod !== "CREDIT_CARD") return false;
  if (order.paymentStatus !== "PAID") return false;
  return order.paymentProvider === "IYZICO" || order.paymentProvider == null;
}

export function isOrderMarkedPaid(order: {
  paymentStatus: OrderPaymentStatus | null;
  paymentSettled?: boolean | null;
}): boolean {
  return order.paymentStatus === "PAID" || order.paymentSettled === true;
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function resolvePaymentSettledState(order: {
  paymentStatus: OrderPaymentStatus | null;
  deliveredAt?: Date | null;
  totalUnpaid?: number | null;
  totalPaid?: number | null;
  totalFromOrders?: number | null;
}): boolean {
  if (order.paymentStatus === "PAID") return true;
  if (!order.deliveredAt) return false;

  const totalUnpaid = toFiniteNumber(order.totalUnpaid);
  const totalPaid = toFiniteNumber(order.totalPaid);
  const totalFromOrders = toFiniteNumber(order.totalFromOrders);

  if (totalUnpaid == null || totalPaid == null || totalFromOrders == null) return false;
  if (totalUnpaid > 0) return false;
  if (totalPaid <= 0) return false;
  if (totalFromOrders < 0) return false;
  return true;
}

export function getOrderPaymentMethodLabel(order: {
  requestedPaymentMethod: PaymentMethod | null;
  paymentProvider?: PaymentGatewayProvider | null;
}): string {
  if (order.paymentProvider === "IYZICO") return "Online (Iyzico)";

  switch (order.requestedPaymentMethod) {
    case "CASH":
      return "Nakit";
    case "CREDIT_CARD":
      return "Kredi Karti";
    case "SODEXO":
      return "Sodexo";
    case "MULTINET":
      return "Multinet";
    case "TICKET":
      return "Ticket";
    case "METROPOL":
      return "Metropol";
    default:
      return "Sonra Ode";
  }
}

export function getOrderPaymentStateLabel(order: {
  paymentStatus: OrderPaymentStatus | null;
  paymentSettled?: boolean | null;
  refundStatus?: "NONE" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED" | null;
}): string {
  if (order.refundStatus === "REFUNDED") return "Iade Edildi";
  if (order.paymentStatus === "PAID" || order.paymentSettled === true) return "Odendi";
  if (order.paymentStatus === "INITIATED") return "Kısmi Odendi";
  if (order.paymentStatus === "FAILED" || order.paymentStatus === "PENDING") return "Odenmedi";
  return "Bilinmiyor";
}

export function getOrderStatusLabel(order: {
  status:
    | "PENDING_WAITER_APPROVAL"
    | "PENDING"
    | "PREPARING"
    | "COMPLETED"
    | "REJECTED";
  readyAt?: Date | null;
  deliveredAt?: Date | null;
  refundStatus?: "NONE" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED" | null;
}): string {
  if (order.refundStatus === "REFUNDED") return "Iade";
  if (order.status === "REJECTED") return "İptal";
  if (order.status === "PENDING_WAITER_APPROVAL" || order.status === "PENDING") return "Yeni";
  if (order.status === "PREPARING") return "Hazırlaniyor";
  if (order.status === "COMPLETED" && order.deliveredAt) return "Teslim Edildi";
  if (order.status === "COMPLETED" && order.readyAt) return "Hazır";
  return "Hazır";
}

export function getAccountStatusLabel(order: {
  paymentSettled?: boolean | null;
}): string {
  return order.paymentSettled === true ? "Kapatildi" : "Acik";
}

type OrderCancellationMatrixInput = {
  status:
    | "PENDING_WAITER_APPROVAL"
    | "PENDING"
    | "PREPARING"
    | "COMPLETED"
    | "REJECTED";
  deliveredAt?: Date | null;
  paymentStatus: OrderPaymentStatus | null;
  paymentSettled?: boolean | null;
};

export type OrderCancellationMatrixResult = {
  canCancel: boolean;
  canRefund: boolean;
  blockMessage: string | null;
  paid: boolean;
  delivered: boolean;
};

const PREPARING_BLOCK_MESSAGE =
  "SIPARIS HAZIRLANIYOR ASAMASINDA OLDUGU ICIN IPTAL VEYA IADE EDILEMEZ";

export function getOrderCancellationMatrix(
  order: OrderCancellationMatrixInput,
): OrderCancellationMatrixResult {
  const paid = isOrderMarkedPaid({
    paymentStatus: order.paymentStatus,
    paymentSettled: order.paymentSettled ?? null,
  });
  const delivered = Boolean(order.deliveredAt);

  if (paid && delivered) {
    return { canCancel: false, canRefund: true, blockMessage: null, paid, delivered };
  }

  if (paid && !delivered) {
    return {
      canCancel: false,
      canRefund: false,
      blockMessage: PREPARING_BLOCK_MESSAGE,
      paid,
      delivered,
    };
  }

  if (!paid && delivered) {
    return { canCancel: true, canRefund: false, blockMessage: null, paid, delivered };
  }

  if (order.status === "PENDING_WAITER_APPROVAL" || order.status === "PENDING") {
    return { canCancel: true, canRefund: false, blockMessage: null, paid, delivered };
  }

  if (order.status === "PREPARING" || order.status === "COMPLETED") {
    return {
      canCancel: false,
      canRefund: false,
      blockMessage: PREPARING_BLOCK_MESSAGE,
      paid,
      delivered,
    };
  }

  return {
    canCancel: false,
    canRefund: false,
    blockMessage: "Bu sipariş icin islem yapilamaz.",
    paid,
    delivered,
  };
}

export function getVisibleOrderActions(
  order: OrderCancellationMatrixInput,
): Array<"cancel" | "refund"> {
  const matrix = getOrderCancellationMatrix(order);
  const visibleActions: Array<"cancel" | "refund"> = [];
  if (matrix.canCancel) visibleActions.push("cancel");
  if (matrix.canRefund) visibleActions.push("refund");
  return visibleActions;
}

